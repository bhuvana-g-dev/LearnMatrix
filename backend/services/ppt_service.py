"""
services/ppt_service.py

Builds a downloadable .pptx "Study Summary" deck, styled with the
LearnMatrix navy/gold brand palette (colored backgrounds, accent bars,
badge-numbered sections, colored bullet markers) instead of the
default plain PowerPoint template. Three modes, mirroring Flashcards'
mode selector:
  - generate_study_summary_pptx: from an already-generated
    learning_notes entry (services/notes_repository.py)
  - generate_chat_summary_pptx: from one saved AI Chat session's
    Q&A turns (services/chat_repository.py)
  - generate_sources_summary_pptx: from the user's uploaded/linked
    chat sources (services/embedding_service.py)

No LLM call in ANY of the three modes — each just reshapes data that
already exists into a {title, summary, sections, keyTakeaways} shape,
which _build_pptx_from_notes turns into slides. Regenerating that text
through an agent would be a slower, costlier way to get content already
on hand.

There's no external image-search/stock-photo API configured in this
backend (no Unsplash/Pexels key in config/settings.py), so "visual"
content here means brand-colored shapes/badges/accent bars drawn
directly with python-pptx — not photographs. Wiring in a real photo
API is a separate, later change (would need an API key added to
Settings).

Uses python-pptx to build the deck in memory (BytesIO) — nothing is
written to disk, so there's no cleanup/temp-file lifecycle to manage;
routes/ppt_routes.py streams the bytes straight back as a file download.
"""

from io import BytesIO

from pptx import Presentation
from pptx.util import Pt, Inches, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

from firebase.firebase_config import get_firestore_client
from services import chat_repository, embedding_service, notes_repository

# --- LearnMatrix brand palette (mirrors frontend/src/constants/theme.js) ---
NAVY = RGBColor(0x0D, 0x1B, 0x3D)
NAVY_MID = RGBColor(0x3E, 0x4A, 0x66)
GOLD = RGBColor(0xD4, 0xA0, 0x17)
GOLD_LIGHT = RGBColor(0xE8, 0xB9, 0x3D)
CREAM = RGBColor(0xFB, 0xF3, 0xE1)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

# Alternating accent color per content slide, cycling through the palette
# so a long deck doesn't look monotone.
ACCENT_CYCLE = [GOLD, NAVY, GOLD_LIGHT]


class PptServiceError(Exception):
    pass


def generate_study_summary_pptx(skill: str, topic: str, focus_band: str) -> tuple[BytesIO, str]:
    """Raises PptServiceError if no notes exist yet for this
    (skill, topic, focus_band) — same precondition as
    embedding_service.index_learning_notes."""
    db = get_firestore_client()
    notes = notes_repository.get_cached_notes(db, skill, topic, focus_band)
    if not notes:
        raise PptServiceError(
            f"No study notes found yet for '{skill} / {topic}' ({focus_band}). "
            "Open that topic in the Learning Hub first so notes are generated."
        )
    safe_topic = _safe_filename(topic)
    return _build_pptx_from_notes(notes, subtitle=f"{focus_band.title()} level"), f"{safe_topic}_study_summary.pptx"


def generate_sources_summary_pptx(uid: str) -> tuple[BytesIO, str]:
    db = get_firestore_client()
    sources_content = embedding_service.get_sources_with_text(db, uid)
    if not sources_content:
        raise PptServiceError("No sources found yet — upload a source first.")

    notes = {
        "title": "Your Sources",
        "summary": "",
        "sections": [{"heading": s["title"], "content": s["text"]} for s in sources_content],
        "keyTakeaways": [],
    }
    return _build_pptx_from_notes(notes, subtitle="Study Summary from Sources"), "sources_study_summary.pptx"


def generate_chat_summary_pptx(uid: str, session_id: str) -> tuple[BytesIO, str]:
    if not session_id:
        raise PptServiceError("No chat conversation selected — open or start a chat first.")
    db = get_firestore_client()
    history = chat_repository.get_session_messages(db, uid, session_id, limit=0)
    if not history:
        raise PptServiceError("That conversation has no messages yet — ask the AI Study Assistant something first.")

    sections = []
    for i, turn in enumerate(history):
        if turn.get("role") == "user":
            answer = history[i + 1].get("content", "") if i + 1 < len(history) and history[i + 1].get("role") == "assistant" else ""
            sections.append({"heading": turn.get("content", "")[:60], "content": answer})

    notes = {"title": "Your Chat", "summary": "", "sections": sections, "keyTakeaways": []}
    return _build_pptx_from_notes(notes, subtitle="Study Summary from AI Chat"), "chat_study_summary.pptx"


def generate_custom_text_pptx(text: str) -> tuple[BytesIO, str]:
    if not text or not text.strip():
        raise PptServiceError("Type something first.")
    title = text.strip().split("\n")[0][:60] or "Your Topic"
    notes = {"title": title, "summary": "", "sections": [{"heading": "Your Input", "content": text.strip()}], "keyTakeaways": []}
    return _build_pptx_from_notes(notes, subtitle="Study Summary"), "custom_study_summary.pptx"


# ---------------------------------------------------------------------------
# Deck assembly — collects the notes dict content shared by every mode above
# into a `_DeckContent`-shaped list of sections, so the PDF service
# (services/pdf_service.py) can build a matching-design PDF from the exact
# same content without duplicating the Firestore-fetching logic in each
# generate_* function above.
# ---------------------------------------------------------------------------

def build_deck_sections(notes: dict) -> list[dict]:
    """Turns a {title, summary, sections, keyTakeaways} notes dict into the
    flat list of {kind, heading, body} slides both the pptx and pdf
    builders render, so the two file formats never drift apart."""
    slides = []
    if notes.get("summary"):
        slides.append({"kind": "text", "heading": "Summary", "body": notes["summary"]})
    for section in notes.get("sections", []):
        content = section.get("content", "")
        if content:
            slides.append({"kind": "text", "heading": section.get("heading", "Section"), "body": content})
    takeaways = notes.get("keyTakeaways", [])
    if takeaways:
        slides.append({"kind": "bullets", "heading": "Key Takeaways", "items": takeaways})
    return slides


def _build_pptx_from_notes(notes: dict, subtitle: str) -> BytesIO:
    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H
    blank_layout = prs.slide_layouts[6]  # fully blank — every element below is hand-placed

    _add_title_slide(prs, blank_layout, notes.get("title") or "Study Summary", subtitle)

    deck_sections = build_deck_sections(notes)
    for i, slide_data in enumerate(deck_sections):
        accent = ACCENT_CYCLE[i % len(ACCENT_CYCLE)]
        if slide_data["kind"] == "bullets":
            _add_bullet_slide(prs, blank_layout, slide_data["heading"], slide_data["items"], i + 1, accent)
        else:
            _add_text_slide(prs, blank_layout, slide_data["heading"], slide_data["body"], i + 1, accent)

    buffer = BytesIO()
    prs.save(buffer)
    buffer.seek(0)
    return buffer


def _safe_filename(value: str) -> str:
    return "".join(c if c.isalnum() or c in " -_" else "_" for c in value)


# ---------------------------------------------------------------------------
# Slide builders — every shape is hand-placed on a blank layout so the
# design (colored backgrounds, accent bars, numbered badges, bullet
# markers) is fully controlled rather than inherited from a default
# PowerPoint theme.
# ---------------------------------------------------------------------------

def _set_fill(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def _add_title_slide(prs: Presentation, layout, title: str, subtitle: str) -> None:
    slide = prs.slides.add_slide(layout)

    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    _set_fill(bg, NAVY)
    bg.shadow.inherit = False

    # Large soft gold arc/circle bleeding off the right edge as a decorative
    # accent — stands in for photography since no image-search API is
    # configured (see module docstring).
    circle = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(9.2), Inches(-2.5), Inches(7), Inches(7))
    _set_fill(circle, GOLD)
    circle.fill.fore_color.brightness = 0.0
    circle.shadow.inherit = False
    _set_transparency(circle, 70)

    circle2 = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(10.6), Inches(3.6), Inches(3.4), Inches(3.4))
    _set_fill(circle2, GOLD_LIGHT)
    circle2.shadow.inherit = False
    _set_transparency(circle2, 40)

    # Thin gold rule above the title, LearnMatrix wordmark styling.
    rule = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.7), Inches(2.55), Inches(1.1), Pt(4))
    _set_fill(rule, GOLD)
    rule.shadow.inherit = False

    brand_box = slide.shapes.add_textbox(Inches(0.7), Inches(2.05), Inches(6), Inches(0.5))
    brand_tf = brand_box.text_frame
    brand_tf.text = "LEARNMATRIX"
    brand_run = brand_tf.paragraphs[0].runs[0]
    brand_run.font.size = Pt(15)
    brand_run.font.bold = True
    brand_run.font.color.rgb = GOLD_LIGHT
    brand_run.font.name = "Arial"

    title_box = slide.shapes.add_textbox(Inches(0.65), Inches(2.9), Inches(9.5), Inches(2.2))
    title_tf = title_box.text_frame
    title_tf.word_wrap = True
    title_tf.text = title
    title_run = title_tf.paragraphs[0].runs[0]
    title_run.font.size = Pt(40)
    title_run.font.bold = True
    title_run.font.color.rgb = WHITE
    title_run.font.name = "Arial"

    sub_box = slide.shapes.add_textbox(Inches(0.7), Inches(4.9), Inches(9), Inches(0.6))
    sub_tf = sub_box.text_frame
    sub_tf.text = f"{subtitle}"
    sub_run = sub_tf.paragraphs[0].runs[0]
    sub_run.font.size = Pt(18)
    sub_run.font.color.rgb = CREAM
    sub_run.font.name = "Arial"


def _add_slide_chrome(prs, slide, heading, index, accent):
    """Shared header used by every content slide: colored left accent bar,
    a numbered badge, and the heading — keeps _add_text_slide and
    _add_bullet_slide visually consistent."""
    # Full-height accent bar down the left edge.
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(0.35), prs.slide_height)
    _set_fill(bar, accent)
    bar.shadow.inherit = False

    # White page background.
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.35), 0, prs.slide_width - Inches(0.35), prs.slide_height)
    _set_fill(bg, WHITE)
    bg.shadow.inherit = False
    # send background behind everything added after it by re-adding chrome on top — python-pptx has no z-order API,
    # so shapes are simply added in back-to-front order (bar/bg first, since they're added first, is already correct).

    # Numbered badge.
    badge = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(0.75), Inches(0.55), Inches(0.55), Inches(0.55))
    _set_fill(badge, accent)
    badge.shadow.inherit = False
    badge_tf = badge.text_frame
    badge_tf.word_wrap = False
    badge_tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    badge_tf.text = str(index)
    badge_run = badge_tf.paragraphs[0].runs[0]
    badge_tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    badge_run.font.size = Pt(18)
    badge_run.font.bold = True
    badge_run.font.color.rgb = WHITE if accent != GOLD_LIGHT else NAVY
    badge_run.font.name = "Arial"

    heading_box = slide.shapes.add_textbox(Inches(1.55), Inches(0.5), Inches(11), Inches(0.75))
    heading_tf = heading_box.text_frame
    heading_tf.word_wrap = True
    heading_tf.text = heading
    heading_run = heading_tf.paragraphs[0].runs[0]
    heading_run.font.size = Pt(26)
    heading_run.font.bold = True
    heading_run.font.color.rgb = NAVY
    heading_run.font.name = "Arial"

    rule = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(1.55), Inches(1.35), Inches(1.4), Pt(3))
    _set_fill(rule, accent)
    rule.shadow.inherit = False


def _add_text_slide(prs: Presentation, layout, heading: str, body: str, index: int, accent) -> None:
    slide = prs.slides.add_slide(layout)
    _add_slide_chrome(prs, slide, heading, index, accent)

    body_box = slide.shapes.add_textbox(Inches(1.55), Inches(1.75), Inches(11.1), Inches(5.2))
    text_frame = body_box.text_frame
    text_frame.word_wrap = True

    # A single dense paragraph reads poorly on a slide, so split on
    # sentence boundaries into shorter paragraphs rather than dumping
    # the whole block into one text run.
    sentences = [s.strip() for s in body.replace("\n", " ").split(". ") if s.strip()]
    if not sentences:
        sentences = [body[:2000]]

    first = True
    for sentence in sentences[:20]:  # cap paragraphs per slide — very long sources shouldn't produce one giant slide
        text = sentence + ("." if not sentence.endswith(".") else "")
        p = text_frame.paragraphs[0] if first else text_frame.add_paragraph()
        first = False
        p.space_after = Pt(12)
        run = p.add_run()
        run.text = text
        run.font.size = Pt(18)
        run.font.color.rgb = NAVY_MID
        run.font.name = "Arial"


def _add_bullet_slide(prs: Presentation, layout, heading: str, bullets: list[str], index: int, accent) -> None:
    slide = prs.slides.add_slide(layout)
    _add_slide_chrome(prs, slide, heading, index, accent)

    top = Inches(1.9)
    for b in bullets:
        marker = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(1.6), top + Inches(0.12), Inches(0.16), Inches(0.16))
        _set_fill(marker, accent)
        marker.shadow.inherit = False

        text_box = slide.shapes.add_textbox(Inches(1.95), top, Inches(10.7), Inches(0.7))
        tf = text_box.text_frame
        tf.word_wrap = True
        tf.text = b
        run = tf.paragraphs[0].runs[0]
        run.font.size = Pt(18)
        run.font.color.rgb = NAVY_MID
        run.font.name = "Arial"
        top += Inches(0.75)


def _set_transparency(shape, alpha_pct: int) -> None:
    """python-pptx has no first-class alpha API — this pokes the
    <a:alpha> element directly into the shape's solid fill XML.
    alpha_pct is how OPAQUE the shape should look (0 = invisible, 100 = solid)."""
    sp = shape.fill.fore_color._xFill
    alpha = sp.find(qn("a:srgbClr"))
    if alpha is None:
        return
    a = alpha.makeelement(qn("a:alpha"), {"val": str(alpha_pct * 1000)})
    alpha.append(a)
