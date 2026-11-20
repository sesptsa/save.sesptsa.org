#!/usr/bin/env python3
"""Convert the Google Docs HTML export of the coalition letter into the HTML
for coalition/index.html.

How a content update works:
  1. In the Google Doc, on the letter's tab, File > Download > Web page (.html,
     zipped); unzip it.
  2. python3 -I tools/coalition2html.py <export>.html <out_dir>
  3. Paste out_dir/letter.html into coalition/index.html between the
     "letter:start" and "letter:end" comments.
  4. Compare the title, subtitle, salutation and closing printed here with the
     page: those four are typed by hand there (the hero's h1 and lede, the
     salutation, .letter-close).

The Doc is: the title (a heading), a bold subtitle, the salutation ("Dear ...,"),
the paragraphs, "Sincerely," and a bold signature line, then a
"[Coalition Signatories]" placeholder (the page's list comes from the sign-on
form instead). A paragraph that is bold from end to end becomes a pull-out
(<p class="pull">); bold, italic and links inside a paragraph are kept.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # gdoc.py, beside this file
from gdoc import all_bold, plain, read, render, warn_placeholders

out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
blocks = read(sys.argv[1])
names = [plain(runs) for _, runs in blocks]

dear = next(i for i, name in enumerate(names) if name.startswith("Dear ") and name.endswith(","))
close = names.index("Sincerely,")
assert dear < close, (dear, close)

letter = [
    f'<p class="pull">{render(runs, bold=False)}</p>' if all_bold(runs) else f"<p>{render(runs)}</p>"
    for _, runs in blocks[dear + 1 : close]
]
(out / "letter.html").write_text(
    "\n".join(f"        {s}" for s in letter) + "\n", encoding="utf-8"
)

print(f"{len(letter)} paragraphs ({sum('class=\"pull\"' in s for s in letter)} pull-outs) -> {out}/letter.html")
for label, lines in (("before the letter", names[:dear]), ("salutation", [names[dear]]), ("closing", names[close:])):
    for line in lines:
        print(f"{label}: {line}")
warn_placeholders(letter, sys.stderr)
