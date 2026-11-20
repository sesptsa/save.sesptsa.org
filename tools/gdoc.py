"""Reading a Google Docs HTML export (File > Download > Web page): what
statement2html.py and coalition2html.py share. Not run on its own.

read(path) gives the Doc's non-empty blocks in order, each ("p" | "li" | "h1"...,
runs); a run is (text, bold, italic, url), with bold and italic read from the
export's own styles. render(runs) is a block's inline HTML, plain(runs) its
text.

letter2html.py, the first converter, has its own reader (the letter's
citations are superscripts and its headings are in a table there).
"""
import html
import re
import urllib.parse
from pathlib import Path

BR = "\x00"


def read(path):
    src = Path(path).read_text(encoding="utf-8")
    style = re.search(r"<style.*?</style>", src, re.S).group(0)
    classes = {m.group(1): m.group(2) for m in re.finditer(r"\.(c\d+)\{([^}]*)\}", style)}
    bold_classes = {c for c, d in classes.items() if "font-weight:700" in d}
    italic_classes = {c for c, d in classes.items() if "font-style:italic" in d}
    body = src.split("<body", 1)[1]

    def runs_of(inner):
        """Yield the runs of one exported block; text is plain (unescaped),
        with BR for a line break."""
        bold = italic = False
        url = None
        for m in re.finditer(r"<span(?: class=\"([^\"]*)\")?[^>]*>|</span>|<a [^>]*href=\"([^\"]*)\"[^>]*>|</a>|<br>|<[^>]+>|([^<]+)", inner):
            tag = m.group(0)
            if tag.startswith("<span"):
                cls = set((m.group(1) or "").split())
                bold, italic = bool(cls & bold_classes), bool(cls & italic_classes)
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

    # A <br> inside a paragraph starts a new block.
    blocks = []
    for m in re.finditer(r"<(p|li|h[1-6])\b[^>]*>(.*?)</\1>", body, re.S):
        cur = []
        for run in runs_of(m.group(2)):
            if run[0] == BR:
                blocks.append((m.group(1), cur))
                cur = []
            else:
                cur.append(run)
        blocks.append((m.group(1), cur))
    return [(kind, runs) for kind, runs in blocks if plain(runs)]


def render(runs, bold=True):
    """Inline HTML for a block's runs. Adjacent runs with the same styling are
    joined first (the Doc splits them wherever it was edited). bold=False
    leaves the <strong>s out, for a block that is styled as a whole."""
    merged = []
    for text, b, italic, url in runs:
        b = b and bold
        if not text.strip():
            b, italic = (merged[-1][1], merged[-1][2]) if merged else (False, False)
        if merged and merged[-1][1:] == (b, italic, url):
            merged[-1] = (merged[-1][0] + text, b, italic, url)
        else:
            merged.append((text, b, italic, url))
    parts = []
    for text, b, italic, url in merged:
        if not text.strip():
            parts.append(" " if text else "")
            continue
        lead = " " if text[0].isspace() else ""
        trail = " " if text[-1].isspace() else ""
        s = html.escape(text.strip(), quote=False)
        # A straight apostrophe typed in the Doc ("It's", "students'") becomes the curly one.
        s = re.sub(r"(?<=\w)'", "’", s)
        # "... not evidence based [1], harms" -> a superscript link to the note.
        s = re.sub(r"\s*\[(\d+)\]", r'<sup class="cite" id="cite-\1"><a href="#note-\1">\1</a></sup>', s)
        if italic:
            s = f"<em>{s}</em>"
        if b:
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


def all_bold(runs):
    """Whether every word of the block is bold."""
    return all(bold for text, bold, _, _ in runs if text.strip())


def warn_placeholders(lines, out):
    """Print any "[Date]"-style placeholder still in the text."""
    for s in lines:
        for m in re.finditer(r"\[(?:Signatory|Date|Title|TK|TBD)[^\]]*\]", s):
            print(f"WARNING: placeholder still in the Doc: {m.group(0)}", file=out)
