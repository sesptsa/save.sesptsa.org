#!/usr/bin/env python3
"""Convert the Google Docs HTML export of the community letter into the page's HTML.

How a content update works:
  1. In the Google Doc, File > Download > Web page (.html, zipped); unzip it.
  2. python3 -I tools/letter2html.py <export>.html <out_dir>
  3. Paste out_dir/letter.html into index.html in place of the paragraphs and
     <h2>s from the salutation to .letter-close, and out_dir/references.html in
     place of the <ol class="references-list">. The reference count on the page
     is filled in by script.js from the list.
  4. Open the page: every citation marker must have a matching reference
     (the script asserts the counts match).

Headings in the Doc are ALL CAPS; the HEADINGS table below maps them to sentence
case, so a new or reworded heading needs a new entry here. Everything else
(bold, italic, superscript citation markers, links) is read from the export's
own styles.
"""
import html
import re
import sys
import urllib.parse
from pathlib import Path

src = Path(sys.argv[1]).read_text(encoding="utf-8")
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

# --- which classes mean what -------------------------------------------------
style = re.search(r"<style.*?</style>", src, re.S).group(0)
classes = {m.group(1): m.group(2) for m in re.finditer(r"\.(c\d+)\{([^}]*)\}", style)}
SUPER = {c for c, d in classes.items() if "vertical-align:super" in d}
BOLD = {c for c, d in classes.items() if "font-weight:700" in d}
ITALIC = {c for c, d in classes.items() if "font-style:italic" in d}
assert SUPER and BOLD, (SUPER, BOLD)

body = src.split("<body", 1)[1]
body = body[body.index(">") + 1 :]
paras = re.findall(r"<p[^>]*>(.*?)</p>", body, re.S)

HEADINGS = {
    "SUNNYSIDE ENVIRONMENTAL SCHOOL IS WORKING":
        "Sunnyside Environmental School is working",
    "BEING A K-8 ENVIRONMENTAL SCHOOL IS INTEGRAL TO SUNNYSIDE’S CONTINUED SUCCESS AND KEEPS STUDENTS IN PPS":
        "Being a K-8 environmental school is integral to Sunnyside’s continued success and keeps students in PPS",
    "DISMANTLING SUNNYSIDE RUNS AFOUL OF PPS’S COMMITMENT TO CLIMATE JUSTICE EDUCATION":
        "Dismantling Sunnyside runs afoul of PPS’s commitment to climate justice education",
    "SUNNYSIDE MIDDLE SCHOOLERS TANGIBLY BENEFIT THE LOWER GRADES AND THEIR LARGER COMMUNITY":
        "Sunnyside middle schoolers tangibly benefit the lower grades and their larger community",
    "PPS BOARD POLICY 6.10.022-P REQUIRES THE DISTRICT TO COLLABORATE WITH SUNNYSIDE BEFORE TERMINATING ITS FOCUS PROGRAM AND THIS HAS NOT OCCURRED":
        "PPS Board Policy 6.10.022-P requires the District to collaborate with Sunnyside before terminating its focus program and this has not occurred",
    "IF SUNNYSIDE IS MADE A K-5 AND STRIPPED OF ITS FOCUS PROGRAMMING, PPS WILL LOSE ALL THE BENEFITS DETAILED ABOVE":
        "If Sunnyside is made a K-5 and stripped of its focus programming, PPS will lose all the benefits detailed above",
}

BR = "\x00BR\x00"


def runs_of(p):
    """Yield (kind, payload) runs from one exported <p>."""
    for m in re.finditer(r"<span(?: class=\"([^\"]*)\")?>(.*?)</span>|<a class=\"[^\"]*\" href=\"([^\"]+)\">(.*?)</a>|(<br>)", p, re.S):
        if m.group(5):
            yield ("br", None)
            continue
        if m.group(3):
            url = html.unescape(m.group(3))
            q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("q")
            url = q[0] if q else url
            text = re.sub(r"<br>", "", m.group(4)).replace("&nbsp;", "").strip()
            if text:
                yield ("link", url)
            for _ in re.findall(r"<br>", m.group(4)):
                yield ("br", None)
            continue
        cls = set((m.group(1) or "").split())
        inner = m.group(2)
        if cls & SUPER:
            num = re.sub(r"<br>|&nbsp;", "", inner).strip()
            if num:
                assert num.isdigit(), inner
                yield ("cite", int(num))
            for _ in re.findall(r"<br>", inner):
                yield ("br", None)
            continue
        # a span may itself contain <br> or <a>
        for part in re.split(r"(<br>|<a [^>]*>.*?</a>)", inner, flags=re.S):
            if not part:
                continue
            if part == "<br>":
                yield ("br", None)
            elif part.startswith("<a "):
                for r in runs_of(part):
                    yield r
            else:
                yield ("text", (part, bool(cls & BOLD), bool(cls & ITALIC)))


def render_text(text, bold, italic):
    s = text
    if italic:
        s = f"<em>{s}</em>"
    if bold:
        s = f"<strong>{s}</strong>"
    return s


# --- split into letter and references ----------------------------------------
ref_start = next(i for i, p in enumerate(paras) if "REFERENCES" in p)
letter_paras, ref_paras = paras[:ref_start], paras[ref_start + 1 :]

# --- letter -------------------------------------------------------------------
blocks = []  # list of lists of runs
for p in letter_paras:
    cur = []
    for kind, payload in runs_of(p):
        if kind == "br":
            blocks.append(cur)
            cur = []
        else:
            cur.append((kind, payload))
    blocks.append(cur)

letter_html = []
cites_seen = []
for runs in blocks:
    plain = html.unescape("".join(t for k, (t, *_) in [(k, v if k == "text" else ("", 0, 0)) for k, v in runs] if k == "text"))
    plain = plain.replace("\xa0", " ").strip()
    if not plain and not any(k == "cite" for k, _ in runs):
        continue
    if plain.startswith("To the") and plain.endswith(":"):   # the salutation
        letter_html.append(f'<p class="salutation">{html.escape(plain, quote=False)}</p>')
        continue
    key = plain.upper()
    if all(k != "text" or v[1] or not html.unescape(v[0]).replace("\xa0", " ").strip() for k, v in runs) and key in HEADINGS:
        letter_html.append(f"<h2>{html.escape(HEADINGS[key], quote=False)}</h2>")
        continue
    assert key not in HEADINGS, plain
    parts = []
    for kind, payload in runs:
        if kind == "text":
            parts.append(render_text(*payload))
        elif kind == "cite":
            n = payload
            cites_seen.append(n)
            parts.append(f'<sup class="cite" id="cite-{n}"><a href="#ref-{n}">{n}</a></sup>')
    s = "".join(parts)
    # tidy: leading nbsp, nbsp after citations, merge adjacent strong tags
    s = re.sub(r"^(&nbsp;|\s)+", "", s)
    s = s.replace("</sup>&nbsp;", "</sup> ")
    s = s.replace("</strong><strong>", "")
    s = s.replace("<strong>.</strong>", ".")            # a bolded period is a doc artifact
    s = re.sub(r"\s+</strong>", "</strong> ", s)       # trailing space belongs outside the bold run
    s = s.replace("</strong>&nbsp;", "</strong> ")
    s = re.sub(r"\s+$", "", s)
    if plain in ("Sincerely,", "[Signatures]"):         # the closing is hand-written in index.html
        continue
    letter_html.append(f"<p>{s}</p>")


# --- references ---------------------------------------------------------------
refs = []
for p in ref_paras:
    runs = list(runs_of(p))
    text_runs = [v[0] for k, v in runs if k == "text"]
    if not "".join(text_runs).strip():
        continue
    m = re.match(r"\s*(\d+)\.\s*", html.unescape(text_runs[0]))
    assert m, text_runs[0]
    n = int(m.group(1))
    parts = []
    first = True
    for kind, payload in runs:
        if kind == "text":
            t, b, i = payload
            if first:
                t = re.sub(r"^\s*\d+\.\s*", "", t)
                first = False
            parts.append(render_text(t, b, i))
        elif kind == "link":
            parts.append(f' <a target="_blank" href="{html.escape(payload)}" rel="noopener">{html.escape(payload)}</a>')
        elif kind == "br":
            parts.append("<br>")
    s = "".join(parts)
    s = re.sub(r"(<br>)+$", "", s)
    s = s.replace("<br>&nbsp;", "<br>").replace("<br> ", "<br>")
    s = re.sub(r"\s+$", "", s)
    refs.append((n, s))

# Every reference must be cited exactly once, in order, and vice versa.
assert [n for n, _ in refs] == list(range(1, len(refs) + 1)), [n for n, _ in refs]
assert sorted(cites_seen) == [n for n, _ in refs], cites_seen

ref_html = ["<ol class=\"references-list\">"]
for n, s in refs:
    ref_html.append(
        f'  <li id="ref-{n}"><span class="ref-body">{s}</span> '
        f'<a class="backref" href="#cite-{n}" aria-label="Back to citation {n} in the letter">↩&#xFE0E;</a></li>'
    )
ref_html.append("</ol>")

(out / "letter.html").write_text("\n".join(letter_html) + "\n", encoding="utf-8")
(out / "references.html").write_text("\n".join(ref_html) + "\n", encoding="utf-8")
print(f"letter: {len(letter_html)} blocks, {len(cites_seen)} citations; refs: {len(refs)}")
