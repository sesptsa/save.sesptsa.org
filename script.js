// Save Sunnyside — the little bit of behaviour the page needs.
// Everything here is progressive: without it the citations are plain anchor
// links into the references list and the page still reads and signs fine.
(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var letter = document.querySelector(".letter");
  var sign = document.getElementById("sign");
  var refsDetails = document.querySelector(".references");
  var refItems = document.querySelectorAll(".references-list li");
  // Same breakpoint as the side-by-side layout in style.css; keep them together.
  var desktop = window.matchMedia("(min-width: 1200px) and (hover: hover)");

  /* ---- Header: hide its "Add my name" while the form is already on screen. */
  new IntersectionObserver(
    function (entries) {
      header.classList.toggle("form-visible", entries[0].isIntersecting);
    },
    { rootMargin: "-20% 0px 0px 0px" }, // "on screen" once a fifth of the viewport is past its top
  ).observe(sign);

  /* ---- References list: the count comes from the list itself; open by
          default on desktop, when printing, and when a link points at it. */
  document.querySelector(".references .count").textContent = "(" + refItems.length + ")";
  document.querySelector(".sheet-all a").textContent = "All " + refItems.length + " references";
  if (desktop.matches) refsDetails.open = true;
  window.addEventListener("beforeprint", function () {
    refsDetails.open = true;
  });
  document.querySelectorAll('a[href="#references"]').forEach(function (a) {
    a.addEventListener("click", function () {
      refsDetails.open = true;
    });
  });

  /* ---- Citations ------------------------------------------------------ */
  var pop = document.querySelector(".cite-pop");
  var sheet = document.querySelector(".sheet");
  var sheetClose = sheet.querySelector(".sheet-close");
  var backdrop = document.querySelector(".sheet-backdrop");
  var outside = document.querySelectorAll(".site-header, main, .site-footer");
  var current = null; // the <a> inside the open sup.cite
  var byHover = false; // opened by mouseenter rather than a click or key

  // Copies a reference into a dialog. Each source URL becomes a "Source: host"
  // button that opens in a new tab; the <br>s between multiple sources go.
  function fill(container, li) {
    if (container.dataset.ref === li.id) return; // already showing it
    container.dataset.ref = li.id;
    container.querySelector(".cite-label").textContent = "Reference " + li.id.replace("ref-", "");
    var body = container.querySelector(".cite-body");
    body.innerHTML = li.querySelector(".ref-body").innerHTML;
    body.querySelectorAll("br").forEach(function (br) {
      br.remove();
    });
    body.querySelectorAll("a[href^='http']").forEach(function (a) {
      var host = a.hostname.replace(/^www\./, "");
      a.className = "source";
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", "Source: " + host + " (opens in a new tab)");
      a.innerHTML =
        "<span></span>" +
        '<svg width="18" height="18" aria-hidden="true"><use href="#icon-external"></use></svg>';
      a.firstChild.textContent = "Source: " + host;
    });
  }

  function setOpen(link, open) {
    link.classList.toggle("is-open", open);
    link.setAttribute("aria-expanded", String(open));
  }

  function openFor(link, viaHover) {
    var li = document.getElementById(link.hash.slice(1));
    if (!li) return;
    if (current && current !== link) setOpen(current, false);
    current = link;
    byHover = viaHover;
    setOpen(link, true);

    if (desktop.matches) {
      // Read layout before writing to it, so the hover does not force a reflow.
      var top = link.getBoundingClientRect().top - letter.getBoundingClientRect().top;
      fill(pop, li);
      pop.style.top = Math.max(0, Math.round(top - 8)) + "px"; // level with the marker's top
      pop.classList.add("is-open");
      // A click (keyboard or mouse) moves focus into the dialog so it is
      // announced; a hover just shows it.
      if (!viaHover) pop.focus({ preventScroll: true });
    } else {
      fill(sheet, li);
      document.body.classList.add("sheet-open");
      sheet.removeAttribute("hidden");
      backdrop.removeAttribute("hidden");
      outside.forEach(function (el) {
        el.inert = true;
      });
      sheetClose.focus({ preventScroll: true });
    }
  }

  function close() {
    var sheetOpen = document.body.classList.contains("sheet-open");
    var hadFocus = sheetOpen || pop.contains(document.activeElement);
    pop.classList.remove("is-open");
    if (sheetOpen) {
      document.body.classList.remove("sheet-open");
      sheet.setAttribute("hidden", "");
      backdrop.setAttribute("hidden", "");
      outside.forEach(function (el) {
        el.inert = false;
      });
    }
    if (current) {
      setOpen(current, false);
      if (hadFocus) current.focus({ preventScroll: true });
    }
    current = null;
  }

  document.querySelectorAll('sup.cite a[href^="#ref-"]').forEach(function (link) {
    link.setAttribute("aria-haspopup", "dialog");
    link.setAttribute("aria-expanded", "false");
    // Tap or click: open; a second click on the open marker closes it. On
    // desktop a click on a marker that is only hovered-open pins it instead.
    link.addEventListener("click", function (ev) {
      ev.preventDefault();
      if (current === link && !byHover) close();
      else openFor(link, false);
    });
    // Desktop: hovering opens and it stays open until another citation is
    // hovered, a click lands outside, or Escape is pressed.
    link.addEventListener("mouseenter", function () {
      if (desktop.matches) openFor(link, true);
    });
  });

  sheetClose.addEventListener("click", close);
  sheet.querySelector(".sheet-all a").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && current) close();
  });
  document.addEventListener("click", function (ev) {
    if (current && !ev.target.closest("sup.cite, .cite-pop, .sheet")) close();
  });
  desktop.addEventListener("change", close);

  /* ---- The embedded form ---------------------------------------------- */
  var frame = document.querySelector(".form-frame");
  var iframe = frame.querySelector("iframe");

  // It loads lazily, so start fetching as soon as someone heads for it.
  document.querySelectorAll('a[href="#sign"]').forEach(function (a) {
    a.addEventListener("click", function () {
      iframe.loading = "eager";
    });
  });

  // Submitting reloads the frame once (observed behaviour of Google Forms;
  // "Submit another response" reloads it again). Shrink it to the
  // confirmation and bring that into view instead of leaving a tall blank frame.
  var loads = 0;
  iframe.addEventListener("load", function () {
    loads += 1;
    if (loads === 2) {
      frame.classList.add("is-submitted");
      sign.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (loads > 2) {
      frame.classList.remove("is-submitted");
    }
  });

  /* ---- The undersigned ------------------------------------------------ */
  // The feed is a Google Apps Script web app (tools/signers-apps-script.js)
  // serving only the names and stories PTSA volunteers have approved, plus the
  // count. All of it is text typed by the public, so it only ever goes in via
  // textContent. It takes a second or more, so the request is preloaded from
  // <head>, and the hero shows a floor ("200+") or this visitor's last-seen
  // count meanwhile. The section stays hidden until the feed loads.
  var undersigned = document.getElementById("undersigned");
  var heroCount = document.querySelector(".hero .signed-count");
  var heroValue = heroCount.querySelector(".count-value");
  var feedLink = document.getElementById("signers-feed");
  var COUNT_KEY = "save-ses:signed-count";
  var STORY_CUT = 280; // longer stories show this much, then "Read more"
  var wide = window.matchMedia("(min-width: 560px)").matches;

  // Storage can be unavailable (private mode, blocked site data); the floor
  // then just stays until the feed answers.
  try {
    var seen = Number(localStorage.getItem(COUNT_KEY));
    if (seen > parseInt(heroValue.textContent, 10))
      heroValue.textContent = seen.toLocaleString("en-US");
  } catch (err) {
    // keep the floor
  }

  if (feedLink) {
    // Same URL and CORS mode as the preload, so the browser reuses that request.
    fetch(feedLink.href)
      .then(function (res) {
        if (!res.ok) throw new Error("Signers feed: HTTP " + res.status);
        return res.json();
      })
      .then(function (feed) {
        if (!showSigners(feed)) noSection();
      })
      .catch(function (err) {
        noSection();
        console.warn(err);
      });
  } else {
    noSection();
  }

  // Without the section the count keeps its floor but links nowhere.
  function noSection() {
    heroCount.removeAttribute("href");
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
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

  function storyItem(s) {
    var li = el("li");
    var fig = el("figure", "story");
    var mark = el("span", "quote-mark", "\u201C");
    mark.setAttribute("aria-hidden", "true");
    var quote = el("blockquote", "", s.story);
    fig.append(mark, quote);
    if (s.story.length > STORY_CUT + 60) {
      // Cut at the last space before the limit and keep the full text a tap away.
      var cut = s.story.slice(0, STORY_CUT + 1).search(/\s\S*$/);
      var short = s.story.slice(0, cut > 0 ? cut : STORY_CUT).replace(/[\s.,;:]+$/, "") + "\u2026";
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

  // Returns whether there was anything to show.
  function showSigners(feed) {
    var names = (feed && feed.names) || [];
    var stories = (feed && feed.stories) || [];
    // The count is every signature; names and stories only the approved ones.
    if (!(feed && feed.count > 0)) return false;
    var count = feed.count.toLocaleString("en-US");

    heroValue.textContent = count;
    undersigned.querySelector(".undersigned-count strong").textContent = count;
    try {
      localStorage.setItem(COUNT_KEY, String(feed.count));
    } catch (err) {
      // fine: next visit starts from the floor
    }
    undersigned.hidden = false;

    // Stories: featured first (the feed's order), a few at a time.
    if (stories.length) {
      var storyBox = undersigned.querySelector(".stories");
      var storyList = storyBox.querySelector(".story-list");
      var moreStories = storyBox.querySelector(".more-button");
      var shownStories = 0;
      var showStories = function (n) {
        shownStories = Math.min(stories.length, shownStories + n);
        var lis = fillList(storyList, stories.slice(0, shownStories), storyItem);
        moreStories.hidden = shownStories >= stories.length;
        return lis;
      };
      showStories(wide ? 6 : 3);
      storyBox.hidden = false;
      moreStories.querySelector("button").addEventListener("click", function () {
        var before = shownStories;
        focusItem(showStories(6)[before]);
      });
    }

    // Names: newest first, the first few until "Show all"; typing in "Find a
    // name" searches all of them, ignoring case and accents.
    if (!names.length) return true;
    undersigned.querySelector(".names").hidden = false;
    var nameList = undersigned.querySelector(".name-list");
    var status = undersigned.querySelector(".names-status");
    var find = document.getElementById("find-name");
    var showAll = undersigned.querySelector(".names .more-button");
    var first = wide ? 24 : 8;
    var expanded = names.length <= first;
    var fold = function (text) {
      return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    };
    var folded = names.map(function (s) {
      return fold(s.name);
    });
    showAll.querySelector("button").textContent =
      "Show all " + names.length.toLocaleString("en-US") + " names";

    var update = function () {
      var q = fold(find.value.trim());
      if (!q) {
        showAll.hidden = expanded;
        status.textContent = "Newest first";
        return fillList(nameList, expanded ? names : names.slice(0, first), nameItem);
      }
      var hits = names.filter(function (s, i) {
        return folded[i].indexOf(q) >= 0;
      });
      showAll.hidden = true;
      status.textContent =
        hits.length === 0
          ? "No names match"
          : hits.length === 1
            ? "1 name matches"
            : hits.length + " names match";
      return fillList(nameList, hits, nameItem);
    };
    update();
    find.addEventListener("input", update);
    showAll.querySelector("button").addEventListener("click", function () {
      expanded = true;
      focusItem(update()[first]);
    });
    return true;
  }
})();
