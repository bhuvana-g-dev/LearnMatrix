"""
utils/source_text_extractor.py

Turns an uploaded chat source file into plain text, before chunking
(text_chunker.py) and embedding (embedding_service.py). Separate from
utils/pdf_question_extractor.py — that module parses a specific
question-paper STRUCTURE for the Admin Panel; this one just wants raw
readable text from whatever the student uploads, no structural parsing.

Reuses pdfplumber (already in requirements.txt) rather than adding a
second PDF library for the same job.
"""

import pdfplumber

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md"}


class SourceExtractionError(Exception):
    """Raised when the uploaded file can't be read at all, or has no
    extractable text (e.g. an image-only scanned PDF with no OCR)."""


def extract_text(file_stream, filename: str) -> str:
    ext = _extension(filename)
    if ext not in SUPPORTED_EXTENSIONS:
        raise SourceExtractionError(
            f"Unsupported file type '{ext}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}."
        )

    if ext == ".pdf":
        text = _extract_pdf_text(file_stream)
    else:
        text = _extract_plain_text(file_stream)

    if not text or not text.strip():
        raise SourceExtractionError(
            "No readable text found in this file — if it's a scanned PDF, "
            "it needs OCR before it can be used as a source."
        )
    return text.strip()


def _extension(filename: str) -> str:
    filename = filename.lower()
    idx = filename.rfind(".")
    return filename[idx:] if idx != -1 else ""


def _extract_pdf_text(file_stream) -> str:
    try:
        with pdfplumber.open(file_stream) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
    except Exception as exc:  # noqa: BLE001
        raise SourceExtractionError(f"Couldn't read this PDF: {exc}") from exc
    return "\n\n".join(p for p in pages if p)


def _extract_plain_text(file_stream) -> str:
    raw = file_stream.read()
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="ignore")
    return raw