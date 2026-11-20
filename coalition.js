// Save Sunnyside — the coalition letter's page (/coalition/): the count in the
// hero and the "Signed by" list, both from the coalition feed (signers.js
// fetches it: an Apps Script on the sign-on form's responses spreadsheet,
// serving only the names volunteers have ticked). Without it, or until an
// approved name exists, the page is the letter and the form, and the hero
// invites sign-ons instead of counting them.
(function () {
  "use strict";

  var S = window.SaveSES;
  var count = document.querySelector(".co-count");
  var signers = document.getElementById("signers");
  var wide = window.matchMedia("(min-width: 560px)").matches;

  S.signForm();

  S.loadFeed("coalition-feed")
    .then(show)
    .catch(function (err) {
      invite();
      console.warn(err);
    });

  // The hero keeps the count's space while the feed loads (the HTML holds a
  // stand-in). Whatever goes there is no taller, and the box keeps the height
  // it had, so the letter below never moves.
  function fillCount(number, label) {
    count.style.minHeight = count.getBoundingClientRect().height + "px";
    count.querySelector("strong").textContent = number;
    count.querySelector("strong").hidden = !number;
    count.querySelector(".co-count-label").textContent = label;
    count.classList.add("is-ready");
  }
  // Nobody listed yet, or no feed: an invitation instead of a count.
  function invite() {
    fillCount("", "Organizations and individuals can sign on.");
    var link = count.querySelector("a");
    link.textContent = "Sign on";
    link.href = "#sign";
  }

  function show(feed) {
    var names = (feed && feed.names) || [];
    if (!names.length) return invite();

    var n = S.format(names.length);
    var one = names.length === 1;
    fillCount(
      n,
      one ? "organization or individual has signed." : "organizations and individuals have signed.",
    );
    document.getElementById("signers-title").textContent =
      "Signed by " + n + (one ? " organization or individual" : " organizations and individuals");

    // The most recent few names until "Show all".
    var list = signers.querySelector(".name-list");
    var showAll = signers.querySelector(".more-button");
    var first = wide ? 12 : 8;
    S.fillList(list, names.slice(0, first), S.nameItem);
    showAll.hidden = names.length <= first;
    showAll.querySelector("button").textContent = "Show all " + n;
    showAll.querySelector("button").addEventListener("click", function () {
      showAll.hidden = true;
      S.focusItem(S.fillList(list, names, S.nameItem)[first]);
    });
    signers.hidden = false;

    // A link to #signers (the home page's card) arrived while the section
    // was still hidden, so the browser had nowhere to go.
    if (location.hash === "#signers") {
      requestAnimationFrame(function () {
        signers.scrollIntoView();
      });
    }
  }
})();
