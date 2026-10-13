# save.sesptsa.org

Static site for the Save Sunnyside Environmental School campaign. Public repo,
served by GitHub Pages at https://save.sesptsa.org.

## Stack

- Plain HTML/CSS plus one small vanilla script (`script.js`: sticky bar, citation
  popovers/sheet, form-submit scroll, the signers list). No framework. Keep it that way.
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

- `index.html` — the page: hero, the letter (`<article class="letter">`), references
  (`<details>`), embedded Google Form. The letter HTML was generated from the Google
  Docs export of the FINAL tab by `tools/letter2html.py` (its docstring has the
  update steps); citation markers are `<sup class="cite">` linking to `#ref-N`, and
  the popovers and the reference count read from the references list.
- `#undersigned` in `index.html` — the signers section after the form, and the
  count in the hero. Both are filled by `script.js` from the JSON feed, whose URL is
  the `<link rel="preload" id="signers-feed">` in `<head>` (preloaded because Apps
  Script takes 1–2 s). The section stays hidden until it loads; the hero count
  shows a floor ("1,000+") at once, then the visitor's last-seen count, then the
  live one. Raise the floor as the count grows (both spans; see the comment in
  `style.css`), never above the real count. The feed is a
  Google Apps Script web app on the form's responses spreadsheet; its source and
  setup steps are in `tools/signers-apps-script.js`. It serves only ticked rows
  ("Name ok", "Story ok", "Feature?"), so the data never touches this repo; Name ok
  can be ticked automatically on new signatures, Story ok is always a volunteer's. Names go out as "First L." until full names are approved
  (`FULL_NAMES` in the script). Feed text is public input: insert it with `textContent` only.
- `script.js` — see above.
- `package.json`, `.oxlintrc.json`, `.prettierrc`, `.prettierignore` — dev tooling only.
- `style.css` — tokens at the top. `--green: #007108` is August's artwork green;
  everything green on the page uses it.
- `sign/index.html` — redirect to the Google Form (meta refresh + JS + visible link).
  `/sign/` is the stable link used in messages; the QR code points at the root.
- `assets/save-ses.svg` — vector artwork (converted from August's PDF; type is outlined),
  white on transparent. `assets/save-ses-mask.svg` — the same shapes in black, used as a
  CSS mask so the hero draws the artwork in the theme's colour. `assets/save-ses-ink.svg`
  — recoloured to `--ink`, for the favicon. `assets/save-ses-share.jpg` — the
  `og:image`: the artwork centred on 1200×630 green, rendered from the SVG.
  `assets/save-ses.jpg` — the square green original, not used by the page (handy
  for square social posts).
- Theme: the header and hero colourway is a token set in `style.css` (`--header-*`,
  `--hero-*`, `--mast-*`). `<html data-theme="green">` is cream on green; without the
  attribute it is ink on cream. Nothing below the hero changes between them.
  `assets/sunnyside-by-the-numbers.pdf` — Hanna's one-page fact sheet, linked under the letter.

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
- Verify in a real browser at 390px and 1200px before pushing anything visual.
