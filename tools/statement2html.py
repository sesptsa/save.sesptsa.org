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
Bold, italic and links are read from the export's own styles (gdoc.py, which
the coalition letter's converter shares).
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # gdoc.py, beside this file
from gdoc import plain, read, render, warn_placeholders

out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
blocks = [(kind, runs) for kind, runs in read(sys.argv[1]) if kind in ("p", "li")]

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
warn_placeholders(statement + notes + refs, sys.stderr)
