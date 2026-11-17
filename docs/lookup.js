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
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function buzz() {
    if (calm) return;
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
        '<input id="lk-q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" maxlength="500" placeholder="' + HINT + '">' +
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
  var ghost = el('div', 'lk-ghost', MAG);
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
  function source() { return hero && !launch.classList.contains('lk-here') ? hero : launch; }

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

  // A passage reads like a page of the book: the words, then who wrote it and where to see it.
  function passage(h) {
    var text = esc(h.text).replace(/\[\[/g, '<mark>').replace(/\]\]/g, '</mark>').replace(/\*(.+?)\*/g, '<i>$1</i>');
    var where = ['<cite>' + esc(h.title) + '</cite>'];
    if (h.year) where.push(esc(h.year));
    if (h.page) where.push(esc(h.page));
    var a = el('article', 'lk-hit');
    a.innerHTML =
      '<blockquote class="lk-text">' + (h.cut_start ? '&hellip;' : '') + text + (h.cut_end && !/[.?!"”]$/.test(h.text) ? '&hellip;' : '') + '</blockquote>' +
      '<div class="lk-cite">' +
        '<p><span class="lk-who">' + esc(h.author) + '</span>' + (h.dates ? ' <span class="lk-dates">' + esc(h.dates) + '</span>' : '') +
        '<br><span class="lk-work">' + where.join(' · ') + '</span></p>' +
        '<div class="lk-acts"><span class="lk-ways"></span>' + (!/^https?:\/\//i.test(String(h.link || '')) ? '' : '<a class="lk-icon lk-open-src" href="' + esc(h.link) + '" target="_blank" rel="noopener" title="' + (h.scan ? 'Open the scan' : 'Open the source') + '" aria-label="' + (h.scan ? 'Open the scan' : 'Open the source') + '">' + OPEN + '</a>') +
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
    var fly = function (r0, rad0, r1, rad1, after) {
      if (calm) { after(); return; }
      ghost.classList.add('lk-flying');
      var a = ghost.animate([frame(r0, rad0), frame(r1, rad1)], { duration: 520, easing: SPRING });
      a.onfinish = a.oncancel = function () { ghost.classList.remove('lk-flying'); after(); };
    };
    new IntersectionObserver(function (es) {
      var seen = es[es.length - 1].isIntersecting;
      if (first) { first = false; launch.classList.toggle('lk-here', !seen); return; }
      if (isOpen) { launch.classList.toggle('lk-here', !seen); return; }
      if (!seen && !launch.classList.contains('lk-here')) {
        launch.classList.add('lk-here', 'lk-wait');
        var r1 = launch.getBoundingClientRect();
        fly(hero.getBoundingClientRect(), radius(hero), r1, radius(launch), function () { launch.classList.remove('lk-wait'); });
      } else if (seen && launch.classList.contains('lk-here')) {
        var r0 = launch.getBoundingClientRect(), rad = radius(launch);
        launch.classList.remove('lk-here');
        hero.classList.add('lk-wait');
        fly(r0, rad, hero.getBoundingClientRect(), radius(hero), function () { hero.classList.remove('lk-wait'); });
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
