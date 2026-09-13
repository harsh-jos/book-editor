"""Round-trip: a generated PDF restyles with identical content and intact figures."""
import re
import tempfile
import unittest
from pathlib import Path

import pymupdf
from jinja2 import Environment, FileSystemLoader

from backend.extract import _join_lines, extract

ROOT = Path(__file__).resolve().parent.parent
SENTENCES = [
    "The quick brown fox jumps over the lazy dog near the riverbank.",
    "Pack my box with five dozen liquor jugs before the night falls.",
]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


class RoundTripTest(unittest.TestCase):
    def test_extract_preserves_content_and_figures(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmpdir = Path(tmp)
            pdf_path = tmpdir / "fixture.pdf"
            doc = pymupdf.open()
            doc.set_metadata({"title": "Fixture Title", "author": "QA"})
            page = doc.new_page()
            page.insert_text((72, 100), "Fixture Title", fontsize=20)
            page.insert_text((72, 150), "Getting Started", fontsize=15)
            rect = pymupdf.Rect(72, 180, 500, 300)
            page.insert_textbox(rect, " ".join(SENTENCES), fontsize=11)
            page.insert_text((72, 340), "• alpha item", fontsize=11)
            page.insert_text((72, 356), "• beta item", fontsize=11)
            page.insert_text((72, 388), "1. first step", fontsize=11)
            page.insert_text((72, 404), "2. second step", fontsize=11)
            page.insert_text((72, 436), "    indented = True", fontsize=11, fontname="cour")
            page.insert_text((72, 452), "    print(indented)", fontsize=11, fontname="cour")
            pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 120, 80))
            pix.set_rect(pix.irect, (2, 132, 199))
            fig_src = tmpdir / "fig.png"
            pix.save(fig_src)
            page.insert_image(pymupdf.Rect(72, 480, 272, 560), filename=str(fig_src))
            doc.save(pdf_path)
            doc.close()

            assets = tmpdir / "assets"
            model = extract(pdf_path, assets)
            kinds = [b["type"] for b in model["blocks"]]

            self.assertEqual(model["title"], "Fixture Title")
            headings = [b["text"] for b in model["blocks"] if b["type"] == "heading"]
            self.assertIn("Getting Started", headings)
            body = " ".join(b["text"] for b in model["blocks"] if b["type"] == "paragraph")
            for sentence in SENTENCES:
                self.assertIn(sentence, normalize(body))
            lists = [b["items"] for b in model["blocks"] if b["type"] == "list"]
            self.assertIn(["alpha item", "beta item"], lists)
            self.assertIn(["1. first step", "2. second step"], lists)
            figures = [b for b in model["blocks"] if b["type"] == "figure"]
            self.assertEqual(len(figures), 1)
            saved = assets / Path(figures[0]["src"]).name
            self.assertTrue(saved.exists())
            self.assertEqual(saved.read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
            self.assertIn("figure", kinds)

            env = Environment(
                loader=FileSystemLoader(ROOT / "templates" / "whitepaper"), autoescape=True)
            html = env.get_template("template.html.j2").render(doc=model)
            self.assertNotIn("{{", html)
            self.assertIn("<h2>Getting Started</h2>", html)
            self.assertIn("Figure 1", html)
            code_blocks = [b for b in model["blocks"] if b["type"] == "code"]
            self.assertEqual(len(code_blocks), 1)
            self.assertIn("    indented = True\n    print(indented)", code_blocks[0]["text"])
            self.assertIn('<pre class="codeblock">', html)

    def test_join_lines_undoes_hyphenation(self):
        self.assertEqual(_join_lines(["extraor-", "dinary results"]), "extraordinary results")
        self.assertEqual(_join_lines(["well -", "known fact"]), "well known fact")
        self.assertEqual(_join_lines(["plain", "Old line"]), "plain Old line")


if __name__ == "__main__":
    unittest.main()
