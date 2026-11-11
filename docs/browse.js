// Browse page: loads catalog.json (served from this site) and filters it as you type.
(function () {
  var input = document.getElementById('q');
  var sortSel = document.getElementById('sort');
  var list = document.getElementById('works');
  var count = document.getElementById('count');
  var more = document.getElementById('more');
  var PAGE = 400;
  var works = [], keys = [], shown = 0, matches = [];

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
    var q = new URLSearchParams(location.search).get('q');
    if (q) input.value = q;
    update();
  }).catch(function () {
    count.textContent = 'The list could not be loaded. Try reloading the page.';
  });
})();
