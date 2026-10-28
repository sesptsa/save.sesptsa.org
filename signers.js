// Save Sunnyside — the signers feed, shared by the letter page (script.js) and
// the impact page (impact.js): fetching it, the running count, and the story
// cards. The take-action page (take-action.js) uses the fetch and the helpers
// for its events feed, which the same Apps Script serves. Loaded before each
// page script; it defines window.SaveSES and nothing else. Everything in the
// feeds is text typed by the public or by volunteers, so it only ever goes into
// the page via textContent.
window.SaveSES = (function () {
  "use strict";

  var COUNT_KEY = "save-ses:signed-count";
  // Stories longer than `full` show about `cut` characters, ending at a
  // sentence if one ends in the second half of that, then "Read more".
  var LIMITS = { full: 340, cut: 280 };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function format(n) {
    return n.toLocaleString("en-US");
  }

  // The feed is a Google Apps Script web app (tools/signers-apps-script.js)
  // serving the count plus only the names and stories PTSA volunteers have
  // approved. It takes a second or more, so each page preloads it from <head>
  // (<link rel="preload" id="signers-feed">); fetching the same URL with the
  // same CORS mode reuses that request.
  function loadFeed() {
    var link = document.getElementById("signers-feed");
    if (!link) return Promise.reject(new Error("Signers feed: no preload link"));
    return fetch(link.href).then(function (res) {
      if (!res.ok) throw new Error("Signers feed: HTTP " + res.status);
      return res.json();
    });
  }

  // The count shows a floor ("3,500+", in the HTML) at once, then this
  // visitor's last-seen count, then the live one. Storage can be unavailable
  // (private mode, blocked site data); the floor then just stays.
  function showLastCount(valueEl) {
    try {
      var seen = Number(localStorage.getItem(COUNT_KEY));
      if (seen > parseInt(valueEl.textContent, 10)) valueEl.textContent = format(seen);
    } catch {
      // keep the floor
    }
  }
  function rememberCount(n) {
    try {
      localStorage.setItem(COUNT_KEY, String(n));
    } catch {
      // fine: next visit starts from the floor
    }
  }

  function signer(s, nameTag) {
    var parts = [el(nameTag, "signer-name", s.name)];
    if (s.connection) parts.push(el("span", "signer-connection", s.connection));
    return parts;
  }

  function nameItem(s) {
    var li = el("li");
    li.append.apply(li, signer(s, "span"));
    return li;
  }

  // The first `cut` characters or so of a story, ending at a sentence when one
  // ends in the second half of that, else at a word with an ellipsis.
  function shorten(story, cut) {
    var head = story.slice(0, cut + 1);
    var sentence = head.search(/[.!?]["”’)]?\s[^.!?]*$/);
    if (sentence > cut / 2) return head.slice(0, sentence + 1).replace(/\s+$/, "");
    var word = head.search(/\s\S*$/);
    return story.slice(0, word > 0 ? word : cut).replace(/[\s.,;:]+$/, "") + "…";
  }

  // A story card: the story, "Read more" when it is long, and who wrote it.
  // limits: { full, cut } to override LIMITS (the impact page shows more).
  function storyItem(s, limits) {
    var lim = limits || LIMITS;
    var li = el("li");
    var fig = el("figure", "story");
    var quote = el("blockquote", "", s.story);
    fig.append(quote);
    if (s.story.length > lim.full) {
      // Keep the full text a tap away.
      var short = shorten(s.story, lim.cut);
      var more = el("button", "read-more", "Read more");
      more.type = "button";
      more.setAttribute("aria-expanded", "false");
      quote.textContent = short;
      more.addEventListener("click", function () {
        var open = more.getAttribute("aria-expanded") !== "true";
        quote.textContent = open ? s.story : short;
        more.textContent = open ? "Show less" : "Read more";
        more.setAttribute("aria-expanded", String(open));
      });
      fig.append(more);
    }
    var caption = el("figcaption");
    caption.append.apply(caption, signer(s, "strong"));
    fig.append(caption);
    li.append(fig);
    return li;
  }

  // Replaces a list's items. Returns the new <li>s.
  function fillList(list, items, render) {
    var lis = items.map(render);
    list.textContent = "";
    list.append.apply(list, lis);
    return lis;
  }

  // Moves focus to an item a "more" button just revealed, so keyboard and
  // screen reader users carry on from there instead of losing their place.
  function focusItem(li) {
    if (!li) return;
    li.tabIndex = -1;
    li.focus();
  }

  // A copy in random order (Fisher–Yates).
  function shuffle(items) {
    var a = items.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // The feed's stories, featured ones first in a fresh random order each visit
  // (so the same few don't lead every time), then the rest newest first.
  function storiesFeaturedFirst(feed) {
    var all = (feed && feed.stories) || [];
    var featured = all.filter(function (s) {
      return s.featured;
    });
    var rest = all.filter(function (s) {
      return !s.featured;
    });
    return shuffle(featured).concat(rest);
  }

  return {
    el: el,
    format: format,
    loadFeed: loadFeed,
    showLastCount: showLastCount,
    rememberCount: rememberCount,
    nameItem: nameItem,
    storyItem: storyItem,
    shorten: shorten,
    fillList: fillList,
    focusItem: focusItem,
    shuffle: shuffle,
    storiesFeaturedFirst: storiesFeaturedFirst,
  };
})();
