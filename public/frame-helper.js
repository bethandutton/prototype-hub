// Runs inside the prototype frame. Outlines the element under the pointer
// and tells Rehearsal which element it is, so the app can show it and, later,
// pin comments and selections to it.
(function () {
  if (window.parent === window) return;

  var outline = document.createElement("div");
  outline.style.cssText =
    "position:fixed;pointer-events:none;border:1.5px solid #000;border-radius:2px;z-index:2147483647;display:none;transition:all 60ms ease-out";
  document.documentElement.appendChild(outline);

  function describe(el) {
    var parts = [];
    while (el && el !== document.body && parts.length < 4) {
      var tag = el.tagName.toLowerCase();
      if (el.id) {
        parts.unshift(tag + "#" + el.id);
        break;
      }
      var cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean)[0];
      parts.unshift(cls ? tag + "." + cls : tag);
      el = el.parentElement;
    }
    return parts.join(" › ");
  }

  document.addEventListener("mousemove", function (e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === document.documentElement || el === document.body) {
      outline.style.display = "none";
      window.parent.postMessage({ type: "rehearsal:hover", element: null }, "*");
      return;
    }
    var r = el.getBoundingClientRect();
    outline.style.display = "block";
    outline.style.left = r.left - 1 + "px";
    outline.style.top = r.top - 1 + "px";
    outline.style.width = r.width + "px";
    outline.style.height = r.height + "px";
    window.parent.postMessage({ type: "rehearsal:hover", element: describe(el) }, "*");
  });

  document.addEventListener("mouseleave", function () {
    outline.style.display = "none";
    window.parent.postMessage({ type: "rehearsal:hover", element: null }, "*");
  });
})();
