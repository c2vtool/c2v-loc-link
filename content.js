/**
 * C2V Lọc Link — gom link video Instagram / Facebook khi cuộn trang.
 * Instagram / Facebook: views, likes, comments khi hiển thị trên ô video.
 */
(function () {
  "use strict";

  var host = (location.hostname || "").replace(/^(www|m|web)\./i, "").toLowerCase();
  var isIg = host === "instagram.com" || host === "instagr.am";
  var isFb = host === "facebook.com" || host === "fb.com" || host === "fb.watch";
  if (!isIg && !isFb) return;

  var MSG = "loc_links";
  /** @type {Object.<string, {url:string, views:number, likes:number, comments:number}>} */
  var bag = Object.create(null);
  var currentPageKey = pageKey();
  var pageReadyAt = 0;

  function extAlive() {
    try {
      return !!(typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function isIgShortcode(code) {
    if (!code || code.length < 8 || code.length > 15) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return false;
    if (/^(en_us|en_gb|es_la|pt_br|zh_cn|zh_tw|zh_hk|fr_ca)$/i.test(code)) return false;
    return true;
  }

  function parseCount(raw) {
    return C2VCounts.parse(raw);
  }

  function isVideoUrl(u) {
    if (!u) return false;
    var s = String(u);
    var low = s.toLowerCase();
    if (low.indexOf("instagram.com") !== -1 || low.indexOf("instagr.am") !== -1) {
      if (/\/reels\/?(\?|$)/i.test(low) || /\/stories\//i.test(low)) return false;
      var m = s.match(/\/(reel|p|tv)\/([A-Za-z0-9_-]+)/i);
      return !!(m && isIgShortcode(m[2]));
    }
    if (low.indexOf("fb.watch/") !== -1) return true;
    if (low.indexOf("facebook.com") !== -1 || low.indexOf("fb.com") !== -1) {
      return /\/(reel|reels)\/\d+/i.test(low)
        || /\/watch\/?\?/i.test(low)
        || /\/videos\/\d+/i.test(low)
        || /\/share\/(v|r)\//i.test(low)
        || /\/video\.php/i.test(low);
    }
    return false;
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "string") return "";
    raw = raw.trim().replace(/\\u002F/g, "/").replace(/&amp;/g, "&");
    if (raw.startsWith("//")) raw = location.protocol + raw;
    try {
      if (!/^https?:\/\//i.test(raw)) raw = new URL(raw, location.href).href;
      var u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      u.hash = "";
      ["igsh", "igshid", "fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "mibextid", "hl"].forEach(function (k) {
        u.searchParams.delete(k);
      });
      var ig = (u.pathname || "").match(/\/(?:[A-Za-z0-9._]+\/)?(reel|p|tv)\/([A-Za-z0-9_-]+)\/?/i);
      if ((u.hostname || "").indexOf("instagram") !== -1 && ig && isIgShortcode(ig[2])) {
        return "https://www.instagram.com/" + ig[1].toLowerCase() + "/" + ig[2] + "/";
      }
      var fbReel = (u.pathname || "").match(/\/(?:reel|reels)\/(\d+)/i);
      if ((u.hostname || "").indexOf("facebook") !== -1 && fbReel) {
        return "https://www.facebook.com/reel/" + fbReel[1];
      }
      var out = u.toString().replace(/[?&]+$/, "");
      return isVideoUrl(out) ? out : "";
    } catch (e) {
      return "";
    }
  }

  function ensureItem(url) {
    if (!bag[url]) {
      bag[url] = { url: url, views: 0, likes: 0, comments: 0 };
    }
    return bag[url];
  }

  function bumpMetric(item, key, val) {
    var n = parseCount(val);
    if (n > (item[key] || 0)) {
      item[key] = n;
    }
  }

  function add(raw, metrics) {
    var n = normalize(raw);
    if (!n) return false;
    var item = ensureItem(n);
    if (metrics) {
      if (metrics.views != null) bumpMetric(item, "views", metrics.views);
      if (metrics.likes != null) bumpMetric(item, "likes", metrics.likes);
      if (metrics.comments != null) bumpMetric(item, "comments", metrics.comments);
    }
    return true;
  }

  function collectionRoot() {
    return document.querySelector('main, [role="main"]') || document;
  }

  function looksLikeCountText(txt) {
    if (!txt) return false;
    var s = String(txt).trim();
    if (s.length > 18) return false;
    return /^[\d.,]+\s*[KkMmBbWw万亿]?$/.test(s.replace(/\s/g, ""));
  }

  function extractCountNear(el) {
    if (!el) return 0;
    var best = 0;
    var nodes = el.querySelectorAll("span, div, time");
    for (var i = 0; i < nodes.length && i < 40; i++) {
      var t = (nodes[i].getAttribute("aria-label") || nodes[i].textContent || "").trim();
      var viewHint = /view|lượt xem|play|xem/i.test(t);
      var likeHint = /like|thích/i.test(t);
      var num = t.match(/([\d.,]+\s*[KkMmBbWw万亿]?)/i);
      if (!num) continue;
      if (viewHint || looksLikeCountText(t) || looksLikeCountText(num[1])) {
        var n = parseCount(num[1]);
        if (n > best && !likeHint) best = n;
      }
    }
    var aria = el.getAttribute && (el.getAttribute("aria-label") || "");
    if (aria) {
      var am = aria.match(/([\d.,]+\s*[KkMmBbWw万亿]?)\s*(views?|lượt xem|plays?)/i);
      if (am) best = Math.max(best, parseCount(am[1]));
    }
    return best;
  }

  function harvestIgDomMetrics() {
    if (!isIg) return;
    collectionRoot().querySelectorAll('a[href*="/reel/"], a[href*="/p/"], a[href*="/tv/"]').forEach(function (a) {
      var href = a.href || a.getAttribute("href") || "";
      var url = normalize(href);
      if (!url) return;
      // leo lên vài cấp để bắt ô grid reel (có số view)
      var cur = a;
      for (var i = 0; i < 6 && cur; i++) {
        var v = extractCountNear(cur);
        if (v > 0) {
          add(url, { views: v });
          break;
        }
        cur = cur.parentElement;
      }
      // aria trên chính thẻ a
      var al = a.getAttribute("aria-label") || "";
      var am = al.match(/([\d.,]+\s*[KkMmBbWw万亿]?)/i);
      if (am) add(url, { views: am[1] });
    });
  }

  function extractFbViews(el) {
    return C2VCounts.fbViews(el);
  }

  function harvestFbDomMetrics() {
    if (!isFb) return;
    collectionRoot().querySelectorAll("a[href]").forEach(function (anchor) {
      var url = normalize(anchor.href || anchor.getAttribute("href") || "");
      if (!url || !/facebook\.com|fb\.com|fb\.watch/i.test(url)) return;
      var cur = anchor;
      for (var depth = 0; cur && depth < 5; depth++, cur = cur.parentElement) {
        // Stop before a shared row/grid: another video's views must never leak.
        var links = cur.querySelectorAll("a[href]");
        for (var i = 0; i < links.length; i++) {
          var other = normalize(links[i].href || links[i].getAttribute("href") || "");
          if (other && other !== url) return;
        }
        var views = extractFbViews(cur);
        var metrics = C2VCounts.fbEngagement(cur);
        metrics.views = views;
        if (views > 0 || metrics.likes > 0 || metrics.comments > 0) add(url, metrics);
        if (views > 0 && metrics.likes > 0 && metrics.comments > 0) return;
      }
    });
  }

  function harvestDom() {
    if (killIfDead() || !syncPage()) return;
    try {
      collectionRoot().querySelectorAll("a[href]").forEach(function (a) { add(a.href); });
      collectionRoot().querySelectorAll("[href]").forEach(function (el) {
        var h = el.getAttribute("href");
        if (h) add(h);
      });
      // Ignore embedded app JSON, which can retain other profiles and suggestions.
      harvestIgDomMetrics();
      harvestFbDomMetrics();
    } catch (e) {}
  }

  function killIfDead() {
    if (extAlive()) return false;
    try { if (obs) obs.disconnect(); } catch (e) {}
    try { if (tickTimer) clearInterval(tickTimer); } catch (e) {}
    try { if (harvestTimer) clearTimeout(harvestTimer); } catch (e) {}
    return true;
  }

  function itemsList() {
    return Object.keys(bag).map(function (k) { return bag[k]; });
  }

  function pageKey() {
    var url = new URL(location.href);
    var pathname = url.pathname.replace(/\/+$/, "").replace(/\/(reels|videos|posts)$/, "");
    return host + pathname + (url.pathname === "/profile.php" ? "?id=" + (url.searchParams.get("id") || "") : "");
  }

  function syncPage() {
    var next = pageKey();
    if (next !== currentPageKey) {
      currentPageKey = next;
      bag = Object.create(null);
      // SPA navigation may update the URL before replacing the previous grid.
      pageReadyAt = Date.now() + 350;
    }
    return Date.now() >= pageReadyAt;
  }

  try {
    chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
      if (!extAlive()) return;
      if (!msg || msg.a !== MSG) return;
      if (msg.op === "get") {
        harvestDom();
        var items = itemsList().sort(function (a, b) {
          return (b.views || 0) - (a.views || 0) || String(a.url).localeCompare(String(b.url));
        });
        try {
          sendResponse({
            links: items.map(function (x) { return x.url; }),
            items: items,
            host: host,
            page: location.href,
            platform: isIg ? "instagram" : "facebook",
          });
        } catch (e) {}
        return true;
      }
      if (msg.op === "clear") {
        bag = Object.create(null);
        try { sendResponse({ ok: true }); } catch (e) {}
        return true;
      }
    });
  } catch (e) {}

  var harvestTimer = null;
  function scheduleHarvest() {
    if (!isFb) { harvestDom(); return; }
    if (harvestTimer || killIfDead()) return;
    // Throttle rather than debounce so continuous scrolling still collects links.
    harvestTimer = setTimeout(function () {
      harvestTimer = null;
      harvestDom(false);
    }, 600);
  }

  var obs = new MutationObserver(scheduleHarvest);
  var tickTimer = null;

  function start() {
    if (killIfDead()) return;
    harvestDom();
    try {
      obs.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["href", "aria-label"],
      });
    } catch (e) {}
    window.addEventListener("scroll", scheduleHarvest, { passive: true, capture: true });
    tickTimer = setInterval(harvestDom, isFb ? 5000 : 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
