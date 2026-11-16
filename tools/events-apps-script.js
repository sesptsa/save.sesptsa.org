/**
 * Events feed for save.sesptsa.org: a Google Apps Script web app, bound to the
 * Advocacy committee's planning spreadsheet, that serves the events marked
 * for the website as JSON. The take-action page (take-action.js) fetches it
 * and fills in the "next event" card and the upcoming events list, so
 * volunteers keep the list current without a site deploy. Nothing here runs
 * on the site itself; this file is the source of the script, kept in the
 * repo so it isn't lost in a Google account. It is separate from the signers
 * feed (tools/signers-apps-script.js), which lives on the form's responses
 * spreadsheet.
 *
 * @OnlyCurrentDoc
 *
 * The events are the rows of the spreadsheet's events tab: the first tab
 * with "Website?", "Date" and "Event / Deadline" headers in one of its top
 * five rows, whatever the tab is called. Columns are found by their header
 * text (capitals don't matter), so they can be reordered and other columns
 * can sit among them. Only these columns are ever read; the coordinator,
 * attendee, strategy and notes columns never reach the feed. Each cell is
 * shown as typed: nothing is worked out from the wording, and a link put on
 * words inside a cell is not seen, so links go in their own columns.
 *   Website?          "Yes" (or a tick) puts the row on the site. Nothing is
 *                     public without it.
 *   Date              When. Events leave the site the day after their date.
 *   Time              "6–8 PM", "12:45 PM". Optional. Clock times typed
 *                     loosely ("430p", "6p-8p", "7:30:00 AM") are set in the
 *                     site's style ("4:30 PM", "6–8 PM", "7:30 AM");
 *                     anything else shows as typed.
 *   Event / Deadline  The title: "PPS Board Meeting".
 *   Location/Link     Where: "Hosford MS", "501 N Dixon St", "Online". Optional.
 *   Map link          A map (or venue, or Zoom) URL; makes the place a link.
 *                     Optional.
 *   Details           A sentence or a short paragraph. Optional.
 *   Link              A URL for the event's button. Must start with http://
 *                     or https://, else there is no button. Optional.
 *   Link text         What the button says: "RSVP", "Agenda". "Details" if
 *                     blank.
 *   Highlight         "Yes" (or a tick) gives the event a green edge.
 * Website > Add the website's columns adds whichever of these the tab lacks
 * (beside "Link"), each with a note on its header.
 *
 * The page gets
 * { events: [{ date: "2026-10-21", time, title, place, placeUrl, details,
 *   link: { text, url } | null, featured }] },
 * in date order, dated yesterday or later (the page drops the rest by its own
 * clock). The feed is cached for FRESH_SECONDS, and any edit to the
 * spreadsheet marks it stale (onEdit), so a change shows on the next page
 * load. If the tab can't be read, the last events served stay up and the
 * error is logged (Apps Script > Executions).
 *
 * Setup (once, signed in as an account that can edit the spreadsheet and
 * will keep that access: the web app runs as whoever deploys it):
 *   1. Open the planning spreadsheet. Extensions > Apps Script. Replace the
 *      editor's contents with this file and save.
 *   2. Reload the spreadsheet. Website > Add the website's columns, if any
 *      are missing. Website > List what the site will show (authorize when
 *      asked) to check the rows.
 *   3. In Apps Script: Deploy > New deployment > Web app. Execute as: Me.
 *      Who has access: Anyone. Copy the web app URL (ends in /exec) into the
 *      href of <link id="events-feed"> in take-action/index.html.
 *   4. Open the URL in a browser to check the JSON.
 * Updating the code later: paste it in, save, then Deploy > Manage deployments
 * > edit (pencil) > Version: New version > Deploy. That keeps the same URL;
 * "New deployment" would make a new one.
 */

var FRESH_SECONDS = 300; // older than this, the next request reads the tab again
var KEEP_SECONDS = 21600; // how long the last good copy is kept, in case the tab can't be read

// Each column's header. To rename a column in the spreadsheet, rename it here
// too and deploy a new version.
var COLUMNS = {
  show: "Website?",
  date: "Date",
  time: "Time",
  title: "Event / Deadline",
  place: "Location/Link",
  placeUrl: "Map link",
  details: "Details",
  linkUrl: "Link",
  linkText: "Link text",
  featured: "Highlight",
};
// The columns Add the website's columns can add, in order, with their notes.
var ADDABLE = {
  linkText: 'What the button says: RSVP, Agenda, ... "Details" if blank. The URL goes in Link.',
  placeUrl: "A Google Maps, venue or Zoom link; the location becomes a link to it. Optional.",
  details: "A sentence or a short paragraph shown under the event. Optional.",
  featured: "Yes for the events that matter most: they get a green edge on the site.",
};

// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function doGet() {
  var cache = CacheService.getScriptCache();
  var cached = cache.getAll(["events", "events:at"]);
  var json = cached.events;
  // No "events:at": an edit removed it (onEdit), so the copy is stale.
  var readAt = Number(cached["events:at"]) || 0;
  if (!json || Date.now() - readAt > FRESH_SECONDS * 1000) {
    try {
      json = JSON.stringify({ events: readEvents_() });
      cache.putAll({ events: json, "events:at": String(Date.now()) }, KEEP_SECONDS);
    } catch (err) {
      // Unreadable: keep serving the last good copy if there is one.
      console.warn("Events not read: " + err);
      if (!json) throw err;
    }
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Website")
    .addItem("List what the site will show", "checkEvents")
    .addItem("Add the website's columns", "addWebsiteColumns")
    .addToUi();
}

// Any edit marks the cache stale, so the next page load reads the tab again
// and the change shows right away rather than within FRESH_SECONDS. A simple
// trigger: it runs as whoever edits, with no authorization, which the cache
// doesn't need; anything that goes wrong here must never bother the editor.
// oxlint-disable-next-line no-unused-vars -- Apps Script calls it by name
function onEdit() {
  try {
    CacheService.getScriptCache().remove("events:at");
  } catch (err) {
    console.warn(err);
  }
}

// Shows the events the feed would serve right now, read fresh from the tab.
// oxlint-disable-next-line no-unused-vars -- the Website menu calls it by name
function checkEvents() {
  var ui = SpreadsheetApp.getUi();
  var events;
  try {
    events = readEvents_();
  } catch (err) {
    ui.alert(String(err.message || err));
    return;
  }
  var lines = events.map(function (e) {
    return (
      [e.date, e.time, e.title, e.place].filter(Boolean).join(" · ") +
      (e.link ? " [" + e.link.text + "]" : "")
    );
  });
  ui.alert(
    events.length + (events.length === 1 ? " event" : " events") + " to show on the site",
    lines.join("\n") || 'No row dated yesterday or later has "Yes" under ' + COLUMNS.show + ".",
    ui.ButtonSet.OK,
  );
}

// Adds the ADDABLE columns the events tab lacks, to the right of "Link" (or
// at the far right if there is no Link column), with a note on each header.
// Existing columns are left alone. Safe to run again.
// oxlint-disable-next-line no-unused-vars -- the Website menu calls it by name
function addWebsiteColumns() {
  var ui = SpreadsheetApp.getUi();
  var found;
  try {
    found = eventsTab_();
  } catch (err) {
    ui.alert(String(err.message || err));
    return;
  }
  var sheet = found.sheet;
  var missing = Object.keys(ADDABLE).filter(function (key) {
    return found.head.col[key] < 0;
  });
  if (!missing.length) {
    ui.alert("The tab already has all of the website's columns.");
    return;
  }
  var after = found.head.col.linkUrl >= 0 ? found.head.col.linkUrl + 1 : sheet.getLastColumn();
  sheet.insertColumnsAfter(after, missing.length);
  missing.forEach(function (key, i) {
    sheet
      .getRange(found.head.row + 1, after + 1 + i)
      .setValue(COLUMNS[key])
      .setNote(ADDABLE[key]);
  });
  ui.alert(
    "Added: " +
      missing
        .map(function (key) {
          return COLUMNS[key];
        })
        .join(", ") +
      ".",
  );
}

// { sheet, head }: the events tab and its header (see eventHeader_). Throws
// if no tab has the headers.
function eventsTab_() {
  var sheets = SpreadsheetApp.getActive().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var rows = Math.min(sheets[i].getLastRow(), 5);
    var cols = sheets[i].getLastColumn();
    if (!rows || !cols) continue;
    var head = eventHeader_(sheets[i].getRange(1, 1, rows, cols).getValues());
    if (head) return { sheet: sheets[i], head: head };
  }
  throw new Error(
    "No tab has the headers " + [COLUMNS.show, COLUMNS.date, COLUMNS.title].join(", ") + ".",
  );
}

// { row, col: { date: 3, ... } }: the header row, which is the first of the
// rows given with the show, date and title headers, and where each column is
// (-1 if absent). null if there is no such row.
function eventHeader_(values) {
  for (var r = 0; r < values.length; r++) {
    var headers = values[r].map(function (h) {
      return clean_(h).toLowerCase();
    });
    var col = {};
    Object.keys(COLUMNS).forEach(function (key) {
      col[key] = headers.indexOf(COLUMNS[key].toLowerCase());
    });
    if (col.show >= 0 && col.date >= 0 && col.title >= 0) return { row: r, col: col };
  }
  return null;
}

// The events tab's shown rows, dated yesterday or later, in date order (rows
// on one day keep the sheet's order).
function readEvents_() {
  var found = eventsTab_();
  var sheet = found.sheet;
  var range = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn());
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  var yesterday = Utilities.formatDate(new Date(Date.now() - 86400000), tz, "yyyy-MM-dd");
  return eventsFromRows_(found.head, range.getValues(), range.getDisplayValues(), tz, yesterday);
}

// The rows after the header as feed events. Text columns are read as
// displayed (shown), so a time typed as a time still reads "6:00 PM"; dates
// and ticks from the values.
function eventsFromRows_(head, values, shown, tz, yesterday) {
  var col = head.col;
  var text = function (row, key) {
    return col[key] >= 0 ? clean_(shown[row][col[key]]) : "";
  };
  var events = [];
  for (var r = head.row + 1; r < values.length; r++) {
    if (!yes_(values[r][col.show])) continue;
    var date = isoDate_(values[r][col.date], tz);
    var title = text(r, "title");
    if (!date || !title || date < yesterday) continue;
    var url = httpUrl_(text(r, "linkUrl"));
    events.push({
      date: date,
      time: tidyTime_(text(r, "time")),
      title: title,
      place: text(r, "place"),
      placeUrl: httpUrl_(text(r, "placeUrl")),
      details: col.details >= 0 ? paragraphs_(shown[r][col.details]) : "",
      link: url ? { text: text(r, "linkText") || "Details", url: url } : null,
      featured: col.featured >= 0 && yes_(values[r][col.featured]),
      order: r,
    });
  }
  events.sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order;
  });
  return events.map(function (e) {
    delete e.order;
    return e;
  });
}

// A clock time, or a span of two, in the site's style: "430p" -> "4:30 PM",
// "6p-8p" -> "6–8 PM", "11a-2p" -> "11 AM–2 PM", "7:30:00 AM" -> "7:30 AM".
// Anything else, or a time with no am/pm at all, comes back as typed.
function tidyTime_(typed) {
  var one = "(\\d{1,2})(?::?(\\d{2}))?(?::\\d{2})?\\s*(?:([ap])\\.?(?:m\\.?)?)?";
  var m = new RegExp("^" + one + "(?:\\s*(?:-|–|—|to)\\s*" + one + ")?$", "i").exec(typed);
  if (!m || !(m[3] || m[6])) return typed;
  var clock = function (h, min) {
    if (+h < 1 || +h > 12 || +(min || 0) > 59) return "";
    return String(+h) + (min && min !== "00" ? ":" + min : "");
  };
  var half = function (ap) {
    return " " + ap.toUpperCase() + "M";
  };
  var start = clock(m[1], m[2]);
  if (!start) return typed;
  if (!m[4]) return start + half(m[3]);
  var end = clock(m[4], m[5]);
  if (!end) return typed;
  var from = m[3] || m[6];
  var to = m[6] || m[3];
  if (from.toLowerCase() === to.toLowerCase()) return start + "–" + end + half(to);
  return start + half(from) + "–" + end + half(to);
}

// A tick, or "Yes" picked from a list.
function yes_(v) {
  return v === true || /^(yes|true)$/i.test(clean_(v));
}

// The URL if it is an http(s) one, else "".
function httpUrl_(url) {
  return /^https?:\/\//i.test(url) ? url : "";
}

// A date cell (or a date typed as text) as "yyyy-MM-dd" in the sheet's time
// zone; "" if it isn't one.
function isoDate_(v, tz) {
  var d = v && typeof v.getTime === "function" ? v : clean_(v) ? new Date(clean_(v)) : null;
  if (!d || isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, tz, "yyyy-MM-dd");
}

function clean_(v) {
  return String(v == null ? "" : v)
    .replace(/\s+/g, " ")
    .trim();
}

// Keeps the writer's line breaks, but no more than one blank line in a row.
function paragraphs_(v) {
  return String(v == null ? "" : v)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
