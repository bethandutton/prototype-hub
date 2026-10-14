// Runs inside the prototype frame. It is the app's eyes and hands in there:
// it reports what the pointer is over, lets people pick an element to
// comment on, and draws other people's cursors and the comment pins.
(function () {
  if (window.parent === window) return;

  var mode = "browse";
  var layer = document.createElement("div");
  layer.setAttribute("data-rehearsal", "");
  layer.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483647";
  document.documentElement.appendChild(layer);

  var outline = box("1.5px solid #000");
  var selected = box("2px solid #000");
  selected.style.display = "none";
  var peerLayer = document.createElement("div");
  var pinLayer = document.createElement("div");
  layer.appendChild(peerLayer);
  layer.appendChild(pinLayer);

  function box(border) {
    var el = document.createElement("div");
    el.style.cssText = "position:absolute;pointer-events:none;border:" + border + ";border-radius:2px;display:none;transition:all 60ms ease-out";
    layer.appendChild(el);
    return el;
  }

  function ours(el) {
    return layer.contains(el);
  }

  function place(el, target) {
    var r = target.getBoundingClientRect();
    el.style.display = "block";
    el.style.left = r.left + window.scrollX - 1 + "px";
    el.style.top = r.top + window.scrollY - 1 + "px";
    el.style.width = r.width + "px";
    el.style.height = r.height + "px";
  }

  // A readable name, e.g. "main › section.hero › h1".
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

  // A path that finds the same element again later, even after the page changes a little.
  function pathTo(el) {
    if (el.id) return "#" + CSS.escape(el.id);
    var parts = [];
    while (el && el !== document.body) {
      var tag = el.tagName.toLowerCase();
      var siblings = Array.prototype.filter.call(el.parentElement ? el.parentElement.children : [], function (s) {
        return s.tagName === el.tagName;
      });
      parts.unshift(siblings.length > 1 ? tag + ":nth-of-type(" + (siblings.indexOf(el) + 1) + ")" : tag);
      el = el.parentElement;
    }
    return "body > " + parts.join(" > ");
  }

  function find(path) {
    try {
      return document.querySelector(path);
    } catch {
      return null;
    }
  }

  function send(msg) {
    window.parent.postMessage(msg, "*");
  }

  var lastCursor = 0;
  document.addEventListener("mousemove", function (e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || ours(el) || el === document.documentElement || el === document.body) {
      outline.style.display = "none";
      send({ type: "rehearsal:hover", element: null });
    } else {
      place(outline, el);
      send({ type: "rehearsal:hover", element: describe(el) });
    }
    var now = Date.now();
    if (now - lastCursor > 40) {
      lastCursor = now;
      send({ type: "rehearsal:cursor", x: e.pageX, y: e.pageY });
    }
  });

  document.addEventListener("mouseleave", function () {
    outline.style.display = "none";
    send({ type: "rehearsal:hover", element: null });
    send({ type: "rehearsal:cursor", x: null, y: null });
  });

  // In comment mode a click picks an element instead of doing what the page would do.
  document.addEventListener(
    "click",
    function (e) {
      if (mode !== "comment") return;
      e.preventDefault();
      e.stopPropagation();
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || ours(el) || el === document.documentElement || el === document.body) return;
      place(selected, el);
      var r = el.getBoundingClientRect();
      send({
        type: "rehearsal:select",
        element: pathTo(el),
        label: describe(el),
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
      });
    },
    true,
  );

  var peers = [];
  var pins = [];

  function drawPeers() {
    peerLayer.innerHTML = "";
    peers.forEach(function (p) {
      if (p.x == null || p.y == null) return;
      var c = document.createElement("div");
      c.style.cssText = "position:absolute;left:" + p.x + "px;top:" + p.y + "px;transition:left 80ms linear,top 80ms linear";
      c.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 18 18" style="display:block;filter:drop-shadow(0 1px 1px rgba(0,0,0,.25))"><path d="M2 2 L16 8 L9 10 L7 17 Z" fill="' +
        p.colour +
        '" stroke="#fff" stroke-width="1.2"/></svg>' +
        '<span style="position:absolute;left:14px;top:14px;background:' +
        p.colour +
        ';color:#fff;font:12px/1 system-ui,sans-serif;padding:3px 6px;border-radius:4px;white-space:nowrap">' +
        escapeHtml(p.name) +
        "</span>";
      peerLayer.appendChild(c);
    });
  }

  function drawPins() {
    pinLayer.innerHTML = "";
    pins.forEach(function (pin) {
      var el = find(pin.element);
      if (!el) return;
      var r = el.getBoundingClientRect();
      var d = document.createElement("div");
      d.style.cssText =
        "position:absolute;left:" + (r.right + window.scrollX - 10) + "px;top:" + (r.top + window.scrollY - 10) + "px;width:22px;height:22px;border-radius:11px 11px 11px 2px;background:" +
        (pin.resolved ? "#a8a8a4" : pin.colour) +
        ";color:#fff;font:600 11px/22px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #fff;pointer-events:auto;cursor:pointer" +
        (pin.active ? ";transform:scale(1.25)" : "");
      d.textContent = String(pin.n);
      d.title = pin.author;
      d.addEventListener("click", function (e) {
        e.stopPropagation();
        send({ type: "rehearsal:pin", id: pin.id });
      });
      pinLayer.appendChild(d);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  window.addEventListener("message", function (e) {
    var m = e.data || {};
    if (m.type === "rehearsal:mode") {
      mode = m.mode;
      document.documentElement.style.cursor = mode === "comment" ? "crosshair" : "";
      if (mode !== "comment") selected.style.display = "none";
    } else if (m.type === "rehearsal:peers") {
      peers = m.peers || [];
      drawPeers();
    } else if (m.type === "rehearsal:pins") {
      pins = m.pins || [];
      drawPins();
    } else if (m.type === "rehearsal:focus") {
      var el = find(m.element);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        place(selected, el);
        setTimeout(function () {
          if (mode !== "comment") selected.style.display = "none";
        }, 1600);
      }
    } else if (m.type === "rehearsal:clear") {
      selected.style.display = "none";
    }
  });

  window.addEventListener("scroll", drawPins, { passive: true });
  window.addEventListener("resize", drawPins);
  // Announce twice: once now, once when the page has fully loaded, so the app
  // can send state whichever moment it is listening.
  send({ type: "rehearsal:ready" });
  window.addEventListener("load", function () {
    send({ type: "rehearsal:ready" });
    drawPins();
  });
})();
