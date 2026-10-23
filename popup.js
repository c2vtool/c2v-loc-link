(function () {
  "use strict";

  var STORAGE_KEY = "loc_link_bag";
  var MSG = "loc_links";
  var allLinks = [];
  var mode = "all";

  var out = document.getElementById("out");
  var statusEl = document.getElementById("status");
  var siteBadge = document.getElementById("siteBadge");
  var countShow = document.getElementById("countShow");
  var countTotal = document.getElementById("countTotal");
  var btnRefresh = document.getElementById("btnRefresh");
  var btnCopy = document.getElementById("btnCopy");
  var btnClear = document.getElementById("btnClear");

  function setStatus(msg, kind) {
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function isIg(u) {
    return /instagram\.com|instagr\.am/i.test(u);
  }

  function isFb(u) {
    return /facebook\.com|fb\.com|fb\.watch/i.test(u);
  }

  function isIgReel(u) {
    return isIg(u) && /\/reel\/[A-Za-z0-9_-]+/i.test(u);
  }

  function filterLinks() {
    return allLinks.filter(function (u) {
      if (mode === "ig") return isIg(u);
      if (mode === "ig_reel") return isIgReel(u);
      if (mode === "fb") return isFb(u);
      return true;
    });
  }

  function render() {
    var shown = filterLinks();
    out.value = shown.join("\n");
    countShow.textContent = String(shown.length);
    countTotal.textContent = String(allLinks.length);
    btnCopy.disabled = shown.length === 0;
    btnClear.disabled = allLinks.length === 0;
    return shown;
  }

  function hostKey(url) {
    try {
      return new URL(url).hostname.replace(/^(www|m|web)\./i, "").toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function mergeUnique(list) {
    var map = Object.create(null);
    (list || []).forEach(function (u) {
      if (u) map[u] = 1;
    });
    return Object.keys(map).sort();
  }

  function setBadge(tabUrl, platform) {
    siteBadge.className = "site";
    if (!tabUrl || /^(chrome|edge|about|chrome-extension):/i.test(tabUrl)) {
      siteBadge.textContent = "Hãy mở Instagram hoặc Facebook";
      siteBadge.classList.add("bad");
      return;
    }
    if (platform === "instagram" || /instagram\.com/i.test(tabUrl)) {
      siteBadge.textContent = "Instagram — đang gom khi bạn cuộn";
      siteBadge.classList.add("ig");
      return;
    }
    if (platform === "facebook" || /facebook\.com|fb\.com|fb\.watch/i.test(tabUrl)) {
      siteBadge.textContent = "Facebook — đang gom khi bạn cuộn";
      siteBadge.classList.add("fb");
      return;
    }
    siteBadge.textContent = "Trang này không phải IG/FB";
    siteBadge.classList.add("bad");
  }

  function refresh() {
    setStatus("Đang lấy link…");
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        setStatus("Không đọc được tab.", "err");
        return;
      }
      setBadge(tab.url, null);

      var fromMsg = null;
      var fromStore = null;
      var left = 2;
      var platform = null;

      function done() {
        left--;
        if (left > 0) return;
        allLinks = mergeUnique([].concat(fromMsg || [], fromStore || []));
        render();
        setBadge(tab.url, platform);
        if (!/instagram|facebook|fb\.com|fb\.watch/i.test(tab.url || "")) {
          setStatus("Mở tab Instagram Reels hoặc Facebook rồi cuộn trang.", "warn");
          return;
        }
        if (!allLinks.length) {
          setStatus("Chưa có link — cuộn chậm thêm rồi bấm Làm mới.", "warn");
        } else {
          setStatus("Đã gom " + allLinks.length + " link video. Copy dán vào C2V.", "ok");
        }
      }

      chrome.tabs.sendMessage(tab.id, { a: MSG, op: "get" }, function (res) {
        if (chrome.runtime.lastError) {
          fromMsg = [];
        } else {
          fromMsg = (res && res.links) || [];
          platform = res && res.platform;
        }
        done();
      });

      var host = hostKey(tab.url || "");
      chrome.storage.local.get(STORAGE_KEY, function (data) {
        var bag = data[STORAGE_KEY] || {};
        var links = [];
        function pull(h) {
          if (bag[h] && bag[h].links) links = links.concat(bag[h].links);
        }
        pull(host);
        if (/instagram|instagr/i.test(host)) {
          pull("instagram.com");
          pull("instagr.am");
        }
        if (/facebook|fb\.com|fb\.watch/i.test(host)) {
          pull("facebook.com");
          pull("fb.com");
          pull("fb.watch");
        }
        fromStore = links;
        done();
      });
    });
  }

  document.getElementById("filters").addEventListener("click", function (ev) {
    var btn = ev.target.closest(".chip");
    if (!btn) return;
    mode = btn.getAttribute("data-mode") || "all";
    document.querySelectorAll(".chip").forEach(function (c) {
      c.classList.toggle("active", c === btn);
    });
    render();
  });

  btnRefresh.addEventListener("click", refresh);

  btnCopy.addEventListener("click", function () {
    var shown = render();
    if (!shown.length) return;
    var text = shown.join("\n");
    navigator.clipboard.writeText(text).then(function () {
      setStatus("Đã copy " + shown.length + " link.", "ok");
    }).catch(function () {
      out.focus();
      out.select();
      try {
        document.execCommand("copy");
        setStatus("Đã copy " + shown.length + " link.", "ok");
      } catch (e) {
        setStatus("Copy thất bại — chọn ô rồi Ctrl+C.", "err");
      }
    });
  });

  btnClear.addEventListener("click", function () {
    allLinks = [];
    render();
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { a: MSG, op: "clear" }, function () {
          void chrome.runtime.lastError;
        });
      }
      var host = hostKey((tab && tab.url) || "");
      chrome.storage.local.get(STORAGE_KEY, function (data) {
        var bag = data[STORAGE_KEY] || {};
        if (host) delete bag[host];
        ["instagram.com", "facebook.com", "fb.com", "fb.watch"].forEach(function (h) {
          if (host && host.indexOf(h.split(".")[0]) !== -1) delete bag[h];
        });
        chrome.storage.local.set({ [STORAGE_KEY]: bag });
      });
    });
    setStatus("Đã xóa bộ nhớ link trang này.");
  });

  refresh();
})();
