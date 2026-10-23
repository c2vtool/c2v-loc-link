/**
 * C2V Lọc Link — gom dần link video Instagram / Facebook khi cuộn trang.
 */
(function () {
  "use strict";

  var host = (location.hostname || "").replace(/^(www|m|web)\./i, "").toLowerCase();
  var isIg = host === "instagram.com" || host === "instagr.am";
  var isFb = host === "facebook.com" || host === "fb.com" || host === "fb.watch";
  if (!isIg && !isFb) return;

  var STORAGE_KEY = "loc_link_bag";
  var MSG = "loc_links";
  var bag = Object.create(null);
  var saveTimer = null;
  var dirty = false;

  function isIgShortcode(code) {
    if (!code || code.length < 8 || code.length > 15) return false;
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return false;
    if (/^(en_us|en_gb|es_la|pt_br|zh_cn|zh_tw|zh_hk|fr_ca)$/i.test(code)) return false;
    return true;
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

  function add(raw) {
    var n = normalize(raw);
    if (!n || bag[n]) return false;
    bag[n] = 1;
    dirty = true;
    scheduleSave();
    return true;
  }

  function addIgShortcode(code, kind) {
    if (!isIgShortcode(code)) return;
    kind = kind || "reel";
    add("https://www.instagram.com/" + kind + "/" + code + "/");
  }

  function harvestFromText(text) {
    if (!text) return;
    var m;
    var reAbs = /https?:\/\/(?:(?:www|m|web)\.)?(?:instagram\.com|facebook\.com|fb\.com|fb\.watch)[^\s"'<>)\\]+/gi;
    while ((m = reAbs.exec(text))) add(m[0]);

    if (isIg) {
      var rePath = /(?:instagram\.com)?\/(?:[A-Za-z0-9._]+\/)?(reel|p|tv)\/([A-Za-z0-9_-]+)/gi;
      while ((m = rePath.exec(text))) addIgShortcode(m[2], m[1].toLowerCase());
      var reCode = /"(?:shortcode|code)"\s*:\s*"([A-Za-z0-9_-]{8,15})"/g;
      while ((m = reCode.exec(text))) addIgShortcode(m[1], "reel");
    }
    if (isFb) {
      var reFb = /(?:facebook\.com|fb\.com)\/(?:reel|reels)\/(\d+)/gi;
      while ((m = reFb.exec(text))) add("https://www.facebook.com/reel/" + m[1]);
      var reWatch = /[?&]v=(\d{5,})/g;
      while ((m = reWatch.exec(text))) add("https://www.facebook.com/watch/?v=" + m[1]);
      var reShare = /facebook\.com\/share\/(v|r)\/([A-Za-z0-9_-]+)/gi;
      while ((m = reShare.exec(text))) add("https://www.facebook.com/share/" + m[1] + "/" + m[2]);
    }
  }

  function harvestDom() {
    document.querySelectorAll("a[href]").forEach(function (a) { add(a.href); });
    document.querySelectorAll("[href]").forEach(function (el) {
      var h = el.getAttribute("href");
      if (h) add(h);
    });
    try {
      harvestFromText(document.documentElement.innerHTML);
    } catch (e) {}
  }

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(flushSave, 400);
  }

  function flushSave() {
    saveTimer = null;
    if (!dirty) return;
    dirty = false;
    var list = Object.keys(bag);
    chrome.storage.local.get(STORAGE_KEY, function (data) {
      var all = data[STORAGE_KEY] || {};
      var entry = all[host] || { links: [] };
      var merged = Object.create(null);
      (entry.links || []).forEach(function (u) { merged[u] = 1; });
      list.forEach(function (u) { merged[u] = 1; });
      all[host] = { links: Object.keys(merged), ts: Date.now(), page: location.href };
      chrome.storage.local.set({ [STORAGE_KEY]: all });
    });
  }

  function loadBag() {
    chrome.storage.local.get(STORAGE_KEY, function (data) {
      var all = data[STORAGE_KEY] || {};
      var entry = all[host];
      if (entry && entry.links) {
        entry.links.forEach(function (u) {
          var n = normalize(u);
          if (n) bag[n] = 1;
        });
      }
      harvestDom();
    });
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.a !== MSG) return;
    if (msg.op === "get") {
      harvestDom();
      flushSave();
      sendResponse({
        links: Object.keys(bag).sort(),
        host: host,
        page: location.href,
        platform: isIg ? "instagram" : "facebook"
      });
      return true;
    }
    if (msg.op === "clear") {
      bag = Object.create(null);
      dirty = false;
      chrome.storage.local.get(STORAGE_KEY, function (data) {
        var all = data[STORAGE_KEY] || {};
        delete all[host];
        chrome.storage.local.set({ [STORAGE_KEY]: all }, function () {
          sendResponse({ ok: true });
        });
      });
      return true;
    }
  });

  var obs = new MutationObserver(function () { harvestDom(); });

  function start() {
    loadBag();
    try {
      obs.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["href"]
      });
    } catch (e) {}
    window.addEventListener("scroll", function () { harvestDom(); }, { passive: true, capture: true });
    setInterval(harvestDom, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
