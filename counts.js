/** Shared localized view counts for collection, sorting and popup filters. */
(function () {
  "use strict";

  function parse(raw) {
    if (raw == null || raw === "") return 0;
    if (typeof raw === "number" && isFinite(raw)) return Math.max(0, Math.floor(raw));
    var s = String(raw).trim().toLowerCase().replace(/(\d)\s+(?=\d)/g, "$1");
    var m = s.match(/^([\d][\d.,\s]*?)\s*(triệu|trieu|nghìn|nghin|ngàn|ngan|tỷ|tỉ|ty|ti|[kmbw万亿])?(?=\s|$)/i);
    if (!m) return 0;
    var digits = m[1].replace(/\s/g, "");
    var u = (m[2] || "").toLowerCase();
    if (!u && /^\d{1,3}([.,]\d{3})+$/.test(digits)) {
      digits = digits.replace(/[.,]/g, "");
    } else {
      // Compact counts use a decimal comma in Vietnamese (1,2 triệu).
      var decimal = Math.max(digits.lastIndexOf(","), digits.lastIndexOf("."));
      if (decimal >= 0) {
        digits = digits.slice(0, decimal).replace(/[.,]/g, "") + "." + digits.slice(decimal + 1);
      }
    }
    var n = Number(digits);
    if (!isFinite(n)) return 0;
    if (/^(k|nghìn|nghin|ngàn|ngan)$/.test(u)) n *= 1e3;
    else if (/^(m|triệu|trieu)$/.test(u)) n *= 1e6;
    else if (/^(b|tỷ|tỉ|ty|ti)$/.test(u)) n *= 1e9;
    else if (u === "w" || u === "万") n *= 1e4;
    else if (u === "亿") n *= 1e8;
    return Math.max(0, Math.round(n));
  }

  function fbEngagement(el) {
    var result = { likes: 0, comments: 0 };
    var count = "[0-9][0-9.,]*(?:\\s*(?:triệu|trieu|nghìn|nghin|ngàn|ngan|tỷ|tỉ|ty|ti|[kmbw万亿]))?";
    var labels = { likes: "lượt thích|likes?|thích", comments: "bình luận|comments?" };
    var nodes = [el].concat(Array.prototype.slice.call(el.querySelectorAll("span, div, button, [aria-label]")));
    Object.keys(labels).forEach(function (key) {
      var suffix = new RegExp("(" + count + ")\\s*(?:" + labels[key] + ")(?=$|[^\\p{L}\\p{N}])", "giu");
      var prefix = new RegExp("^(?:" + labels[key] + ")\\s*[:：]?\\s*(" + count + ")$", "giu");
      nodes.forEach(function (node) {
        var aria = node.getAttribute("aria-label") || "";
        var text = node.textContent || "";
        [aria, text, aria && aria + " " + text].forEach(function (raw) {
          var value = raw.replace(/\s+/g, " ").trim();
          if (!value || value.length > 160) return;
          [suffix, prefix].forEach(function (re) {
            re.lastIndex = 0;
            var match;
            while ((match = re.exec(value))) result[key] = Math.max(result[key], parse(match[1]));
          });
        });
      });
    });
    return result;
  }

  function fbViews(el) {
    var count = "[0-9][0-9.,]*(?:\\s*(?:triệu|trieu|nghìn|nghin|ngàn|ngan|tỷ|tỉ|ty|ti|[kmbw万亿]))?";
    var labelled = new RegExp("(" + count + ")\\s*(?:lượt xem|người xem|views?|plays?)(?=\\s|$|[.,])", "i");
    var exact = new RegExp("^" + count + "$", "i");
    var otherMetric = new RegExp("^" + count + "\\s*(?:lượt thích|thích|likes?|bình luận|comments?|chia sẻ|shares?)$", "i");
    var bestLabel = 0, bestCompact = 0, bestPlain = 0;
    var nodes = [el].concat(Array.prototype.slice.call(el.querySelectorAll("a, span, div, [aria-label]")));
    nodes.forEach(function (node) {
      var parent = node;
      while (parent) {
        var label = (parent.getAttribute("aria-label") || parent.textContent || "").replace(/\s+/g, " ").trim();
        if (otherMetric.test(label)) return;
        if (parent === el) break;
        parent = parent.parentElement;
      }
      [node.getAttribute("aria-label") || "", node.textContent || ""].forEach(function (raw) {
        var text = raw.replace(/\s+/g, " ").trim();
        if (!text || text.length > 160) return;
        var match = text.match(labelled);
        if (match) { bestLabel = Math.max(bestLabel, parse(match[1])); return; }
        // Unlabelled views are the standalone counter beside the eye icon.
        // Never interpret arbitrary caption numbers or like/comment labels.
        if (!exact.test(text)) return;
        var value = parse(text);
        if (/[a-z万亿à-ỹ]/i.test(text)) bestCompact = Math.max(bestCompact, value);
        else bestPlain = Math.max(bestPlain, value);
      });
    });
    return bestLabel || bestCompact || bestPlain;
  }

  var IG_VIDEO_SELECTOR = 'a[href*="/reel/"], a[href*="/p/"], a[href*="/tv/"]';

  function igVideoId(link) {
    try {
      var url = new URL(link.getAttribute("href") || link.href || "", "https://www.instagram.com/");
      if (!/^(www\.)?(instagram\.com|instagr\.am)$/i.test(url.hostname)) return "";
      var match = url.pathname.match(/\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i);
      return match ? match[1] : "";
    } catch (e) { return ""; }
  }

  function igVideoIds(el) {
    var links = Array.prototype.slice.call(el.querySelectorAll(IG_VIDEO_SELECTOR));
    if (el.matches(IG_VIDEO_SELECTOR)) links.unshift(el);
    var ids = new Set();
    links.forEach(function (link) { var id = igVideoId(link); if (id) ids.add(id); });
    return ids;
  }

  function igViews(el) {
    // A row or entire grid must never supply a count for one video.
    if (igVideoIds(el).size !== 1) return 0;
    return fbViews(el);
  }

  function igViewsForLink(link) {
    var id = igVideoId(link);
    if (!id) return 0;
    for (var el = link, depth = 0; el && depth < 8; el = el.parentElement, depth++) {
      if (/^(MAIN|BODY|HTML)$/.test(el.tagName) || el.querySelector('header, [role="tablist"]')) break;
      var ids = igVideoIds(el);
      if (ids.size !== 1 || !ids.has(id)) break;
      var views = fbViews(el);
      if (views > 0) return views;
    }
    return 0;
  }

  function isProfilePage(href) {
    try {
      var url = new URL(href);
      var host = url.hostname.replace(/^(www|m|web)\./i, "").toLowerCase();
      var path = url.pathname.replace(/\/+$/, "");
      if (host === "instagram.com" || host === "instagr.am") {
        var ig = path.match(/^\/([A-Za-z0-9._]+)(?:\/(reels|tagged))?$/i);
        return !!ig && !/^(accounts|about|api|direct|explore|reels|reel|p|tv|stories|developer|developers|legal|privacy|terms|challenge|web|emails|settings|your_activity)$/i.test(ig[1]);
      }
      if (host !== "facebook.com" && host !== "fb.com") return false;
      if (path === "/profile.php") return /^\d+$/.test(url.searchParams.get("id") || "");
      if (/^\/(people|pages)\/[^/]+\/\d+(?:\/(reels|videos|posts))?$/i.test(path)) return true;
      var fb = path.match(/^\/([A-Za-z0-9._-]+)(?:\/(reels|videos|posts))?$/i);
      return !!fb && !/^(watch|reel|reels|share|groups|marketplace|gaming|home|search|friends|notifications|messages|settings|help|login|photo|photos|video|videos|events|stories|saved|bookmarks|pages|people|privacy|policies|recover|checkpoint|dialog|plugins|business|ads)$/i.test(fb[1]);
    } catch (e) {
      return false;
    }
  }

  globalThis.C2VCounts = { parse: parse, fbEngagement: fbEngagement, fbViews: fbViews, isProfilePage: isProfilePage,
    igVideoSelector: IG_VIDEO_SELECTOR, igVideoId: igVideoId, igVideoIds: igVideoIds, igViews: igViews, igViewsForLink: igViewsForLink };
})();
