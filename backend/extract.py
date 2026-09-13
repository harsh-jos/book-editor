"""Extract a PDF into the white-paper template's document model.

Same content out as in: text order and figures are preserved, nothing is
rewritten. All visual decisions belong to the Jinja template.
"""
from __future__ import annotations

import re
import statistics
from pathlib import Path

import pymupdf

BULLET_RE = re.compile(r"^[\s]*[•▪‣·*◦○\-–—]\s+(.*\S)\s*$")
NUMBERED_RE = re.compile(r"^\s*\d+[.)]\s+(\S.*)$")
MIN_FIGURE_PX = 24  # smaller images are usually glyphs, bullets, or rules
MONO_SUBSTRINGS = ("mono", "courier", "consolas", "menlo", "monaco")


def _is_mono_font(name: str) -> bool:
    lowered = name.lower()
    if any(key in lowered for key in MONO_SUBSTRINGS):
        return True
    return "code" in re.findall(r"[a-z]+", lowered)


def _line_text(spans: list[dict]) -> str:
    return re.sub(r"\s+", " ", "".join(s["text"] for s in spans)).strip()


def _join_lines(lines: list[str]) -> str:
    """Join wrapped lines, undoing end-of-line hyphenation."""
    out = ""
    for line in lines:
        if not line:
            continue
        if out.endswith("-") and len(out) > 1 and line[:1].islower():
            out = out[:-1] + line
        else:
            out = f"{out} {line}" if out else line
    return out


def _body_size(doc: pymupdf.Document) -> float:
    sizes = []
    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    if span["text"].strip():
                        sizes.append(round(span["size"], 1))
    return statistics.median(sizes) if sizes else 10.0


def _save_figure(src: pymupdf.Document, xref: int, dest: Path) -> bool:
    try:
        pix = pymupdf.Pixmap(src, xref)
        if pix.n > 4:  # CMYK and friends: flatten to RGB
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        pix.save(dest)
        return dest.stat().st_size > 0
    except Exception:
        return False


def extract(pdf_path: Path, assets_dir: Path) -> dict:
    """Read *pdf_path*, write figure PNGs into *assets_dir*, return the doc model."""
    src = pymupdf.open(pdf_path)
    n_pages = len(src)
    assets_dir.mkdir(parents=True, exist_ok=True)
    body = _body_size(src)

    meta = src.metadata or {}
    file_title = pdf_path.stem.replace("_", " ").replace("-", " ").strip()
    title = (meta.get("title") or "").strip() or file_title
    authors = (meta.get("author") or "").strip()

    blocks: list[dict] = []
    seen_xrefs: set[int] = set()
    fig_num = 0

    for page in src:
        # (page-y, sequence, kind, payload); stable sort keeps line order.
        events: list[tuple[float, int, str, dict]] = []
        seq = 0
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            raw_lines = []
            max_size = 0.0
            for line in block["lines"]:
                text = _line_text(line["spans"])
                if not text:
                    continue
                size = max((s["size"] for s in line["spans"]), default=0.0)
                max_size = max(max_size, size)
                mono_chars = sum(len(s["text"]) for s in line["spans"]
                                 if _is_mono_font(s.get("font", "")))
                total_chars = sum(len(s["text"]) for s in line["spans"])
                raw_lines.append({
                    "text": text,
                    "raw": "".join(s["text"] for s in line["spans"]).rstrip(),
                    "code": total_chars > 0 and mono_chars / total_chars > 0.5,
                    "size": size,
                    "x0": line["bbox"][0],
                })
            if not raw_lines:
                continue
            joined = _join_lines([ln["text"] for ln in raw_lines])
            n_code = sum(1 for ln in raw_lines if ln["code"])
            if n_code >= 2 and n_code / len(raw_lines) >= 0.5:
                events.append((block["bbox"][1], seq, "code",
                               {"text": "\n".join(ln["raw"] for ln in raw_lines)}))
                seq += 1
            elif max_size > body * 1.12 and len(joined) < 200:
                events.append((block["bbox"][1], seq, "heading", {"text": joined}))
                seq += 1
            else:
                for ln in raw_lines:
                    events.append((block["bbox"][1], seq, "line", ln))
                    seq += 1

        for img in page.get_images(full=True):
            xref = img[0]
            if xref in seen_xrefs:
                continue
            try:
                rects = page.get_image_rects(xref)
            except Exception:
                continue
            if not rects:
                continue
            rect = rects[0]
            if rect.width < MIN_FIGURE_PX or rect.height < MIN_FIGURE_PX:
                continue
            seen_xrefs.add(xref)
            fig_num += 1
            dest = assets_dir / f"fig{fig_num}.png"
            if not _save_figure(src, xref, dest):
                continue
            events.append(((rect.y0 + rect.y1) / 2, seq, "figure",
                           {"number": fig_num, "file": dest.name}))
            seq += 1

        events.sort(key=lambda e: (e[0], e[1]))
        para_lines: list[str] = []
        pending_bullets: list[str] = []
        pending_numbered: list[str] = []
        marker_x0: float | None = None

        def flush_para() -> None:
            if para_lines:
                blocks.append({"type": "paragraph", "text": _join_lines(para_lines)})
                para_lines.clear()

        def flush_lists() -> None:
            if pending_bullets:
                blocks.append({"type": "list", "items": pending_bullets.copy()})
                pending_bullets.clear()
            if len(pending_numbered) >= 2:
                blocks.append({"type": "list", "items": pending_numbered.copy()})
            elif pending_numbered:
                blocks.append({"type": "paragraph", "text": pending_numbered[0]})
            pending_numbered.clear()

        for _, _, kind, payload in events:
            if kind == "figure":
                flush_para()
                flush_lists()
                blocks.append({"type": "figure", "number": payload["number"],
                               "src": f"figures/{payload['file']}",
                               "alt": f"Figure {payload['number']} from the original document",
                               "caption": ""})
                continue
            if kind == "code":
                flush_para()
                flush_lists()
                blocks.append({"type": "code", "text": payload["text"]})
                continue
            if kind == "heading":
                flush_para()
                flush_lists()
                blocks.append({"type": "heading", "number": "", "text": payload["text"]})
                continue
            text, x0 = payload["text"], payload["x0"]
            bullet = BULLET_RE.match(text)
            if bullet:
                flush_para()
                if pending_numbered:
                    flush_lists()
                pending_bullets.append(bullet.group(1))
                marker_x0 = x0
                continue
            numbered = NUMBERED_RE.match(text)
            if numbered:
                flush_para()
                if pending_bullets:
                    flush_lists()
                pending_numbered.append(text)  # keep original numbering: content
                marker_x0 = x0
                continue
            active = pending_bullets or pending_numbered
            if active and marker_x0 is not None and x0 > marker_x0 + 2:
                active[-1] += " " + text  # wrapped list item, not a new paragraph
                continue
            flush_lists()
            para_lines.append(text)
        flush_para()
        flush_lists()

    src.close()
    return {
        "kicker": "Restyled document",
        "short_title": title if len(title) <= 60 else title[:57] + "...",
        "title": title,
        "subtitle": "",
        "authors": authors,
        "date": "",
        "footer_left": pdf_path.name,
        "footer_right": f"{n_pages} pages",
        "blocks": blocks,
    }
