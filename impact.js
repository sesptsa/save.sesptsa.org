// Save Sunnyside — the impact page: the running count in the bridge band and
// the stories section, both from the signers feed (signers.js, loaded first).
// Without it the record reads fine; only the stories and the live count wait
// on the feed.
(function () {
  "use strict";

  var S = window.SaveSES;
  var SET = 6; // featured stories at first, and per "More stories"
  var PAGE = 10; // "All stories" grows by this much per tap
  // This page has the room to show most stories whole (the featured ones run
  // to about 660 characters at the median); only the long ones get cut.
  var LIMITS = { full: 800, cut: 600 };

  function card(s) {
    return S.storyItem(s, LIMITS);
  }

  var stories = document.getElementById("stories");
  var featuredBox = stories.querySelector(".featured");
  var allBox = stories.querySelector(".all-stories");
  var emptyBox = stories.querySelector(".stories-empty");
  var errorBox = stories.querySelector(".stories-error");
  var countValue = document.querySelector(".signed-count .count-value");

  S.showLastCount(countValue);
  load();
  errorBox.querySelector("button").addEventListener("click", load);

  function load() {
    show({ loading: true });
    S.loadFeed()
      .then(showStories)
      .catch(function (err) {
        show({ error: true });
        console.warn(err);
      });
  }

  // Which of the section's blocks is up. The featured panel holds the loading
  // skeleton, so it stays while loading and goes when there is nothing to show.
  function show(state) {
    featuredBox.hidden = !(state.loading || state.loaded);
    allBox.hidden = !state.loaded;
    emptyBox.hidden = !state.empty;
    errorBox.hidden = !state.error;
  }

  function showStories(feed) {
    if (feed && feed.count > 0) {
      countValue.textContent = S.format(feed.count);
      S.rememberCount(feed.count);
    }
    var all = (feed && feed.stories) || [];
    if (!all.length) return show({ empty: true });
    show({ loaded: true });
    featured(all);
    everything(all);
  }

  // Featured: SET to start, from a pool that starts with the stories volunteers
  // ticked "Feature?", in a fresh random order each visit, then the rest.
  // "More stories" adds the next SET until the pool is used up.
  function featured(all) {
    var pool = all.some(function (s) {
      return s.featured;
    })
      ? S.storiesFeaturedFirst({ stories: all })
      : S.shuffle(all); // nothing ticked "Feature?" yet: any six
    var list = featuredBox.querySelector(".story-list");
    var pager = featuredBox.querySelector(".pager");
    var shown = 0;

    var render = function () {
      shown = Math.min(pool.length, shown + SET);
      var lis = S.fillList(list, pool.slice(0, shown), card);
      pager.hidden = shown >= pool.length;
      return lis;
    };
    featuredBox.querySelector(".panel-status").textContent = "";
    pager.querySelector("button").addEventListener("click", function () {
      var before = shown;
      S.focusItem(render()[before]);
    });
    render();
  }

  // All stories, newest first (the feed's order), PAGE at a time.
  function everything(all) {
    var list = allBox.querySelector(".story-list");
    var more = allBox.querySelector(".more-button");
    var button = more.querySelector("button");
    var shownNote = more.querySelector(".shown");
    var shown = 0;

    var render = function (n) {
      shown = Math.min(all.length, shown + n);
      var lis = S.fillList(list, all.slice(0, shown), card);
      more.hidden = shown >= all.length;
      shownNote.textContent = "Showing " + shown + " of " + S.format(all.length);
      return lis;
    };
    button.textContent = "Show " + PAGE + " more stories";
    button.addEventListener("click", function () {
      var before = shown;
      S.focusItem(render(PAGE)[before]);
    });
    render(PAGE);
  }
})();
