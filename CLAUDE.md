# save.sesptsa.org

Static site for the Save Sunnyside Environmental School campaign. Public repo,
served by GitHub Pages at https://save.sesptsa.org.

## Stack

- Plain HTML/CSS plus three small vanilla scripts, no framework: `signers.js`
  (shared: the feed fetch, the count, story cards), `script.js` (the letter page:
  sticky bar, citation popovers/sheet, form-submit scroll, the signers list) and
  `impact.js` (the impact page's stories). Keep it that way.
- Pages serves the files exactly as committed. `package.json` holds dev tooling only
  (`npm run dev` = Vite dev server, `npm run lint` = Oxlint, `npm run format` =
  Prettier). **Never add a build script**: nothing may depend on a transform step,
  so no imports that only Vite can resolve. Prettier skips `index.html` on purpose;
  the letter markup there is generated.
- GitHub Pages, "deploy from a branch" (`main`, root). Every push to `main` deploys
  in about a minute; the deploy shows under the Actions tab.
- `.nojekyll` is present so Pages serves files as-is. Don't remove it.
- `CNAME` contains `save.sesptsa.org`. Don't remove it; the custom domain setting
  unsets itself if the file goes away.
- DNS: `save` CNAME → `sesptsa.github.io` at Dreamhost (PTSA's existing DNS).

## Layout

- Three pages, `/` (the letter), `/impact/` and `/resources/`, with the same
  header, footer and tokens. The header's nav (`.site-nav`) shows from 720px; below that each page
  has a `.page-tabs` row at the top of its hero. Mark the current page with
  `aria-current="page"` in both. Cross-page links are root-relative (`/#sign`).
- `index.html` — the letter page: hero, the letter (`<article class="letter">`), references
  (`<details>`), embedded Google Form. The letter HTML was generated from the Google
  Docs export of the FINAL tab by `tools/letter2html.py` (its docstring has the
  update steps); citation markers are `<sup class="cite">` linking to `#ref-N`, and
  the popovers and the reference count read from the references list.
- `#undersigned` in `index.html` — the signers section after the form, and the
  count in the hero. Both are filled by `script.js` from the JSON feed, whose URL is
  the `<link rel="preload" id="signers-feed">` in `<head>` (preloaded because Apps
  Script takes 1–2 s). The section stays hidden until it loads; the hero count
  shows a floor ("1,400+", in both pages) at once, then the visitor's last-seen count, then the
  live one. Raise the floor as the count grows (both spans; see the comment in
  `style.css`), never above the real count. The feed is a
  Google Apps Script web app on the form's responses spreadsheet; its source and
  setup steps are in `tools/signers-apps-script.js`. It serves only ticked rows
  ("Name ok", "Story ok", "Feature?"), so the data never touches this repo; Name ok
  can be ticked automatically on new signatures, Story ok is always a volunteer's. Names go out as "First L." until full names are approved
  (`FULL_NAMES` in the script). Feed text is public input: insert it with `textContent` only.
  Each story carries `featured` (the "Feature?" tick); the pages order them
  themselves, featured first in a fresh random order per visit (`signers.js`), since
  the feed is cached for minutes and can't shuffle per visitor.
- `impact/index.html`, `impact.js` — the impact page: Hanna's "Place-Based
  Education in Action" copy (hero numbers, the work, the dark "since 1994" band,
  how it works, about the data), a green bridge back to `/#sign`, then the stories
  from the feed: Featured, six on a full-width mint band ("More stories" adds six
  more, the featured ones first, then the rest; any six if nothing is featured
  yet), and All stories newest first, 10 at a time. Stories up to 800 characters
  show whole there; longer ones are cut at a sentence near 600 (`LIMITS` in
  `impact.js`; `signers.js` cuts at a sentence too, with the letter page's
  smaller limits). Loading, empty and error states are
  in the HTML. The photo slot is commented out until there are cleared photos;
  a "1994" marker fills its place beside the intro.
  The page's styles are the "Impact page" block in `style.css` (`.impact-col` is its
  column; the extra tokens `--leaf`, `--mint`, `--sage`).
- `resources/index.html` — "Print & share": the letter and the two data sheets as
  PDFs, the flyers, and the logo. Static, no script. No hero: on phones the page
  tabs sit on a green band (`.tabs-band`) under the header. Each file is a row on
  phones and a card from 600px, with a preview of page 1 of its PDF. The
  meta line (pages, size) is typed by hand. To add or replace a file: put the PDF
  in `assets/`, then render its previews (a 300 and an 800px wide WebP each):
  `pdftoppm -f 1 -l 1 -singlefile -scale-to-x 800 -scale-to-y -1 -png in.pdf out`,
  then `cwebp -q 80 out.png -o assets/previews/<name>-800.webp`; the same for
  the 300px one. Styles: the "Resources page" block in `style.css`.
- `script.js`, `signers.js` — see above.
- `package.json`, `.oxlintrc.json`, `.prettierrc`, `.prettierignore` — dev tooling only.
- `style.css` — tokens at the top. `--green: #007108` is August's artwork green;
  everything green on the page uses it.
- `sign/index.html` — redirect to the Google Form (meta refresh + JS + visible link).
  `/sign/` is the stable link used in messages; the QR code points at the root.
- `assets/save-ses.svg` — vector artwork (converted from August's PDF; type is outlined),
  white on a green square. `assets/save-ses-mask.svg` — the same shapes in black, used as a
  CSS mask so the hero draws the artwork in the theme's colour. `assets/save-ses-ink.svg`
  — recoloured to `--ink`, for the favicon. `assets/save-ses-share.jpg` — the
  `og:image`: the artwork centred on 1200×630 green, rendered from the SVG.
  `assets/save-ses.jpg` — the square green original, not used by the page (handy
  for square social posts).
- Theme: the header and hero colourway is a token set in `style.css` (`--header-*`,
  `--hero-*`, `--mast-*`). `<html data-theme="green">` is cream (`--cream`) on green;
  without the attribute it is ink on cream. Nothing below the hero changes between
  them. The artwork is a CSS mask filled with `--hero-fg`, so it follows the theme.
- Page titles are sized from their column (`--title-scale`, so "ENVIRONMENTAL"
  always fits) up to `--title-max` (4rem). From 1200px the letter hero's text column
  is what's left beside the artwork (`--hero-art-w`), and the impact hero uses the
  full column, so both reach about the maximum there.
  `assets/sunnyside-by-the-numbers.pdf` — Hanna's one-page fact sheet, linked under the letter
  and on `/resources/`.
- The other downloads on `/resources/`: `assets/sunnyside-letter-to-pps-board.pdf`,
  `assets/place-based-education-in-action.pdf`, the flyers
  (`assets/save-ses-flyer*.pdf`), `assets/save-ses-logo.png` (Hanna's green square)
  and `assets/save-ses-logo-transparent.{svg,png}` (from `save-ses.svg`: white →
  green, the green ground and circle removed; the PNG rendered at 2048px with
  `rsvg-convert`). Previews in `assets/previews/`.

## Rules

- This repo is public. Nothing internal ever gets committed: strategy notes,
  response data, contact lists, board-member discussion, draft letters.
  Campaign context lives outside the repo (see CLAUDE.local.md).
- Framing: lead with the environmental mission, K-8 continuity, and what SES does
  for Portland. Never anything charter-adjacent ("school choice", "families deserve
  options"). The letter is the source of truth for message; don't invent new claims.
- Content changes go through the communications group (Hanna) before publishing.
  Dan can ship structural and technical changes directly.
- Mobile first; most visitors arrive from a phone via QR or a Konstella link.
- Verify in a real browser at 390px and 1200px before pushing anything visual,
  on both pages when the shared CSS or scripts change.
