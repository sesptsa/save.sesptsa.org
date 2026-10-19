// Save Sunnyside — the take-action page: the next event in the hero and the
// upcoming events list, both from the events feed (signers.js fetches it: the
// same Apps Script as the signers feed, asked for the Events tab), the "we are
// here" marker in the key dates, and the Copy Message button. Everything is
// progressive: without it the hero shows the vote, the dates show without a
// marker, and the message is there to select by hand.
(function () {
  "use strict";

  var S = window.SaveSES;
  var DAY = 86400000;
  // AP style, as the dates in the HTML are written: "Sun., Oct. 18".
  var AP_DAYS = ["Sun.", "Mon.", "Tue.", "Wed.", "Thu.", "Fri.", "Sat."];
  var AP_MONTHS = [
    "Jan.",
    "Feb.",
    "March",
    "April",
    "May",
    "June",
    "July",
    "Aug.",
    "Sept.",
    "Oct.",
    "Nov.",
    "Dec.",
  ];

  function today() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  // "2026-10-21" as a local date (new Date("2026-10-21") would be UTC, a day
  // off in the evening here). Anything else is null.
  function parseDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function apDate(d) {
    return AP_DAYS[d.getDay()] + ", " + AP_MONTHS[d.getMonth()] + " " + d.getDate();
  }
  function longDate(d) {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }
  // The calendar-leaf tile: weekday, day, month.
  function dateTile(d) {
    var tile = S.el("span", "date-tile");
    tile.setAttribute("aria-hidden", "true");
    tile.append(
      S.el("span", "", d.toLocaleDateString("en-US", { weekday: "short" })),
      S.el("b", "", String(d.getDate())),
      S.el("span", "", d.toLocaleDateString("en-US", { month: "short" })),
    );
    return tile;
  }
  // "6–8 PM · Hosford MS", with the full date first for screen readers; the
  // place is a link (a new tab) when the sheet has a map link for it.
  function whenWhere(e) {
    var p = S.el("p", "");
    p.append(S.el("span", "visually-hidden", longDate(e.when) + ", "));
    if (e.time) p.append(e.time);
    if (e.time && e.place) p.append(" · ");
    if (e.place) p.append(e.placeUrl ? newTabLink(e.place, e.placeUrl) : e.place);
    return p;
  }
  function newTabLink(text, url, className) {
    var a = S.el("a", className || "", text);
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }
  function httpUrl(url) {
    return /^https?:\/\//i.test(url) ? url : "";
  }

  /* ---- Key dates: dim what has passed, mark today ------------------------ */
  var timeline = document.querySelector(".timeline");
  var now = today();
  (function markToday() {
    var vote = parseDate(timeline.querySelector(".is-vote").dataset.date);
    var days = Math.round((vote - now) / DAY);
    var item = S.el("li", "is-today");
    item.append(S.el("span", "tag tag-sun flag", "We are here"));
    item.append(S.el("strong", "", "Today, " + apDate(now)));
    if (days > 0) {
      item.append(
        S.el("span", "tl-note", days + (days === 1 ? " day" : " days") + " until the board votes"),
      );
    } else if (days === 0) {
      item.append(S.el("span", "tl-note", "The board votes today"));
    }
    // Before the first date that is still to come; past ones fade.
    var items = Array.prototype.slice.call(timeline.children);
    var placed = items.some(function (li) {
      var d = parseDate(li.dataset.date);
      if (d && d < now) {
        li.classList.add("is-past");
        return false;
      }
      timeline.insertBefore(item, li);
      return true;
    });
    if (!placed) timeline.append(item);
  })();

  /* ---- Copy Message ----------------------------------------------------- */
  (function copyButton() {
    var button = document.querySelector(".copy-message");
    var status = document.querySelector(".copy-status");
    var message = document.getElementById("share-message");
    var text = message.textContent.replace(/\s+/g, " ").trim();
    var label = button.lastChild; // the text node after the icon
    var icon = button.querySelector("use");
    var timer;

    function copy() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      // Older browsers, or not a secure context: select it and copy that.
      return new Promise(function (resolve, reject) {
        var range = document.createRange();
        range.selectNodeContents(message);
        var selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        var ok = document.execCommand("copy");
        selection.removeAllRanges();
        if (ok) resolve();
        else reject(new Error("execCommand copy failed"));
      });
    }
    function done(ok) {
      clearTimeout(timer);
      icon.setAttribute("href", ok ? "#icon-check" : "#icon-copy");
      label.textContent = ok ? "Copied" : "Copy Message";
      status.textContent = ok
        ? "Copied. Paste it into a text, email or post."
        : "Couldn’t copy. Select the message and copy it yourself.";
      timer = setTimeout(function () {
        icon.setAttribute("href", "#icon-copy");
        label.textContent = "Copy Message";
      }, 3000);
    }
    button.addEventListener("click", function () {
      copy().then(
        function () {
          done(true);
        },
        function (err) {
          done(false);
          console.warn(err);
        },
      );
    });
    button.hidden = false;
  })();

  /* ---- Events: the hero card and the list ------------------------------- */
  var events = document.getElementById("events");
  var list = events.querySelector(".event-list");
  var statusLine = events.querySelector(".events-status");
  var emptyBox = events.querySelector(".events-empty");
  var errorBox = events.querySelector(".events-error");
  var card = document.querySelector(".next-card");

  load();
  errorBox.querySelector("button").addEventListener("click", load);

  function load() {
    show({ loading: true });
    S.loadFeed()
      .then(showEvents)
      .catch(function (err) {
        show({ error: true });
        console.warn(err);
      });
  }

  function show(state) {
    statusLine.hidden = !state.loading;
    emptyBox.hidden = !state.empty;
    errorBox.hidden = !state.error;
  }

  // The feed's events from today on (the script drops older ones too, but
  // its copy can be minutes old), in date order as served. Everything in it
  // was typed into the sheet by volunteers: text goes in via textContent and
  // only http(s) links are kept.
  function upcoming(feed) {
    return ((feed && feed.events) || [])
      .map(function (e) {
        var link = e.link && httpUrl(e.link.url) ? e.link : null;
        return {
          when: parseDate(e.date),
          title: String(e.title || ""),
          time: String(e.time || ""),
          place: String(e.place || ""),
          placeUrl: httpUrl(String(e.placeUrl || "")),
          details: String(e.details || ""),
          link: link && { text: String(link.text || "Details"), url: link.url },
          featured: Boolean(e.featured),
        };
      })
      .filter(function (e) {
        return e.when && e.when >= now && e.title;
      });
  }

  function showEvents(feed) {
    var all = upcoming(feed);
    if (!all.length) return show({ empty: true });
    show({ loaded: true });
    S.fillList(list, all, eventItem);
    fillCard(all[0]);
  }

  // A card; a highlighted one ("Highlight" ticked in the sheet) gets a green edge.
  function eventItem(e) {
    var li = S.el("li", "event" + (e.featured ? " is-featured" : ""));
    li.append(dateTile(e.when));
    var body = S.el("div", "event-body");
    body.append(S.el("h3", "", e.title));
    var meta = whenWhere(e);
    meta.className = "event-meta";
    body.append(meta);
    if (e.details) body.append(S.el("p", "event-details", e.details));
    li.append(body);
    if (e.link) {
      var p = S.el("p", "event-link");
      p.append(newTabLink(e.link.text, e.link.url, "button outline small"));
      li.append(p);
    }
    return li;
  }

  // The hero card: the vote until now; from here the next event.
  function fillCard(e) {
    card.querySelector(".next-label").textContent = "Next event";
    card.querySelector(".date-tile").replaceWith(dateTile(e.when));
    card.querySelector("#next-title").textContent = e.title;
    var meta = whenWhere(e);
    meta.className = "next-meta";
    card.querySelector(".next-meta").replaceWith(meta);
    var details = card.querySelector(".next-details");
    details.textContent = e.details ? S.shorten(e.details, 160) : "";
    details.hidden = !e.details;
    var link = card.querySelector(".next-link");
    if (e.link) {
      link.textContent = e.link.text;
      link.href = e.link.url;
    }
    link.hidden = !e.link;
    var all = card.querySelector(".next-all");
    all.querySelector("span").textContent = "All upcoming events";
    all.href = "#events";
  }
})();
