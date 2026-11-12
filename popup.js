(function () {
  "use strict";

  var MSG = "loc_links";
  /** @type {Array<{url:string, views:number, likes:number, comments:number}>} */
  var allItems = [];
  var mode = "all";
  var activePlatform = null;
  var refreshSequence = 0;

  var out = document.getElementById("out");
  var statusEl = document.getElementById("status");
  var siteBadge = document.getElementById("siteBadge");
  var countShow = document.getElementById("countShow");
  var countTotal = document.getElementById("countTotal");
  var btnRefresh = document.getElementById("btnRefresh");
  var btnCopy = document.getElementById("btnCopy");
  var btnClear = document.getElementById("btnClear");
  var igTools = document.getElementById("igTools");
  var minViewsEl = document.getElementById("minViews");
  var sortByEl = document.getElementById("sortBy");
  var onlyWithViewsEl = document.getElementById("onlyWithViews");
  var showMetaEl = document.getElementById("showMeta");
  function syncSortOptions() {
    if (!["views_desc", "views_asc", "url"].includes(sortByEl.value)) sortByEl.value = "views_desc";
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function parseCount(raw) {
    return C2VCounts.parse(raw);
  }

  function formatCount(n) {
    n = parseCount(n);
    if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  function isIg(u) {
    return /instagram\.com|instagr\.am/i.test(u);
  }

  function isFb(u) {
    return /facebook\.com|fb\.com|fb\.watch/i.test(u);
  }

  function toItem(x) {
    if (!x) return null;
    if (typeof x === "string") return { url: x, views: 0, likes: 0, comments: 0 };
    if (x.url) {
      return {
        url: x.url,
        views: parseCount(x.views),
        likes: parseCount(x.likes),
        comments: parseCount(x.comments),
      };
    }
    return null;
  }

  function mergeItems(lists) {
    var map = Object.create(null);
    (lists || []).forEach(function (list) {
      (list || []).forEach(function (raw) {
        var it = toItem(raw);
        if (!it || !it.url) return;
        if (!map[it.url]) {
          map[it.url] = it;
        } else {
          map[it.url].views = Math.max(map[it.url].views || 0, it.views || 0);
          map[it.url].likes = Math.max(map[it.url].likes || 0, it.likes || 0);
          map[it.url].comments = Math.max(map[it.url].comments || 0, it.comments || 0);
        }
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function platformFilter(items) {
    return items.filter(function (it) {
      var u = it.url;
      if (mode === "ig") return isIg(u);
      if (mode === "fb") return isFb(u);
      return true;
    });
  }

  function selectedMetric() {
    return "views";
  }

  function syncMetricLabels() {
    var labels = {
      views: ["View tối thiểu", "Chỉ link có view", "vd: 10k / 100000"],
    }[selectedMetric()];
    document.getElementById("minMetricLabel").textContent = labels[0];
    document.getElementById("onlyMetricLabel").textContent = labels[1];
    minViewsEl.placeholder = labels[2];
  }

  function applyMetricFilters(items) {
    var minimum = parseCount(minViewsEl.value);
    var onlyWithMetric = onlyWithViewsEl.checked;
    var metric = selectedMetric();
    var sortBy = sortByEl.value || "views_desc";

    var outList = items.filter(function (it) {
      if (!isIg(it.url) && !isFb(it.url)) return true;
      if (onlyWithMetric && !(it[metric] > 0)) return false;
      if (minimum > 0 && !(it[metric] >= minimum)) return false;
      return true;
    });

    outList = outList.slice();
    outList.sort(function (a, b) {
      if (sortBy === "url") return String(a.url).localeCompare(String(b.url));
      var av = a[metric] || 0;
      var bv = b[metric] || 0;
      // Stored zero also represents data not yet collected. Keep these links
      // after known counts in both directions rather than calling them lowest.
      if (av > 0 && !(bv > 0)) return -1;
      if (!(av > 0) && bv > 0) return 1;
      var delta = sortBy.endsWith("_asc") ? av - bv : bv - av;
      return delta || String(a.url).localeCompare(String(b.url));
    });
    return outList;
  }

  function filteredItems() {
    return applyMetricFilters(platformFilter(allItems));
  }

  function syncIgToolsVisibility() {
    var show = mode === "all" || mode === "ig" || mode === "fb";
    igTools.style.display = show ? "" : "none";
  }

  function render() {
    syncSortOptions();
    syncIgToolsVisibility();
    syncMetricLabels();
    var shown = filteredItems();
    var showMeta = showMetaEl.checked;
    var metric = selectedMetric();
    var metricName = { views: "view", likes: "like", comments: "bình luận" }[metric];
    out.value = shown.map(function (it) {
      if (!showMeta) return it.url;
      var meta = it[metric] > 0
        ? formatCount(it[metric]) + " " + metricName
        : "Chưa có dữ liệu " + metricName;
      return meta + "\n" + it.url;
    }).join("\n\n");

    countShow.textContent = String(shown.length);
    countTotal.textContent = String(allItems.length);
    btnCopy.disabled = shown.length === 0;
    btnClear.disabled = allItems.length === 0;
    return shown;
  }

  function setBadge(tabUrl, platform) {
    activePlatform = platform || (isFb(tabUrl || "") ? "facebook" : isIg(tabUrl || "") ? "instagram" : null);
    siteBadge.className = "site";
    if (!tabUrl || /^(chrome|edge|about|chrome-extension):/i.test(tabUrl)) {
      siteBadge.textContent = "Hãy mở Instagram hoặc Facebook";
      siteBadge.classList.add("bad");
      return;
    }
    if (platform === "instagram" || /instagram\.com/i.test(tabUrl)) {
      siteBadge.textContent = "Instagram — cuộn để gom link + view";
      siteBadge.classList.add("ig");
      return;
    }
    if (platform === "facebook" || /facebook\.com|fb\.com|fb\.watch/i.test(tabUrl)) {
      siteBadge.textContent = "Facebook — cuộn để gom link + view";
      siteBadge.classList.add("fb");
      return;
    }
    siteBadge.textContent = "Trang này không phải IG/FB";
    siteBadge.classList.add("bad");
  }

  function refresh() {
    var sequence = ++refreshSequence;
    setStatus("Đang lấy link…");
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (sequence !== refreshSequence) return;
      var tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        setStatus("Không đọc được tab.", "err");
        return;
      }
      setBadge(tab.url, null);

      var fromMsg = null;
      var platform = null;

      function done() {
        allItems = mergeItems([fromMsg]);
        render();
        setBadge(tab.url, platform);
        if (!/instagram|facebook|fb\.com|fb\.watch/i.test(tab.url || "")) {
          setStatus("Mở tab Instagram Reels hoặc Facebook rồi cuộn trang.", "warn");
          return;
        }
        if (!allItems.length) {
          setStatus("Chưa có link — cuộn chậm thêm rồi bấm Làm mới.", "warn");
        } else {
          var withViews = allItems.filter(function (x) { return x.views > 0; }).length;
          var shown = filteredItems().length;
          setStatus(
            "Đã gom " + allItems.length + " link" +
            (withViews ? (" · " + withViews + " có view") : "") +
            " · hiện " + shown + ". Copy dán vào C2V.",
            "ok"
          );
        }
      }

      chrome.tabs.sendMessage(tab.id, { a: MSG, op: "get" }, function (res) {
        if (sequence !== refreshSequence) return;
        if (chrome.runtime.lastError) {
          allItems = [];
          render();
          setStatus("Không kết nối được trang. F5 trang rồi bấm Làm mới.", "warn");
          return;
        } else if (res && res.page && res.page.split("#")[0] !== (tab.url || "").split("#")[0]) {
          allItems = [];
          render();
          setStatus("Trang vừa thay đổi. Bấm Làm mới để lấy link kênh hiện tại.", "warn");
          return;
        } else {
          fromMsg = (res && (res.items || res.links)) || [];
          platform = res && res.platform;
        }
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

  [minViewsEl, sortByEl, onlyWithViewsEl, showMetaEl].forEach(function (el) {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });

  btnRefresh.addEventListener("click", refresh);

  btnCopy.addEventListener("click", function () {
    var shown = filteredItems();
    if (!shown.length) return;
    // Copy chỉ URL — để dán thẳng vào C2V Download
    var text = shown.map(function (it) { return it.url; }).join("\n");
    navigator.clipboard.writeText(text).then(function () {
      setStatus("Đã copy " + shown.length + " link (chỉ URL).", "ok");
      render();
    }).catch(function () {
      out.value = text;
      out.focus();
      out.select();
      try {
        document.execCommand("copy");
        setStatus("Đã copy " + shown.length + " link (chỉ URL).", "ok");
      } catch (e) {
        setStatus("Copy thất bại — chọn ô rồi Ctrl+C.", "err");
      }
    });
  });

  btnClear.addEventListener("click", function () {
    allItems = [];
    render();
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { a: MSG, op: "clear" }, function () {
          void chrome.runtime.lastError;
        });
      }

    });
    setStatus("Đã xóa danh sách link trong tab này.");
  });

  refresh();
})();
