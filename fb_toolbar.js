/**
 * C2V Lọc Link — thanh điều khiển lưới Reels trên Facebook.
 */
(function () {
  "use strict";

  var host = (location.hostname || "").replace(/^(www|m|web)\./i, "").toLowerCase();
  if (host !== "facebook.com" && host !== "fb.com" && host !== "fb.watch") return;

  var PANEL_ID = "c2v-fb-reel-panel";
  var CSS_ID = "c2v-fb-reel-panel-css";
  var STORE_KEY = "c2v_fb_reel_panel";
  var settings = { metric: "views", order: "desc", pace: 14 };
  var resortDelay = null;
  var originalOrders = new WeakMap();
  var feedRaf = null;
  var feedOn = false;
  var feedAcc = 0;
  var feedLastTs = 0;

  var SVG_PACE =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path fill="currentColor" d="M4 14h3l2-5 3 8 2-4h6v2H15l-2 4-3-8-2 5H4z"/>' +
    "</svg>";
  var SVG_FEED =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path fill="currentColor" d="M8 5v14l11-7z"/>' +
    "</svg>";
  var SVG_FEED_STOP =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path fill="currentColor" d="M7 6h4v12H7zm6 0h4v12h-4z"/>' +
    "</svg>";
  var SVG_HOME =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 4l8 7h-3v8h-4v-5H11v5H7v-8H4z"/>' +
    "</svg>";

  function toNumber(raw) {
    return C2VCounts.parse(raw);
  }

  function extAlive() {
    try {
      return !!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function persist() {
    if (!extAlive()) return;
    try {
      chrome.storage.local.set({ [STORE_KEY]: settings }, function () {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (e) {}
  }

  var PACE_FLOAT_ID = "c2v-fb-pace-float";

  var DD_MENU_ID = "c2v-fb-dd-menu";
  var METRIC_OPTS = [
    { v: "off", t: "Tắt" },
    { v: "views", t: "Lượt xem" },
  ];
  var ORDER_OPTS = [
    { v: "asc", t: "Tăng dần" },
    { v: "desc", t: "Giảm dần" },
  ];

  function injectCss() {
    var el = document.getElementById(CSS_ID);
    // Rewriting a style node also triggers our childList observer.
    if (el) return;
    if (!el) {
      el = document.createElement("style");
      el.id = CSS_ID;
      (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = [
      "#" + PANEL_ID + "{",
      "  position:fixed !important; top:56px; left:12px; right:12px;",
      "  width:min(960px, calc(100vw - 24px)); margin:0 auto;",
      "  z-index:2147483645 !important;",
      "  display:flex; align-items:center; flex-wrap:wrap; gap:8px;",
      "  padding:10px 12px;",
      "  border-radius:14px;",
      "  background:#0d1524;",
      "  border:1px solid #1e3a66;",
      "  color:#e8f0ff;",
      "  font:600 13px/1.3 'Segoe UI',system-ui,sans-serif;",
      "  box-shadow:0 12px 32px rgba(0,0,0,.55);",
      "}",
      "#" + PANEL_ID + " .c2v-name{flex:none; white-space:nowrap; font-weight:800; letter-spacing:.04em; color:#5b9dff;}",
      "#" + PANEL_ID + " .c2v-cap{flex:none; white-space:nowrap; color:#8fa6c8;}",
      "#" + PANEL_ID + " .c2v-dd{",
      "  box-sizing:border-box; flex:none; position:relative; height:34px;",
      "  border:1px solid #2a4a7a; background:#0a1220; color:#e8f0ff;",
      "  border-radius:10px; padding:0 24px 0 10px; text-align:left; white-space:nowrap; font:600 12px system-ui; cursor:pointer;",
      "}",
      "#c2v-fb-metric-btn{width:104px;}",
      "#c2v-fb-order-btn{width:96px;}",
      "#" + PANEL_ID + " .c2v-dd::after{content:'▾'; position:absolute; right:10px; top:50%; transform:translateY(-50%);}",
      "#" + PANEL_ID + " .c2v-dd:hover{border-color:#5b9dff;}",
      "#" + PANEL_ID + " .c2v-actions{display:grid; grid-template-columns:70px 94px 96px; flex:none; gap:6px; margin-left:auto;}",
      "#" + PANEL_ID + " .c2v-chip{",
      "  box-sizing:border-box; width:100%; display:inline-flex; align-items:center; justify-content:center; gap:6px;",
      "  height:34px; padding:0 10px; border-radius:10px;",
      "  border:1px solid #2a4a7a; background:#13233f; color:#9ec2ff;",
      "  font:700 11px/1 system-ui; cursor:pointer;",
      "}",
      "#" + PANEL_ID + " .c2v-chip:hover{border-color:#5b9dff; color:#fff;}",
      "#" + PANEL_ID + " .c2v-chip.on{background:#16325c; border-color:#5b9dff; color:#5b9dff;}",
      "#" + PANEL_ID + " .c2v-chip span.lbl{white-space:nowrap;}",
      "#" + PACE_FLOAT_ID + ",#" + DD_MENU_ID + "{",
      "  position:fixed; z-index:2147483647;",
      "  background:#0a1220; border:1px solid #2a4a7a;",
      "  box-shadow:0 14px 32px rgba(0,0,0,.6);",
      "  color:#e8f0ff; font:600 12px system-ui;",
      "}",
      "#" + PACE_FLOAT_ID + "{",
      "  display:none; width:190px; padding:12px; border-radius:12px;",
      "}",
      "#" + PACE_FLOAT_ID + ".show{display:block;}",
      "#" + PACE_FLOAT_ID + " label{display:block; font-size:11px; color:#8fa6c8; margin-bottom:6px;}",
      "#" + PACE_FLOAT_ID + " input[type=range]{width:100%; accent-color:#5b9dff;}",
      "#" + PACE_FLOAT_ID + " .val{margin-top:6px; font-size:11px; color:#5b9dff; text-align:right;}",
      "#" + DD_MENU_ID + "{",
      "  min-width:140px; padding:6px; border-radius:12px;",
      "  display:flex; flex-direction:column; gap:4px;",
      "}",
      "#" + DD_MENU_ID + " .c2v-dd-item{",
      "  display:block; width:100%; text-align:left;",
      "  border:0; background:transparent; color:#e8f0ff;",
      "  border-radius:8px; padding:8px 10px; font:600 12px system-ui; cursor:pointer;",
      "}",
      "#" + DD_MENU_ID + " .c2v-dd-item:hover{background:#13233f;}",
      "#" + DD_MENU_ID + " .c2v-dd-item.on{background:#16325c; color:#5b9dff;}",
      "@media (max-width:760px){#" + PANEL_ID + " .c2v-chip span.lbl{display:none;} #" + PANEL_ID + " .c2v-actions{grid-template-columns:repeat(3,38px);} #" + PANEL_ID + "{top:48px;}}",
    ].join("\n");
  }

  function optLabel(opts, value) {
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].v === value) return opts[i].t;
    }
    return opts[0] ? opts[0].t : value;
  }

  function hideDdMenu() {
    var m = document.getElementById(DD_MENU_ID);
    if (m) try { m.remove(); } catch (e) {}
  }

  function openDdMenu(anchor, opts, current, onPick) {
    hideDdMenu();
    hidePaceFloat();
    var menu = document.createElement("div");
    menu.id = DD_MENU_ID;
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "c2v-dd-item" + (o.v === current ? " on" : "");
      b.textContent = o.t;
      b.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      });
      b.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        hideDdMenu();
        onPick(o.v);
      });
      menu.appendChild(b);
    });
    menu.addEventListener("mousedown", function (ev) { ev.stopPropagation(); });
    menu.addEventListener("click", function (ev) { ev.stopPropagation(); });
    document.documentElement.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    var w = Math.max(140, r.width);
    menu.style.minWidth = w + "px";
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + "px";
    var top = r.bottom + 6;
    var menuHeight = menu.getBoundingClientRect().height;
    if (top + menuHeight > window.innerHeight) top = Math.max(8, r.top - menuHeight - 6);
    menu.style.top = top + "px";
  }

  function syncDdLabels(panel) {
    if (!panel) return;
    var mb = panel.querySelector("#c2v-fb-metric-btn");
    var ob = panel.querySelector("#c2v-fb-order-btn");
    if (mb) mb.textContent = optLabel(METRIC_OPTS, settings.metric || "views");
    if (ob) ob.textContent = optLabel(ORDER_OPTS, settings.order || "desc");
  }

  function applySetting(key, value) {
    if (feedOn) haltFeed();
    settings[key] = value;
    persist();
    syncDdLabels(document.getElementById(PANEL_ID));
    if (resortDelay) {
      clearTimeout(resortDelay);
      resortDelay = null;
    }
    resortGrid();
  }

  function ensurePaceFloat() {
    var box = document.getElementById(PACE_FLOAT_ID);
    if (box) return box;
    box = document.createElement("div");
    box.id = PACE_FLOAT_ID;
    box.innerHTML =
      "<label>Nhịp cuộn (px mỗi nhịp)</label>" +
      '<input id="c2v-fb-pace-range" type="range" min="3" max="48" step="1">' +
      '<div class="val" id="c2v-fb-pace-val">14 px</div>';
    document.documentElement.appendChild(box);
    box.addEventListener("click", function (ev) { ev.stopPropagation(); });
    return box;
  }

  function hidePaceFloat() {
    var box = document.getElementById(PACE_FLOAT_ID);
    if (box) box.classList.remove("show");
  }

  function showPaceFloat(anchor) {
    var box = ensurePaceFloat();
    var range = box.querySelector("#c2v-fb-pace-range");
    var val = box.querySelector("#c2v-fb-pace-val");
    if (range) {
      range.value = String(settings.pace || 14);
      if (val) val.textContent = range.value + " px";
    }
    var r = anchor.getBoundingClientRect();
    var openUp = r.bottom + 110 > window.innerHeight;
    box.style.left = Math.max(8, Math.min(r.right - 190, window.innerWidth - 198)) + "px";
    box.style.top = openUp
      ? Math.max(8, r.top - 110) + "px"
      : (r.bottom + 8) + "px";
    box.classList.add("show");
  }

  function isReelHref(href) {
    if (!href) return false;
    var h = String(href);
    if (h.indexOf("javascript:") === 0) return false;
    return /\/reel\//i.test(h) || /\/reels\//i.test(h) || /\/share\/(r|v)\//i.test(h);
  }

  /** Chỉ trang lưới Reels (tab profile /reels) — không hiện trên feed thường */
  function isReelsPage() {
    var href = location.href || "";
    var path = (location.pathname || "").replace(/\/+$/, "") || "/";
    if (/[?&]sk=reels_tab(?:&|#|$)/i.test(href)) return true;
    if (/\/reels$/i.test(path)) return true;
    if (/\/[^/]+\/reels$/i.test(path)) return true;
    return false;
  }

  function reelLinks() {
    return Array.prototype.slice.call(document.querySelectorAll("a[href]")).filter(function (a) {
      return isReelHref(a.getAttribute("href") || a.href || "");
    });
  }

  function haltFeed() {
    var wasRunning = feedOn;
    feedOn = false;
    if (feedRaf) {
      try { cancelAnimationFrame(feedRaf); } catch (e) {}
      feedRaf = null;
    }
    feedAcc = 0;
    feedLastTs = 0;
    hidePaceFloat();
    if (wasRunning && isReelsPage()) queueResort();
    var btn = document.getElementById("c2v-fb-feed-btn");
    if (!btn) return;
    btn.classList.remove("on");
    btn.innerHTML = SVG_FEED + '<span class="lbl">Chạy lưới</span>';
    btn.title = "Tự động cuộn xuống";
  }

  function runFeed() {
    haltFeed();
    if (resortDelay) {
      clearTimeout(resortDelay);
      resortDelay = null;
    }
    feedOn = true;
    var btn = document.getElementById("c2v-fb-feed-btn");
    if (btn) {
      btn.classList.add("on");
      btn.innerHTML = SVG_FEED_STOP + '<span class="lbl">Dừng</span>';
      btn.title = "Dừng cuộn";
    }
    var stuckSince = null;
    feedAcc = 0;
    feedLastTs = 0;

    function tick(ts) {
      if (!feedOn) return;
      if (!feedLastTs) feedLastTs = ts;
      var dt = Math.min(40, Math.max(0, ts - feedLastTs));
      feedLastTs = ts;

      // pace 3–48 ≈ tốc độ cũ; quy ra px/giây rồi cộng dồn theo frame → mượt hơn jump setInterval
      var pace = Math.max(3, parseInt(settings.pace, 10) || 14);
      var pxPerSec = pace * 30;
      feedAcc += (pxPerSec * dt) / 1000;
      var step = feedAcc | 0;
      if (step > 0) {
        feedAcc -= step;
        var root = document.scrollingElement || document.documentElement;
        var before = window.scrollY || root.scrollTop || 0;
        try {
          // Override any page-level smooth scrolling: RAF already animates us.
          root.scrollTo({ top: before + step, behavior: "instant" });
        } catch (e) {
          window.scrollBy(0, step);
        }
        var after = window.scrollY || root.scrollTop || 0;
        var bottom = after + window.innerHeight >= (root.scrollHeight || 0) - 8;
        if (bottom || after <= before) {
          if (stuckSince === null) stuckSince = ts;
          if (ts - stuckSince >= 3000) {
            haltFeed();
            return;
          }
        } else {
          stuckSince = null;
        }
      }
      feedRaf = requestAnimationFrame(tick);
    }

    feedRaf = requestAnimationFrame(tick);
    // Reorder only after scrolling stops, so loaded tiles do not jump around.
  }

  function toggleFeed() {
    if (feedOn) haltFeed();
    else runFeed();
  }

  function jumpTop() {
    haltFeed();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindActions(panel) {
    if (panel.getAttribute("data-c2v-bound") === "1") return;
    panel.setAttribute("data-c2v-bound", "1");

    var paceBtn = panel.querySelector("#c2v-fb-pace-btn");
    var feedBtn = panel.querySelector("#c2v-fb-feed-btn");
    var homeBtn = panel.querySelector("#c2v-fb-home-btn");
    var floatBox = ensurePaceFloat();
    var slider = floatBox.querySelector("#c2v-fb-pace-range");
    var val = floatBox.querySelector("#c2v-fb-pace-val");

    if (slider && !slider.getAttribute("data-c2v-bound")) {
      slider.setAttribute("data-c2v-bound", "1");
      slider.value = String(settings.pace || 14);
      if (val) val.textContent = slider.value + " px";
      slider.addEventListener("input", function () {
        settings.pace = parseInt(slider.value, 10) || 14;
        if (val) val.textContent = settings.pace + " px";
        persist();
      });
    }

    if (paceBtn) {
      paceBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var box = document.getElementById(PACE_FLOAT_ID);
        if (box && box.classList.contains("show")) hidePaceFloat();
        else showPaceFloat(paceBtn);
      });
    }
    if (!document.documentElement.getAttribute("data-c2v-fb-pace-doc")) {
      document.documentElement.setAttribute("data-c2v-fb-pace-doc", "1");
      document.addEventListener("click", function (ev) {
        var t = ev.target;
        if (t && t.closest && (
          t.closest("#" + PANEL_ID) ||
          t.closest("#" + PACE_FLOAT_ID) ||
          t.closest("#" + DD_MENU_ID)
        )) return;
        hidePaceFloat();
        hideDdMenu();
        var panel = document.getElementById(PANEL_ID);
        if (panel) {
          var mb = panel.querySelector("#c2v-fb-metric-btn");
          var ob = panel.querySelector("#c2v-fb-order-btn");
          if (mb) mb.removeAttribute("data-open");
          if (ob) ob.removeAttribute("data-open");
        }
      });
    }
    if (feedBtn) {
      feedBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        hidePaceFloat();
        toggleFeed();
      });
    }
    if (homeBtn) {
      homeBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        hidePaceFloat();
        jumpTop();
      });
    }
  }

  function findGrid(fromEl) {
    var el = fromEl;
    for (var d = 0; d < 12 && el; d++) {
      var parent = el.parentElement;
      if (!parent) break;
      var count = 0;
      for (var i = 0; i < parent.children.length; i++) {
        var kid = parent.children[i];
        if (!kid.querySelector) continue;
        var a = kid.querySelector("a[href]");
        if (a && isReelHref(a.getAttribute("href") || a.href || "")) count++;
      }
      if (count >= 3) return parent;
      el = parent;
    }
    return null;
  }

  function insertPoint() {
    // Chèn ngay trước lưới / tiêu đề Reels
    var links = reelLinks();
    if (links.length) {
      var grid = findGrid(links[0].closest("div") || links[0]);
      if (grid) return grid;
    }
    var nodes = document.querySelectorAll("span, h1, h2, a, div");
    for (var i = 0; i < nodes.length; i++) {
      var t = (nodes[i].textContent || "").trim();
      if (t !== "Reels" && t.indexOf("Thước phim") !== 0) continue;
      var block = nodes[i].closest("div") || nodes[i];
      if (block && block.parentNode) return block;
    }
    return document.querySelector('[role="main"]') || document.body;
  }

  function ensurePanel() {
    injectCss();
    var panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML =
      '<span class="c2v-name">C2V</span>' +
      '<span class="c2v-cap">Xếp lưới FB:</span>' +
      '<button type="button" class="c2v-dd" id="c2v-fb-metric-btn" title="Tiêu chí xếp"></button>' +
      '<button type="button" class="c2v-dd" id="c2v-fb-order-btn" title="Thứ tự xếp"></button>' +
      '<div class="c2v-actions">' +
      '<button type="button" class="c2v-chip" id="c2v-fb-pace-btn" title="Chỉnh tốc độ cuộn">' +
      SVG_PACE + '<span class="lbl">Nhịp</span></button>' +
      '<button type="button" class="c2v-chip" id="c2v-fb-feed-btn" title="Tự động cuộn xuống">' +
      SVG_FEED + '<span class="lbl">Chạy lưới</span></button>' +
      '<button type="button" class="c2v-chip" id="c2v-fb-home-btn" title="Lên đầu trang">' +
      SVG_HOME + '<span class="lbl">Đầu trang</span></button>' +
      "</div>";

    (document.documentElement || document.body).appendChild(panel);
    syncDdLabels(panel);

    var metricBtn = panel.querySelector("#c2v-fb-metric-btn");
    var orderBtn = panel.querySelector("#c2v-fb-order-btn");
    if (metricBtn) {
      metricBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (document.getElementById(DD_MENU_ID) && metricBtn.getAttribute("data-open") === "1") {
          hideDdMenu();
          metricBtn.removeAttribute("data-open");
          return;
        }
        if (orderBtn) orderBtn.removeAttribute("data-open");
        metricBtn.setAttribute("data-open", "1");
        openDdMenu(metricBtn, METRIC_OPTS, settings.metric || "views", function (v) {
          metricBtn.removeAttribute("data-open");
          applySetting("metric", v);
        });
      });
    }
    if (orderBtn) {
      orderBtn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (document.getElementById(DD_MENU_ID) && orderBtn.getAttribute("data-open") === "1") {
          hideDdMenu();
          orderBtn.removeAttribute("data-open");
          return;
        }
        if (metricBtn) metricBtn.removeAttribute("data-open");
        orderBtn.setAttribute("data-open", "1");
        openDdMenu(orderBtn, ORDER_OPTS, settings.order || "desc", function (v) {
          orderBtn.removeAttribute("data-open");
          applySetting("order", v);
        });
      });
    }
    bindActions(panel);
    return panel;
  }

  function scoreCell(cell) {
    var views = C2VCounts.fbViews(cell);
    if (views > 0) return views;
    var text = (cell.getAttribute("aria-label") || "") + " " + (cell.innerText || cell.textContent || "");
    text = text.replace(/\s+/g, " ").trim();
    var countPattern = "[0-9][0-9.,]*(?:\\s*(?:triệu|trieu|nghìn|nghin|ngàn|ngan|tỷ|tỉ|ty|ti|[kmbw万亿]))?";
    // Prefer explicitly labelled view counts over numbers in captions.
    var vm = text.match(new RegExp("(" + countPattern + ")\\s*(?:views?|lượt xem|người xem)(?=\\s|$|[.,])", "i"));
    if (vm) return toNumber(vm[1]);
    // Facebook thumbnails also show compact counts without a view label.
    var best = 0;
    var re = /([0-9][0-9.,]*\s*(?:triệu|trieu|nghìn|nghin|ngàn|ngan|tỷ|tỉ|ty|ti|[kmbw万亿]))(?=\s|$|[^\p{L}\p{N}])/giu;
    var m;
    while ((m = re.exec(text))) {
      var n = toNumber(m[1]);
      if (n > best) best = n;
    }
    if (best > 0) return best;
    vm = text.match(/[0-9][0-9.,]*/);
    if (vm) return toNumber(vm[0]);
    return 0;
  }

  function collectTiles() {
    var links = reelLinks();
    if (!links.length) return { grid: null, tiles: [] };
    var sample = links[Math.min(3, links.length - 1)];
    var grid = findGrid(sample);
    if (!grid) return { grid: null, tiles: [] };

    var tiles = [];
    for (var i = 0; i < grid.children.length; i++) {
      var child = grid.children[i];
      if (!child.querySelector) continue;
      var a = child.querySelector("a[href]");
      if (a && isReelHref(a.getAttribute("href") || a.href || "")) tiles.push(child);
    }
    if (tiles.length < 2) {
      tiles = links.map(function (a) { return a.closest("div") || a; });
      var seen = [];
      tiles = tiles.filter(function (c) {
        if (seen.indexOf(c) >= 0) return false;
        seen.push(c);
        return true;
      });
      grid = tiles[0] && tiles[0].parentElement;
    }
    return { grid: grid, tiles: tiles };
  }

  function resortGrid() {
    // A queued sort may fire after the user has opened a control.
    if (!isReelsPage() || feedOn || panelBusy()) return;
    var panel = ensurePanel();
    if (!panel) return;
    // The panel is mounted on documentElement, outside Facebook's body.
    // Keep the same controls alive instead of recreating them on every sort.
    var pack = collectTiles();
    var grid = pack.grid;
    var tiles = pack.tiles;
    if (!grid || !tiles.length) return;

    var desc = (settings.order || "desc") === "desc";
    var metric = settings.metric || "views";
    var page = (location.pathname || "") + (location.search || "");
    var original = originalOrders.get(grid);
    if (original && original.page !== page) original = null;
    if (!original) {
      // Off must leave an untouched Facebook grid entirely under its control.
      if (metric === "off") return;
      original = { page: page, positions: new Map(), next: 0 };
      originalOrders.set(grid, original);
    }
    function tileKey(tile) {
      var link = tile.querySelector("a[href]");
      var href = link && (link.getAttribute("href") || link.href || "");
      var reel = href && href.match(/\/(?:reel|reels)\/(\d+)/i);
      return reel ? "reel:" + reel[1] : href ? href.split(/[?#]/)[0] : tile;
    }
    // Record native order before the first sort. Newly loaded reels follow
    // those already captured, retaining their own Facebook loading order.
    tiles.forEach(function (tile) {
      var key = tileKey(tile);
      if (!original.positions.has(key)) original.positions.set(key, original.next++);
    });
    var ranked = tiles.map(function (tile, idx) {
      var score = metric === "off" ? 0 : metric === "views" ? scoreCell(tile) : C2VCounts.fbEngagement(tile)[metric] || 0;
      return { tile: tile, idx: idx, original: original.positions.get(tileKey(tile)), score: score };
    });
    ranked.sort(function (a, b) {
      if (metric === "off") return a.original - b.original || a.idx - b.idx;
      // Unavailable engagement counts stay after videos with known counts.
      if (metric !== "views" && (!a.score || !b.score)) {
        if (!a.score && b.score) return 1;
        if (a.score && !b.score) return -1;
      }
      if (a.score === b.score) return a.original - b.original || a.idx - b.idx;
      return desc ? b.score - a.score : a.score - b.score;
    });

    var changed = false;
    for (var i = 0; i < ranked.length; i++) {
      if (ranked[i].tile !== tiles[i]) {
        changed = true;
        break;
      }
    }
    if (changed) {
      // Keep headers/loading indicators and other non-video nodes in place.
      var slots = tiles.map(function (tile) {
        var slot = document.createComment("c2v-reel-slot");
        grid.replaceChild(slot, tile);
        return slot;
      });
      ranked.forEach(function (x, idx) { grid.replaceChild(x.tile, slots[idx]); });
    }
    // Once restored, Facebook may append/reorder freely while sorting is off.
    if (metric === "off") originalOrders.delete(grid);
  }

  function queueResort() {
    if (feedOn) return;
    if (resortDelay) clearTimeout(resortDelay);
    resortDelay = setTimeout(resortGrid, 320);
  }

  function panelBusy() {
    if (document.getElementById(DD_MENU_ID)) return true;
    var pace = document.getElementById(PACE_FLOAT_ID);
    if (pace && pace.classList.contains("show")) return true;
    var ae = document.activeElement;
    if (!ae) return false;
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return false;
    return panel.contains(ae) && (ae.tagName === "SELECT" || ae.tagName === "INPUT");
  }

  function stripPanel() {
    originalOrders = new WeakMap();
    haltFeed();
    hideDdMenu();
    var orphan = document.getElementById(PANEL_ID);
    if (orphan) try { orphan.remove(); } catch (e) {}
    var pace = document.getElementById(PACE_FLOAT_ID);
    if (pace) try { pace.remove(); } catch (e) {}
  }

  function heartbeat() {
    if (isReelsPage()) {
      if (panelBusy()) return;
      ensurePanel();
      if (!feedOn) queueResort();
    } else {
      stripPanel();
    }
  }

  function start() {
    try {
      if (!extAlive()) {
        heartbeat();
        return;
      }
      chrome.storage.local.get(STORE_KEY, function (data) {
        try {
          if (chrome.runtime.lastError) {
            heartbeat();
            return;
          }
          if (data && data[STORE_KEY]) {
            settings.metric = data[STORE_KEY].metric === "off" ? "off" : "views";
            settings.order = data[STORE_KEY].order || "desc";
            settings.pace = parseInt(data[STORE_KEY].pace, 10) || 14;
          }
        } catch (e) {}
        heartbeat();
      });
    } catch (e) {
      heartbeat();
    }

    var obs = new MutationObserver(function () { heartbeat(); });
    try {
      obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (e) {}
    window.addEventListener("scroll", function () {
      if (feedOn) return;
      queueResort();
    }, { passive: true });
    setInterval(heartbeat, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
