"""Deck-import parser tests.

Covers delimited text and both Anki `.apkg` layouts: the legacy plain SQLite
collection and the modern zstd-compressed `collection.anki21b` that current
Anki builds export by default (the format our parser previously rejected).
"""

import io
import sqlite3
import tempfile
import zipfile

from uski.services.import_cards import parse_apkg, parse_apkg_media, parse_delimited


def _build_anki_db(pairs: list[tuple[str, str]]) -> bytes:
    """Create a minimal Anki SQLite collection whose `notes.flds` holds pairs."""
    with tempfile.NamedTemporaryFile(suffix=".anki2", delete=True) as tmp:
        con = sqlite3.connect(tmp.name)
        con.execute("CREATE TABLE notes (flds text)")
        con.executemany(
            "INSERT INTO notes (flds) VALUES (?)",
            [(f"{front}\x1f{back}",) for front, back in pairs],
        )
        con.commit()
        con.close()
        tmp.seek(0)
        return tmp.read()


def _zip_apkg(db_bytes: bytes, member_name: str) -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(member_name, db_bytes)
        zf.writestr("media", "{}")
    return out.getvalue()


class TestParseDelimited:
    def test_splits_front_and_back(self):
        assert parse_delimited("Q1;A1\nQ2;A2", ";") == [("Q1", "A1"), ("Q2", "A2")]

    def test_skips_lines_without_delimiter(self):
        assert parse_delimited("no-delimiter-here\nQ;A", ";") == [("Q", "A")]


class TestParseApkgLegacy:
    def test_reads_plain_sqlite_collection(self):
        db = _build_anki_db([("Front A", "Back A"), ("Front B", "Back B")])
        raw = _zip_apkg(db, "collection.anki2")
        assert parse_apkg(raw) == [("Front A", "Back A"), ("Front B", "Back B")]


class TestParseApkgModern:
    def test_reads_zstd_compressed_collection(self):
        import zstandard as zstd

        db = _build_anki_db([("Mitochondria", "Powerhouse of the cell")])
        compressed = zstd.ZstdCompressor().compress(db)
        raw = _zip_apkg(compressed, "collection.anki21b")
        assert parse_apkg(raw) == [("Mitochondria", "Powerhouse of the cell")]


class TestParseApkgMedia:
    def _apkg_with_media(self, media_json: str, entries: dict[str, bytes]) -> bytes:
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("collection.anki2", _build_anki_db([("q", "a")]))
            zf.writestr("media", media_json)
            for name, data in entries.items():
                zf.writestr(name, data)
        return out.getvalue()

    def test_maps_filenames_to_bytes(self):
        raw = self._apkg_with_media('{"0": "diagram.png", "1": "audio.mp3"}',
                                    {"0": b"PNGDATA", "1": b"MP3DATA"})
        media = parse_apkg_media(raw)
        assert media == {"diagram.png": b"PNGDATA", "audio.mp3": b"MP3DATA"}

    def test_missing_media_returns_empty(self):
        raw = _zip_apkg(_build_anki_db([("q", "a")]), "collection.anki2")
        assert parse_apkg_media(raw) == {}

    def test_binary_manifest_returns_empty(self):
        # Modern binary (non-JSON) media manifest must not raise.
        raw = self._apkg_with_media("\x00\x01\x02not-json", {"0": b"x"})
        assert parse_apkg_media(raw) == {}
