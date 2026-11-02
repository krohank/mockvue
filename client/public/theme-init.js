// Applies the saved theme before first paint to avoid a light/dark flash.
// Kept as a same-origin file so a strict Content-Security-Policy can block inline scripts.
(function () {
  try {
    var pref = JSON.parse(localStorage.getItem('mockvue_theme') || '"system"');
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
