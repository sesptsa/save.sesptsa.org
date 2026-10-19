# save sunnyside

the website at **[save.sesptsa.org](https://save.sesptsa.org)**: the sunnyside
environmental school PTSA's community letter to the portland school board, asking
that SES stay a K–8 with its environmental focus program. to add your name, sign
on the site.

## how it works

- static pages served by github pages: the letter at `/`, the impact page at
  `/impact/`, flyers, data sheets and the logo to print at `/resources/`, and
  ways to help plus upcoming events at `/take-action/`. whatever is on `main` is
  live within a minute or two.
- the letter lives in a google doc and gets converted to HTML w
  `tools/letter2html.py`.
- signatures go to a google form owned by the PTSA and are never stored in this
  repo. the count and signers list on the page come from a google apps script
  (`tools/signers-apps-script.js`) that publishes only what PTSA volunteers
  have okayed to show. the repo is public, the names aren't, and that split is
  on purpose. the same script serves the events list from a tab in that
  spreadsheet, so volunteers keep it current without touching the site.

## contributing

- **ideas, corrections, stories, or removing your name:** email
  [advocacy@sesptsa.org](mailto:advocacy@sesptsa.org). the wording of the letter
  and the site goes thru the PTSA's advocacy committee.
- **bugs:** open an issue, or email the address above. we're not taking pull
  requests for now.

## running it locally

```
npm install
npm run dev      # local server with live reload
npm run lint     # Oxlint
npm run format   # Prettier (skips index.html; the letter markup is generated)
```
