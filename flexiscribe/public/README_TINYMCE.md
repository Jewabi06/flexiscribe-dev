# TinyMCE Implementation

Replaced Quill.js with TinyMCE for better Cornell format table support.

## What Changed

- **Editor:** Quill.js → TinyMCE (self-hosted)
- **Reason:** TinyMCE has native support for:
  - Complex table structures
  - Cell merging/splitting
  - Table operations (insert/delete rows/columns)
  - Cornell note format preservation

## Files

- `page.jsx`: Clean TinyMCE implementation (240 lines, down from 379)
- `styles.tinymce.css`: Minimal TinyMCE-specific styles (177 lines)
- `page.jsx.backup`: Original Quill version (if you need to revert)
- `public/tinymce/`: TinyMCE assets (self-hosted, no CDN needed)

## Cornell Format Support

TinyMCE will properly handle:
- 2-column tables (30% cue, 70% notes)
- Merged header row (Date | Title)
- Merged summary row (full width)
- Cell editing without breaking structure
- Paste content without table breakage

## Usage

The editor automatically loads DOCX files from `/public/sample.docx`:
1. Backend generates Cornell-formatted DOCX
2. Frontend converts DOCX → HTML (mammoth.js)
3. TinyMCE displays with full table editing
4. User edits content
5. Save to backend → Convert to PDF

## Backend Integration

See `server/BACKEND_INTEGRATION.md` for:
- FastAPI endpoints for save/load
- Python-docx Cornell format generation
- HTML → PDF conversion with WeasyPrint/xhtml2pdf
