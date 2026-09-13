"""Render the white-paper Jinja template with sample content for visual review."""
from pathlib import Path
import shutil

from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = ROOT / "templates" / "whitepaper"
OUT_DIR = ROOT / "previews"

DOC = {
    "kicker": "White paper",
    "short_title": "Cutting last-mile delivery emissions",
    "title": "Cutting last-mile delivery emissions",
    "subtitle": "What two years of pilots taught us about e-cargo bikes, micro-hubs, and the diesel baseline.",
    "authors": "Northwind Logistics Research",
    "date": "September 2026",
    "footer_left": "Northwind Logistics Research",
    "footer_right": "Working paper · September 2026",
    "blocks": [
        {"type": "heading", "number": "", "text": "Executive summary"},
        {"type": "paragraph", "text": (
            "Last-mile delivery now accounts for the fastest-growing share of urban transport emissions. "
            "Between 2024 and 2025 we ran twelve pilots across nine cities to find out which interventions "
            "actually move the number — and which only look good in a slide deck.")},
        {"type": "paragraph", "text": (
            "The short version: e-cargo bikes paired with micro-hubs cut per-parcel emissions by 34% against "
            "the diesel baseline, at a cost increase of four cents per parcel. Everything else helped, but "
            "nothing else came close.")},
        {"type": "heading", "number": "1", "text": "Where the emissions come from"},
        {"type": "paragraph", "text": (
            "A diesel van delivering 120 parcels a day emits roughly 96 grams of CO2 per parcel by 2025, up "
            "from 78 grams in 2021. Demand grew faster than routing software could compensate: more stops, "
            "tighter time windows, and more failed first attempts.")},
        {"type": "figure", "number": "1", "src": "figures/fig1.svg",
         "alt": "Line chart of emissions per parcel rising for diesel and falling with e-cargo bikes",
         "caption": "Average grams of CO2 per parcel. The diesel baseline kept rising with demand; "
                    "routes converted to e-cargo bikes plus micro-hubs bent the curve within two quarters."},
        {"type": "heading", "number": "2", "text": "What actually moved the needle"},
        {"type": "paragraph", "text": (
            "Four interventions survived contact with operations. Parcel lockers and night windows are cheap "
            "and nearly free to run, but their ceiling is low. Full EV van fleets help more, at a real cost. "
            "E-cargo bikes combined with micro-hubs were the outlier in every city we tried them.")},
        {"type": "table", "number": "1", "caption": "Pilot results, 2024–2025, against the diesel-van baseline.",
         "headers": ["Intervention", "Pilot cities", "CO2 cut", "Cost / parcel"],
         "rows": [
             ["E-cargo bikes + micro-hubs", "6", "34%", "+€0.04"],
             ["EV van fleet", "9", "21%", "+€0.11"],
             ["Night delivery windows", "3", "12%", "−€0.02"],
             ["Parcel lockers", "12", "9%", "−€0.06"],
         ]},
        {"type": "list", "items": [
            "Micro-hubs matter more than the bikes: without a hub within 2 km, bike productivity collapses.",
            "Night windows work only where noise rules allow them — two of five cities said no.",
            "EV vans underperform in winter; plan for a 15% range penalty in northern pilots.",
        ]},
        {"type": "code", "text": (
            "hubs = find_micro_hubs(city, max_distance_km=2)\n"
            "routes = assign_bikes(hubs, fleet=40)\n"
            "\n"
            "cut = simulate(routes, baseline=\"diesel\")\n"
            "print(f\"CO2 cut: {cut:.0%}\")  # 34%")},
        {"type": "figure", "number": "2", "src": "figures/fig2.svg",
         "alt": "Bar chart comparing CO2 cuts of four interventions",
         "caption": "CO2 cut by intervention. Only the e-cargo and micro-hub combination clears 30%."},
        {"type": "heading", "number": "3", "text": "Recommendation"},
        {"type": "paragraph", "text": (
            "Fund hubs first and bikes second: one micro-hub unlocks roughly forty bike routes, while bikes "
            "without a hub save almost nothing. Keep lockers and night windows as complements, not substitutes. "
            "That sequencing is the difference between a pilot that photographs well and one that compounds.")},
    ],
}


def main() -> None:
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=True)
    html = env.get_template("template.html.j2").render(doc=DOC, engine_class="engine-browser")
    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "whitepaper.html").write_text(html, encoding="utf-8")
    shutil.copy(TEMPLATE_DIR / "theme.css", OUT_DIR / "theme.css")
    shutil.copytree(ROOT / "sample" / "figures", OUT_DIR / "figures", dirs_exist_ok=True)
    print(f"wrote {OUT_DIR / 'whitepaper.html'}")


if __name__ == "__main__":
    main()
