"""Card content sanitization seam.

Card front/back HTML is produced by the client's TipTap editor and must never be
trusted. `sanitize` strips everything outside a safe allow-list (XSS defense).
Small interface, all the allow-list complexity hidden inside.
"""

import nh3

_ALLOWED_TAGS = {
    "p", "br", "span", "strong", "b", "em", "i", "u", "s",
    "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre", "a", "mark",
    "sub", "sup", "img",
}
_ALLOWED_ATTRS = {
    "a": {"href", "title"},
    "span": {"class"},
    "mark": {"class"},
    # Inline images point at our storage; width allows the editor's scaling.
    "img": {"src", "alt", "width", "height"},
    # Indentation levels (up to 3) carried as a data attribute on list items / paragraphs.
    "li": {"data-indent"},
    "p": {"data-indent"},
}
# Only http(s) URLs (our Supabase Storage). No data:/javascript: schemes.
_ALLOWED_SCHEMES = {"http", "https"}


def sanitize(html: str) -> str:
    """Return XSS-safe HTML containing only allow-listed tags/attributes."""
    return nh3.clean(
        html or "",
        tags=_ALLOWED_TAGS,
        attributes=_ALLOWED_ATTRS,
        url_schemes=_ALLOWED_SCHEMES,
    )
