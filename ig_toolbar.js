/**
 * C2V Lọc Link — thanh điều khiển lưới Reels trên Instagram.
 */
(function () {
  "use strict";

  var host = (location.hostname || "").replace(/^(www|m|web)\./i, "").toLowerCase();
  if (host !== "instagram.com" && host !== "instagr.am") return;

  var PANEL_ID = "c2v-reel-panel";
  var CSS_ID = "c2v-reel-panel-css";
  var STORE_KEY = "c2v_reel_panel";
  var settings = { metric: "views", order: "desc", pace: 12 };
  var resortDelay = null;
  var routeKey = "";
  var feedRaf = null;
  var feedResortTimer = null;
  var feedOn = false;
  var feedAcc = 0;
  var feedLastTs = 0;

  // Icon riêng C2V (không dùng bộ icon đồng hồ/chuột/mũi tên cổ điển)
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
    if (raw == null || raw === "") return 0;
    if (typeof raw === "number" && isFinite(raw)) return Math.max(0, Math.floor(raw));
    var s = String(raw).trim().replace(/,/g, "").replace(/\s+/g, "");
    if (!s) return 0;
    var m = s.match(/^([\d.]+)\s*([KkMmBbWw万亿])?/i);
    if (!m) {
      var digits = s.replace(/[^\d]/g, "");
      return digits ? parseInt(digits, 10) || 0 : 0;
    }
    var n = parseFloat(m[1]);
    if (!isFinite(n)) return 0;
    var u = (m[2] || "").toUpperCase();
    if (u === "K" || u === "W" || u === "万") n *= 1e3;
    else if (u === "M" || u === "亿") n *= 1e6;
    else if (u === "B") n *= 1e9;
    return Math.max(0, Math.floor(n));
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

  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var el = document.createElement("style");
    el.id = CSS_ID;
    el.textContent = [
      "#" + PANEL_ID + "{",
      "  position:sticky; top:0; z-index:2147483000;",
      "  display:flex; align-items:center; flex-wrap:wrap; gap:8px;",
      "  padding:10px 12px; margin:8px 0 12px;",
      "  border-radius:14px;",
      "  background:#0b1c2a;",
      "  border:1px solid #1e4a5c;",
      "  color:#e8f6f4;",
      "  font:600 13px/1.3 'Segoe UI',system-ui,sans-serif;",
      "  box-shadow:0 10px 28px rgba(8,30,40,.4);",
      "}",
      "#" + PANEL_ID + " .c2v-name{font-weight:800; letter-spacing:.04em; color:#3dd6c6;}",
      "#" + PANEL_ID + " .c2v-cap{color:#8fb6c4;}",
      "#" + PANEL_ID + " select{",
      "  border:1px solid #2a6070; background:#07141d; color:#e8f6f4;",
      "  border-radius:10px; padding:7px 10px; font:600 12px system-ui; cursor:pointer;",
      "}",
      "#" + PANEL_ID + " .c2v-actions{display:flex; gap:6px; margin-left:auto;}",
      "#" + PANEL_ID + " .c2v-chip{",
      "  position:relative; display:inline-flex; align-items:center; gap:6px;",
      "  height:34px; padding:0 10px; border-radius:10px;",
      "  border:1px solid #2a6070; background:#102938; color:#9fe8dc;",
      "  font:700 11px/1 system-ui; cursor:pointer;",
      "}",
      "#" + PANEL_ID + " .c2v-chip:hover{border-color:#3dd6c6; color:#fff;}",
      "#" + PANEL_ID + " .c2v-chip.on{background:#164a48; border-color:#3dd6c6; color:#3dd6c6;}",
      "#" + PANEL_ID + " .c2v-chip span.lbl{white-space:nowrap;}",
      "#" + PANEL_ID + " .c2v-pace-box{",
      "  display:none; position:fixed; z-index:2147483646;",
      "  width:180px; padding:10px; border-radius:12px;",
      "  background:#07141d; border:1px solid #2a6070;",
      "  box-shadow:0 12px 28px rgba(0,0,0,.55);",
      "}",
      "#" + PANEL_ID + " .c2v-chip.open .c2v-pace-box{display:block;}",
      "#" + PANEL_ID + " .c2v-pace-box label{display:block; font-size:11px; color:#8fb6c4; margin-bottom:6px;}",
      "#" + PANEL_ID + " .c2v-pace-box input[type=range]{width:100%; accent-color:#3dd6c6;}",
      "#" + PANEL_ID + " .c2v-pace-box .val{margin-top:4px; font-size:11px; color:#3dd6c6; text-align:right;}",
      "@media (max-width:760px){#" + PANEL_ID + " .c2v-actions{margin-left:0;} #" + PANEL_ID + " .c2v-chip span.lbl{display:none;}}",
    ].join("\n");
    (document.head || document.documentElement).appendChild(el);
  }

  function haltFeed() {
    feedOn = false;
    if (feedRaf) {
      try { cancelAnimationFrame(feedRaf); } catch (e) {}
      feedRaf = null;
    }
    if (feedResortTimer) {
      clearInterval(feedResortTimer);
      feedResortTimer = null;
    }
    feedAcc = 0;
    feedLastTs = 0;
    var btn = document.getElementById("c2v-feed-btn");
    if (!btn) return;
    btn.classList.remove("on");
    btn.innerHTML = SVG_FEED + '<span class="lbl">Chạy lưới</span>';
    btn.title = "Tự động cuộn xuống";
  }

  function runFeed() {
    haltFeed();
    feedOn = true;
    var btn = document.getElementById("c2v-feed-btn");
    if (btn) {
      btn.classList.add("on");
      btn.innerHTML = SVG_FEED_STOP + '<span class="lbl">Dừng</span>';
      btn.title = "Dừng cuộn";
    }
    var stuck = 0;
    feedAcc = 0;
    feedLastTs = 0;

    function tick(ts) {
      if (!feedOn) return;
      if (!feedLastTs) feedLastTs = ts;
      var dt = Math.min(40, Math.max(0, ts - feedLastTs));
      feedLastTs = ts;
      var pace = Math.max(3, parseInt(settings.pace, 10) || 12);
      var pxPerSec = pace * 30;
      feedAcc += (pxPerSec * dt) / 1000;
      var step = feedAcc | 0;
      if (step > 0) {
        feedAcc -= step;
        var root = document.scrollingElement || document.documentElement;
        var before = window.scrollY || root.scrollTop || 0;
        try {
          root.scrollTop = before + step;
        } catch (e) {
          window.scrollBy(0, step);
        }
        var after = window.scrollY || root.scrollTop || 0;
        var bottom = after + window.innerHeight >= (root.scrollHeight || 0) - 8;
        if (bottom || after <= before) {
          stuck++;
          if (stuck >= 90) {
            haltFeed();
            return;
          }
        } else {
          stuck = 0;
        }
      }
      feedRaf = requestAnimationFrame(tick);
    }

    feedRaf = requestAnimationFrame(tick);
    feedResortTimer = setInterval(function () {
      if (feedOn) queueResort();
    }, 1600);
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
    var paceBtn = panel.querySelector("#c2v-pace-btn");
    var feedBtn = panel.querySelector("#c2v-feed-btn");
    var homeBtn = panel.querySelector("#c2v-home-btn");
    var slider = panel.querySelector("#c2v-pace-range");
    var val = panel.querySelector("#c2v-pace-val");

    if (slider) {
      slider.value = String(settings.pace || 12);
      if (val) val.textContent = slider.value + " px";
      slider.addEventListener("input", function () {
        settings.pace = parseInt(slider.value, 10) || 12;
        if (val) val.textContent = settings.pace + " px";
        persist();
      });
    }
    function placePaceBox() {
      var box = paceBtn && paceBtn.querySelector(".c2v-pace-box");
      if (!paceBtn || !box || !paceBtn.classList.contains("open")) return;
      var r = paceBtn.getBoundingClientRect();
      var boxH = 88;
      var openUp = r.bottom + boxH + 12 > window.innerHeight;
      box.style.left = Math.max(8, Math.min(r.right - 180, window.innerWidth - 188)) + "px";
      if (openUp) {
        box.style.top = Math.max(8, r.top - boxH - 8) + "px";
      } else {
        box.style.top = (r.bottom + 8) + "px";
      }
    }

    if (paceBtn) {
      paceBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        paceBtn.classList.toggle("open");
        placePaceBox();
      });
    }
    window.addEventListener("scroll", placePaceBox, true);
    window.addEventListener("resize", placePaceBox);
    document.addEventListener("click", function () {
      if (paceBtn) paceBtn.classList.remove("open");
    });
    if (feedBtn) feedBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      toggleFeed();
    });
    if (homeBtn) homeBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      jumpTop();
    });
  }

  function insertPoint() {
    var tabs = document.querySelector('div[role="tablist"]');
    if (tabs) {
      var wrap = tabs.closest("header") || tabs.parentElement;
      var next = wrap && wrap.nextElementSibling;
      if (next) return next;
      return wrap || tabs;
    }
    var link = document.querySelector('a[href*="/reel/"]');
    if (link) {
      var cell = link.closest("div") || link;
      return findGrid(cell) || cell;
    }
    return null;
  }

  function isProfileGridPage() {
    var path = location.pathname || "/";
    var match = path.match(/^\/([A-Za-z0-9._]+)(?:\/reels)?\/?$/i);
    if (!match) return false;
    return !/^(accounts|about|api|direct|explore|reels|reel|p|tv|stories|developer|developers|legal|privacy|terms|challenge|web|emails|settings|your_activity)$/i.test(match[1]);
  }

  function ensurePanel() {
    if (!isProfileGridPage()) return null;
    injectCss();
    var panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML =
      '<span class="c2v-name">C2V</span>' +
      '<span class="c2v-cap">Xếp lưới:</span>' +
      '<select id="c2v-metric">' +
      '<option value="off">Tắt</option>' +
      '<option value="views">Lượt xem</option>' +
      "</select>" +
      '<select id="c2v-order">' +
      '<option value="asc">Tăng dần</option>' +
      '<option value="desc">Giảm dần</option>' +
      "</select>" +
      '<div class="c2v-actions">' +
      '<button type="button" class="c2v-chip" id="c2v-pace-btn" title="Chỉnh tốc độ cuộn">' +
      SVG_PACE + '<span class="lbl">Nhịp</span>' +
      '<div class="c2v-pace-box">' +
      "<label>Nhịp cuộn (px mỗi nhịp)</label>" +
      '<input id="c2v-pace-range" type="range" min="3" max="48" step="1">' +
      '<div class="val" id="c2v-pace-val">12 px</div>' +
      "</div></button>" +
      '<button type="button" class="c2v-chip" id="c2v-feed-btn" title="Tự động cuộn xuống">' +
      SVG_FEED + '<span class="lbl">Chạy lưới</span></button>' +
      '<button type="button" class="c2v-chip" id="c2v-home-btn" title="Lên đầu trang">' +
      SVG_HOME + '<span class="lbl">Đầu trang</span></button>' +
      "</div>";

    var spot = insertPoint();
    if (spot && spot.parentNode) spot.parentNode.insertBefore(panel, spot);
    else {
      var main = document.querySelector("main") || document.body;
      main.insertBefore(panel, main.firstChild);
    }

    var metric = panel.querySelector("#c2v-metric");
    var order = panel.querySelector("#c2v-order");
    metric.value = settings.metric || "views";
    order.value = settings.order || "desc";
    metric.addEventListener("change", onSettingChange);
    order.addEventListener("change", onSettingChange);
    bindActions(panel);
    return panel;
  }

  function onSettingChange() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    settings.metric = panel.querySelector("#c2v-metric").value;
    settings.order = panel.querySelector("#c2v-order").value;
    persist();
    queueResort();
  }

  function findGrid(fromEl) {
    var el = fromEl;
    for (var d = 0; d < 10 && el; d++) {
      var parent = el.parentElement;
      if (!parent) break;
      var count = 0;
      for (var i = 0; i < parent.children.length; i++) {
        var kid = parent.children[i];
        if (kid.querySelector && kid.querySelector('a[href*="/reel/"]')) count++;
      }
      if (count >= 3) return parent;
      el = parent;
    }
    return null;
  }

  function scoreCell(cell, metric) {
    var text = (cell.getAttribute("aria-label") || "") + " " + (cell.innerText || cell.textContent || "");
    text = text.replace(/\s+/g, " ").trim();
    if (metric === "likes") {
      var lm = text.match(/([\d.,]+\s*[KkMmBbWw万亿]?)\s*(likes?|lượt thích|thích)/i);
      if (lm) return toNumber(lm[1]);
    }
    if (metric === "comments") {
      var cm = text.match(/([\d.,]+\s*[KkMmBbWw万亿]?)\s*(comments?|bình luận|comment)/i);
      if (cm) return toNumber(cm[1]);
    }
    var vm = text.match(/([\d.,]+\s*[KkMmBbWw万亿]?)\s*(views?|lượt xem|plays?)/i);
    if (vm) return toNumber(vm[1]);
    var best = 0;
    var re = /([\d.,]+\s*[KkMmBbWw万亿]?)/gi;
    var m;
    while ((m = re.exec(text))) {
      var n = toNumber(m[1]);
      if (n >= 10 && n > best) best = n;
    }
    return best;
  }

  function collectTiles() {
    var links = Array.prototype.slice.call(document.querySelectorAll('a[href*="/reel/"]'));
    links = links.filter(function (a) {
      var href = a.getAttribute("href") || "";
      return /\/reel\/[A-Za-z0-9_-]+/i.test(href) && !/\/reels\/?$/i.test(href);
    });
    if (!links.length) return { grid: null, tiles: [] };
    var sample = links[Math.min(3, links.length - 1)];
    var grid = findGrid(sample);
    if (!grid) return { grid: null, tiles: [] };
    var tiles = [];
    for (var i = 0; i < grid.children.length; i++) {
      var child = grid.children[i];
      if (child.querySelector && child.querySelector('a[href*="/reel/"]')) tiles.push(child);
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
    var panel = ensurePanel();
    if (!panel) return;
    if (!document.body.contains(panel)) {
      try { panel.remove(); } catch (e) {}
      panel = ensurePanel();
    }
    if ((settings.metric || "off") === "off") return;

    var pack = collectTiles();
    var grid = pack.grid;
    var tiles = pack.tiles;
    if (!grid || tiles.length < 2) return;

    var metric = settings.metric;
    var desc = (settings.order || "desc") === "desc";
    var ranked = tiles.map(function (tile, idx) {
      return { tile: tile, idx: idx, score: scoreCell(tile, metric) };
    });
    ranked.sort(function (a, b) {
      if (a.score === b.score) return a.idx - b.idx;
      return desc ? b.score - a.score : a.score - b.score;
    });

    var changed = false;
    for (var i = 0; i < ranked.length; i++) {
      if (ranked[i].tile !== tiles[i]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    var frag = document.createDocumentFragment();
    ranked.forEach(function (x) { frag.appendChild(x.tile); });
    var extra = [];
    for (var j = 0; j < grid.children.length; j++) {
      var ch = grid.children[j];
      if (tiles.indexOf(ch) < 0) extra.push(ch);
    }
    grid.appendChild(frag);
    extra.forEach(function (n) { grid.appendChild(n); });
  }

  function queueResort() {
    if (resortDelay) clearTimeout(resortDelay);
    if (!isProfileGridPage()) {
      resortDelay = null;
      return;
    }
    resortDelay = setTimeout(resortGrid, feedOn ? 900 : 250);
  }

  function heartbeat() {
    var path = location.pathname || "";
    if (path !== routeKey) {
      routeKey = path;
      haltFeed();
      var old = document.getElementById(PANEL_ID);
      if (old) try { old.remove(); } catch (e) {}
    }
    if (!isProfileGridPage()) {
      if (resortDelay) clearTimeout(resortDelay);
      resortDelay = null;
      if (feedOn) haltFeed();
      var orphan = document.getElementById(PANEL_ID);
      if (orphan) orphan.remove();
      return;
    }
    if (document.querySelector('a[href*="/reel/"]')) {
      ensurePanel();
      queueResort();
    }
  }

  function start() {
    try {
      if (!extAlive()) {
        heartbeat();
        return;
      }
      chrome.storage.local.get([STORE_KEY, "c2v_ig_sort"], function (data) {
        try {
          if (chrome.runtime.lastError) {
            heartbeat();
            return;
          }
          var saved = (data && (data[STORE_KEY] || data.c2v_ig_sort)) || null;
          if (saved) {
            settings.metric = saved.metric === "off" || (!saved.metric && saved.ob === "0") ? "off" : "views";
            settings.order = saved.order || ({ "1": "asc", "2": "desc" }[saved.o]) || "desc";
            settings.pace = parseInt(saved.pace || saved.speed, 10) || 12;
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
