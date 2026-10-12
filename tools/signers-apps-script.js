/**
 * Signers feed for save.sesptsa.org: a Google Apps Script web app, bound to the
 * signature form's responses spreadsheet, that serves the names and stories PTSA
 * volunteers have approved as JSON, plus the total number of signatures. The
 * page (script.js) fetches it and fills in "The undersigned" and the hero's
 * count. Nothing here runs on the site itself; this file is the source of the
 * script, kept in the repo so it isn't lost in a Google account.
 *
 * No name or story is public until a volunteer ticks it. The count is not
 * reviewed: it is every different non-empty name, so it moves the moment
 * someone signs (a prank inflates it until someone deletes the row). Names
 * are compared ignoring case, accents and spacing, so someone who signs twice
 * counts once and is listed once (the newer row) even if both are ticked; two
 * different people with the same name also count once. Each tab that holds
 * signatures gets three checkbox columns (Signers menu > Add review columns
 * to this tab):
 *   Name ok   Real person, not a duplicate or a joke, and the connection line
 *             is fine to show. Shows the name in the list.
 *   Story ok  The impact answer can be shown. Leave unticked if it names a
 *             child, a staff member, or anything private.
 *   Feature?  Put the story first.
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
 * Updating the code later: paste it in, save, then Deploy > Manage deployments
 * > edit (pencil) > Version: New version > Deploy. That keeps the same URL;
 * "New deployment" would make a new one.
 *
 * Ticks and new signatures show up on the site within CACHE_SECONDS.
 */

var REVIEW = { name: "Name ok", story: "Story ok", feature: "Feature?" };
var REVIEW_NOTES = {
  "Name ok":
    "Real person, not a duplicate or a joke, and the connection line is fine to show. " +
    "Shows the name in the list.",
  "Story ok":
    "Impact answer can be shown. Leave unticked if it names a child, a staff member, " +
    "or anything private.",
  "Feature?": "Put the story first.",
};
var CACHE_SECONDS = 300;
var CHUNK = 30000; // characters per cache entry; the cache caps each entry at 100 KB

// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function doGet() {
  return ContentService.createTextOutput(cachedFeed_()).setMimeType(ContentService.MimeType.JSON);
}

// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Signers")
    .addItem("Add review columns to this tab", "addReviewColumns")
    .addToUi();
}

// Adds any missing review columns at the right of the active tab, with
// checkboxes far enough down for new form responses and a note on each header.
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
    sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).insertCheckboxes();
  });
}

function cachedFeed_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get("feed:n"));
  if (n) {
    var keys = [];
    for (var i = 0; i < n; i++) keys.push("feed:" + i);
    var parts = cache.getAll(keys);
    if (Object.keys(parts).length === n) {
      return keys
        .map(function (k) {
          return parts[k];
        })
        .join("");
    }
  }
  var json = JSON.stringify(buildFeed_(SpreadsheetApp.getActiveSpreadsheet().getSheets()));
  var entries = {};
  var count = Math.ceil(json.length / CHUNK);
  for (var j = 0; j < count; j++) entries["feed:" + j] = json.slice(j * CHUNK, (j + 1) * CHUNK);
  entries["feed:n"] = String(count);
  cache.putAll(entries, CACHE_SECONDS);
  return json;
}

// { count, names: [{ name, connection }], stories: [{ name, connection, story }] }
// count: every different non-empty name, ticked or not. names: ticked, each
// name once, newest first. stories: ticked, featured first, then newest first.
function buildFeed_(sheets) {
  var signed = {}; // nameKey_ -> true, for the count
  var rows = [];
  sheets.forEach(function (sheet) {
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return;
    var headers = values[0].map(clean_);
    var col = columns_(headers);
    if (col.nameOk < 0 || (col.name < 0 && col.first < 0)) return;
    values.slice(1).forEach(function (row) {
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
  stories.sort(function (a, b) {
    return Number(b.featured) - Number(a.featured) || b.time - a.time || a.order - b.order;
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
        return { name: r.name, connection: r.connection };
      }),
    stories: stories.map(function (r) {
      return { name: r.name, connection: r.connection, story: r.story };
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
