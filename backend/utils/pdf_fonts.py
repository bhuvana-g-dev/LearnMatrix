"""
utils/pdf_fonts.py

Registers a real, modern typeface (Poppins) with reportlab for
services/pdf_service.py's heading-weight text — titles, section
headings, badges, card labels, step numbers — instead of reportlab's
14 built-in PDF-safe fonts (Helvetica/Helvetica-Bold), which is the
single biggest thing separating the old PDF's look from a real
Gamma/Canva-style generated deck: those tools never ship a document
set in plain Helvetica.

Body copy (paragraphs, list items, key-point text) deliberately STAYS
on Helvetica — a clean geometric heading font (Poppins) paired with a
plain, highly-readable body font is a standard, deliberate pairing
(the same reasoning most real slide templates use), not a fallback.
It also avoids re-tuning every _wrap_text() call in pdf_service.py
that already measures body text against "Helvetica" specifically.

Font files live in backend/assets/fonts/ (Poppins, SIL Open Font
License, from Google Fonts) and are loaded from disk — nothing is
downloaded at runtime. If the font files are ever missing (e.g. a
stripped-down deployment), registration fails gracefully and every
constant below falls back to reportlab's built-in Helvetica-Bold, so
PDF generation never breaks over a missing/optional asset — same
"never let a design nicety break the core feature" philosophy as
services/image_service.py's stock-photo fallback.
"""

import os

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

_FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "fonts")

# Public constants — services/pdf_service.py imports and uses ONLY
# these names, never "Poppins-Bold" etc. directly, so a registration
# failure transparently swaps in Helvetica-Bold everywhere without any
# call site needing to know or care.
HEADING_BOLD = "Helvetica-Bold"
HEADING_SEMIBOLD = "Helvetica-Bold"
HEADING_MEDIUM = "Helvetica-Bold"

_FONTS_READY = False


def _register(name: str, filename: str) -> str | None:
    path = os.path.join(_FONT_DIR, filename)
    try:
        pdfmetrics.registerFont(TTFont(name, path))
        return name
    except Exception:
        return None


def ensure_fonts_registered() -> None:
    """Idempotent — safe to call on every PDF build. Registers Poppins
    once per process and rebinds the HEADING_* constants above; a
    second call is a no-op (reportlab would otherwise re-register the
    same font name harmlessly, but there's no reason to touch disk
    twice)."""
    global _FONTS_READY, HEADING_BOLD, HEADING_SEMIBOLD, HEADING_MEDIUM
    if _FONTS_READY:
        return
    _FONTS_READY = True  # set first — a failed attempt shouldn't retry on every single PDF build

    bold = _register("Poppins-Bold", "Poppins-Bold.ttf")
    semibold = _register("Poppins-SemiBold", "Poppins-SemiBold.ttf")
    medium = _register("Poppins-Medium", "Poppins-Medium.ttf")

    HEADING_BOLD = bold or "Helvetica-Bold"
    HEADING_SEMIBOLD = semibold or HEADING_BOLD
    HEADING_MEDIUM = medium or HEADING_BOLD
