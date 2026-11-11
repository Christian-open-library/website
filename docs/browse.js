// Browse page: loads catalog.json (served from this site) and filters it as you type.
(function () {
  var input = document.getElementById('q');
  var sortSel = document.getElementById('sort');
  var list = document.getElementById('works');
  var count = document.getElementById('count');
  var more = document.getElementById('more');
  var PAGE = 400;
  var az = document.getElementById('az');
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat('#');
  var works = [], keys = [], surnames = [], shown = 0, matches = [];

  function fold(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9Ͱ-Ͽ֐-׿ ]+/g, ' ');
  }
  function num(n) { return n.toLocaleString('en-US'); }

  function sorted(arr) {
    var mode = sortSel.value;
    if (mode === 'author') return arr;
    var copy = arr.slice();
    if (mode === 'title') copy.sort(function (a, b) { return works[a][1].localeCompare(works[b][1]); });
    if (mode === 'year' || mode === 'year-desc') {
      var dir = mode === 'year' ? 1 : -1;
      copy.sort(function (a, b) {
        var ya = parseInt(works[a][2], 10), yb = parseInt(works[b][2], 10);
        if (isNaN(ya) && isNaN(yb)) return 0;
        if (isNaN(ya)) return 1;
        if (isNaN(yb)) return -1;
        return (ya - yb) * dir;
      });
    }
    return copy;
  }

  function cell(cls, text) {
    var s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  }
  function row(w) {
    var li = document.createElement('li');
    var title = w[1] + (w[3] && w[3] !== 'book' ? ' (' + w[3] + ')' : '');
    var t = cell('w-title', title);
    t.title = title;
    li.appendChild(t);
    li.appendChild(cell('w-author', w[0] || 'Unknown author'));
    li.appendChild(cell('w-year', w[2] || '\u2013'));
    return li;
  }

  function showMore() {
    var frag = document.createDocumentFragment();
    var end = Math.min(shown + PAGE, matches.length);
    for (var i = shown; i < end; i++) frag.appendChild(row(works[matches[i]]));
    list.appendChild(frag);
    shown = end;
    more.hidden = shown >= matches.length;
    more.textContent = 'Show more (' + num(matches.length - shown) + ' left)';
  }

  // The catalog sorts authors by last name, ignoring brackets and Jr/Sr (books repo tools/build_catalog.py).
  function surnameLetter(author) {
    var toks = author.replace(/\(.*?\)/g, '').replace(/\b(Jr|Sr)\.?$/, '').trim().split(/\s+/);
    return initial(toks.length ? toks[toks.length - 1] : '');
  }
  function initial(s) {
    var c = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
    return c >= 'A' && c <= 'Z' ? c : '#';
  }
  function letterOf(i) { return sortSel.value === 'title' ? initial(works[i][1]) : surnames[i]; }

  function buildIndex() {
    var mode = sortSel.value;
    az.hidden = !(mode === 'author' || mode === 'title') || matches.length < 30;
    if (az.hidden) return;
    var have = {};
    for (var i = 0; i < matches.length; i++) have[letterOf(matches[i])] = true;
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
    var start = LETTERS.indexOf(L), idx = -1;
    for (var k = start; k < LETTERS.length && idx < 0; k++) {
      for (var i = 0; i < matches.length; i++) { if (letterOf(matches[i]) === LETTERS[k]) { idx = i; break; } }
    }
    if (idx < 0) return;
    while (shown < Math.min(idx + 80, matches.length)) showMore();
    var li = list.children[idx];
    if (!li) return;
    // Where the search bar sits once it is pinned under the header.
    var barEl = document.querySelector('.finder-bar');
    var pinned = parseFloat(getComputedStyle(barEl).top) + barEl.offsetHeight;
    window.scrollTo(0, window.scrollY + li.getBoundingClientRect().top - pinned - 2);
  }

  var dragging = false;
  function letterAt(x, y) {
    var el = document.elementFromPoint(x, y);
    return el && el.dataset && el.dataset.letter;
  }
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

  function update() {
    var words = fold(input.value).split(/\s+/).filter(Boolean);
    var hits = [];
    for (var i = 0; i < works.length; i++) {
      var k = keys[i], ok = true;
      for (var j = 0; j < words.length; j++) { if (k.indexOf(words[j]) < 0) { ok = false; break; } }
      if (ok) hits.push(i);
    }
    matches = sorted(hits);
    list.textContent = '';
    shown = 0;
    if (!words.length) count.textContent = num(works.length) + ' works';
    else if (!matches.length) count.textContent = 'Nothing in the list matches "' + input.value.trim() + '". Try a single distinctive word.';
    else count.textContent = num(matches.length) + ' of ' + num(works.length) + ' works match';
    showMore();
    buildIndex();
  }

  var timer;
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(update, 120); });
  sortSel.addEventListener('change', update);
  more.addEventListener('click', showMore);
  // Tap or click a book to see its whole title.
  list.addEventListener('click', function (e) {
    var li = e.target.closest('li');
    if (li) li.classList.toggle('open');
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !more.hidden) showMore();
    }, { rootMargin: '800px' }).observe(more);
  }

  fetch('catalog.json').then(function (r) { return r.json(); }).then(function (data) {
    works = data.works;
    keys = works.map(function (w) { return ' ' + fold(w[0] + ' ' + w[1] + ' ' + w[2] + ' ' + w[3]); });
    surnames = works.map(function (w) { return surnameLetter(w[0]); });
    var q = new URLSearchParams(location.search).get('q');
    if (q) input.value = q;
    update();
  }).catch(function () {
    count.textContent = 'The list could not be loaded. Try reloading the page.';
  });
})();
