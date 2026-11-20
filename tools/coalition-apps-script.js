/**
 * Coalition feed for save.sesptsa.org: a Google Apps Script web app, bound to
 * the coalition letter's sign-on form's responses spreadsheet, that serves the
 * names volunteers have approved as JSON. The coalition page (coalition.js)
 * fills its count and "Signed by" list from it, and the home page
 * (take-action.js) its card. Nothing here runs on the site itself; this
 * file is the source of the script, kept in the repo so it isn't lost in a
 * Google account. It is separate from the signers feed
 * (tools/signers-apps-script.js), which lives on the community letter's
 * responses spreadsheet.
 *
 * @OnlyCurrentDoc
 *
 * The form asks two things: the organization's (or person's) name, which is
 * listed, and an email address, which is for the committee only. Only the
 * name ever leaves the sheet: the feed is built from the name, the timestamp
 * and the tick, and no other column is read into it.
 *
 * No name is public until a volunteer ticks "Show on site" on its row
 * (Coalition > Add the Show on site column adds the checkboxes). Anyone can
 * type any organization's name into the form, so the tick is where someone
 * checks that the sign-on is real. The name shows exactly as typed in the
 * sheet, so fix capitals or spelling there. A name that is ticked twice
 * (ignoring case, accents and spacing) is listed once.
 *
 * Columns are found by their header text, so they can be reordered: the name
 * is the first header containing "organization" or "name", the order comes
 * from "Timestamp" (newest first).
 *
 * The page gets { names: [{ name }] }, newest first. The feed is cached for
 * FRESH_SECONDS, and any edit to the spreadsheet (a tick, a corrected name)
 * marks it stale, so a change shows on the next page load. Deleting a row is
 * not an edit in that sense, so a deleted name can stay up for FRESH_SECONDS:
 * to take a name down at once, untick it first. If the sheet can't
 * be read, the last names served stay up and the error is logged (Apps
 * Script > Executions).
 *
 * Setup (once, signed in as the account that owns the form):
 *   1. Open the form's responses spreadsheet. Extensions > Apps Script.
 *      Replace the editor's contents with this file and save.
 *   2. Reload the spreadsheet. On the responses tab: Coalition > Add the Show
 *      on site column.
 *   3. In Apps Script: Deploy > New deployment > Web app. Execute as: Me.
 *      Who has access: Anyone. Authorize, then copy the web app URL (ends in
 *      /exec) into the href of <link id="coalition-feed"> in
 *      coalition/index.html and index.html.
 *   4. Open the URL in a browser to check the JSON.
 * Updating the code later: paste it in, save, then Deploy > Manage deployments
 * > edit (pencil) > Version: New version > Deploy. That keeps the same URL;
 * "New deployment" would make a new one.
 */

var SHOW = "Show on site";
var SHOW_NOTE =
  "Tick to list this name on save.sesptsa.org. Check first that the sign-on is real: " +
  "anyone can type an organization's name. The name shows as typed in this row.";
var FRESH_SECONDS = 300; // older than this, the next request reads the sheet again
var KEEP_SECONDS = 21600; // how long the last good copy is kept, in case the sheet can't be read

// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function doGet() {
  var cache = CacheService.getScriptCache();
  var cached = cache.getAll(["names", "names:at"]);
  var json = cached.names;
  // No "names:at": an edit removed it (onEdit), so the copy is stale.
  var readAt = Number(cached["names:at"]) || 0;
  if (!json || Date.now() - readAt > FRESH_SECONDS * 1000) {
    try {
      json = JSON.stringify({ names: readNames_() });
      cache.putAll({ names: json, "names:at": String(Date.now()) }, KEEP_SECONDS);
    } catch (err) {
      // Unreadable: keep serving the last good copy if there is one.
      console.warn("Names not read: " + err);
      if (!json) throw err;
    }
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Coalition")
    .addItem("Add the Show on site column", "addShowColumn")
    .addToUi();
}

// Any edit marks the cache stale, so the next page load reads the sheet again
// and a tick shows right away rather than within FRESH_SECONDS. A simple
// trigger: it runs as whoever edits, with no authorization, which the cache
// doesn't need; anything that goes wrong here must never bother the editor.
// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function onEdit() {
  try {
    CacheService.getScriptCache().remove("names:at");
  } catch (err) {
    console.warn(err);
  }
}

// Adds the "Show on site" column at the right of the active tab if it lacks
// one, with checkboxes far enough down for new responses and a note on the
// header. Existing ticks are kept (insertCheckboxes would reset them all to
// unticked). Safe to run again.
// oxlint-disable-next-line no-unused-vars -- the Coalition menu calls it by name
function addShowColumn() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var minRows = 1000;
  if (sheet.getMaxRows() < minRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minRows - sheet.getMaxRows());
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(clean_);
  var col = headers.indexOf(SHOW) + 1;
  if (!col) {
    col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue(SHOW);
  }
  sheet.getRange(1, col).setNote(SHOW_NOTE);
  sheet
    .getRange(2, col, sheet.getMaxRows() - 1, 1)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
}

// [{ name }]: the ticked names from every tab that has the columns, each name
// once, newest first (rows without a timestamp go last, in sheet order).
function readNames_() {
  var rows = [];
  SpreadsheetApp.getActiveSpreadsheet()
    .getSheets()
    .forEach(function (sheet) {
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow < 2) return;
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(clean_);
      var col = columns_(headers);
      if (col.show < 0 || col.name < 0) return;
      // One column at a time, so the email column is never read.
      var column = function (c) {
        return c < 0 ? null : sheet.getRange(2, c + 1, lastRow - 1, 1).getValues();
      };
      var names = column(col.name);
      var shows = column(col.show);
      var times = column(col.time);
      names.forEach(function (cell, i) {
        var name = clean_(cell[0]);
        if (!name || !ticked_(shows[i][0])) return;
        var stamp = times ? times[i][0] : null;
        rows.push({
          name: name,
          time: stamp && typeof stamp.getTime === "function" ? stamp.getTime() : 0,
          order: rows.length,
        });
      });
    });
  rows.sort(function (a, b) {
    return b.time - a.time || a.order - b.order;
  });
  var listed = {};
  return rows
    .filter(function (r) {
      var key = nameKey_(r.name);
      if (listed[key]) return false;
      listed[key] = true;
      return true;
    })
    .map(function (r) {
      return { name: r.name };
    });
}

// Where each column is (-1 if absent). The name is the first header that
// mentions an organization or a name, and never the email or the tick.
function columns_(headers) {
  function find(test) {
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i].toLowerCase();
      if (headers[i] === SHOW || /e-?mail/.test(h)) continue;
      if (test(h)) return i;
    }
    return -1;
  }
  return {
    show: headers.indexOf(SHOW),
    name: find(function (h) {
      return /organi[sz]ation|\bname\b/.test(h);
    }),
    time: find(function (h) {
      return h === "timestamp";
    }),
  };
}

function ticked_(v) {
  return v === true || String(v).toUpperCase() === "TRUE";
}

// What a name refers to, for spotting repeats: "  Sierra  Club" = "sierra club".
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
