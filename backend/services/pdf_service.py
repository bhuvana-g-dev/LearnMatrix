"""
services/pdf_service.py

Builds a downloadable .pdf "Study Summary" — same LearnMatrix
navy/gold branded design as services/ppt_service.py's slide deck
(colored title page, numbered section pages with an accent bar and
badge, colored bullet markers for Key Takeaways), but as PDF pages
instead of pptx slides.

Deliberately does NOT convert the generated .pptx to PDF (e.g. via a
LibreOffice `soffice --headless` shell-out): that would require
LibreOffice installed on the server, which isn't guaranteed for this
deployment (runtime.txt points at a plain Heroku-style Python
buildpack, no system packages). Building the PDF directly with
reportlab (a pure-Python library, already just needs adding to
requirements.txt) works the same way everywhere the app runs.

Mirrors ppt_service.py's four entry points and reuses its
build_deck_sections() so the two file formats are generated from the
exact same {title, summary, sections, keyTakeaways} shape and never
drift apart in content — only in the file format they end up in.
"""

from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

from firebase.firebase_config import get_firestore_client
from services import chat_repository, embedding_service, notes_repository
from services.ppt_service import build_deck_sections, PptServiceError, _safe_filename

# --- LearnMatrix brand palette (mirrors frontend/src/constants/theme.js) ---
NAVY = HexColor("#0D1B3D")
NAVY_MID = HexColor("#3E4A66")
GOLD = HexColor("#D4A017")
GOLD_LIGHT = HexColor("#E8B93D")
CREAM = HexColor("#FBF3E1")
WHITE = HexColor("#FFFFFF")

PAGE_W, PAGE_H = 13.333 * inch, 7.5 * inch
ACCENT_CYCLE = [GOLD, NAVY, GOLD_LIGHT]

PdfServiceError = PptServiceError  # same precondition errors as the pptx service


def generate_study_summary_pdf(skill: str, topic: str, focus_band: str) -> tuple[BytesIO, str]:
    db = get_firestore_client()
    notes = notes_repository.get_cached_notes(db, skill, topic, focus_band)
    if not notes:
        raise PdfServiceError(
            f"No study notes found yet for '{skill} / {topic}' ({focus_band}). "
            "Open that topic in the Learning Hub first so notes are generated."
        )
    safe_topic = _safe_filename(topic)
    return _build_pdf_from_notes(notes, subtitle=f"{focus_band.title()} level"), f"{safe_topic}_study_summary.pdf"


def generate_sources_summary_pdf(uid: str) -> tuple[BytesIO, str]:
    db = get_firestore_client()
    sources_content = embedding_service.get_sources_with_text(db, uid)
    if not sources_content:
        raise PdfServiceError("No sources found yet — upload a source first.")
    notes = {
        "title": "Your Sources",
        "summary": "",
        "sections": [{"heading": s["title"], "content": s["text"]} for s in sources_content],
        "keyTakeaways": [],
    }
    return _build_pdf_from_notes(notes, subtitle="Study Summary from Sources"), "sources_study_summary.pdf"


def generate_chat_summary_pdf(uid: str, session_id: str) -> tuple[BytesIO, str]:
    if not session_id:
        raise PdfServiceError("No chat conversation selected — open or start a chat first.")
    db = get_firestore_client()
    history = chat_repository.get_session_messages(db, uid, session_id, limit=0)
    if not history:
        raise PdfServiceError("That conversation has no messages yet — ask the AI Study Assistant something first.")

    sections = []
    for i, turn in enumerate(history):
        if turn.get("role") == "user":
            answer = history[i + 1].get("content", "") if i + 1 < len(history) and history[i + 1].get("role") == "assistant" else ""
            sections.append({"heading": turn.get("content", "")[:60], "content": answer})

    notes = {"title": "Your Chat", "summary": "", "sections": sections, "keyTakeaways": []}
    return _build_pdf_from_notes(notes, subtitle="Study Summary from AI Chat"), "chat_study_summary.pdf"


def generate_custom_text_pdf(text: str) -> tuple[BytesIO, str]:
    """AI-expands the student's short prompt/notes into a full deck —
    see ppt_service.py's generate_custom_text_pptx for why (same
    SlideDeckAgent call, so the pptx and pdf downloads of a typed
    prompt always contain the same generated content)."""
    if not text or not text.strip():
        raise PdfServiceError("Type something first.")
    from services.slide_deck_service import generate_deck_content, SlideDeckServiceError

    try:
        notes = generate_deck_content(text.strip())
    except SlideDeckServiceError as exc:
        raise PdfServiceError(str(exc)) from exc
    return build_pdf_from_deck_content(notes, subtitle="Study Summary"), f"{_safe_filename(notes.get('title') or 'custom')}_study_summary.pdf"


# ---------------------------------------------------------------------------
# Page assembly
# ---------------------------------------------------------------------------

def _build_pdf_from_notes(notes: dict, subtitle: str) -> BytesIO:
    return build_pdf_from_deck_content(notes, subtitle)


def build_pdf_from_deck_content(notes: dict, subtitle: str) -> BytesIO:
    """Public entry point — same "from-content" purpose as
    ppt_service.py's build_pptx_from_deck_content."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    _draw_title_page(c, notes.get("title") or "Study Summary", subtitle)

    deck_sections = build_deck_sections(notes)
    for i, slide_data in enumerate(deck_sections):
        c.showPage()
        accent = ACCENT_CYCLE[i % len(ACCENT_CYCLE)]
        kind = slide_data["kind"]
        if kind == "bullets":
            _draw_bullet_page(c, slide_data["heading"], slide_data["items"], i + 1, accent)
        elif kind == "list":
            _draw_list_page(c, slide_data["heading"], slide_data["items"], i + 1, accent)
        elif kind == "comparison":
            _draw_comparison_page(c, slide_data["heading"], slide_data["left"], slide_data["right"], i + 1)
        else:
            _draw_text_page(c, slide_data["heading"], slide_data["body"], i + 1, accent)

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


# ---------------------------------------------------------------------------
# Page drawing helpers — hand-drawn with reportlab's canvas so the design
# (colored backgrounds, accent bars, numbered badges, bullet markers)
# matches ppt_service.py's slide layout page-for-page.
# ---------------------------------------------------------------------------

def _wrap_text(text: str, font: str, size: float, max_width: float) -> list[str]:
    words = text.split()
    lines, current = [], ""
    for w in words:
        trial = f"{current} {w}".strip()
        if stringWidth(trial, font, size) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def _draw_title_page(c: canvas.Canvas, title: str, subtitle: str) -> None:
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Decorative gold circles bleeding off the right edge — stands in for
    # photography since no image-search/stock-photo API is configured in
    # this backend (see services/ppt_service.py's module docstring).
    c.saveState()
    c.setFillColor(GOLD)
    c.setFillAlpha(0.75)
    c.circle(PAGE_W - 2.8 * inch, PAGE_H - 0.5 * inch, 3.5 * inch, fill=1, stroke=0)
    c.setFillColor(GOLD_LIGHT)
    c.setFillAlpha(0.55)
    c.circle(PAGE_W - 1.0 * inch, 1.0 * inch, 1.7 * inch, fill=1, stroke=0)
    c.restoreState()

    c.setFillColor(GOLD)
    c.rect(0.7 * inch, PAGE_H - 2.3 * inch, 1.1 * inch, 4, fill=1, stroke=0)

    c.setFillColor(GOLD_LIGHT)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(0.7 * inch, PAGE_H - 1.85 * inch, "LEARNMATRIX")

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 34)
    title_lines = _wrap_text(title, "Helvetica-Bold", 34, 9.2 * inch)
    y = PAGE_H - 2.85 * inch
    for line in title_lines[:3]:
        c.drawString(0.65 * inch, y, line)
        y -= 0.55 * inch

    c.setFillColor(CREAM)
    c.setFont("Helvetica", 16)
    c.drawString(0.7 * inch, y - 0.35 * inch, subtitle)


def _draw_chrome(c: canvas.Canvas, heading: str, index: int, accent) -> None:
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    c.setFillColor(accent)
    c.rect(0, 0, 0.35 * inch, PAGE_H, fill=1, stroke=0)

    badge_cx, badge_cy = 1.02 * inch, PAGE_H - 0.85 * inch
    c.setFillColor(accent)
    c.circle(badge_cx, badge_cy, 0.28 * inch, fill=1, stroke=0)
    c.setFillColor(WHITE if accent != GOLD_LIGHT else NAVY)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(badge_cx, badge_cy - 5, str(index))

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(1.55 * inch, PAGE_H - 0.95 * inch, heading)

    c.setFillColor(accent)
    c.rect(1.55 * inch, PAGE_H - 1.35 * inch, 1.4 * inch, 3, fill=1, stroke=0)


def _draw_text_page(c: canvas.Canvas, heading: str, body: str, index: int, accent) -> None:
    _draw_chrome(c, heading, index, accent)

    c.setFillColor(NAVY_MID)
    c.setFont("Helvetica", 14)

    sentences = [s.strip() for s in body.replace("\n", " ").split(". ") if s.strip()]
    if not sentences:
        sentences = [body[:2000]]

    y = PAGE_H - 1.9 * inch
    max_width = 11.1 * inch
    for sentence in sentences[:20]:
        text = sentence + ("." if not sentence.endswith(".") else "")
        for line in _wrap_text(text, "Helvetica", 14, max_width):
            if y < 0.6 * inch:
                return  # page is full — matches the pptx cap of ~20 sentences/slide
            c.drawString(1.55 * inch, y, line)
            y -= 0.28 * inch
        y -= 0.16 * inch  # extra gap between sentences/paragraphs


def _draw_bullet_page(c: canvas.Canvas, heading: str, bullets: list[str], index: int, accent) -> None:
    """Key Takeaways — soft-tinted rounded cards with a checkmark badge,
    matching ppt_service.py's _add_bullet_slide."""
    _draw_chrome(c, heading, index, accent)

    y = PAGE_H - 1.85 * inch
    card_h = 0.72 * inch
    for b in bullets:
        c.setFillColor(CREAM)
        c.roundRect(1.55 * inch, y - card_h, 10.9 * inch, card_h, 8, fill=1, stroke=0)

        badge_cx, badge_cy = 1.95 * inch, y - card_h / 2
        c.setFillColor(accent)
        c.circle(badge_cx, badge_cy, 0.2 * inch, fill=1, stroke=0)
        c.setFillColor(WHITE if accent != GOLD_LIGHT else NAVY)
        c.setFont("Helvetica-Bold", 12)
        c.drawCentredString(badge_cx, badge_cy - 4, "\u2713")

        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(2.35 * inch, y - card_h / 2 - 5, b)

        y -= card_h + 0.18 * inch


def _draw_list_page(c: canvas.Canvas, heading: str, items: list[str], index: int, accent) -> None:
    """Features/steps/examples — a grid of colored icon cards, matching
    ppt_service.py's _add_list_slide."""
    _draw_chrome(c, heading, index, accent)

    cols = 2 if len(items) <= 4 else 3
    gap = 0.3 * inch
    area_left, area_top = 1.55 * inch, PAGE_H - 1.85 * inch
    area_w = PAGE_W - area_left - 0.6 * inch
    card_w = (area_w - gap * (cols - 1)) / cols
    card_h = 1.05 * inch

    for i, item in enumerate(items):
        r, col = divmod(i, cols)
        x = area_left + col * (card_w + gap)
        y_top = area_top - r * (card_h + gap)

        c.setFillColor(CREAM)
        c.setStrokeColor(accent)
        c.setLineWidth(1)
        c.roundRect(x, y_top - card_h, card_w, card_h, 10, fill=1, stroke=1)

        num_cx, num_cy = x + 0.36 * inch, y_top - 0.36 * inch
        c.setFillColor(accent)
        c.circle(num_cx, num_cy, 0.18 * inch, fill=1, stroke=0)
        c.setFillColor(WHITE if accent != GOLD_LIGHT else NAVY)
        c.setFont("Helvetica-Bold", 11)
        c.drawCentredString(num_cx, num_cy - 4, str(i + 1))

        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 12)
        text_lines = _wrap_text(item, "Helvetica-Bold", 12, card_w - 0.85 * inch)
        ty = y_top - 0.42 * inch
        for line in text_lines[:3]:
            c.drawString(x + 0.65 * inch, ty, line)
            ty -= 0.2 * inch


def _draw_comparison_page(c: canvas.Canvas, heading: str, left: dict, right: dict, index: int) -> None:
    """Pros/cons, before/after — two colored columns, matching
    ppt_service.py's _add_comparison_slide."""
    _draw_chrome(c, heading, index, GOLD)

    col_top = PAGE_H - 1.85 * inch
    col_h = 5.15 * inch
    gap = 0.35 * inch
    area_left = 1.55 * inch
    area_w = PAGE_W - area_left - 0.6 * inch
    col_w = (area_w - gap) / 2

    for panel, color, x in [(left, NAVY, area_left), (right, GOLD, area_left + col_w + gap)]:
        text_color = WHITE if color != GOLD else NAVY
        c.setFillColor(color)
        c.roundRect(x, col_top - col_h, col_w, col_h, 10, fill=1, stroke=0)

        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", 16)
        c.drawCentredString(x + col_w / 2, col_top - 0.42 * inch, panel.get("label", ""))

        item_y = col_top - 0.95 * inch
        for item in panel.get("items", []):
            c.setFillColor(text_color)
            c.circle(x + 0.42 * inch, item_y + 0.04 * inch, 0.045 * inch, fill=1, stroke=0)
            lines = _wrap_text(item, "Helvetica", 13, col_w - 0.9 * inch)
            ty = item_y
            for line in lines:
                c.drawString(x + 0.62 * inch, ty, line)
                ty -= 0.22 * inch
            item_y = ty - 0.18 * inch
