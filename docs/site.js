// Small enhancements. Everything works without JavaScript.
(function () {
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COPY = 'M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2zM5 15V5a2 2 0 0 1 2-2h10';
  var DONE = 'M5 12.5l4.5 4.5L19 7.5';

  // A light tap on phones that have one (Android vibrates; iPhones tick through a hidden switch).
  function buzz() {
    try {
      if (navigator.vibrate) { navigator.vibrate(10); return; }
      var lb = document.createElement('label'), sw = document.createElement('input');
      sw.type = 'checkbox';
      sw.setAttribute('switch', '');
      lb.setAttribute('aria-hidden', 'true');
      lb.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      lb.appendChild(sw);
      document.body.appendChild(lb);
      lb.click();
      setTimeout(function () { lb.remove(); }, 50);
    } catch (e) { /* no tap */ }
  }

  // Copy: a small icon in the address box; tapping the box copies too. On a copy the icon becomes a tick
  // that draws and snaps, and a ring of colour runs out from the box.
  document.querySelectorAll('.address').forEach(function (box) {
    var code = box.querySelector('code');
    if (!code || !navigator.clipboard) return;
    var what = box.dataset.what || 'the address';
    var btn = document.createElement('button');
    var live = document.createElement('span');
    var back;
    live.className = 'sr';
    live.setAttribute('aria-live', 'polite');
    btn.type = 'button';
    btn.className = 'copy';
    btn.title = 'Copy';
    btn.setAttribute('aria-label', 'Copy ' + what);
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + COPY + '"/></svg>';
    var path = btn.querySelector('path');
    function copy() {
      navigator.clipboard.writeText(code.textContent.trim()).then(function () {
        path.setAttribute('d', DONE);
        box.classList.remove('copied');
        void box.offsetWidth;
        box.classList.add('copied');
        live.textContent = 'Copied';
        buzz();
        clearTimeout(back);
        back = setTimeout(function () { path.setAttribute('d', COPY); box.classList.remove('copied'); live.textContent = ''; }, 2400);
      }, function () {
        live.textContent = 'Could not copy. Press and hold the text to copy it.';
      });
    }
    btn.addEventListener('click', copy);
    code.addEventListener('click', copy);
    box.classList.add('has-copy');
    box.appendChild(btn);
    box.appendChild(live);
  });

  // Set-up page: pick your app, and only its steps show. Without JavaScript all four show.
  var apps = document.querySelector('.apps');
  if (apps) {
    var panes = apps.querySelectorAll('.app');
    var pick = document.createElement('div');
    pick.className = 'app-pick';
    pick.setAttribute('role', 'group');
    pick.setAttribute('aria-label', 'Your AI app');
    var mark = document.createElement('span');
    mark.className = 'app-mark';
    mark.setAttribute('aria-hidden', 'true');
    var tabs = {};
    panes.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.querySelector('h3').textContent;
      b.addEventListener('click', function () { choose(p.dataset.app, true); });
      tabs[p.dataset.app] = b;
      pick.appendChild(b);
    });
    pick.appendChild(mark);
    apps.parentNode.insertBefore(pick, apps);
    apps.classList.add('picked');
    document.documentElement.classList.add('app-picked');
    function place(b) {
      mark.style.width = b.offsetWidth + 'px';
      mark.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    }
    function choose(app, tapped) {
      if (!tabs[app]) return;
      var h0 = apps.offsetHeight;
      panes.forEach(function (p) { p.hidden = p.dataset.app !== app; });
      document.querySelectorAll('li[data-app]').forEach(function (li) { li.hidden = li.dataset.app !== app; });
      Object.keys(tabs).forEach(function (k) { tabs[k].setAttribute('aria-pressed', k === app ? 'true' : 'false'); });
      place(tabs[app]);
      if (!tapped) return;
      history.replaceState(null, '', '#' + app);
      var h1 = apps.offsetHeight;
      if (calm || !apps.animate) return;
      apps.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 260, easing: 'cubic-bezier(.22, .9, .25, 1)' });
      apps.querySelector('.app:not([hidden])').animate(
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 240, easing: 'cubic-bezier(.22, .9, .25, 1)' });
    }
    var start = location.hash.slice(1);
    choose(tabs[start] ? start : 'claude');
    if (tabs[start]) pick.scrollIntoView();
    mark.classList.add('ready');
    window.addEventListener('resize', function () { var on = pick.querySelector('[aria-pressed="true"]'); if (on) place(on); });
    window.addEventListener('hashchange', function () { choose(location.hash.slice(1)); });
  }

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

  // Long pages: mark the section being read in the side list. On a phone the list is a bar under the header
  // that names that section and opens the list; headings jumped to land below the bar, not under it.
  var side = document.querySelector('nav.side');
  if (side) {
    var links = side.querySelectorAll('a[href^="#"]');
    var heads = [], now = side.querySelector('.side-now'), nowText = now && now.querySelector('span');
    var header = document.querySelector('header.site'), narrow = window.matchMedia('(max-width: 56rem)');
    Array.prototype.forEach.call(links, function (a) {
      var h = document.getElementById(a.getAttribute('href').slice(1));
      if (h) heads.push([h, a]);
    });
    side.classList.add('js');
    if (now) now.hidden = false;
    var setOpen = function (on) { side.classList.toggle('open', on); if (now) now.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    var offset = function () { return (header ? header.offsetHeight : 0) + (narrow.matches && now ? now.offsetHeight : 0); };
    var fit = function () {
      var h = header ? header.offsetHeight : 0;
      side.style.setProperty('--head-h', h + 'px');
      document.documentElement.style.scrollPaddingTop = (offset() + 16) + 'px';
      if (!narrow.matches) setOpen(false);
    };
    var current = null;
    var mark = function () {
      var line = offset() + 24, pick = heads.length ? heads[0] : null;
      heads.forEach(function (p) { if (p[0].getBoundingClientRect().top <= line) pick = p; });
      // At the very bottom the last section counts as read, even when its heading can't reach the top.
      if (heads.length && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) pick = heads[heads.length - 1];
      if (!pick || pick === current) return;
      if (current) current[1].removeAttribute('aria-current');
      current = pick;
      pick[1].setAttribute('aria-current', 'location');
      if (nowText) nowText.textContent = pick[1].textContent;
    };
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; mark(); });
    }, { passive: true });
    window.addEventListener('resize', function () { fit(); mark(); });
    if (now) now.addEventListener('click', function () { setOpen(!side.classList.contains('open')); });
    side.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && side.classList.contains('open')) { setOpen(false); now.focus(); } });
    document.addEventListener('click', function (e) { if (side.classList.contains('open') && !side.contains(e.target)) setOpen(false); });
    fit();
    mark();
  }
})();
