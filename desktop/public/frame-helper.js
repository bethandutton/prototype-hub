// Runs inside every prototype shown on the stage. It finds the block under
// the pointer, reports hovers and clicks to the app, previews alternatives
// in place and draws the app's overlays. The prototype's own code is never
// touched; everything here lives in its own layer.
(function () {
  if (window.__rehearsalHelper) return;
  window.__rehearsalHelper = true;

  var ATTR = "data-rh-id";
  var mode = "select";
  var originals = {};
  var pins = [];
  var selectedId = null;

  var layer = document.createElement("div");
  layer.setAttribute("data-rh-layer", "");
  layer.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483647";

  function box(style) {
    var el = document.createElement("div");
    el.style.cssText = "position:absolute;display:none;pointer-events:none;box-sizing:border-box;" + style;
    layer.appendChild(el);
    return el;
  }

  var hover = box("border:1px solid rgba(23,23,23,.6);border-radius:2px");
  var selected = box("border:1.5px solid #2f6ff0;border-radius:2px;box-shadow:0 0 0 3px rgba(47,111,240,.14)");

  function mount() {
    if (document.body && !layer.parentNode) document.body.appendChild(layer);
  }

  function ours(el) {
    return layer.contains(el);
  }

  function blockOf(el) {
    while (el && el !== document.documentElement) {
      if (el.getAttribute && el.getAttribute(ATTR)) return el;
      el = el.parentNode;
    }
    return null;
  }

  function byId(id) {
    return document.querySelector("[" + ATTR + '="' + id + '"]');
  }

  function labelOf(el) {
    var tag = el.tagName.toLowerCase();
    var text = (el.getAttribute("alt") || el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > 48) text = text.slice(0, 47).replace(/\s+$/, "") + "…";
    return text ? tag + " · " + text : tag;
  }

  function place(el, target) {
    if (!target) {
      el.style.display = "none";
      return;
    }
    var r = target.getBoundingClientRect();
    el.style.display = "block";
    el.style.left = r.left + window.scrollX + "px";
    el.style.top = r.top + window.scrollY + "px";
    el.style.width = r.width + "px";
    el.style.height = r.height + "px";
  }

  function send(msg) {
    window.parent.postMessage(Object.assign({ rehearsal: true }, msg), "*");
  }

  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }

  function drawPins() {
    layer.querySelectorAll("[data-rh-pin]").forEach(function (p) {
      p.parentNode.removeChild(p);
    });
    pins.forEach(function (pin) {
      var el = byId(pin.blockId);
      if (!el) return;
      var r = el.getBoundingClientRect();
      var dot = document.createElement("div");
      dot.setAttribute("data-rh-pin", pin.blockId);
      dot.textContent = String(pin.count);
      dot.style.cssText =
        "position:absolute;pointer-events:auto;cursor:pointer;min-width:20px;height:20px;padding:0 6px;border-radius:10px 10px 10px 2px;background:#2f6ff0;color:#fff;font:600 11px/20px -apple-system,system-ui,sans-serif;text-align:center;box-shadow:0 1px 2px rgba(0,0,0,.25);left:" +
        (r.right + window.scrollX - 10) +
        "px;top:" +
        (r.top + window.scrollY - 10) +
        "px";
      dot.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        send({ type: "pin", blockId: pin.blockId });
      });
      layer.appendChild(dot);
    });
  }

  function refresh() {
    place(selected, selectedId ? byId(selectedId) : null);
    drawPins();
  }

  document.addEventListener("mousemove", function (e) {
    if (mode !== "select") return;
    var el = blockOf(document.elementFromPoint(e.clientX, e.clientY));
    if (!el || ours(el)) {
      hover.style.display = "none";
      send({ type: "hover", block: null });
      return;
    }
    place(hover, el);
    send({ type: "hover", block: { id: el.getAttribute(ATTR), label: labelOf(el) } });
  });

  document.addEventListener("mouseleave", function () {
    hover.style.display = "none";
    send({ type: "hover", block: null });
  });

  document.addEventListener(
    "click",
    function (e) {
      if (mode !== "select") return;
      e.preventDefault();
      e.stopPropagation();
      var el = blockOf(document.elementFromPoint(e.clientX, e.clientY));
      if (!el || ours(el)) {
        selectedId = null;
        place(selected, null);
        send({ type: "select", block: null });
        return;
      }
      selectedId = el.getAttribute(ATTR);
      place(selected, el);
      send({ type: "select", block: { id: selectedId, tag: el.tagName.toLowerCase(), label: labelOf(el), rect: rectOf(el), html: el.outerHTML } });
    },
    true,
  );

  // Block typed shortcuts and form submits from doing anything while selecting.
  document.addEventListener(
    "submit",
    function (e) {
      if (mode === "select") e.preventDefault();
    },
    true,
  );

  window.addEventListener("message", function (e) {
    var msg = e.data;
    if (!msg || !msg.rehearsal) return;
    if (msg.type === "mode") {
      mode = msg.mode;
      hover.style.display = "none";
      if (mode !== "select") {
        selectedId = null;
        place(selected, null);
      }
    }
    if (msg.type === "select") {
      selectedId = msg.blockId || null;
      var el = selectedId ? byId(selectedId) : null;
      place(selected, el);
      if (el && msg.scroll) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    if (msg.type === "preview") {
      var target = byId(msg.blockId);
      if (!target) return;
      if (!(msg.blockId in originals)) originals[msg.blockId] = target.outerHTML;
      target.outerHTML = msg.content;
      var next = byId(msg.blockId);
      if (!next) {
        // The alternative lost its id; put it back so the swap stays reversible.
        var tmp = document.createElement("div");
        tmp.innerHTML = msg.content;
        if (tmp.firstElementChild) tmp.firstElementChild.setAttribute(ATTR, msg.blockId);
      }
      setTimeout(refresh, 0);
    }
    if (msg.type === "restore") {
      var current = byId(msg.blockId);
      if (current && originals[msg.blockId]) current.outerHTML = originals[msg.blockId];
      delete originals[msg.blockId];
      setTimeout(refresh, 0);
    }
    if (msg.type === "pins") {
      pins = msg.pins || [];
      drawPins();
    }
  });

  window.addEventListener("scroll", refresh, { passive: true });
  window.addEventListener("resize", refresh);
  if (window.ResizeObserver && document.body) new ResizeObserver(refresh).observe(document.body);

  function ready() {
    mount();
    send({ type: "ready", title: document.title, height: document.documentElement.scrollHeight });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
