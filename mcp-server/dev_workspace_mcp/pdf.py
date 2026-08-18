"""Extract text from PDF bytes (transcrições de reunião)."""

from __future__ import annotations

import base64
import binascii
import io
import os

from pypdf import PdfReader

MAX_PDF_BYTES = int(os.environ.get("MCP_MAX_PDF_BYTES", str(20 * 1024 * 1024)))


def decode_pdf_base64(pdf_base64: str) -> bytes:
    raw = pdf_base64.strip()
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    try:
        data = base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"pdf_base64 inválido: {exc}") from exc

    if not data:
        raise ValueError("PDF vazio após decode base64.")
    if len(data) > MAX_PDF_BYTES:
        raise ValueError(
            f"PDF excede limite de {MAX_PDF_BYTES // (1024 * 1024)}MB "
            f"({len(data)} bytes)."
        )
    if not data.startswith(b"%PDF"):
        raise ValueError("Conteúdo não parece um PDF (%PDF header ausente).")
    return data


def extract_text_from_pdf_bytes(data: bytes) -> tuple[str, int]:
    reader = PdfReader(io.BytesIO(data))
    pages = len(reader.pages)
    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            parts.append(text.strip())
    text = "\n\n".join(parts).strip()
    if not text:
        raise ValueError("Nenhum texto extraído do PDF (pode ser scan sem OCR).")
    return text, pages


def extract_text_from_pdf_base64(pdf_base64: str) -> tuple[str, int]:
    data = decode_pdf_base64(pdf_base64)
    return extract_text_from_pdf_bytes(data)
