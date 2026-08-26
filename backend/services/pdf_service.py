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

GAMMA-STYLE PASS: headings/labels/badges now render in Poppins
(utils/pdf_fonts.py) instead of plain Helvetica-Bold, every content
page carries a footer (page number + wordmark) and a faint decorative
corner accent, an Agenda page lists every section right after the
title page, and the deck closes on a branded "recap" page — the set
of things a real Gamma/Canva-generated deck always has that a bare
title+content+takeaways structure didn't.
"""

from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

from firebase.firebase_config import get_firestore_client
from services import chat_repository, embedding_service, notes_repository
from services.ppt_service import build_deck_sections, PptServiceError, _safe_filename, THEMES, _pick_theme
from utils.pdf_fonts import ensure_fonts_registered, HEADING_BOLD, HEADING_SEMIBOLD, HEADING_MEDIUM

# --- Gamma-style theme palettes ---
# Mirrors ppt_service.py's _apply_theme/THEMES exactly (same THEMES list,
# same per-title pick) so a deck's PDF and PPTX always match — see that
# module's THEMES for what each of the 6 palettes looks like and why.
# Headings/labels now render in Poppins (see utils/pdf_fonts.py); body
# paragraph text stays on reportlab's built-in Helvetica everywhere —
# see that module's docstring for why that split is deliberate, not a
# fallback.
NAVY = NAVY_MID = GOLD = GOLD_LIGHT = CREAM = None  # set by _apply_theme() below
WHITE = HexColor("#FFFFFF")

PAGE_W, PAGE_H = 13.333 * inch, 7.5 * inch
ACCENT_CYCLE: list = []  # set by _apply_theme() below, alongside NAVY/GOLD/etc.


def _apply_theme(theme: dict) -> None:
    """PDF counterpart to ppt_service.py's _apply_theme — same
    reasoning (single sync Gunicorn worker, so rebinding module
    globals per-build is safe) and same THEMES source, just RGB tuples
    -> HexColor instead of RGBColor."""
    global NAVY, NAVY_MID, GOLD, GOLD_LIGHT, CREAM, ACCENT_CYCLE
    NAVY = HexColor("#%02X%02X%02X" % theme["navy"])
    NAVY_MID = HexColor("#%02X%02X%02X" % theme["navy_mid"])
    GOLD = HexColor("#%02X%02X%02X" % theme["gold"])
    GOLD_LIGHT = HexColor("#%02X%02X%02X" % theme["gold_light"])
    CREAM = HexColor("#%02X%02X%02X" % theme["cream"])
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
    ensure_fonts_registered()
    _apply_theme(_pick_theme(notes.get("title") or ""))

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    _draw_title_page(c, notes.get("title") or "Study Summary", subtitle)

    deck_sections = build_deck_sections(notes)
    total_pages = len(deck_sections) + 2  # + agenda page + closing page

    c.showPage()
    _draw_agenda_page(c, [s["heading"] for s in deck_sections], total_pages)

    for i, slide_data in enumerate(deck_sections):
        c.showPage()
        accent = ACCENT_CYCLE[i % len(ACCENT_CYCLE)]
        kind = slide_data["kind"]
        page_num = i + 2  # agenda page was page 1 of the content pages
        if kind == "bullets":
            _draw_bullet_page(c, slide_data["heading"], slide_data["items"], page_num, accent)
        elif kind == "list":
            _draw_list_page(c, slide_data["heading"], slide_data["items"], page_num, accent)
        elif kind == "process":
            _draw_process_page(c, slide_data["heading"], slide_data["steps"], page_num, accent)
        elif kind == "comparison":
            _draw_comparison_page(c, slide_data["heading"], slide_data["left"], slide_data["right"], page_num)
        else:
            _draw_text_page(c, slide_data["heading"], slide_data["body"], page_num, accent, slide_data.get("image_url"), slide_data.get("subpoints"))
        _draw_footer(c, page_num, total_pages)

    c.showPage()
    _draw_closing_page(c, notes.get("title") or "Study Summary")

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


def _distribute_fill(n: int, avail_h_in: float, gap_in: float, min_item: float, max_item: float) -> tuple[float, float]:
    """Same fix as ppt_service.py's _distribute_fill, for the PDF
    builder — grows each stacked item's height to fill the available
    vertical space (clamped to [min_item, max_item]) instead of a
    fixed size that leaves a blank strip below a short list, and
    returns a top offset so any leftover space is centered. Returns
    (item_height_in, top_offset_in)."""
    if n <= 0:
        return min_item, 0.0
    ideal = (avail_h_in - gap_in * (n - 1)) / n
    item_h_in = max(min_item, min(ideal, max_item))
    content_h_in = item_h_in * n + gap_in * (n - 1)
    offset_in = max(0.0, (avail_h_in - content_h_in) / 2)
    return item_h_in, offset_in


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
        # BUG FIX: rotate_deg=45 with 4 sides puts vertices at
        # 45/135/225/315°, which is an axis-aligned SQUARE, not a
        # diamond (a square's corners point up/down/left/right at
        # 0/90/180/270°) — that's why this rendered as a plain square
        # instead of the intended diamond gear stand-in.
        _draw_polygon(c, _regular_polygon_points(cx, cy, r, 4, rotate_deg=0))  # diamond stand-in for a gear
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
    # A third, faint ring purely for texture — real Gamma/Canva title
    # slides rarely rest on just two flat shapes; a thin outline ring
    # layered over the filled circles reads as an intentional graphic
    # motif rather than a placeholder.
    c.setStrokeColor(WHITE)
    c.setFillAlpha(1)
    c.setStrokeAlpha(0.25)
    c.setLineWidth(1.4)
    c.circle(PAGE_W - 2.8 * inch, PAGE_H - 0.5 * inch, 3.95 * inch, fill=0, stroke=1)
    c.restoreState()

    # Small pill/eyebrow tag above the title — the "STUDY SUMMARY" kicker
    # every Gamma-generated doc opens with, instead of jumping straight
    # from the wordmark to the title with nothing between them.
    c.setFillColor(GOLD)
    pill_w, pill_h, pill_x, pill_y = 1.9 * inch, 0.34 * inch, 0.7 * inch, PAGE_H - 1.35 * inch
    c.saveState()
    c.setFillColor(GOLD)
    c.setFillAlpha(0.16)
    c.roundRect(pill_x, pill_y, pill_w, pill_h, pill_h / 2, fill=1, stroke=0)
    c.restoreState()
    c.setFillColor(GOLD_LIGHT)
    c.setFont(HEADING_SEMIBOLD, 10.5)
    c.drawString(pill_x + 0.22 * inch, pill_y + 0.11 * inch, "STUDY SUMMARY")

    c.setFillColor(GOLD)
    c.rect(0.7 * inch, PAGE_H - 2.3 * inch, 1.1 * inch, 4, fill=1, stroke=0)

    c.setFillColor(GOLD_LIGHT)
    c.setFont(HEADING_BOLD, 15)
    c.drawString(0.7 * inch, PAGE_H - 1.85 * inch, "LEARNMATRIX")

    c.setFillColor(WHITE)
    c.setFont(HEADING_BOLD, 34)
    title_lines = _wrap_text(title, HEADING_BOLD, 34, 9.2 * inch)
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

    # Faint decorative corner circle, bottom-right — the same "designed,
    # not just functional" texture the title page already has, but at
    # low enough alpha (4%) to sit behind body text/cards without ever
    # competing with them for attention.
    c.saveState()
    c.setFillColor(accent)
    c.setFillAlpha(0.05)
    c.circle(PAGE_W - 0.3 * inch, 0.2 * inch, 2.4 * inch, fill=1, stroke=0)
    c.restoreState()

    c.setFillColor(accent)
    c.rect(0, 0, 0.35 * inch, PAGE_H, fill=1, stroke=0)

    badge_cx, badge_cy = 1.02 * inch, PAGE_H - 0.85 * inch
    c.setFillColor(accent)
    c.circle(badge_cx, badge_cy, 0.28 * inch, fill=1, stroke=0)
    c.setFillColor(WHITE if accent != GOLD_LIGHT else NAVY)
    c.setFont(HEADING_BOLD, 14)
    c.drawCentredString(badge_cx, badge_cy - 5, str(index))

    c.setFillColor(NAVY)
    c.setFont(HEADING_BOLD, 22)
    c.drawString(1.55 * inch, PAGE_H - 0.95 * inch, heading)

    c.setFillColor(accent)
    c.rect(1.55 * inch, PAGE_H - 1.35 * inch, 1.4 * inch, 3, fill=1, stroke=0)


def _draw_footer(c: canvas.Canvas, page_num: int, total_pages: int) -> None:
    """Bottom-of-page wordmark + page counter — drawn on every content
    page (see build_pdf_from_deck_content's loop) so the deck reads as
    one consistently-branded document instead of the title page being
    the only page that looks finished. Small and low-contrast on
    purpose: a footer should be findable, not competing with the
    content above it."""
    c.saveState()
    c.setFillColor(NAVY_MID)
    c.setFillAlpha(0.55)
    c.setFont(HEADING_MEDIUM, 8.5)
    c.drawString(0.55 * inch, 0.3 * inch, "LEARNMATRIX")
    c.drawRightString(PAGE_W - 0.55 * inch, 0.3 * inch, f"{page_num} / {total_pages}")
    c.restoreState()


def _draw_agenda_page(c: canvas.Canvas, headings: list[str], total_pages: int) -> None:
    """"What we'll cover" — the agenda/table-of-contents page every
    real Gamma/Canva-generated deck opens its body with, right after
    the title page. Numbered pills down the left, heading text beside
    each — same visual language as the numbered section badges every
    content page already uses (_draw_chrome), just laid out as a list
    instead of one-per-page."""
    c.setFillColor(CREAM)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    c.saveState()
    c.setFillColor(GOLD)
    c.setFillAlpha(0.10)
    c.circle(PAGE_W + 0.4 * inch, PAGE_H + 0.2 * inch, 3.2 * inch, fill=1, stroke=0)
    c.restoreState()

    c.setFillColor(GOLD)
    c.rect(0.7 * inch, PAGE_H - 1.3 * inch, 1.1 * inch, 4, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont(HEADING_BOLD, 26)
    c.drawString(0.65 * inch, PAGE_H - 1.85 * inch, "What We'll Cover")

    n = len(headings)
    # Distance-from-TOP idiom (same as every other page's content_top_in
    # style, e.g. _draw_process_page) — content_top_in must clear the
    # "What We'll Cover" heading drawn at PAGE_H - 1.85in above, plus its
    # descenders, or the first row collides with the title text.
    content_top_in, content_bottom_in = 2.3, 6.9
    avail_h_in = content_bottom_in - content_top_in

    # NOT _distribute_fill here on purpose: that helper's min_item floor
    # (needed so a 2-3 item content CARD never shrinks unreadably small)
    # actively overflows the page once a deck has ~7+ sections, since
    # `max(min_item, ideal)` ignores how little space is actually left
    # and pushes rows straight into the footer. An agenda row only holds
    # a number badge + a heading (no body copy to protect the readability
    # of), so both the row height AND the gap between rows are allowed to
    # keep shrinking — down to a much smaller floor than a content card —
    # as section count grows, with the heading font itself stepping down
    # a size once rows get tight so the text still reads as one clean line
    # instead of wrapping into a row too short to hold it.
    gap_in = 0.14 if n <= 9 else 0.08
    ideal_in = (avail_h_in - gap_in * (n - 1)) / n if n > 0 else avail_h_in
    row_h_in = max(0.22, min(ideal_in, 0.85))
    content_h_in = row_h_in * n + gap_in * (n - 1)
    offset_in = max(0.0, (avail_h_in - content_h_in) / 2)
    y = PAGE_H - (content_top_in + offset_in) * inch
    row_h = row_h_in * inch

    heading_font_size = 16 if row_h_in >= 0.55 else 13
    max_heading_lines = 2 if row_h_in >= 0.4 else 1

    for i, heading in enumerate(headings):
        accent = ACCENT_CYCLE[i % len(ACCENT_CYCLE)]
        text_color = WHITE if accent != GOLD_LIGHT else NAVY

        badge_r = min(0.22, row_h_in * 0.42) * inch
        c.setFillColor(accent)
        c.circle(1.05 * inch, y - row_h / 2, badge_r, fill=1, stroke=0)
        c.setFillColor(text_color)
        c.setFont(HEADING_BOLD, min(12, heading_font_size))
        c.drawCentredString(1.05 * inch, y - row_h / 2 - 4, str(i + 1))

        c.setFillColor(NAVY)
        c.setFont(HEADING_SEMIBOLD, heading_font_size)
        lines = _wrap_text(heading, HEADING_SEMIBOLD, heading_font_size, 10.8 * inch)[:max_heading_lines]
        line_h_in = 0.22 if heading_font_size >= 16 else 0.18
        ty = y - row_h / 2 + (len(lines) - 1) * line_h_in * inch / 2
        for line in lines:
            c.drawString(1.55 * inch, ty, line)
            ty -= line_h_in * inch

        if i < n - 1:
            c.setStrokeColor(accent)
            c.setStrokeAlpha(0.25)
            c.setLineWidth(0.75)
            c.line(1.55 * inch, y - row_h - gap_in * inch / 2, PAGE_W - 0.7 * inch, y - row_h - gap_in * inch / 2)

        y -= row_h + gap_in * inch

    _draw_footer(c, 1, total_pages)


def _draw_closing_page(c: canvas.Canvas, title: str) -> None:
    """Branded sign-off page — mirrors the title page's palette/shapes
    so the deck feels like it has a deliberate beginning AND end,
    instead of stopping mid-content right after the last Key Takeaways
    card."""
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    c.saveState()
    c.setFillColor(GOLD)
    c.setFillAlpha(0.65)
    c.circle(PAGE_W / 2, PAGE_H + 1.2 * inch, 3.0 * inch, fill=1, stroke=0)
    c.setFillColor(GOLD_LIGHT)
    c.setFillAlpha(0.4)
    c.circle(PAGE_W / 2, -0.8 * inch, 2.2 * inch, fill=1, stroke=0)
    c.restoreState()

    c.setFillColor(WHITE)
    c.setFont(HEADING_BOLD, 30)
    c.drawCentredString(PAGE_W / 2, PAGE_H / 2 + 0.35 * inch, "Keep Learning")

    c.setFillColor(CREAM)
    c.setFont("Helvetica", 15)
    c.drawCentredString(PAGE_W / 2, PAGE_H / 2 - 0.15 * inch, f"You've completed the summary on {title}.")

    c.setFillColor(GOLD_LIGHT)
    c.setFont(HEADING_SEMIBOLD, 13)
    c.drawCentredString(PAGE_W / 2, 0.75 * inch, "LEARNMATRIX")


def _draw_text_page(c: canvas.Canvas, heading: str, body: str, index: int, accent, image_url: str | None = None, subpoints: list | None = None) -> None:
    _draw_chrome(c, heading, index, accent)

    image_bytes = None
    if image_url:
        from services.image_service import fetch_image_bytes
        image_bytes = fetch_image_bytes(image_url)

    has_sidebar = bool(image_bytes) or bool(subpoints)
    sidebar_x = 8.45 * inch
    sidebar_top = PAGE_H - 1.85 * inch

    if image_bytes:
        # BUG FIX: same issue as ppt_service.py's _add_text_slide — a
        # fixed 3.15in image height left no guaranteed room for the
        # "Key Points" panel below it, so a section with 4 subpoints
        # routinely had its last item or two land below the bottom
        # margin (or off the page entirely). Height now shrinks
        # (floor 1.9in) to whatever leaves the panel's real wrapped
        # height room to fit — reportlab gives us exact stringWidth,
        # so this estimate is exact, not approximate like the pptx one.
        panel_h_in = _estimate_subpoints_panel_height(subpoints) if subpoints else 0.0
        avail_in = 7.5 - 1.85 - 0.5  # content band from below the heading to the bottom margin
        max_img_h_in = avail_in - 0.4 - panel_h_in  # 0.4in = gap between image and panel
        img_h_in = max(1.9, min(3.15, max_img_h_in)) if subpoints else 3.15
        img_left, img_top, img_w, img_h = sidebar_x, PAGE_H - 1.85 * inch, 4.2 * inch, img_h_in * inch
        try:
            from reportlab.lib.utils import ImageReader
            c.setFillColor(accent)
            c.roundRect(img_left - 0.12 * inch, img_top - img_h - 0.12 * inch, img_w + 0.24 * inch, img_h + 0.24 * inch, 10, fill=1, stroke=0)

            # Clip the photo itself to rounded corners (not just framed
            # by a rounded border behind a square photo) and lay a very
            # faint theme-color wash over it — the two things that make
            # a stock photo look like it was chosen FOR this deck's
            # palette instead of dropped in as-is.
            c.saveState()
            clip_path = c.beginPath()
            clip_path.roundRect(img_left, img_top - img_h, img_w, img_h, 8)
            c.clipPath(clip_path, stroke=0, fill=0)
            c.drawImage(ImageReader(BytesIO(image_bytes)), img_left, img_top - img_h, width=img_w, height=img_h, preserveAspectRatio=True, mask="auto")
            c.setFillColor(accent)
            c.setFillAlpha(0.10)
            c.rect(img_left, img_top - img_h, img_w, img_h, fill=1, stroke=0)
            c.restoreState()

            sidebar_top = img_top - img_h - 0.4 * inch
        except Exception:
            image_bytes = None  # corrupt/unsupported download — fall through to full-width text below

    c.setFillColor(NAVY_MID)

    sentences = [s.strip() for s in body.replace("\n", " ").split(". ") if s.strip()]
    if not sentences:
        sentences = [body[:2000]]

    max_width = 6.6 * inch if has_sidebar else 11.1 * inch

    # No sidebar (no image/subpoints) means the paragraph is the ONLY
    # content on the page, so a short section used to leave a big
    # blank area below it — same fix as ppt_service.py's
    # _add_text_slide: scale the font UP and vertically center the
    # block so a short paragraph still reads as an intentional full
    # page instead of a stub glued to the top.
    if has_sidebar:
        body_font_size = 12.5 if len(sentences) > 5 else 14
        y = PAGE_H - 1.9 * inch
    else:
        if len(sentences) <= 3:
            body_font_size = 24
        elif len(sentences) <= 5:
            body_font_size = 18
        else:
            body_font_size = 14
        total_lines = sum(len(_wrap_text(s, "Helvetica", body_font_size, max_width)) for s in sentences)
        line_h_in = (body_font_size / 14) * 0.28
        est_h_in = total_lines * line_h_in + len(sentences) * 0.16
        content_top_in, content_bottom_in = 1.9, 6.9
        top_offset_in = max(0.0, ((content_bottom_in - content_top_in) - est_h_in) / 2)
        y = PAGE_H - (content_top_in + top_offset_in) * inch

    c.setFont("Helvetica", body_font_size)
    for sentence in sentences[:26]:
        text = sentence + ("." if not sentence.endswith(".") else "")
        for line in _wrap_text(text, "Helvetica", body_font_size, max_width):
            if y < 0.6 * inch:
                break  # page is full — matches the pptx cap of ~26 sentences/slide
            c.drawString(1.55 * inch, y, line)
            y -= (body_font_size / 14) * 0.28 * inch
        y -= 0.16 * inch  # extra gap between sentences/paragraphs

    if subpoints:
        _draw_key_points_panel(c, subpoints, sidebar_x, sidebar_top, 4.2 * inch, accent)


def _estimate_subpoints_panel_height(subpoints: list) -> float:
    """Mirrors _draw_key_points_panel's own row-height math (label +
    real wrapped-line count per item, via the same _wrap_text used to
    draw them) so the text page can decide the image height BEFORE
    drawing the panel, instead of finding out after the fact that it
    ran off the bottom of the page."""
    if not subpoints:
        return 0.0
    total_in = 0.3  # "KEY POINTS" label + gap before first row
    for sp in subpoints[:5]:
        text, _icon = _item_text_icon(sp)
        if not text:
            continue
        lines = _wrap_text(text, "Helvetica", 13, 4.2 * inch - 0.25 * inch)
        total_in += 0.22 * len(lines) + 0.14
    return total_in


def _draw_key_points_panel(c: canvas.Canvas, subpoints: list, x: float, top: float, width: float, accent) -> None:
    """PDF counterpart to ppt_service.py's _add_key_points_panel — a
    compact 'Key Points' list of short highlight bullets (see
    agents/slide_deck_agent.py's "subpoints") stacked below the image
    in the text page's sidebar."""
    c.setFillColor(accent)
    c.setFont(HEADING_BOLD, 12)
    c.drawString(x, top, "KEY POINTS")

    y = top - 0.3 * inch
    # HARD SAFETY NET: same as ppt_service.py's panel — stop adding
    # rows once the next one would cross the page's bottom margin,
    # instead of drawing it past the edge where it's invisible either
    # way. Backstops the image-height estimate above for any edge case
    # (several long, two-line subpoints) it didn't fully anticipate.
    bottom_limit = 0.5 * inch
    for sp in subpoints[:5]:
        text, _icon = _item_text_icon(sp)
        if not text:
            continue
        lines = _wrap_text(text, "Helvetica", 13, width - 0.25 * inch)
        row_h = 0.22 * len(lines) + 0.14
        if y - row_h < bottom_limit:
            break
        c.setFillColor(accent)
        c.circle(x + 0.05 * inch, y + 0.04 * inch, 0.045 * inch, fill=1, stroke=0)

        c.setFillColor(NAVY_MID)
        c.setFont("Helvetica", 13)
        ty = y
        for line in lines:
            c.drawString(x + 0.22 * inch, ty, line)
            ty -= 0.22 * inch
        y = ty - 0.14 * inch


def _draw_bullet_page(c: canvas.Canvas, heading: str, bullets: list, index: int, accent) -> None:
    """Key Takeaways — soft-tinted rounded cards with a per-item icon
    badge, matching ppt_service.py's _add_bullet_slide."""
    _draw_chrome(c, heading, index, accent)

    # Card height scales to fill down to the bottom margin (see
    # _distribute_fill) instead of a fixed 0.72in — a deck with only
    # 3-4 takeaways used to leave a blank gap under the last card.
    # Text is also now wrapped (previously a single drawString with no
    # wrapping at all, which ran a long takeaway straight off the
    # right edge of the card/page instead of onto a second line).
    card_h_in, offset_in = _distribute_fill(len(bullets), PAGE_H / inch - 1.85 - 0.5, 0.18, min_item=0.72, max_item=1.3)
    y = PAGE_H - (1.85 + offset_in) * inch
    card_h = card_h_in * inch
    font_size = 13 if card_h_in <= 0.9 else 15
    text_color = WHITE if accent != GOLD_LIGHT else NAVY
    for b in bullets:
        text, icon = _item_text_icon(b)
        c.setFillColor(CREAM)
        c.roundRect(1.55 * inch, y - card_h, 10.9 * inch, card_h, 8, fill=1, stroke=0)

        icon_r = 0.16 * inch if card_h_in <= 0.9 else 0.2 * inch
        _draw_icon(c, icon, 1.95 * inch, y - card_h / 2, icon_r, accent, text_color)

        c.setFillColor(NAVY)
        c.setFont(HEADING_BOLD, font_size)
        lines = _wrap_text(text, HEADING_BOLD, font_size, 10.9 * inch - 1.2 * inch)
        line_h = 0.2 * inch
        ty = y - card_h / 2 + (len(lines) - 1) * line_h / 2
        for line in lines[:3]:
            c.drawString(2.35 * inch, ty, line)
            ty -= line_h

        y -= card_h + 0.18 * inch


def _draw_list_page(c: canvas.Canvas, heading: str, items: list, index: int, accent) -> None:
    """Features/steps/examples — a grid of colored icon cards, matching
    ppt_service.py's _add_list_slide. Each item's icon is picked per
    its own meaning (see agents/slide_deck_agent.py) rather than a
    generic sequence number."""
    _draw_chrome(c, heading, index, accent)

    cols = 2 if len(items) <= 4 else 3
    gap = 0.3 * inch
    area_left = 1.55 * inch
    area_w = PAGE_W - area_left - 0.6 * inch
    card_w = (area_w - gap * (cols - 1)) / cols
    rows = -(-len(items) // cols)  # ceil
    # Card height scales to fill down to the bottom margin (see
    # _distribute_fill) instead of a fixed 1.05in — a 2-3 item grid
    # used to leave a big blank strip at the bottom of the page.
    card_h_in, offset_in = _distribute_fill(rows, PAGE_H / inch - 1.85 - 0.5, 0.3, min_item=1.05, max_item=2.1)
    area_top = PAGE_H - (1.85 + offset_in) * inch
    card_h = card_h_in * inch
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

        # Icon/text sit at a fixed distance from the TOP of a compact
        # card, but grow toward VERTICALLY CENTERED as the card grows
        # (few-item grids get taller cards via _distribute_fill above)
        # so a 2-item page doesn't look like its content is glued to
        # the top of an otherwise empty card.
        icon_cy = y_top - 0.36 * inch if card_h_in <= 1.1 else y_top - card_h / 2
        _draw_icon(c, icon, x + 0.36 * inch, icon_cy, 0.18 * inch, accent, text_color)

        c.setFillColor(NAVY)
        c.setFont(HEADING_BOLD, 12)
        text_lines = _wrap_text(text, HEADING_BOLD, 12, card_w - 0.85 * inch)[:3]
        ty = (y_top - 0.42 * inch) if card_h_in <= 1.1 else (y_top - card_h / 2 + (len(text_lines) - 1) * 0.1 * inch)
        for line in text_lines:
            c.drawString(x + 0.65 * inch, ty, line)
            ty -= 0.2 * inch


def _draw_process_page(c: canvas.Canvas, heading: str, steps: list, index: int, accent) -> None:
    """"How it works" / ordered setup steps — a left-to-right chip flow
    with numbered circles and arrow connectors, matching
    ppt_service.py's _add_process_slide."""
    _draw_chrome(c, heading, index, accent)

    n = len(steps)
    area_left = 1.55 * inch
    area_w = PAGE_W - area_left - 0.6 * inch
    arrow_w = 0.45 * inch
    chip_w = (area_w - arrow_w * (n - 1)) / n
    text_color = WHITE if accent != GOLD_LIGHT else NAVY

    texts = [step.get("text", "") if isinstance(step, dict) else str(step) for step in steps]

    # Pick the smallest step-down in font size (12 -> 10.5 -> 9) that
    # keeps every step's wrapped text to at most 4 lines, then size the
    # chip to fit that many lines. BUG FIX: the old code fixed the chip
    # at 1.6in and only ever drew the first 3 wrapped lines
    # (`lines[:3]`) — any step whose phrase needed a 4th line (common
    # once a deck has 5-6 narrow chips) had that line silently dropped,
    # cutting the step off mid-sentence. Nothing is dropped now: the
    # chip grows (and the font shrinks a step) to fit the longest step
    # in full instead.
    font_size = 12
    max_lines = 1
    for candidate in (12, 10.5, 9):
        per_step_lines = [len(_wrap_text(t, HEADING_BOLD, candidate, chip_w - 0.3 * inch)) for t in texts]
        m = max(per_step_lines) if per_step_lines else 1
        if m <= 4 or candidate == 9:
            font_size, max_lines = candidate, m
            break

    line_h_in = 0.15 + (font_size / 12) * 0.06
    chip_h_in = min(3.2, max(1.6, 0.75 + max_lines * line_h_in))
    chip_h = chip_h_in * inch

    # Center the chip row vertically in the content area instead of
    # anchoring it near the top — a 2-step deck (tall chips) or a
    # short-phrase deck (small chips) both used to leave a big blank
    # stretch below a fixed 1.6in row stuck right under the heading.
    content_top_in, content_bottom_in = 1.7, 7.0
    avail_h_in = content_bottom_in - content_top_in
    offset_in = max(0.0, (avail_h_in - 0.3 - chip_h_in) / 2)
    area_top = PAGE_H - (content_top_in + 0.3 + offset_in) * inch

    x = area_left
    for i, text in enumerate(texts):
        c.setFillColor(accent)
        c.roundRect(x, area_top - chip_h, chip_w, chip_h, 12, fill=1, stroke=0)

        num_cx, num_cy = x + chip_w / 2, area_top + 0.02 * inch
        c.setFillColor(WHITE)
        c.circle(num_cx, num_cy, 0.22 * inch, fill=1, stroke=1)
        c.setStrokeColor(NAVY)
        c.setFillColor(NAVY)
        c.setFont(HEADING_BOLD, 13)
        c.drawCentredString(num_cx, num_cy - 4, str(i + 1))

        c.setFillColor(text_color)
        c.setFont(HEADING_BOLD, font_size)
        lines = _wrap_text(text, HEADING_BOLD, font_size, chip_w - 0.3 * inch)
        ty = area_top - chip_h / 2 + (len(lines) - 1) * line_h_in * inch / 2
        for line in lines:
            c.drawCentredString(x + chip_w / 2, ty, line)
            ty -= line_h_in * inch

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
        c.setFont(HEADING_BOLD, 16)
        c.drawCentredString(x + col_w / 2, col_top - 0.42 * inch, panel.get("label", ""))

        # Item spacing scales to spread the list across the FULL column
        # height (see _distribute_fill) instead of a fixed 0.62in-per-
        # line gap — a 2-3 item side used to leave a big blank stretch
        # under the last item while the panel's colored background
        # kept going to the bottom of the card.
        items_list = panel.get("items", [])
        label_h_in = 0.95
        avail_h_in = (col_h / inch) - label_h_in - 0.3
        item_h_in, offset_in = _distribute_fill(len(items_list), avail_h_in, 0.0, min_item=0.5, max_item=1.0)
        item_y = col_top - (label_h_in + offset_in) * inch
        for item in items_list:
            c.setFillColor(text_color)
            c.circle(x + 0.42 * inch, item_y + 0.04 * inch, 0.045 * inch, fill=1, stroke=0)
            # BUG FIX: this font must match the font _wrap_text measured
            # with (Helvetica 13) — without an explicit setFont here,
            # the canvas kept the Helvetica-Bold 16 used for the panel
            # LABEL just above, which is visibly wider, so lines wrapped
            # to fit 13pt regular text overflowed past the column edge
            # (and sometimes off the page) once drawn at 16pt bold —
            # that's the "regulato[ry]"/"hard[ware]" cut-off-looking text.
            c.setFont("Helvetica", 13)
            lines = _wrap_text(item, "Helvetica", 13, col_w - 0.9 * inch)
            ty = item_y
            for line in lines:
                c.drawString(x + 0.62 * inch, ty, line)
                ty -= 0.22 * inch
            item_y -= item_h_in * inch
