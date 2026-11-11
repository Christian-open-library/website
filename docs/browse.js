// Browse page: loads catalog.json (served from this site), then searches, filters
// and lists it in the browser. Nothing is sent anywhere.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var input = $('q'), sortSel = $('sort'), typeSel = $('type'), periodSel = $('period');
  var resetBtn = $('reset'), list = $('works'), count = $('count'), more = $('more'), az = $('az');
  var PAGE = 400;
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat('#');
  var TYPES = { book: 'Books', commentary: 'Commentaries', creed: 'Creeds', confession: 'Confessions', catechism: 'Catechisms', hymnal: 'Hymnals' };
  var PERIODS = [
    ['early', 'Before 1500', function (y) { return y < 1500; }],
    ['1500', '1500s', function (y) { return y >= 1500 && y < 1600; }],
    ['1600', '1600s', function (y) { return y >= 1600 && y < 1700; }],
    ['1700', '1700s', function (y) { return y >= 1700 && y < 1800; }],
    ['1800', '1800s', function (y) { return y >= 1800 && y < 1900; }],
    ['1900', '1900s', function (y) { return y >= 1900; }],
    ['none', 'No year', null]
  ];
  var works = [], keys = [], years = [], surnames = [];
  var matches = [], items = [], shown = 0, words = [];

  // ---------- text matching ----------
  // Lower case, no accents, and the usual old-spelling variants folded together:
  // vv = w, v = u, j = i, doubled letters single, and a final e dropped.
  function fold(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9Ͱ-Ͽ֐-׿]+/g, ' ')
      .replace(/vv/g, 'w').replace(/v/g, 'u').replace(/j/g, 'i')
      .replace(/([a-z])\1+/g, '$1')
      .replace(/(\w{3,})e\b/g, '$1');
  }
  function num(n) { return n.toLocaleString('en-US'); }
  function initial(s) {
    var c = s.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
    return c >= 'A' && c <= 'Z' ? c : '#';
  }
  // The catalog sorts authors by last name, ignoring brackets and Jr/Sr (books repo tools/build_catalog.py).
  function surnameLetter(author) {
    var toks = author.replace(/\(.*?\)/g, '').replace(/\b(Jr|Sr)\.?$/, '').trim().split(/\s+/);
    return initial(toks.length ? toks[toks.length - 1] : '');
  }
  function letterOf(i) { return sortSel.value === 'title' ? initial(works[i][1].replace(/^(the|a|an)\s+/i, '')) : surnames[i]; }
  function periodOf(i) {
    var y = years[i];
    for (var k = 0; k < PERIODS.length; k++) {
      if (PERIODS[k][2] === null ? isNaN(y) : (!isNaN(y) && PERIODS[k][2](y))) return PERIODS[k][0];
    }
    return 'none';
  }

  // Wrap the words that matched in <mark>, by folding each word of the text.
  function highlighted(text) {
    var frag = document.createDocumentFragment();
    if (!words.length) { frag.appendChild(document.createTextNode(text)); return frag; }
    var parts = text.split(/(\s+)/);
    parts.forEach(function (part) {
      var f = fold(part).trim();
      var hit = f && words.some(function (w) { return f.indexOf(w) >= 0; });
      if (hit) { var m = document.createElement('mark'); m.textContent = part; frag.appendChild(m); }
      else frag.appendChild(document.createTextNode(part));
    });
    return frag;
  }

  // ---------- rendering ----------
  function cell(cls, content) {
    var s = document.createElement('span');
    s.className = cls;
    if (typeof content === 'string') s.textContent = content; else s.appendChild(content);
    return s;
  }
  function row(i) {
    var w = works[i];
    var li = document.createElement('li');
    var title = w[1] + (w[3] && w[3] !== 'book' ? ' (' + w[3] + ')' : '');
    var t = cell('w-title', highlighted(title));
    t.title = title;
    li.appendChild(t);
    li.appendChild(cell('w-author', highlighted(w[0] || 'Unknown author')));
    li.appendChild(cell('w-year', w[2] || '–'));
    return li;
  }
  function header(L) {
    var li = document.createElement('li');
    li.className = 'letter';
    li.id = 'letter-' + (L === '#' ? 'other' : L);
    li.textContent = L === '#' ? 'Other' : L;
    return li;
  }
  function showMore() {
    var frag = document.createDocumentFragment();
    var end = Math.min(shown + PAGE, items.length);
    for (var k = shown; k < end; k++) {
      var it = items[k];
      frag.appendChild(typeof it === 'string' ? header(it) : row(it));
    }
    list.appendChild(frag);
    shown = end;
    more.hidden = shown >= items.length;
    more.textContent = 'Show more (' + num(items.length - shown) + ' left)';
  }

  // ---------- filtering ----------
  function sorted(arr) {
    var mode = sortSel.value;
    if (mode === 'author') return arr;
    var copy = arr.slice();
    if (mode === 'title') {
      var key = function (i) { return works[i][1].replace(/^(the|a|an)\s+/i, ''); };
      copy.sort(function (a, b) { return key(a).localeCompare(key(b)); });
    } else {
      var dir = mode === 'year' ? 1 : -1;
      copy.sort(function (a, b) {
        var ya = years[a], yb = years[b];
        if (isNaN(ya) && isNaN(yb)) return 0;
        if (isNaN(ya)) return 1;
        if (isNaN(yb)) return -1;
        return (ya - yb) * dir;
      });
    }
    return copy;
  }
  function textMatches() {
    var hits = [];
    for (var i = 0; i < works.length; i++) {
      var k = keys[i], ok = true;
      for (var j = 0; j < words.length; j++) { if (k.indexOf(words[j]) < 0) { ok = false; break; } }
      if (ok) hits.push(i);
    }
    return hits;
  }
  // Counts beside each choice, so a choice never leads to an empty list.
  function refreshCounts(hits) {
    var t = typeSel.value, pd = periodSel.value, tc = {}, pc = {};
    hits.forEach(function (i) {
      if (!pd || periodOf(i) === pd) tc[works[i][3]] = (tc[works[i][3]] || 0) + 1;
      if (!t || works[i][3] === t) pc[periodOf(i)] = (pc[periodOf(i)] || 0) + 1;
    });
    Array.prototype.forEach.call(typeSel.options, function (o) {
      if (!o.value) return;
      o.textContent = TYPES[o.value] + ' (' + num(tc[o.value] || 0) + ')';
      o.disabled = !tc[o.value] && o.value !== t;
    });
    Array.prototype.forEach.call(periodSel.options, function (o) {
      if (!o.value) return;
      var label = PERIODS.filter(function (p) { return p[0] === o.value; })[0][1];
      o.textContent = label + ' (' + num(pc[o.value] || 0) + ')';
      o.disabled = !pc[o.value] && o.value !== pd;
    });
  }

  function update(keepScroll) {
    words = fold(input.value).split(/\s+/).filter(Boolean);
    var hits = textMatches();
    refreshCounts(hits);
    var t = typeSel.value, pd = periodSel.value;
    matches = sorted(hits.filter(function (i) { return (!t || works[i][3] === t) && (!pd || periodOf(i) === pd); }));
    var grouped = sortSel.value === 'author' || sortSel.value === 'title';
    items = [];
    var last = null;
    matches.forEach(function (i) {
      if (grouped) {
        var L = letterOf(i);
        if (L !== last) { items.push(L); last = L; }
      }
      items.push(i);
    });
    list.textContent = '';
    shown = 0;
    var filtered = words.length || t || pd;
    resetBtn.hidden = !filtered;
    if (!filtered) count.textContent = num(works.length) + ' works';
    else if (!matches.length) count.textContent = 'No works match.';
    else count.textContent = num(matches.length) + ' of ' + num(works.length) + ' works';
    $('empty').hidden = matches.length > 0;
    showMore();
    buildIndex();
    saveState();
    var barEl = document.querySelector('.finder-bar');
    document.documentElement.style.setProperty('--pinned', (parseFloat(getComputedStyle(barEl).top) + barEl.offsetHeight) + 'px');
    if (!keepScroll) {
      var top = document.querySelector('.finder-bar');
      if (window.scrollY > top.offsetTop) window.scrollTo(0, top.offsetTop);
    }
  }

  // ---------- A to Z bar ----------
  function buildIndex() {
    az.hidden = !(sortSel.value === 'author' || sortSel.value === 'title') || matches.length < 30;
    if (az.hidden) return;
    var have = {};
    items.forEach(function (it) { if (typeof it === 'string') have[it] = true; });
    az.textContent = '';
    LETTERS.forEach(function (L) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = L;
      b.dataset.letter = L;
      if (!have[L]) b.className = 'empty';
      b.setAttribute('aria-label', L === '#' ? 'Other' : L);
      az.appendChild(b);
    });
  }
  function jump(L) {
    var idx = -1;
    for (var k = LETTERS.indexOf(L); k < LETTERS.length && idx < 0; k++) idx = items.indexOf(LETTERS[k]);
    if (idx < 0) return;
    while (shown < Math.min(idx + 80, items.length)) showMore();
    var li = list.children[idx];
    if (!li) return;
    var barEl = document.querySelector('.finder-bar');
    var pinned = parseFloat(getComputedStyle(barEl).top) + barEl.offsetHeight;
    window.scrollTo(0, window.scrollY + li.getBoundingClientRect().top - pinned + 1);
  }
  var dragging = false;
  function letterAt(x, y) { var el = document.elementFromPoint(x, y); return el && el.dataset && el.dataset.letter; }
  az.addEventListener('pointerdown', function (e) {
    dragging = true;
    az.setPointerCapture(e.pointerId);
    var L = letterAt(e.clientX, e.clientY);
    if (L) jump(L);
    e.preventDefault();
  });
  az.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var r = az.getBoundingClientRect();
    var L = letterAt(r.left + r.width / 2, e.clientY);
    if (L && L !== az.dataset.last) { az.dataset.last = L; jump(L); }
  });
  function stopDrag() { dragging = false; delete az.dataset.last; }
  az.addEventListener('pointerup', stopDrag);
  az.addEventListener('pointercancel', stopDrag);
  az.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.letter) { e.preventDefault(); jump(e.target.dataset.letter); }
  });

  // ---------- address bar: the search can be shared, and Back works ----------
  function saveState() {
    var p = new URLSearchParams();
    if (input.value.trim()) p.set('q', input.value.trim());
    if (sortSel.value !== 'author') p.set('sort', sortSel.value);
    if (typeSel.value) p.set('type', typeSel.value);
    if (periodSel.value) p.set('period', periodSel.value);
    var qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }
  function loadState() {
    var p = new URLSearchParams(location.search);
    input.value = p.get('q') || '';
    if (p.get('sort')) sortSel.value = p.get('sort');
    if (p.get('type')) typeSel.value = p.get('type');
    if (p.get('period')) periodSel.value = p.get('period');
  }

  // ---------- events ----------
  var timer;
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { update(); }, 120); });
  [sortSel, typeSel, periodSel].forEach(function (s) { s.addEventListener('change', function () { update(); }); });
  resetBtn.addEventListener('click', function () { input.value = ''; typeSel.value = ''; periodSel.value = ''; update(); input.focus(); });
  $('empty-clear').addEventListener('click', function () { resetBtn.click(); });
  more.addEventListener('click', showMore);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { if (entries[0].isIntersecting && !more.hidden) showMore(); }, { rootMargin: '800px' }).observe(more);
  }
  list.addEventListener('click', function (e) {
    var li = e.target.closest('li');
    if (li && !li.classList.contains('letter')) li.classList.toggle('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  });

  // ---------- start ----------
  fetch('catalog.json').then(function (r) { return r.json(); }).then(function (data) {
    works = data.works;
    keys = works.map(function (w) { return ' ' + fold(w[0] + ' ' + w[1] + ' ' + w[2] + ' ' + w[3]); });
    years = works.map(function (w) { return parseInt(w[2], 10); });
    surnames = works.map(function (w) { return surnameLetter(w[0]); });
    var typesSeen = {};
    works.forEach(function (w) { typesSeen[w[3]] = true; });
    Object.keys(TYPES).forEach(function (k) { if (typesSeen[k]) { var o = document.createElement('option'); o.value = k; typeSel.appendChild(o); } });
    PERIODS.forEach(function (p) { var o = document.createElement('option'); o.value = p[0]; periodSel.appendChild(o); });
    loadState();
    update(true);
  }).catch(function () {
    count.textContent = 'The list could not be loaded. Try reloading the page.';
  });
})();
