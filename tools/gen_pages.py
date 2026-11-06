#!/usr/bin/env python3
"""Erzeugt für jedes Rezept ohne Quell-Link eine öffentliche Seite mit schema.org-Daten,
damit die Bring-App die Zutaten lesen kann. Aufruf: FAMILY_CODE=... python3 tools/gen_pages.py"""
import json, os, html, pathlib, urllib.request

API = "https://xmirwnrhcngrlnxhkfay.supabase.co/functions/v1/rezepte"
OUT = pathlib.Path(__file__).resolve().parent.parent / "r"

req = urllib.request.Request(
    API, data=json.dumps({"action": "list"}).encode(),
    headers={"content-type": "application/json", "x-family-code": os.environ["FAMILY_CODE"]})
recipes = json.load(urllib.request.urlopen(req, timeout=60))["recipes"]

OUT.mkdir(exist_ok=True)
keep = set()
for r in recipes:
    if r.get("source_url"):
        continue
    steps = [s.strip() for s in (r.get("steps") or "").split("\n") if s.strip()]
    ld = {
        "@context": "https://schema.org", "@type": "Recipe", "name": r["title"],
        "recipeYield": str(r["servings"]),
        "recipeIngredient": r["ingredients"],
        "recipeInstructions": [{"@type": "HowToStep", "text": s} for s in steps],
    }
    if r.get("image_url"):
        ld["image"] = r["image_url"]
    page = f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>{html.escape(r['title'])}</title>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False).replace('</', '<\\/')}</script>
</head><body>
<h1>{html.escape(r['title'])}</h1>
<p>Für {html.escape(str(r['servings']))} Portionen</p>
<ul>{''.join(f'<li>{html.escape(i)}</li>' for i in r['ingredients'])}</ul>
{''.join(f'<p>{html.escape(s)}</p>' for s in steps)}
</body></html>
"""
    name = f"{r['id']}.html"
    keep.add(name)
    (OUT / name).write_text(page, encoding="utf-8")

for f in OUT.glob("*.html"):
    if f.name not in keep:
        f.unlink()
print(f"{len(keep)} Seiten erzeugt")
