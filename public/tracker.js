/*! NivvoTrack tracker.js — captura UTMs/fbclid/_fbp/_fbc, guarda 30 dias e repassa ao checkout. */
(function () {
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
  var COOKIE = "nvt_params", DAYS = 30;

  function getCookie(n) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + n.replace(/[.$?*|{}()\[\]\\\/+^]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(n, v) {
    var d = new Date(Date.now() + DAYS * 864e5).toUTCString();
    document.cookie = n + "=" + encodeURIComponent(v) + "; expires=" + d + "; path=/; SameSite=Lax";
  }
  function load() { try { return JSON.parse(getCookie(COOKIE) || "{}"); } catch (e) { return {}; } }

  var cur = load(), q = new URLSearchParams(location.search), fresh = false;
  KEYS.forEach(function (k) { var v = q.get(k); if (v) { cur[k] = v; fresh = true; } });
  // Se chegou nova UTM, substitui o conjunto inteiro (last click).
  if (fresh) KEYS.forEach(function (k) { if (!q.get(k)) delete cur[k]; });
  var fbp = getCookie("_fbp"), fbc = getCookie("_fbc");
  if (fbp) cur.fbp = fbp;
  if (fbc) cur.fbc = fbc;
  else if (cur.fbclid) cur.fbc = "fb.1." + Date.now() + "." + cur.fbclid;
  setCookie(COOKIE, JSON.stringify(cur));

  // sck compacto para plataformas que só repassam src/sck (ex.: Hotmart): "<campanha>-<conjunto>-<anuncio>" (IDs).
  function idOf(v) { var m = v && v.match(/\|(\d+)$/); return m ? m[1] : null; }
  var ids = [idOf(cur.utm_campaign), idOf(cur.utm_medium), idOf(cur.utm_content)];
  var sck = ids.every(Boolean) ? ids.join("-") : null;

  function decorate(a) {
    try {
      var cfg = window.NIVVO_CHECKOUT_HOSTS || [];
      var u = new URL(a.href, location.href);
      if (u.origin === location.origin || !cfg.some(function (h) { return u.hostname === h || u.hostname.endsWith("." + h); })) return;
      KEYS.forEach(function (k) { if (cur[k] && !u.searchParams.has(k)) u.searchParams.set(k, cur[k]); });
      if (cur.utm_source && !u.searchParams.has("src")) u.searchParams.set("src", cur.utm_source);
      if (sck && !u.searchParams.has("sck")) u.searchParams.set("sck", sck);
      if (cur.fbp) u.searchParams.set("fbp", cur.fbp);
      if (cur.fbc) u.searchParams.set("fbc", cur.fbc);
      a.href = u.toString();
    } catch (e) {}
  }
  function run() { Array.prototype.forEach.call(document.querySelectorAll("a[href]"), decorate); }
  document.addEventListener("DOMContentLoaded", run);
  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("a[href]"); if (a) decorate(a); }, true);
  window.NivvoTrack = { params: cur, sck: sck };
})();
