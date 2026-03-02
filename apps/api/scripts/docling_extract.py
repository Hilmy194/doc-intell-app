"""
Docling document extraction script.
Called by the Node.js backend as a subprocess.

Usage:
    python docling_extract.py <file_path> [mime_type]

Outputs JSON to stdout with keys:
    text, markdown, tables, pages, wordCount, metadata
"""

import sys
import json
import os
from pathlib import Path

# Force UTF-8 on Windows to avoid charmap encoding errors
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

try:
    from docling.document_converter import DocumentConverter
except ImportError:
    print(json.dumps({"error": "docling is not installed. Run: pip install docling"}))
    sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: docling_extract.py <file_path> [mime_type]"}))
        sys.exit(1)

    file_path = Path(sys.argv[1])
    mime_hint = sys.argv[2] if len(sys.argv) >= 3 else None

    if not file_path.exists():
        print(json.dumps({"error": f"File not found: {file_path}"}))
        sys.exit(1)

    try:
        converter = DocumentConverter()
        result = converter.convert(str(file_path))

        # Get markdown export
        markdown_text = result.document.export_to_markdown()

        # Get plain text
        plain_text = markdown_text  # Docling's markdown is the primary text output

        # Extract tables
        tables = []
        if hasattr(result.document, 'tables'):
            for i, table in enumerate(result.document.tables):
                table_md = ""
                if hasattr(table, 'export_to_markdown'):
                    table_md = table.export_to_markdown()
                elif hasattr(table, 'to_markdown'):
                    table_md = table.to_markdown()
                tables.append({
                    "page": getattr(table, 'page_no', i),
                    "markdown": table_md,
                    "cells": [],
                })

        # Estimate pages and word count
        word_count = len(plain_text.split()) if plain_text else 0
        pages = max(1, len(plain_text) // 3000) if plain_text else 0

        output = {
            "text": plain_text,
            "markdown": markdown_text,
            "tables": tables,
            "pages": pages,
            "wordCount": word_count,
            "metadata": {
                "source": str(file_path.name),
                "mime": mime_hint or "",
            },
        }

        print(json.dumps(output, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
