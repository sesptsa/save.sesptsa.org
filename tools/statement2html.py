#!/usr/bin/env python3
"""Convert the Google Docs HTML export of the community statement (the response
to the Superintendent's final recommendation) into the HTML for response/index.html.

How a content update works:
  1. In the Google Doc, File > Download > Web page (.html, zipped); unzip it.
  2. python3 -I tools/statement2html.py <export>.html <out_dir>
  3. Paste out_dir/statement.html into response/index.html between the
     "statement:start" and "statement:end" comments, out_dir/notes.html in place
     of the <ol class="references-list notes-list">, and out_dir/references.html
     in place of the <ul class="references-list sources-list">.
  4. Read the warnings: a "[Date]" or "[Title of ...]" still in the Doc is
     printed here and has to be settled before the page goes out.

The Doc is: a bold title (hand-written in the page, so skipped here), the
paragraphs, a bold "Notes" line with a numbered list, a bold "References" line
with one source per paragraph. Note markers are typed as "[1]" in the text.
Bold, italic and links are read from the export's own styles.
"""
import html
import re
import sys
import urllib.parse
from pathlib import Path

src = Path(sys.argv[1]).read_text(encoding="utf-8")
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

style = re.search(r"<style.*?</style>", src, re.S).group(0)
classes = {m.group(1): m.group(2) for m in re.finditer(r"\.(c\d+)\{([^}]*)\}", style)}
BOLD = {c for c, d in classes.items() if "font-weight:700" in d}
ITALIC = {c for c, d in classes.items() if "font-style:italic" in d}

body = src.split("<body", 1)[1]
BR = "\x00"


def runs_of(inner):
    """Yield (text, bold, italic, url) runs from one exported <p> or <li>;
    text is plain (unescaped), with BR for a line break."""
    bold = italic = False
    url = None
    for m in re.finditer(r"<span(?: class=\"([^\"]*)\")?[^>]*>|</span>|<a [^>]*href=\"([^\"]*)\"[^>]*>|</a>|<br>|<[^>]+>|([^<]+)", inner):
        tag = m.group(0)
        if tag.startswith("<span"):
            cls = set((m.group(1) or "").split())
            bold, italic = bool(cls & BOLD), bool(cls & ITALIC)
        elif tag == "</span>":
            bold = italic = False
        elif tag.startswith("<a "):
            # Docs wraps links in a google.com/url?q= redirect.
            url = html.unescape(m.group(2))
            q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query).get("q")
            url = q[0] if q and "google.com/url" in url else url
        elif tag == "</a>":
            url = None
        elif tag == "<br>":
            yield (BR, False, False, None)
        elif m.group(3):
            yield (html.unescape(m.group(3)).replace("\xa0", " "), bold, italic, url)


def render(runs, link_text=None):
    """Inline HTML for a list of runs. Adjacent runs with the same styling are
    joined first (the Doc splits them wherever it was edited)."""
    merged = []
    for text, bold, italic, url in runs:
        if not text.strip():
            bold, italic = (merged[-1][1], merged[-1][2]) if merged else (False, False)
        if merged and merged[-1][1:] == (bold, italic, url):
            merged[-1] = (merged[-1][0] + text, bold, italic, url)
        else:
            merged.append((text, bold, italic, url))
    parts = []
    for text, bold, italic, url in merged:
        if not text.strip():
            parts.append(" " if text else "")
            continue
        lead = " " if text[0].isspace() else ""
        trail = " " if text[-1].isspace() else ""
        s = html.escape(text.strip(), quote=False)
        # A straight apostrophe typed in the Doc ("It's", "students'") becomes the curly one.
        s = re.sub(r"(?<=\w)'", "\u2019", s)
        # "... not evidence based [1], harms" -> a superscript link to the note.
        s = re.sub(r"\s*\[(\d+)\]", r'<sup class="cite" id="cite-\1"><a href="#note-\1">\1</a></sup>', s)
        if italic:
            s = f"<em>{s}</em>"
        if bold:
            s = f"<strong>{s}</strong>"
        if url:
            s = f'<a href="{html.escape(url)}" target="_blank" rel="noopener">{s}</a>'
        parts.append(lead + s + trail)
    s = "".join(parts)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r" (<sup class=\"cite\")", r"\1", s)
    s = re.sub(r" ([.,;:])", r"\1", s)  # a space the Doc left before punctuation
    return s


def plain(runs):
    return re.sub(r"\s+", " ", "".join(r[0] for r in runs)).strip()


# The blocks in order: ("p", runs) or ("li", runs); a <br> inside a paragraph
# starts a new one.
blocks = []
for m in re.finditer(r"<(p|li)\b[^>]*>(.*?)</\1>", body, re.S):
    cur = []
    for run in runs_of(m.group(2)):
        if run[0] == BR:
            blocks.append((m.group(1), cur))
            cur = []
        else:
            cur.append(run)
    blocks.append((m.group(1), cur))
blocks = [(kind, runs) for kind, runs in blocks if plain(runs)]

names = [plain(runs) for _, runs in blocks]
notes_at, refs_at = names.index("Notes"), names.index("References")
assert 0 < notes_at < refs_at, (notes_at, refs_at)

title = names[0]
statement = [render(runs) for _, runs in blocks[1:notes_at]]
notes = [render(runs) for kind, runs in blocks[notes_at + 1 : refs_at] if kind == "li"]
refs = [render(runs) for _, runs in blocks[refs_at + 1 :]]
# A source's address typed as plain text becomes a link like the others.
refs = [
    re.sub(r'(?<![">])(https?://[^\s<]+)', r'<a href="\1" target="_blank" rel="noopener">\1</a>', s)
    for s in refs
]

# Every note is marked once in the text, in order, and the other way round.
marks = [int(n) for n in re.findall(r'id="cite-(\d+)"', "\n".join(statement))]
assert marks == list(range(1, len(notes) + 1)), (marks, len(notes))

(out / "statement.html").write_text(
    "\n".join(f"        <p>{s}</p>" for s in statement) + "\n", encoding="utf-8"
)
(out / "notes.html").write_text(
    '          <ol class="references-list notes-list">\n'
    + "\n".join(
        f'            <li id="note-{n}"><span class="ref-body">{s}</span> '
        f'<a class="backref" href="#cite-{n}" aria-label="Back to note {n} in the statement">↩&#xFE0E;</a></li>'
        for n, s in enumerate(notes, 1)
    )
    + "\n          </ol>\n",
    encoding="utf-8",
)
(out / "references.html").write_text(
    '          <ul class="references-list sources-list">\n'
    + "\n".join(f"            <li>{s}</li>" for s in refs)
    + "\n          </ul>\n",
    encoding="utf-8",
)

print(f"title: {title}")
print(f"{len(statement)} paragraphs, {len(notes)} notes, {len(refs)} references -> {out}/")
for s in statement + notes + refs:
    for m in re.finditer(r"\[(?:Signatory|Date|Title|TK|TBD)[^\]]*\]", s):
        print(f"WARNING: placeholder still in the Doc: {m.group(0)}", file=sys.stderr)
