"""Deck import parsing seam.

Pure parsers turn an uploaded file into (front, back) card pairs. `parse_delimited`
handles csv/txt with a chosen separator; `parse_apkg` reads Anki's `.apkg`
(a zip around a SQLite `collection.anki2`). No I/O beyond the given bytes/text,
so both are directly unit-testable.
"""

from __future__ import annotations


def parse_delimited(text: str, delimiter: str) -> list[tuple[str, str]]:
    """Parse delimited text into (front, back) pairs.

    One card per non-empty line. The first field is the front, the second the
    back; extra fields are ignored. Lines without the delimiter are skipped.
    """
    pairs: list[tuple[str, str]] = []
    for line in text.splitlines():
        if not line.strip() or delimiter not in line:
            continue
        cols = line.split(delimiter)
        front, back = cols[0].strip(), cols[1].strip()
        pairs.append((front, back))
    return pairs


def parse_apkg(raw: bytes) -> list[tuple[str, str]]:
    """Parse an Anki `.apkg` into (front, back) HTML pairs.

    Handles both the legacy SQLite collection (`collection.anki2` /
    `collection.anki21`) and the modern zstd-compressed collection
    (`collection.anki21b`) that current Anki versions export by default. Each
    note's fields are stored in `notes.flds` joined by the 0x1f unit separator;
    we take the first two fields as front/back. Media is ignored here.
    """
    import io
    import sqlite3
    import tempfile
    import zipfile

    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        names = set(zf.namelist())
        if "collection.anki21b" in names:
            # Modern format: zstd-compressed SQLite.
            try:
                import zstandard as zstd
            except ModuleNotFoundError as exc:  # pragma: no cover
                raise ValueError(
                    "This .apkg uses the newest Anki format. Server is missing zstd support."
                ) from exc
            comp = zf.read("collection.anki21b")
            try:
                db_bytes = zstd.ZstdDecompressor().decompress(comp)
            except zstd.ZstdError:
                db_bytes = zstd.ZstdDecompressor().stream_reader(io.BytesIO(comp)).read()
        else:
            db_name = next((n for n in ("collection.anki21", "collection.anki2") if n in names), None)
            if db_name is None:
                raise ValueError("Unsupported Anki package: no collection database found.")
            db_bytes = zf.read(db_name)

    pairs: list[tuple[str, str]] = []
    with tempfile.NamedTemporaryFile(suffix=".anki2", delete=True) as tmp:
        tmp.write(db_bytes)
        tmp.flush()
        con = sqlite3.connect(tmp.name)
        try:
            rows = con.execute("SELECT flds FROM notes").fetchall()
        finally:
            con.close()

    for (flds,) in rows:
        fields = (flds or "").split("\x1f")
        if len(fields) < 2:
            continue
        front, back = fields[0].strip(), fields[1].strip()
        if front or back:
            pairs.append((front, back))
    return pairs


def parse_apkg_media(raw: bytes) -> dict[str, bytes]:
    """Return ``{original_filename: bytes}`` for media bundled in an ``.apkg``.

    Anki packs a ``media`` file: a JSON object mapping each numbered zip entry
    (``"0"``, ``"1"``, …) to its real filename (e.g. ``"diagram.png"``). The raw
    bytes live in those numbered entries. Card HTML references images by the
    real filename, so callers use this map to re-host the images and rewrite the
    ``src`` attributes. Returns ``{}`` when there is no media or the map can't be
    read (best-effort — import still works without images).
    """
    import io
    import json
    import zipfile

    out: dict[str, bytes] = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        names = set(zf.namelist())
        if "media" not in names:
            return out
        try:
            mapping = json.loads(zf.read("media").decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return out  # modern/binary media manifest — skip (no images imported)
        if not isinstance(mapping, dict):
            return out
        for entry, filename in mapping.items():
            if isinstance(filename, str) and entry in names:
                try:
                    out[filename] = zf.read(entry)
                except KeyError:
                    continue
    return out
