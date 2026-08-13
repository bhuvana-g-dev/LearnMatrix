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
        elif kind == "process":
            _draw_process_page(c, slide_data["heading"], slide_data["steps"], i + 1, accent)
        elif kind == "comparison":
            _draw_comparison_page(c, slide_data["heading"], slide_data["left"], slide_data["right"], i + 1)
        else:
            _draw_text_page(c, slide_data["heading"], slide_data["body"], i + 1, accent, slide_data.get("image_url"))

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


def _item_text_icon(item) -> tuple[str, str]:
    """Same normalization as ppt_service.py's _item_text_icon — list
    items / key takeaways are {"text","icon"} dicts, but a plain string
    (e.g. an older cached deck) is also accepted."""
    if isinstance(item, dict):
        return item.get("text", ""), item.get("icon", "check")
    return str(item), "check"


def _draw_icon(c: canvas.Canvas, icon: str, cx: float, cy: float, r: float, color, text_color) -> None:
    """Draws one icon badge centered at (cx, cy) with radius r, matching
    ppt_service.py's ICON_SHAPE_MAP shape-per-icon approach (star,
    triangle, hexagon, ...) — reportlab has no built-in autoshapes, so
    each icon is a small hand-built polygon/path instead."""
    c.setFillColor(color)

    if icon == "check":
        c.circle(cx, cy, r, fill=1, stroke=0)
        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", r * 1.15)
        c.drawCentredString(cx, cy - r * 0.35, "\u2713")
        return

    if icon == "star":
        _draw_polygon(c, _star_points(cx, cy, r, r * 0.42, 5))
        return

    if icon == "warning":
        _draw_polygon(c, [(cx, cy + r), (cx - r * 0.95, cy - r * 0.8), (cx + r * 0.95, cy - r * 0.8)])
        return

    if icon == "network":
        _draw_polygon(c, _regular_polygon_points(cx, cy, r, 6))
        return

    if icon == "shield":
        _draw_polygon(c, _regular_polygon_points(cx, cy, r, 5, rotate_deg=-90))
        return

    if icon == "zap":
        pts = [
            (cx - r * 0.1, cy + r), (cx + r * 0.55, cy + r * 0.05), (cx + r * 0.1, cy + r * 0.05),
            (cx + r * 0.35, cy - r), (cx - r * 0.5, cy - r * 0.05), (cx - r * 0.05, cy - r * 0.05),
        ]
        _draw_polygon(c, pts)
        return

    if icon == "gear":
        _draw_polygon(c, _regular_polygon_points(cx, cy, r, 4, rotate_deg=45))  # diamond stand-in for a gear
        return

    # database, cloud, book, and anything unrecognized — a plain circle
    # (still color-coded by accent, just not a distinct silhouette)
    c.circle(cx, cy, r, fill=1, stroke=0)


def _draw_polygon(c: canvas.Canvas, points: list[tuple[float, float]]) -> None:
    p = c.beginPath()
    p.moveTo(*points[0])
    for pt in points[1:]:
        p.lineTo(*pt)
    p.close()
    c.drawPath(p, fill=1, stroke=0)


def _regular_polygon_points(cx: float, cy: float, r: float, sides: int, rotate_deg: float = -90) -> list[tuple[float, float]]:
    import math
    start = math.radians(rotate_deg)
    return [(cx + r * math.cos(start + 2 * math.pi * i / sides), cy + r * math.sin(start + 2 * math.pi * i / sides)) for i in range(sides)]


def _star_points(cx: float, cy: float, r_outer: float, r_inner: float, points: int) -> list[tuple[float, float]]:
    import math
    result = []
    for i in range(points * 2):
        r = r_outer if i % 2 == 0 else r_inner
        angle = math.radians(-90 + i * 180 / points)
        result.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return result


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


def _draw_text_page(c: canvas.Canvas, heading: str, body: str, index: int, accent, image_url: str | None = None) -> None:
    _draw_chrome(c, heading, index, accent)

    image_bytes = None
    if image_url:
        from services.image_service import fetch_image_bytes
        image_bytes = fetch_image_bytes(image_url)

    if image_bytes:
        img_left, img_top, img_w, img_h = 8.45 * inch, PAGE_H - 6.65 * inch, 4.2 * inch, 4.9 * inch
        try:
            from reportlab.lib.utils import ImageReader
            c.setFillColor(accent)
            c.roundRect(img_left - 0.12 * inch, img_top - 0.12 * inch, img_w + 0.24 * inch, img_h + 0.24 * inch, 10, fill=1, stroke=0)
            c.drawImage(ImageReader(BytesIO(image_bytes)), img_left, img_top, width=img_w, height=img_h, preserveAspectRatio=True, mask="auto")
        except Exception:
            image_bytes = None  # corrupt/unsupported download — fall through to full-width text below

    c.setFillColor(NAVY_MID)
    c.setFont("Helvetica", 14)

    sentences = [s.strip() for s in body.replace("\n", " ").split(". ") if s.strip()]
    if not sentences:
        sentences = [body[:2000]]

    y = PAGE_H - 1.9 * inch
    max_width = 6.6 * inch if image_bytes else 11.1 * inch
    for sentence in sentences[:20]:
        text = sentence + ("." if not sentence.endswith(".") else "")
        for line in _wrap_text(text, "Helvetica", 14, max_width):
            if y < 0.6 * inch:
                return  # page is full — matches the pptx cap of ~20 sentences/slide
            c.drawString(1.55 * inch, y, line)
            y -= 0.28 * inch
        y -= 0.16 * inch  # extra gap between sentences/paragraphs


def _draw_bullet_page(c: canvas.Canvas, heading: str, bullets: list, index: int, accent) -> None:
    """Key Takeaways — soft-tinted rounded cards with a per-item icon
    badge, matching ppt_service.py's _add_bullet_slide."""
    _draw_chrome(c, heading, index, accent)

    y = PAGE_H - 1.85 * inch
    card_h = 0.72 * inch
    text_color = WHITE if accent != GOLD_LIGHT else NAVY
    for b in bullets:
        text, icon = _item_text_icon(b)
        c.setFillColor(CREAM)
        c.roundRect(1.55 * inch, y - card_h, 10.9 * inch, card_h, 8, fill=1, stroke=0)

        _draw_icon(c, icon, 1.95 * inch, y - card_h / 2, 0.2 * inch, accent, text_color)

        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(2.35 * inch, y - card_h / 2 - 5, text)

        y -= card_h + 0.18 * inch


def _draw_list_page(c: canvas.Canvas, heading: str, items: list, index: int, accent) -> None:
    """Features/steps/examples — a grid of colored icon cards, matching
    ppt_service.py's _add_list_slide. Each item's icon is picked per
    its own meaning (see agents/slide_deck_agent.py) rather than a
    generic sequence number."""
    _draw_chrome(c, heading, index, accent)

    cols = 2 if len(items) <= 4 else 3
    gap = 0.3 * inch
    area_left, area_top = 1.55 * inch, PAGE_H - 1.85 * inch
    area_w = PAGE_W - area_left - 0.6 * inch
    card_w = (area_w - gap * (cols - 1)) / cols
    card_h = 1.05 * inch
    text_color = WHITE if accent != GOLD_LIGHT else NAVY

    for i, item in enumerate(items):
        text, icon = _item_text_icon(item)
        r, col = divmod(i, cols)
        x = area_left + col * (card_w + gap)
        y_top = area_top - r * (card_h + gap)

        c.setFillColor(CREAM)
        c.setStrokeColor(accent)
        c.setLineWidth(1)
        c.roundRect(x, y_top - card_h, card_w, card_h, 10, fill=1, stroke=1)

        _draw_icon(c, icon, x + 0.36 * inch, y_top - 0.36 * inch, 0.18 * inch, accent, text_color)

        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 12)
        text_lines = _wrap_text(text, "Helvetica-Bold", 12, card_w - 0.85 * inch)
        ty = y_top - 0.42 * inch
        for line in text_lines[:3]:
            c.drawString(x + 0.65 * inch, ty, line)
            ty -= 0.2 * inch


def _draw_process_page(c: canvas.Canvas, heading: str, steps: list, index: int, accent) -> None:
    """"How it works" / ordered setup steps — a left-to-right chip flow
    with numbered circles and arrow connectors, matching
    ppt_service.py's _add_process_slide."""
    _draw_chrome(c, heading, index, accent)

    n = len(steps)
    area_left = 1.55 * inch
    area_top = PAGE_H - 2.7 * inch
    area_w = PAGE_W - area_left - 0.6 * inch
    arrow_w = 0.45 * inch
    chip_h = 1.6 * inch
    chip_w = (area_w - arrow_w * (n - 1)) / n
    text_color = WHITE if accent != GOLD_LIGHT else NAVY

    x = area_left
    for i, step in enumerate(steps):
        text = step.get("text", "") if isinstance(step, dict) else str(step)

        c.setFillColor(accent)
        c.roundRect(x, area_top - chip_h, chip_w, chip_h, 12, fill=1, stroke=0)

        num_cx, num_cy = x + chip_w / 2, area_top + 0.02 * inch
        c.setFillColor(WHITE)
        c.circle(num_cx, num_cy, 0.22 * inch, fill=1, stroke=1)
        c.setStrokeColor(NAVY)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 13)
        c.drawCentredString(num_cx, num_cy - 4, str(i + 1))

        c.setFillColor(text_color)
        c.setFont("Helvetica-Bold", 12)
        lines = _wrap_text(text, "Helvetica-Bold", 12, chip_w - 0.3 * inch)
        ty = area_top - chip_h / 2 + (len(lines) - 1) * 0.09 * inch
        for line in lines[:3]:
            c.drawCentredString(x + chip_w / 2, ty, line)
            ty -= 0.18 * inch

        x += chip_w
        if i < n - 1:
            arrow_y = area_top - chip_h / 2
            c.setFillColor(NAVY_MID)
            _draw_polygon(c, [
                (x, arrow_y + 0.12 * inch), (x + arrow_w * 0.55, arrow_y + 0.12 * inch), (x + arrow_w * 0.55, arrow_y + 0.2 * inch),
                (x + arrow_w, arrow_y), (x + arrow_w * 0.55, arrow_y - 0.2 * inch), (x + arrow_w * 0.55, arrow_y - 0.12 * inch),
                (x, arrow_y - 0.12 * inch),
            ])
            x += arrow_w


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
