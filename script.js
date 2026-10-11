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
})();
