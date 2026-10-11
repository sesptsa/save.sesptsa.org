# save.sesptsa.org

Community letter and signature campaign to keep Sunnyside Environmental
School a K-8 with its environmental focus program intact.

Live at https://save.sesptsa.org — a static site served by GitHub Pages.

## Structure

- `index.html` — the letter, references, and embedded signature form
- `sign/index.html` — redirect to the Google Form (so `/sign` is a stable link)
- `style.css`, `script.js` — styles and the small script for citation popovers
- `tools/letter2html.py` — regenerates the letter and references from the Google Docs export

No build step: GitHub Pages serves these files exactly as committed. Edit, commit to
`main`, and it deploys within a minute.

## Local development

```
npm install
npm run dev        # Vite dev server with live reload (dev server only; there is no build)
npm run lint       # Oxlint
npm run format     # Prettier (index.html is excluded: the letter markup is generated)
```

Rule: never add a build script to `package.json`. The committed files are the site.

## Contributing

This site reflects the Save Sunnyside communications plan. Content changes
go through the communications group before they're published.

Code is MIT-licensed. Site content is © Sunnyside Environmental School PTSA.
