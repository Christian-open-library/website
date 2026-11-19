// Search the library: one box on every page. On a computer it floats at the bottom right and grows into a panel;
// on a phone it is a round button that opens into a full-screen sheet. On the home page it starts as the big box
// under the heading and drops into the corner when that scrolls away. Everything else on the site works without it.
(function () {
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = window.matchMedia('(max-width: 40rem)');
  var SPRING = 'cubic-bezier(.2, 1.1, .3, 1)';
  var EASE = 'cubic-bezier(.22, .9, .25, 1)';
  var MAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>';
  var OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  var LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>';
  var SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5V3.5M7.5 8L12 3.5 16.5 8M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2"/></svg>';
  var XLOGO = '<svg viewBox="0 0 24 24" aria-hidden="true" class="lk-fill"><path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77zm-1.08 16.18h1.7L7.4 4.73H5.58z"/></svg>';
  var FB = '<svg viewBox="0 0 24 24" aria-hidden="true" class="lk-fill"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.25-1.46 1.5-1.46h1.6V4.46a21 21 0 0 0-2.3-.16c-2.3 0-3.8 1.4-3.8 3.96v2.24H8v3h2.5V21z"/></svg>';
  var MAIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM4.5 6.5L12 12.5l7.5-6"/></svg>';
  var DONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
  var HINT = 'Search the library: a topic or a line you remember';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  // The CSS cubic-bezier() curve as a function of time, for motion driven frame by frame.
  function bezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return function (t) {
      var u = t;
      for (var i = 0; i < 8; i++) {
        var d = ((ax * u + bx) * u + cx) * u - t, dd = (3 * ax * u + 2 * bx) * u + cx;
        if (Math.abs(d) < 1e-5 || Math.abs(dd) < 1e-6) break;
        u -= d / dd;
      }
      u = Math.max(0, Math.min(1, u));
      return ((ay * u + by) * u + cy) * u;
    };
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function buzz() {
    if (calm || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
    try {
      if (navigator.vibrate) { navigator.vibrate(10); return; }
      var lb = el('label'), sw = el('input');
      sw.type = 'checkbox'; sw.setAttribute('switch', '');
      lb.setAttribute('aria-hidden', 'true');
      lb.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
      lb.appendChild(sw); document.body.appendChild(lb); lb.click();
      setTimeout(function () { lb.remove(); }, 50);
    } catch (e) { /* no tap */ }
  }

  // The pieces: a launcher, a shade over the page, and the panel the launcher grows into.
  var launch = el('button', 'lk-launch', MAG + '<span class="lk-launch-text">Search the library</span><kbd>/</kbd>');
  launch.type = 'button';
  launch.setAttribute('aria-label', 'Search the library');
  launch.setAttribute('aria-keyshortcuts', '/');
  var shade = el('div', 'lk-shade');
  var panel = el('div', 'lk-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Search the library');
  panel.innerHTML =
    '<div class="lk-inner">' +
      '<form class="lk-form" role="search">' + MAG +
        '<label for="lk-q" class="sr">Search the library</label>' +
        '<input id="lk-q" type="search" dir="auto" autocomplete="off" spellcheck="false" enterkeyhint="search" maxlength="500" placeholder="' + HINT + '">' +
        '<button type="submit" class="lk-go" aria-label="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' +
        '<button type="button" class="lk-close" aria-label="Close"><kbd>esc</kbd>' + CLOSE + '</button>' +
      '</form>' +
      '<div class="lk-body" aria-live="polite"></div>' +
    '</div>';
  var inner = panel.querySelector('.lk-inner');
  var form = panel.querySelector('.lk-form');
  var input = panel.querySelector('input');
  var body = panel.querySelector('.lk-body');
  var closeBtn = panel.querySelector('.lk-close');
  var ghost = el('div', 'lk-ghost', MAG + '<span class="lk-gt"><span class="lk-gt-a"></span><span class="lk-gt-b"></span></span>' +
    '<kbd class="lk-gk">/</kbd><span class="lk-gg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>');
  ghost.setAttribute('aria-hidden', 'true');
  document.body.appendChild(launch);
  document.body.appendChild(ghost);
  document.body.appendChild(shade);
  document.body.appendChild(panel);

  var hero = document.querySelector('form.lk-hero');
  var heroInput = hero && hero.querySelector('input');
  // Phones get a shorter hint, so it isn't cut off.
  function hints() { var t = phone.matches ? 'Search the library' : HINT; input.placeholder = t; if (heroInput) heroInput.placeholder = t; }
  hints();
  if (phone.addEventListener) phone.addEventListener('change', hints);
  var isOpen = false, busy = false, from = null, lastQ = '', hidden = null;

  function radius(node) { return getComputedStyle(node).borderRadius; }
  function box(r) { return { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' }; }
  function frame(r, rad) { var b = box(r); b.borderRadius = rad; return b; }

  // Where the panel comes from and goes back to: the home page's big box while it is on screen, else the launcher.
  function source() { return hero && (!launch.classList.contains('lk-here') || launch.classList.contains('lk-band')) ? hero : launch; }

  function open(q, el) {
    if (isOpen) return;
    isOpen = true;
    from = el || source();
    var r0 = from.getBoundingClientRect(), rad0 = radius(from);
    document.documentElement.classList.add('lk-lock');
    document.body.classList.add('lk-open');
    if (q != null) input.value = q;
    has(form, input);
    input.focus({ preventScroll: true });
    try { history.pushState({ lk: 1 }, ''); } catch (e) { /* the page keeps working without it */ }
    if (calm) return;
    var r1 = panel.getBoundingClientRect();
    panel.animate([frame(r0, rad0), frame(r1, radius(panel))], { duration: phone.matches ? 460 : 420, easing: SPRING });
    inner.animate([{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1 }], { duration: 420, easing: 'linear' });
    shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE });
    // What it grew from stays hidden until the panel has gone back into it.
    if (hidden) hidden.cancel();
    hidden = from.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
  }

  function close(viaBack) {
    if (!isOpen) return;
    isOpen = false;
    if (!viaBack && history.state && history.state.lk) { try { history.back(); } catch (e) { /* fine */ } }
    var to = from && from !== hero && from !== launch && from.isConnected ? from : source();
    var done = function () {
      if (hidden) { hidden.cancel(); hidden = null; }
      document.body.classList.remove('lk-open');
      document.documentElement.classList.remove('lk-lock');
      if (to === hero && heroInput) heroInput.value = input.value;
      // Keyboard focus goes back to where the panel came from, not to the top of the page.
      if (!panel.contains(document.activeElement) && document.activeElement !== document.body) return;
      var back = to === hero ? heroInput : to;
      if (back && back.focus) back.focus({ preventScroll: true });
    };
    if (calm) { done(); return; }
    var r1 = panel.getBoundingClientRect(), r0 = to.getBoundingClientRect();
    // The words and the shade stay faded until the panel is back in place (letting them go earlier made them flash
    // back for a moment); then everything is let go at once.
    var fades = [
      inner.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }),
      shade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: EASE, fill: 'forwards' })
    ];
    var a = panel.animate([frame(r1, radius(panel)), frame(r0, radius(to))], { duration: 340, easing: EASE, fill: 'forwards' });
    a.onfinish = function () {
      if (!isOpen) done();   // opened again meanwhile: leave it open
      a.cancel();
      fades.forEach(function (f) { f.cancel(); });
    };
  }

  // The panel grows to fit what lands in it, instead of jumping.
  function grow(change) {
    var h0 = panel.getBoundingClientRect().height;
    change();
    if (calm || phone.matches) return;
    var h1 = panel.getBoundingClientRect().height;
    if (Math.abs(h1 - h0) > 2) panel.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 380, easing: SPRING });
  }

  function setBusy(on) { busy = on; form.classList.toggle('lk-busy', on); }

  // The library's server answers (POST /search). Plain text, so the browser sends it without asking first; the
  // server answers this website only.
  function search(q) {
    // Give up after 30 seconds if the server stalls.
    var stop = window.AbortController ? new AbortController() : null;
    var timer = stop ? setTimeout(function () { stop.abort(); }, 30000) : 0;
    return fetch('https://mcp.christianopenlibrary.org/search', {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ q: q }),
      signal: stop ? stop.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.ok) return d;
        var e = new Error(String(r.status));
        e.say = typeof d.error === 'string' ? d.error : '';
        e.limit = typeof d.limit === 'string' ? d.limit : '';
        throw e;
      });
    });
  }

  function run(q) {
    q = (q || '').trim();
    if (!q || busy) return;
    lastQ = q;
    setBusy(true);
    search(q).then(function (d) { setBusy(false); render(d); buzz(); }, function (e) {
      setBusy(false);
      var say = e && e.say ? esc(e.say) : 'The search didn&rsquo;t answer. Try again in a moment.';
      grow(function () { body.innerHTML = '<p class="lk-msg">' + say + '</p>'; });
    });
  }

  // Syriac, Hebrew and Arabic read right to left. A passage is set that way only when most of its letters are in
  // those scripts (an English commentary that opens with a Hebrew word stays left to right), and is tagged with
  // its language so a screen reader uses the right voice.
  function textDir(t) {
    t = String(t || '');
    // letters only, not the vowel points
    var syr = (t.match(/[\u0710-\u072F\u074D-\u074F]/g) || []).length, heb = (t.match(/[\u05D0-\u05EA]/g) || []).length,
      ara = (t.match(/[\u0620-\u064A\u0671-\u06D3]/g) || []).length;
    var ltr = (t.match(/[A-Za-z\u00C0-\u024F\u0386-\u03FF\u1F00-\u1FFF\u0400-\u04FF]/g) || []).length;
    var rtl = syr + heb + ara;
    if (rtl <= ltr) return ' dir="ltr"';
    return ' dir="rtl" lang="' + (syr >= heb && syr >= ara ? 'syr' : heb >= ara ? 'he' : 'ar') + '"';
  }

  // A passage reads like a page of the book: the words, then who wrote it and where to see it.
  function passage(h) {
    // Some sources give the address followed by a list of files: link the address only.
    var link = String(h.link || '').trim().split(/\s/)[0];
    var text = esc(h.text).replace(/\[\[/g, '<mark>').replace(/\]\]/g, '</mark>').replace(/\*(.+?)\*/g, '<i>$1</i>');
    var where = ['<cite>' + esc(h.title) + '</cite>'];
    if (h.year) where.push(esc(h.year));
    if (h.page) where.push(esc(h.page));
    var a = el('article', 'lk-hit');
    a.innerHTML =
      '<blockquote class="lk-text"' + textDir(h.text) + '>' + (h.cut_start ? '&hellip;' : '') + text + (h.cut_end && !/[.?!"”]$/.test(h.text) ? '&hellip;' : '') + '</blockquote>' +
      '<div class="lk-cite">' +
        '<p><span class="lk-who">' + esc(h.author) + '</span>' + (h.dates ? ' <span class="lk-dates">' + esc(h.dates) + '</span>' : '') +
        '<br><span class="lk-work">' + where.join(' · ') + '</span></p>' +
        '<div class="lk-acts"><span class="lk-ways"></span>' + (!/^https?:\/\//i.test(link) ? '' : '<a class="lk-icon lk-open-src" href="' + esc(link) + '" target="_blank" rel="noopener" title="' + (h.scan ? 'Open the scan' : 'Open the source') + '" aria-label="' + (h.scan ? 'Open the scan' : 'Open the source') + '">' + OPEN + '</a>') +
        '<button type="button" class="lk-icon lk-copy" title="Copy the quote and link" aria-label="Copy the quote and a link">' + LINK + '</button>' +
        '<button type="button" class="lk-icon lk-share" title="Share" aria-label="Share this passage" aria-expanded="false">' + SHARE + '</button></div>' +
      '</div>';
    a.querySelector('.lk-share').addEventListener('click', function () { share(a, this, h); });
    a.querySelector('.lk-copy').addEventListener('click', function () { copyIt(this, h); });
    return a;
  }

  // Share: on a phone, the phone's own share sheet (messages, mail, Facebook, X...). Elsewhere the share icon turns
  // into a close mark and the ways to share spring out beside it. What is shared is the book's own words with the
  // book named, and a link back to this search.
  var sharing = null;
  function unshare() {
    if (!sharing) return;
    sharing.card.classList.remove('lk-sharing');
    sharing.btn.innerHTML = SHARE;
    sharing.btn.setAttribute('aria-expanded', 'false');
    sharing.btn.setAttribute('aria-label', 'Share this passage');
    sharing = null;
  }
  function shareText(h) {
    var m = String(h.text).match(/\[\[(.+?)\]\]/);
    var words = (m ? m[1] : h.text).replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    var where = h.title + ' (' + (h.year || '') + (h.page ? ', ' + h.page : '') + ')';
    return { quote: '“' + words + '”', cite: h.author + ', ' + where };
  }
  function linkTo(h) { return location.href.split('#')[0] + '#q=' + encodeURIComponent(lastQ) + '&p=' + encodeURIComponent(h.ref || ''); }
  function copyIt(btn, h) {
    var t = shareText(h);
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(t.quote + '\n' + t.cite + '\n' + linkTo(h)).then(function () {
      btn.innerHTML = DONE; btn.classList.add('lk-ok'); buzz();
      setTimeout(function () { btn.innerHTML = LINK; btn.classList.remove('lk-ok'); }, 1800);
    }, function () {});
  }
  function share(card, btn, h) {
    var url = location.href.split('#')[0] + '#q=' + encodeURIComponent(lastQ) + '&p=' + encodeURIComponent(h.ref || '');
    var t = shareText(h), text = t.quote + '\n' + t.cite;
    if (navigator.share && phone.matches) { buzz(); navigator.share({ text: text, url: url }).catch(function () {}); return; }
    if (sharing && sharing.card === card) { unshare(); return; }
    unshare();
    var ways = card.querySelector('.lk-ways');
    var post = text.length > 230 ? t.quote.slice(0, 200).replace(/\s+\S*$/, '') + '…”\n' + t.cite : text;
    ways.innerHTML =
      '<a class="lk-icon" target="_blank" rel="noopener" title="Post on X" aria-label="Post on X" href="https://x.com/intent/post?text=' + encodeURIComponent(post) + '&url=' + encodeURIComponent(url) + '">' + XLOGO + '</a>' +
      '<a class="lk-icon" target="_blank" rel="noopener" title="Share on Facebook" aria-label="Share on Facebook" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '">' + FB + '</a>' +
      '<a class="lk-icon" title="Email" aria-label="Email" href="mailto:?subject=' + encodeURIComponent(h.author + ', ' + h.title) + '&body=' + encodeURIComponent(text + '\n\n' + url) + '">' + MAIL + '</a>';
    card.classList.add('lk-sharing');
    btn.innerHTML = CLOSE;
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'Close sharing');
    sharing = { card: card, btn: btn };
    buzz();
  }
  document.addEventListener('click', function (e) { if (sharing && document.contains(e.target) && !sharing.card.contains(e.target)) unshare(); });

  function render(d) {
    grow(function () {
      body.innerHTML = '';
      if (d.note) body.appendChild(el('p', 'lk-note', esc(d.note)));
      if (!d.hits || !d.hits.length) {
        body.appendChild(el('p', 'lk-msg', d.message ? esc(d.message) : 'Nothing in the books for that. Try other words.'));
        if (d.try) {
          var ul = el('ul', 'lk-try');
          d.try.forEach(function (t) {
            var li = el('li'), b = el('button', null, esc(t));
            b.type = 'button';
            b.addEventListener("click", function () { input.value = t; has(form, input); run(t); });
            li.appendChild(b); ul.appendChild(li);
          });
          body.appendChild(ul);
        }
        if (!document.body.classList.contains('page-browse'))
          body.appendChild(el('p', 'lk-next', 'Or look for an author or title in <a href="browse.html?q=' + encodeURIComponent(lastQ) + '">Browse</a>.'));
        return;
      }
      var list = el('div', 'lk-hits');
      d.hits.forEach(function (h) { list.appendChild(passage(h)); });
      body.appendChild(list);
      body.appendChild(el('p', 'lk-next', 'Ask your AI app, with these books behind it. <a href="setup.html">Set it up</a>'));
    });
    body.scrollTop = 0;
    var hits = body.querySelectorAll('.lk-hit');
    hits.forEach(function (a, i) {
      var sweep = function () { a.classList.add('lk-swept'); };
      if (calm) { sweep(); return; }
      var an = a.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 460, delay: 60 + i * 70, easing: SPRING, fill: 'backwards' });
      an.onfinish = sweep;
    });
  }

  // Wiring
  launch.addEventListener('click', function () { buzz(); open(); });
  closeBtn.addEventListener('click', function () { close(); });
  shade.addEventListener('click', function () { close(); });
  // As soon as there is something to search, the arrow springs up; it settles back if the box is cleared.
  function has(f, i) { f.classList.toggle('lk-has', i.value.trim() !== ''); }
  input.addEventListener('input', function () { has(form, input); });
  if (heroInput) heroInput.addEventListener('input', function () { has(hero, heroInput); });
  form.addEventListener('submit', function (e) { e.preventDefault(); input.blur(); run(input.value); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !phone.matches) { e.preventDefault(); run(input.value); } });
  window.addEventListener('popstate', function () { if (isOpen) close(true); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sharing) { unshare(); return; }
    if (e.key === 'Escape' && isOpen) { e.preventDefault(); close(); return; }
    // While the panel is open, Tab goes round inside it (the page behind is covered).
    if (e.key === 'Tab' && isOpen) {
      var f = Array.prototype.filter.call(panel.querySelectorAll('a[href], button, input'), function (n) { return n.offsetParent !== null && !n.disabled; });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
    }
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
    if (!isOpen && ((e.key === '/' && !typing && !own) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)))) { e.preventDefault(); open(); }
  });
  if (hero) hero.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = heroInput.value.trim();
    if (!q) { heroInput.focus(); return; }
    buzz(); open(q); run(q);
  });

  // Home page: the big box and the launcher are the same thing. When the box scrolls away it drops into the
  // corner; scroll back up and it flies back.
  if (hero) {
    var first = true;
    // The box in flight follows where both ends are on every frame, so it lands exactly on the box even while the
    // page is still scrolling. It carries the words, the arrow and the colours of both ends and blends them, so
    // when the real one takes its place in the same frame nothing appears, vanishes or jumps.
    var glide = bezier(.25, .85, .3, 1), flight = 0, cur = null;
    var gText = ghost.querySelector('.lk-gt'), gHead = ghost.querySelector('.lk-gt-a'), gTail = ghost.querySelector('.lk-gt-b');
    var gGo = ghost.querySelector('.lk-gg'), gIcon = ghost.querySelector('svg'), gKey = ghost.querySelector('.lk-gk');
    var heroGo = hero.querySelector('.lk-go'), launchText = launch.querySelector('.lk-launch-text'), launchKey = launch.querySelector('kbd');
    var px = function (v) { return parseFloat(v) || 0; };
    var scaleOf = function (t) { var m = /matrix\(([^,]+),\s*([^,]+)/.exec(t); return m ? Math.hypot(px(m[1]), px(m[2])) : 1; };
    var lineOf = function (cs) { return px(cs.borderTopWidth) ? cs.borderTopColor : cs.backgroundColor; };
    // Everything the box looks like at one end, read from the page so phone, computer and dark mode all match.
    var look = function (e) {
      var r = e.getBoundingClientRect(), cs = getComputedStyle(e), icon = px(getComputedStyle(e.querySelector('svg')).width);
      var shadow = phone.matches ? [10, 26, -8, .45] : [12, 32, -12, .28];
      var o = { top: r.top, left: r.left, width: r.width, height: r.height, rad: Math.min(px(cs.borderTopLeftRadius), r.height / 2),
        bg: cs.backgroundColor, line: lineOf(cs), fg: cs.color, icon: icon, gap: px(cs.columnGap) };
      if (e === hero) {
        var is = getComputedStyle(heroInput), gs = getComputedStyle(heroGo), typed = heroInput.value !== '';
        o.pad = px(cs.paddingLeft); o.indent = px(is.paddingLeft); o.fs = px(is.fontSize); o.fw = 400;
        o.ink = typed ? is.color : getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || is.color;
        o.head = typed ? 1 : .85; o.tail = typed ? 0 : .85; o.go = px(gs.opacity); o.goScale = scaleOf(gs.transform);
        o.goSize = heroGo.getBoundingClientRect().width; o.goRight = px(cs.paddingRight); o.shadow = [10, 30, -18, .3]; o.key = 0;
      } else {
        var ls = getComputedStyle(launchText), shown = ls.display !== 'none';
        o.pad = shown ? px(cs.paddingLeft) : (r.width - icon) / 2; o.indent = 0; o.fs = px(ls.fontSize); o.fw = 500; o.ink = cs.color;
        o.head = shown ? 1 : 0; o.tail = 0; o.go = 0; o.goScale = .4; o.goSize = phone.matches ? 40 : 43; o.goRight = 7; o.shadow = shadow;
        o.key = getComputedStyle(launchKey).display === 'none' ? 0 : 1;
      }
      return o;
    };
    var blend = function (a, b, k) {
      var m = function (x, y) { return x + (y - x) * k; }, c = function (x, y) { return x === y ? x : 'color-mix(in srgb, ' + x + ' ' + (100 - k * 100).toFixed(1) + '%, ' + y + ')'; };
      var o = {};
      ['top', 'left', 'width', 'height', 'rad', 'icon', 'gap', 'pad', 'indent', 'fs', 'fw', 'head', 'tail', 'go', 'goScale', 'goSize', 'goRight', 'key'].forEach(function (n) { o[n] = m(a[n], b[n]); });
      ['bg', 'line', 'fg', 'ink'].forEach(function (n) { o[n] = c(a[n], b[n]); });
      o.shadow = a.shadow.map(function (v, i) { return m(v, b.shadow[i]); });
      return o;
    };
    var place = function (o) {
      var g = ghost.style, s = o.shadow;
      g.top = o.top + 'px'; g.left = o.left + 'px'; g.width = o.width + 'px'; g.height = o.height + 'px'; g.borderRadius = Math.max(0, o.rad) + 'px';
      g.background = o.bg; g.borderColor = o.line; g.color = o.fg; g.paddingLeft = o.pad + 'px'; g.gap = o.gap + 'px';
      g.boxShadow = '0 1px 2px rgba(0, 0, 0, .05), 0 ' + s[0] + 'px ' + s[1] + 'px ' + s[2] + 'px rgba(0, 0, 0, ' + s[3].toFixed(3) + ')';
      gIcon.style.width = gIcon.style.height = o.icon + 'px';
      gText.style.paddingLeft = o.indent + 'px'; gText.style.fontSize = o.fs + 'px'; gText.style.fontWeight = Math.round(o.fw); gText.style.color = o.ink;
      gHead.style.opacity = Math.max(0, Math.min(1, o.head)); gTail.style.opacity = Math.max(0, Math.min(1, o.tail));
      gKey.style.opacity = Math.max(0, Math.min(1, o.key * o.key));
      var gg = gGo.style;
      gg.width = gg.height = o.goSize + 'px'; gg.right = o.goRight + 'px'; gg.opacity = Math.max(0, Math.min(1, o.go)); gg.transform = 'translateY(-50%) scale(' + o.goScale + ')';
    };
    var settle = function (e, cls) { e.style.transition = 'none'; e.classList.remove(cls); void e.offsetWidth; e.style.transition = ''; };
    var fly = function (from, to, after) {
      var start = flight && cur ? cur : null;   // turned round mid-flight: start from where the box is now
      if (flight) cancelAnimationFrame(flight);
      flight = 0;
      if (calm) { ghost.classList.remove('lk-flying'); after(); return; }
      var typed = heroInput.value;
      gHead.textContent = typed || 'Search the library';
      gTail.textContent = typed ? '' : heroInput.placeholder.replace(/^Search the library/, '');
      var t0 = performance.now(), dur = 460, a0 = start || look(from);
      var step = function (now) {
        var t = Math.min(1, (now - t0) / dur);
        // The far end moves with the page, so it is read again on every frame; the near end stays where it was.
        cur = blend(a0, look(to), glide(t));
        place(cur);
        if (t < 1) { flight = requestAnimationFrame(step); return; }
        flight = 0; cur = null;
        after();
        ghost.classList.remove('lk-flying');
      };
      step(t0);   // placed before it is shown, so it never appears where the last flight left it
      ghost.classList.add('lk-flying');
    };
    // The home page's dark band holds the set-up box: the launcher stays out of the way while the band is on
    // screen (on a phone it would sit on the copy button), and comes in once the band has gone.
    var band = document.querySelector('.hero');
    if (band) new IntersectionObserver(function (es) {
      launch.classList.toggle('lk-band', es[es.length - 1].isIntersecting);
    }, { rootMargin: '-56px 0px 0px 0px' }).observe(band);
    new IntersectionObserver(function (es) {
      var seen = es[es.length - 1].isIntersecting;
      if (first) { first = false; launch.classList.toggle('lk-here', !seen); return; }
      // While the launcher is out of the way there is nothing to fly from or to.
      if (isOpen || launch.classList.contains('lk-band')) { launch.classList.toggle('lk-here', !seen); return; }
      if (!seen && !launch.classList.contains('lk-here')) {
        launch.classList.add('lk-here', 'lk-wait');
        hero.classList.add('lk-wait');
        fly(hero, launch, function () { settle(launch, 'lk-wait'); settle(hero, 'lk-wait'); });
      } else if (seen && launch.classList.contains('lk-here')) {
        launch.classList.add('lk-wait');
        launch.classList.remove('lk-here');
        hero.classList.add('lk-wait');
        fly(launch, hero, function () { settle(hero, 'lk-wait'); settle(launch, 'lk-wait'); });
      }
    }, { rootMargin: '-56px 0px 0px 0px' }).observe(hero);
  } else {
    launch.classList.add('lk-here');
  }

  // Other pages can open the panel from their own button, with words already in it (the browse page does).
  // Such a page keeps "/" for its own box and hides the floating launcher.
  var own = document.body.classList.contains('page-browse');
  window.bookSearch = function (q, el) { q = (q || '').trim(); buzz(); open(q, el); if (q) run(q); };
  // The browse page shows passages on the page itself as you type: it asks through here, and builds each passage
  // the way the panel does (share and copy included).
  window.bookSearch.find = function (q) { lastQ = q; return search(q); };
  window.bookSearch.passage = passage;

  // A shared link opens the search it was made from.
  // Inside another site's frame, or in a window another page opened, it waits for a click: otherwise a page could
  // make its visitors run searches against their own daily limit.
  var m = location.hash.match(/^#q=([^&]+)/);
  if (m) {
    var q0 = '';
    try { q0 = decodeURIComponent(m[1]).slice(0, 500); } catch (e) { q0 = ''; }
    var sent = false;
    try { sent = window.top !== window.self || !!window.opener; } catch (e) { sent = true; }
    if (q0) { open(q0); if (!sent) run(q0); }
  }
})();
