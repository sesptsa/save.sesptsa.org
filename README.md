# save sunnyside

the website at **[save.sesptsa.org](https://save.sesptsa.org)**: the sunnyside
environmental school PTSA's campaign to keep SES a K–8 with its environmental
focus program: ways to help before the portland school board votes, and the
community letter to the board. to add your name, sign on the site.

## how it works

- static pages served by github pages: ways to help plus upcoming events at `/`,
  the letter at `/letter/`, the impact page at `/impact/`, flyers, data sheets
  and the logo to print at `/resources/`, the community's statement on the
  superintendent's final recommendation at `/response/`, and the coalition
  letter that organizations sign on to at `/coalition/`. whatever is on `main`
  is live within a minute or two.
- the letters live in google docs and get converted to HTML w the scripts in
  `tools/` (`letter2html.py`, `statement2html.py`, `coalition2html.py`).
- signatures go to a google form owned by the PTSA and are never stored in this
  repo. the count and signers list on the page come from a google apps script
  (`tools/signers-apps-script.js`) that publishes only what PTSA volunteers
  have okayed to show. the repo is public, the names aren't, and that split is
  on purpose. the events list comes from a second script
  (`tools/events-apps-script.js`) on the advocacy committee's planning sheet,
  which publishes only the rows they mark for the website, so volunteers keep
  it current without touching the site. the coalition letter's sign-ons work the same way,
  with a third script (`tools/coalition-apps-script.js`) on its own form's
  responses: only the names a volunteer has ticked are published, and the
  email addresses the form collects never leave the sheet.

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
npm run format   # Prettier (skips the letter, statement and coalition pages; their markup is generated)
```
