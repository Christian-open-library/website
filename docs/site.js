// Small enhancements. Everything works without JavaScript.
(function () {
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  var done = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  // "Copy" button beside the connector address.
  document.querySelectorAll('.address').forEach(function (box) {
    var code = box.querySelector('code');
    if (!code || !navigator.clipboard) return;
    var btn = document.createElement('button');
    var live = document.createElement('span');
    live.className = 'sr';
    live.setAttribute('aria-live', 'polite');
    btn.type = 'button';
    btn.className = 'copy';
    btn.innerHTML = icon + '<span>Copy</span>';
    btn.setAttribute('aria-label', 'Copy the address');
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(code.textContent.trim()).then(function () {
        btn.innerHTML = done + '<span>Copied</span>';
        live.textContent = 'Address copied';
        setTimeout(function () { btn.innerHTML = icon + '<span>Copy</span>'; live.textContent = ''; }, 2500);
      }, function () {
        live.textContent = 'Could not copy. Press and hold the address to copy it.';
      });
    });
    box.appendChild(btn);
    box.appendChild(live);
  });

  // Close the phone menu with Escape or a click outside it.
  var menu = document.querySelector('.nav-mobile');
  if (menu) {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
  }
})();
