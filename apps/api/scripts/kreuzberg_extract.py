"""
Kreuzberg document extraction script with OCR support.
Called by the Node.js backend as a subprocess.

Usage:
    python kreuzberg_extract.py <file_path> [mime_type]

Outputs JSON to stdout with keys:
    text, mime, tables, metadata

OCR is automatically applied for:
  - Image files (PNG, JPG, TIFF, BMP, WEBP, GIF)
  - PDFs (kreuzberg auto-detects scanned pages)
Table detection is always enabled via TesseractConfig.
"""

import sys
import json
import asyncio
import os
from pathlib import Path

# Force UTF-8 on Windows to avoid charmap encoding errors
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

try:
    from kreuzberg import extract_file, ExtractionConfig, OcrConfig, TesseractConfig
except ImportError:
    print(json.dumps({"error": "kreuzberg is not installed. Run: pip install kreuzberg"}))
    sys.exit(1)

# Extensions and MIME types that are pure images and require force_ocr
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "tif", "tiff", "bmp", "webp", "gif"}
IMAGE_MIMES = {
    "image/png", "image/jpeg", "image/tiff", "image/bmp",
    "image/webp", "image/gif", "image/x-tiff",
}


async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: kreuzberg_extract.py <file_path> [mime_type]"}))
        sys.exit(1)

    file_path = Path(sys.argv[1])
    mime_hint = sys.argv[2] if len(sys.argv) >= 3 else None

    if not file_path.exists():
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(1)

    ext = file_path.suffix.lower().lstrip(".")
    is_image = ext in IMAGE_EXTENSIONS or (mime_hint in IMAGE_MIMES if mime_hint else False)

    # OcrConfig wraps the backend + TesseractConfig for fine-grained settings
    ocr_config = OcrConfig(
        backend="tesseract",
        language="eng",
        tesseract_config=TesseractConfig(
            enable_table_detection=True,
            psm=3,  # Fully automatic page segmentation (best for mixed content)
        ),
    )

    # force_ocr=True for images so kreuzberg actually runs Tesseract on them.
    # For PDFs, kreuzberg auto-detects scanned pages and applies OCR as needed.
    extraction_config = ExtractionConfig(
        force_ocr=is_image,
        ocr=ocr_config,
    )

    try:
        result = await extract_file(file_path, mime_type=mime_hint, config=extraction_config)

        # Serialize tables (cells + markdown per table)
        tables = []
        for t in (result.tables or []):
            tables.append({
                "page": t.page_number,
                "markdown": t.markdown,
                "cells": t.cells,
            })

        output = {
            "text": result.content,
            "mime": result.mime_type if hasattr(result, "mime_type") else mime_hint,
            "tables": tables,
            "metadata": dict(result.metadata) if result.metadata else {},
        }

        print(json.dumps(output, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
