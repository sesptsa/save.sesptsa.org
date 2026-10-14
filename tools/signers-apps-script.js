/**
 * Signers feed for save.sesptsa.org: a Google Apps Script web app, bound to the
 * signature form's responses spreadsheet, that serves the names and stories PTSA
 * volunteers have approved as JSON, plus the total number of signatures. The
 * page (script.js) fetches it and fills in "The undersigned" and the hero's
 * count. Nothing here runs on the site itself; this file is the source of the
 * script, kept in the repo so it isn't lost in a Google account.
 *
 * No name or story is public until it is ticked. Name ok can be ticked
 * automatically on each new signature (Signers > Tick Name ok on new
 * signatures), so a name shows as soon as someone signs and volunteers untick
 * the ones to hide; Story ok is always a volunteer's call. The count is not
 * reviewed: it is every different non-empty name, so it moves the moment
 * someone signs (a prank inflates it until someone deletes the row). Names
 * are compared ignoring case, accents and spacing, so someone who signs twice
 * counts once and is listed once (the newer row) even if both are ticked; two
 * different people with the same name also count once. Until full names are
 * cleared for publishing, FULL_NAMES is false and the feed carries only
 * "First L." (see shortName_), so full names never leave the sheet. Each tab that holds
 * signatures gets three checkbox columns (Signers menu > Add review columns
 * to this tab):
 *   Name ok   Shows the name in the list. Ticked automatically on new
 *             signatures while auto-tick is on; untick it for anything that
 *             isn't a real person, is a joke, or whose connection line
 *             shouldn't show.
 *   Story ok  The impact answer can be shown. Leave unticked if it names a
 *             child, a staff member, or anything private.
 *   Feature?  Put the story first. On the letter page the featured stories lead,
 *             in a fresh random order each visit; the impact page shows them
 *             six at a time the same way, then the rest.
 * Any tab with a "Name ok" column is read and counted, so the earlier
 * petition's names can sit in their own tab. Columns are found by their header
 * text, so reordering columns or adding form questions doesn't break anything: the name is the
 * first header starting "Full name" or "Name" (or "First name" + "Last name"),
 * the connection the first containing "connect", the story the first containing
 * "impact", and the order comes from "Timestamp" (newest first; rows without
 * one go last, in sheet order).
 *
 * Setup (once, signed in as admin@sesptsa.org, which owns the form):
 *   1. Open the form's responses spreadsheet. To include the earlier petition,
 *      open its spreadsheet, right-click its tab > Copy to > Existing
 *      spreadsheet > the responses spreadsheet, and rename the copy
 *      "Earlier petition".
 *   2. Extensions > Apps Script. Replace the editor's contents with this file
 *      and save.
 *   3. Reload the spreadsheet. On each signatures tab: Signers > Add review
 *      columns to this tab.
 *   4. In Apps Script: Deploy > New deployment > Web app. Execute as: Me.
 *      Who has access: Anyone. Authorize, then copy the web app URL (ends in
 *      /exec) into the href of <link id="signers-feed"> in index.html.
 *   5. Open the URL in a browser to check the JSON.
 *   6. Optional: Signers > Tick Name ok on new signatures (authorize when
 *      asked). The trigger runs as whoever clicked it, so "Stop ticking new
 *      signatures" only removes it for that person.
 * Updating the code later: paste it in, save, then Deploy > Manage deployments
 * > edit (pencil) > Version: New version > Deploy. That keeps the same URL;
 * "New deployment" would make a new one. To refresh the header notes after
 * changing REVIEW_NOTES, run Signers > Add review columns again (it keeps
 * existing ticks).
 *
 * Ticks show up on the site within FRESH_SECONDS. With auto-tick on, a new
 * signature rebuilds the feed, so it shows on the next page load.
 *
 * Only one build runs at a time (each reads every signatures tab). A visitor
 * who finds the feed stale gets the old copy at once while one request
 * rebuilds it; only when nothing is cached do requests wait for that build.
 * Without this, a busy hour of signing (each signature emptied the cache)
 * started a build for every visitor at once, they slowed each other past
 * Apps Script's 6-minute limit, none finished, and the feed went down. Each
 * build logs how long each tab took: Apps Script > Executions.
 */

var REVIEW = { name: "Name ok", story: "Story ok", feature: "Feature?" };
var REVIEW_NOTES = {
  "Name ok":
    "Shows the name in the list. Ticked automatically when someone signs. Untick it " +
    "if it isn't a real person, is a joke, or the connection line shouldn't show.",
  "Story ok":
    "Impact answer can be shown. Leave unticked if it names a child, a staff member, " +
    "or anything private.",
  "Feature?": "Put the story first.",
};
// false: names go out as "First L." (Jane Q. Public -> "Jane P."). Set to true,
// save and deploy a new version once full names are approved.
var FULL_NAMES = false;
var FRESH_SECONDS = 300; // older than this, the next request rebuilds the feed
var KEEP_SECONDS = 21600; // the longest the cache keeps anything; stale copies are served meanwhile
var CHUNK = 30000; // characters per cache entry; the cache caps each entry at 100 KB

// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function doGet() {
  var cached = readFeed_();
  var json = cached && cached.json;
  if (!cached || Date.now() - cached.builtAt > FRESH_SECONDS * 1000) {
    // Stale: rebuild unless another request already is, and serve the old copy
    // either way. Nothing cached: wait for whichever build is running.
    json = buildFeedOnce_(cached ? 0 : 60000) || json;
  }
  if (!json) throw new Error("The signers feed is still building; try again shortly.");
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Signers")
    .addItem("Add review columns to this tab", "addReviewColumns")
    .addSeparator()
    .addItem("Tick Name ok on new signatures", "startAutoTick")
    .addItem("Stop ticking new signatures", "stopAutoTick")
    .addToUi();
}

// Installs the form-submit trigger that runs tickNameOk. Safe to click twice.
// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function startAutoTick() {
  removeAutoTick_();
  ScriptApp.newTrigger("tickNameOk")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onFormSubmit()
    .create();
  SpreadsheetApp.getActive().toast("New signatures will show with Name ok ticked.");
}

// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function stopAutoTick() {
  removeAutoTick_();
  SpreadsheetApp.getActive().toast("New signatures will wait for a Name ok tick.");
}

function removeAutoTick_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "tickNameOk") ScriptApp.deleteTrigger(t);
  });
}

// Form-submit trigger: ticks Name ok on the new row, then rebuilds the feed so
// the name and count show on the next page load, not FRESH_SECONDS later.
// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function tickNameOk(e) {
  var sheet = e.range.getSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(clean_);
  var col = headers.indexOf(REVIEW.name);
  if (col >= 0) sheet.getRange(e.range.getRow(), col + 1).setValue(true);
  buildFeedOnce_(60000);
}

// Adds any missing review columns at the right of the active tab, with
// checkboxes far enough down for new form responses and a note on each header.
// Existing ticks are kept (insertCheckboxes would reset them all to unticked).
// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function addReviewColumns() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var minRows = 3000;
  if (sheet.getMaxRows() < minRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minRows - sheet.getMaxRows());
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(clean_);
  [REVIEW.name, REVIEW.story, REVIEW.feature].forEach(function (title) {
    var col = headers.indexOf(title) + 1;
    if (!col) {
      col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(title);
      headers[col - 1] = title;
    }
    sheet.getRange(1, col).setNote(REVIEW_NOTES[title]);
    sheet
      .getRange(2, col, sheet.getMaxRows() - 1, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  });
}

// { json, builtAt } from the cache, or null. builtAt is when that build
// started reading the sheet.
function readFeed_() {
  var cache = CacheService.getScriptCache();
  var head = cache.getAll(["feed:n", "feed:at"]);
  var n = Number(head["feed:n"]);
  var builtAt = Number(head["feed:at"]);
  if (!n || !builtAt) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push("feed:" + i);
  var parts = cache.getAll(keys);
  if (Object.keys(parts).length !== n) return null;
  var json = keys
    .map(function (k) {
      return parts[k];
    })
    .join("");
  return { json: json, builtAt: builtAt };
}

// Builds the feed and caches it, one build at a time. If another build is
// running, waits up to waitMs for it and returns its result if it started
// after this call did (so it includes any row written just before); otherwise
// builds again. Returns null if it couldn't get a turn in time.
function buildFeedOnce_(waitMs) {
  var asked = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(waitMs)) return null;
  try {
    var cached = readFeed_();
    if (cached && cached.builtAt >= asked) return cached.json;
    var started = Date.now();
    var json = JSON.stringify(buildFeed_(SpreadsheetApp.getActiveSpreadsheet().getSheets()));
    var entries = { "feed:at": String(started) };
    var count = Math.ceil(json.length / CHUNK);
    for (var j = 0; j < count; j++) entries["feed:" + j] = json.slice(j * CHUNK, (j + 1) * CHUNK);
    entries["feed:n"] = String(count);
    CacheService.getScriptCache().putAll(entries, KEEP_SECONDS);
    console.log("Feed built in " + (Date.now() - started) + " ms, " + json.length + " characters");
    return json;
  } finally {
    lock.releaseLock();
  }
}

// { count, names: [{ name, connection }], stories: [{ name, connection, story, featured }] }
// count: every different non-empty name, ticked or not. names: ticked, each
// name once, newest first. stories: ticked, newest first, each flagged
// featured or not; the pages put the featured ones first themselves, shuffled
// per visit (signers.js), which a feed cached for FRESH_SECONDS can't do.
function buildFeed_(sheets) {
  var signed = {}; // nameKey_ -> true, for the count
  var rows = [];
  sheets.forEach(function (sheet) {
    // Headers first, so tabs that don't hold signatures are never read in full.
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) return;
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(clean_);
    var col = columns_(headers);
    if (col.nameOk < 0 || (col.name < 0 && col.first < 0)) return;
    var started = Date.now();
    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    console.log(
      sheet.getName() +
        ": " +
        values.length +
        " rows x " +
        lastCol +
        " columns read in " +
        (Date.now() - started) +
        " ms",
    );
    values.forEach(function (row) {
      var name =
        col.name >= 0
          ? clean_(row[col.name])
          : clean_(row[col.first] + " " + (col.last >= 0 ? row[col.last] : ""));
      if (!name) return;
      signed[nameKey_(name)] = true;
      if (!ticked_(row[col.nameOk])) return;
      var stamp = col.time >= 0 ? row[col.time] : null;
      var time = stamp && typeof stamp.getTime === "function" ? stamp.getTime() : 0;
      var story = col.story >= 0 && ticked_(row[col.storyOk]) ? cleanStory_(row[col.story]) : "";
      rows.push({
        name: name,
        connection: col.connection >= 0 ? clean_(row[col.connection]) : "",
        story: story,
        featured: Boolean(story) && ticked_(row[col.feature]),
        time: time,
        order: rows.length, // ties (no timestamps) keep sheet order
      });
    });
  });
  rows.sort(function (a, b) {
    return b.time - a.time || a.order - b.order;
  });
  var stories = rows.filter(function (r) {
    return r.story;
  });
  var listed = {};
  return {
    count: Object.keys(signed).length,
    names: rows
      .filter(function (r) {
        var key = nameKey_(r.name);
        if (listed[key]) return false;
        listed[key] = true;
        return true;
      })
      .map(function (r) {
        return { name: shown_(r.name), connection: r.connection };
      }),
    stories: stories.map(function (r) {
      return {
        name: shown_(r.name),
        connection: r.connection,
        story: r.story,
        featured: r.featured,
      };
    }),
  };
}

function columns_(headers) {
  function find(test) {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      if (h === REVIEW.name || h === REVIEW.story || h === REVIEW.feature) continue;
      if (test(h.toLowerCase())) return i;
    }
    return -1;
  }
  return {
    nameOk: headers.indexOf(REVIEW.name),
    storyOk: headers.indexOf(REVIEW.story),
    feature: headers.indexOf(REVIEW.feature),
    name: find(function (h) {
      return /^(full )?name\b/.test(h);
    }),
    first: find(function (h) {
      return /^first name\b/.test(h);
    }),
    last: find(function (h) {
      return /^last name\b/.test(h);
    }),
    connection: find(function (h) {
      return h.indexOf("connect") >= 0;
    }),
    story: find(function (h) {
      return h.indexOf("impact") >= 0;
    }),
    time: find(function (h) {
      return h === "timestamp";
    }),
  };
}

function ticked_(v) {
  return v === true || String(v).toUpperCase() === "TRUE";
}

function shown_(name) {
  return FULL_NAMES ? name : shortName_(name);
}

// "Jane Q. Public" -> "Jane P."; "jane smith-jones jr." -> "jane S.";
// "Cher" -> "Cher". First word as typed, plus the first letter of the last
// word that isn't a suffix. Repeats are still found from the full name.
function shortName_(name) {
  var words = name.split(" ");
  while (
    words.length > 2 &&
    /^(jr|sr|ii|iii|iv|v|phd|md|esq)\.?,?$/i.test(words[words.length - 1])
  ) {
    words.pop();
  }
  if (words.length < 2) return name;
  var initial = words[words.length - 1].match(/\p{L}/u);
  return words[0].replace(/,$/, "") + (initial ? " " + initial[0].toUpperCase() + "." : "");
}

// Who a name refers to, for spotting repeats: "  José  Smith" = "jose smith".
function nameKey_(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// One line, single spaces.
function clean_(v) {
  return String(v == null ? "" : v)
    .replace(/\s+/g, " ")
    .trim();
}

// Keeps the writer's line breaks, but no more than one blank line in a row.
function cleanStory_(v) {
  return String(v == null ? "" : v)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
