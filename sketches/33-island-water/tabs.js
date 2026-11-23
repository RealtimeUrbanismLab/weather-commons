// Three tabs on one page: #crisis, #cisterns, #aegean. Each tab has its own address, so a
// link can open it directly. Charts in a hidden tab redraw at their real width when shown.
(function () {
  "use strict";
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const ids = tabs.map((t) => t.getAttribute("aria-controls"));

  function show(id, focus) {
    if (!ids.includes(id)) id = ids[0];
    tabs.forEach((t) => {
      const on = t.getAttribute("aria-controls") === id;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) t.focus();
    });
    window.dispatchEvent(new Event("resize"));   // charts check their width and redraw
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", (e) => {
      e.preventDefault();
      const id = t.getAttribute("aria-controls");
      history.pushState(null, "", "#" + id);
      show(id);
    });
    t.addEventListener("keydown", (e) => {   // arrow keys move between tabs
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!k) return;
      e.preventDefault();
      const id = ids[(i + k + ids.length) % ids.length];
      history.replaceState(null, "", "#" + id);
      show(id, true);
    });
  });
  window.addEventListener("popstate", () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
  // a link to a tab opens the page at the top, with the title and tabs in view
  if (location.hash) { history.scrollRestoration = "manual"; window.scrollTo(0, 0); requestAnimationFrame(() => window.scrollTo(0, 0)); }
})();
