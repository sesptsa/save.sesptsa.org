# save.sesptsa.org

Static site for the Save Sunnyside Environmental School campaign. Public repo,
served by GitHub Pages at https://save.sesptsa.org.

## Stack

- Plain HTML/CSS plus five small vanilla scripts, no framework: `signers.js`
  (shared: the feed fetch, the count, name rows and story cards, and the
  embedded sign form's behaviour, `signForm()`), then one per page: `letter.js`
  (citation popovers/sheet, the signers list), `impact.js` (the stories),
  `take-action.js` (the home page's events, key dates, copy button and the
  coalition card's signers) and `coalition.js` (the coalition letter's count
  and signers). Keep it that way.
- Pages serves the files exactly as committed. `package.json` holds dev tooling only
  (`npm run dev` = Vite dev server, `npm run lint` = Oxlint, `npm run format` =
  Prettier). **Never add a build script**: nothing may depend on a transform step,
  so no imports that only Vite can resolve. Prettier skips `letter/index.html`,
  `response/index.html` and `coalition/index.html` on purpose; the letter and
  statement markup there is generated.
- GitHub Pages, "deploy from a branch" (`main`, root). Every push to `main` deploys
  in about a minute; the deploy shows under the Actions tab.
- `.nojekyll` is present so Pages serves files as-is. Don't remove it.
- `CNAME` contains `save.sesptsa.org`. Don't remove it; the custom domain setting
  unsets itself if the file goes away.
- DNS: `save` CNAME → `sesptsa.github.io` at Dreamhost (PTSA's existing DNS).

## Layout

- Six pages: `/` (Take Action, the home page since Nov. 2026, when the campaign
  moved from collecting signatures to the board vote), `/letter/` (the letter and
  signatures, the home page until then), `/impact/`, `/resources/`,
  `/response/` (the community statement) and `/coalition/` (the coalition
  letter; neither is in the nav, both are linked from the home page), with the
  same header, footer and tokens. The four nav pages have the statement strip
  (`.statement-strip`) under their hero (under the
  header on resources): the same markup on all four; add `is-hidden`, the
  class that switches a block off, to hide it. `/take-action/` is a redirect
  to `/` (it is in messages already sent; it carries the `#hash` along), and
  `take-action.js` sends the letter's old anchors (`/#undersigned`, `/#ref-N`)
  on to `/letter/`; `/#sign` lands on the home page's sign step. The footer's three paragraphs (project of
  the PTSA, the disclaimer, questions/Instagram) are the Advocacy committee's
  wording; change them on all six pages together. The header's nav (`.site-nav`) shows from 800px; below that each page
  has a `.page-tabs` row at the top of its hero. Mark the current page with
  `aria-current="page"` in both. Cross-page links are root-relative (`/letter/#sign`).
- `letter/index.html` — the letter page: hero (no count or button since the
  letter went to the board), the letter (`<article class="letter">`), references
  (`<details>`), embedded Google Form. The letter HTML was generated from the Google
  Docs export of the FINAL tab by `tools/letter2html.py` (its docstring has the
  update steps); citation markers are `<sup class="cite">` linking to `#ref-N`, and
  the popovers and the reference count read from the references list.
- `#undersigned` in `letter/index.html` — the signers section after the form,
  filled by `letter.js` from the JSON feed, whose URL is
  the `<link rel="preload" id="signers-feed">` in `<head>` (preloaded because Apps
  Script takes 1–2 s). The section stays hidden until it loads. The impact page's
  bridge still shows the count: a floor ("3,500+") at once, then the visitor's
  last-seen count, then the live one. Raise the floor as the count grows (both
  spans; see the comment in `style.css`), never above the real count. The feed is a
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
  how it works, about the data), a green bridge back to `/letter/#sign`, then the stories
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
- `index.html`, `take-action.js` — "Take Action", the home page: the hero (the ask and a card
  with the next event; its "Email the School Board" button and "Last updated"
  line are commented out for now), the statement strip, the coalition letter's
  card (`.coalition-card`, on `--mint` with a green title; what it is, its
  two links and, from the coalition feed, how many have signed, with the most
  recent as chips from 860px; `is-hidden` switches it off),
  seven numbered steps (`.steps`; step 01 holds the officials table, step 05 the
  message to copy, step 07 is signing the letter), upcoming events, key dates on a dark band, the
  four "Why SES" reasons, resources. The hero card and the events list come from
  the events feed (the `events-feed` preload in `<head>`): a second Apps Script,
  on the Advocacy committee's planning spreadsheet, separate from the signers
  feed. It serves that spreadsheet's events tab (columns and setup in
  `tools/events-apps-script.js`; volunteers set "Website?" to Yes on a row, no
  deploy; "Link" and "Link text" make the button, "Highlight" gives a green
  edge, "Map link" makes the place a link). It reads only those columns and
  shows cells as typed, apart from setting clock times in the site's style. That
  spreadsheet is internal: its link never goes in this repo. The page keeps only
  events dated today or later, so they drop off
  the day after; until the feed answers (or without JS) the card shows the vote
  and the list its loading/empty/error states. The key dates are static in the
  HTML with `data-date`; the script dims past ones and puts the "we are here"
  item (days until the `.is-vote` date) in place. The Copy Message button copies
  the blockquote's text (`navigator.clipboard`, with an `execCommand` fallback)
  and stays hidden without JS. Off-site links and the PDFs open a new tab
  (`target="_blank" rel="noopener"`, plus a visually-hidden "(opens in a new
  tab)"); text links get the arrow from CSS, buttons don't. Styles: the "Take
  Action page" block in `style.css`, built on the `--sp-*` spacing scale and
  `--text-sm` (tokens at the top; the older pages still carry their own
  values) and the `.tag` label (`.tag-sun`, `.tag-green`); `--sun` is its
  accent, for time and urgency only (the "not a done deal" highlight, the today
  marker). The "Want to speak at a meeting?" note is commented out until the
  committee has the Konstella sign-up link.
- `response/index.html` — the community statement on the Superintendent's final
  recommendation (Nov. 2026). Static, no script: the page tabs on a green band
  on phones (as on resources), the statement in the letter's column and type,
  then its notes and references, always open. The text is generated from its
  Google Doc by `tools/statement2html.py` (its docstring has the update steps;
  it warns about placeholders still in the Doc). Note markers are
  `<sup class="cite">` linking to `#note-N`. Styles: the "Statement page" block
  in `style.css`.
- `coalition/index.html`, `coalition.js` — the coalition letter (Nov. 2026):
  organizations and individuals sign on to it, separately from the community
  letter. One column (`--measure`) throughout: the green hero (the title, and
  a line saying how many have signed), the letter (`.letter.co-letter`; a
  paragraph that is bold throughout in the Doc is a pull-out, `.pull`),
  "Signed by" under it (`#signers`, before the form on purpose), then the
  sign-on form on cream (`#sign`, under its heading at every width).
  The letter's paragraphs are generated from its Google Doc by
  `tools/coalition2html.py` (its docstring has the update steps); the title,
  salutation and closing are typed by hand. The names come from the coalition
  feed (the `coalition-feed` preload on this page and the home page): a third
  Apps Script, on the sign-on form's responses spreadsheet
  (`tools/coalition-apps-script.js`). It serves only rows a volunteer has
  ticked "Show on site", names as typed, and never the email column. Until a
  name is approved (or if the feed fails) "Signed by" stays hidden and the
  hero invites sign-ons instead of counting; the line's space is kept either
  way, so nothing moves. The form's frame heights are measured signed in to
  Google, the taller case (see the comment in `style.css`); its theme colour
  is set to `--green` in Google Forms. Styles: the "Coalition letter" block in
  `style.css`.
- `letter.js`, `signers.js` — see above.
- `tools/` — the three Apps Script sources (signers, events, coalition; each
  is pasted into its own spreadsheet's script editor) and the three Doc
  converters. `statement2html.py` and `coalition2html.py` share `gdoc.py` (the
  reader for a Google Docs HTML export); `letter2html.py` predates it and has
  its own.
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
- `assets/sunnyside-by-the-numbers.pdf` — Hanna's one-page fact sheet, linked under the letter
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
- Content changes come from the PTSA's Advocacy committee. Dan can ship structural
  and technical changes directly.
- Mobile first; most visitors arrive from a phone via QR or a Konstella link.
- Verify in a real browser at 390px and 1200px before pushing anything visual,
  on every page when the shared CSS or scripts change.
