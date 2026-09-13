"""Restyle a PDF through a Jinja template.

Usage (from the project root):
    source .venv/bin/activate
    python scripts/restyle.py BOOK.pdf [--template whitepaper] [--out previews/mydoc]
"""
import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.extract import extract  # noqa: E402
from jinja2 import Environment, FileSystemLoader  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Restyle a PDF without changing its content.")
    parser.add_argument("pdf", type=Path, help="Input PDF file")
    parser.add_argument("--template", default="whitepaper", help="Template directory name")
    parser.add_argument("--out", type=Path, default=None, help="Output directory")
    args = parser.parse_args()

    template_dir = ROOT / "templates" / args.template
    out_dir = args.out or (ROOT / "previews" / args.pdf.stem)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    assets_dir = out_dir / "figures"

    doc = extract(args.pdf, assets_dir)
    env = Environment(loader=FileSystemLoader(template_dir), autoescape=True)
    (out_dir).mkdir(parents=True, exist_ok=True)
    (out_dir / "restyled.html").write_text(
        env.get_template("template.html.j2").render(doc=doc, engine_class="engine-browser"),
        encoding="utf-8")
    shutil.copy(template_dir / "theme.css", out_dir / "theme.css")

    n_figs = sum(1 for b in doc["blocks"] if b["type"] == "figure")
    print(f"pages={doc['footer_right']} blocks={len(doc['blocks'])} "
          f"figures={n_figs} -> {out_dir / 'restyled.html'}")


if __name__ == "__main__":
    main()
