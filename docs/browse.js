// Browse page: loads catalog.json (served from this site), then searches, filters
// and lists it in the browser. Nothing is sent anywhere.
// Sorted by author, the list reads like shelves: a letter, each author with their works under them. A work opens
// into a card in place (editions, full titles, where the text came from). Order and filters fold into one menu
// that grows out of the icon in the box.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var input = $('q'), toggle = $('opts-toggle'), bar = document.querySelector('.finder-bar'), menu = $('opts');
  var list = $('works'), count = $('count'), more = $('more'), az = $('az'), onChips = $('on-chips');
  var headEls = [], pinnedH = 0;
  var clearBtn = $('q-clear'), suggest = $('suggest'), cards = $('authors'), notice = $('notice'), inbooks = $('inbooks'), box = document.querySelector('.fd-box');
  var PAGE = 150;
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat('#');
  var TYPES = { book: 'Books', commentary: 'Commentaries', creed: 'Creeds', confession: 'Confessions', catechism: 'Catechisms', hymnal: 'Hymnals' };
  var KIND = { commentary: 'Commentary', creed: 'Creed', confession: 'Confession', catechism: 'Catechism', hymnal: 'Hymnal' };
  var SORTS = [['best', 'Best match'], ['author', 'By author'], ['title', 'By title'], ['year', 'Oldest'], ['year-desc', 'Newest']];
  var PERIODS = [
    ['early', 'Before 1500', function (y) { return y < 1500; }],
    ['1500', '1500s', function (y) { return y >= 1500 && y < 1600; }],
    ['1600', '1600s', function (y) { return y >= 1600 && y < 1700; }],
    ['1700', '1700s', function (y) { return y >= 1700 && y < 1800; }],
    ['1800', '1800s', function (y) { return y >= 1800 && y < 1900; }],
    ['1900', '1900s', function (y) { return y >= 1900; }],
    ['none', 'No year', null]
  ];
  var SPRING = 'cubic-bezier(.25, .9, .3, 1)', EASE = 'cubic-bezier(.22, .9, .25, 1)';
  var OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
  var BOOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/></svg>';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // works: one row of the catalog per edition. units: what the list shows, one per work, with
  // its editions (same author, kind and title) folded together.
  var works = [], authorNotes = {}, titlesVersion = '';
  var units = [];
  var authorCount = {}, authorKey = {}, surnameKey = {}, authorNames = [];
  var vocab = {}, vocabList = [];   // folded word -> { n, word }, for "did you mean"
  var matches = [], items = [], shown = 0, words = [], scores = null;
  var authorFilter = '', sortChosen = false, corrected = '';
  var sortV = 'author', typeV = '', periodV = '';

  // A light tap on phones that have one. Android: a short vibration (ms; longer is firmer). iPhone (Safari 18+): the
  // tick a switch gives when it flips; one hidden switch is kept and flipped, so a fast drag down the letters can
  // tick on every one without building anything. Nothing on computers.
  var tick = null;
  function buzz(ms) {
    if (calm) return;
    try {
      if (navigator.vibrate) { navigator.vibrate(ms || 8); return; }
      if (!matchMedia('(pointer: coarse)').matches) return;
      if (!tick) {
        tick = document.createElement('label');
        var sw = document.createElement('input');
        sw.type = 'checkbox'; sw.setAttribute('switch', ''); sw.tabIndex = -1;
        tick.setAttribute('aria-hidden', 'true');
        tick.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
        tick.appendChild(sw); document.body.appendChild(tick);
      }
      tick.click();
    } catch (e) { /* no tap */ }
  }

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
  // Every word of the query must begin a word of the text ("sin" finds "sinners", not "business").
  function has(key, w) { return key.indexOf(' ' + w) >= 0; }
  // A word names an author when it is a whole word of the name, or five letters or more of one:
  // "owen" and "spurg" name authors; "sin" does not name Elsie Singmaster.
  // The start of a well-represented author's surname counts too: "bax" names Richard Baxter.
  function names(author, w) {
    var k = authorKey[author];
    return k.indexOf(' ' + w + ' ') >= 0 || (w.length >= 5 && has(k, w)) ||
      (w.length >= 3 && authorCount[author] >= 5 && has(surnameKey[author], w));
  }
  function num(n) { return n.toLocaleString('en-US'); }
  function plural(n, one, many) { return num(n) + ' ' + (n === 1 ? one : many); }
  function initial(s) {
    var c = s.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
    return c >= 'A' && c <= 'Z' ? c : '#';
  }
  function noArticle(s) { return s.replace(/^(the|a|an)\s+/i, ''); }
  // The catalog sorts authors by last name, ignoring brackets and Jr/Sr (books repo tools/build_catalog.py).
  function surnameOf(author) {
    var toks = author.replace(/\(.*?\)/g, '').replace(/\b(Jr|Sr)\.?$/, '').trim().split(/\s+/);
    return toks.length ? toks[toks.length - 1] : '';
  }
  function shownTitle(i) { return works[i][6] || works[i][1]; }
  function letterOf(u) { return sortV === 'title' ? initial(units[u].titleNoArt) : units[u].letter; }
  function periodOfYear(y) {
    for (var k = 0; k < PERIODS.length; k++) {
      if (PERIODS[k][2] === null ? isNaN(y) : (!isNaN(y) && PERIODS[k][2](y))) return PERIODS[k][0];
    }
    return 'none';
  }

  // Wrap the words that matched in <mark>, by folding each word of the text.
  function highlighted(text, ws) {
    ws = ws || words;
    var frag = document.createDocumentFragment();
    if (!ws.length) { frag.appendChild(document.createTextNode(text)); return frag; }
    text.split(/(\s+)/).forEach(function (part) {
      var toks = fold(part).trim().split(' ');
      var hit = toks[0] && ws.some(function (w) { return toks.some(function (t) { return t.indexOf(w) === 0; }); });
      if (hit) { var m = document.createElement('mark'); m.textContent = part; frag.appendChild(m); }
      else frag.appendChild(document.createTextNode(part));
    });
    return frag;
  }

  // ---------- building the units ----------
  function addVocab(text) {
    text.split(/[^\wÀ-ɏ'-]+/).forEach(function (raw) {
      var w = raw.replace(/^['-]+|['-]+$/g, '').toLowerCase();
      if (w.length < 3 || /\d/.test(w)) return;
      var f = fold(w).trim();
      if (!f || f.indexOf(' ') >= 0) return;
      var v = vocab[f] || (vocab[f] = { n: 0, word: w });
      v.n++;
    });
  }
  function build(data) {
    works = data.works;
    authorNotes = data.authors || {};
    titlesVersion = data.titles || '';
    var byKey = {};
    works.forEach(function (w, i) {
      var t = shownTitle(i);
      var k = w[0] + '|' + w[3] + '|' + fold(noArticle(t.replace(/…$/, ''))).trim();
      var u = byKey[k];
      if (u === undefined) {
        u = byKey[k] = units.length;
        units.push({ ed: [], author: w[0] || 'Unknown author', title: t, type: w[3], years: [], periods: {} });
      }
      units[u].ed.push(i);
      addVocab(w[0] + ' ' + t + ' ' + w[1]);
    });
    vocabList = Object.keys(vocab);
    units.forEach(function (u) {
      var titles = u.ed.map(function (i) { return shownTitle(i) + ' ' + works[i][1]; }).join(' ');
      u.ed.forEach(function (i) {
        var y = parseInt(works[i][2], 10);
        u.years.push(y);
        u.periods[periodOfYear(y)] = true;
      });
      var ys = u.years.filter(function (y) { return !isNaN(y); });
      u.year = ys.length ? Math.min.apply(null, ys) : NaN;
      u.yearText = !ys.length ? '' : (Math.max.apply(null, ys) > u.year ? u.year + '+' : String(u.year));
      u.aKey = ' ' + fold(u.author) + ' ';
      u.tKey = ' ' + fold(titles) + ' ';
      u.key = u.aKey + u.tKey + ' ' + fold(u.ed.map(function (i) { return works[i][2]; }).join(' ') + ' ' + u.type) + ' ';
      u.surname = ' ' + fold(surnameOf(u.author));
      u.letter = initial(surnameOf(u.author));
      u.titleNoArt = noArticle(u.title);
      u.titleKey = ' ' + fold(u.titleNoArt) + ' ';
      authorCount[u.author] = (authorCount[u.author] || 0) + 1;
      authorKey[u.author] = u.aKey;
      surnameKey[u.author] = u.surname;
    });
    authorNames = Object.keys(authorCount);
  }

  // ---------- scoring ----------
  // Higher is better: the author's own books first, then titles that begin with or contain the words.
  function score(u, ws) {
    var s = 0, inAuthor = 0;
    ws.forEach(function (w) {
      if (names(u.author, w)) {
        inAuthor++; s += 30; if (has(u.surname, w)) s += 10;
      } else if (has(u.tKey, w) || has(u.aKey, w)) s += 10;
    });
    // An author's own books come in title order, those with more editions in the library (usually
    // the better known) a little ahead. Other matches: the words as a phrase, then the shorter title.
    if (inAuthor === ws.length) return s + 100 + Math.min(u.ed.length - 1, 3);
    var phrase = ' ' + ws.join(' ');
    if (u.titleKey.indexOf(phrase) === 0) s += 40;
    else if (ws.length > 1 && u.titleKey.indexOf(phrase) >= 0) s += 25;
    return s - Math.min(u.title.length, 200) / 50;
  }

  // ---------- "did you mean" ----------
  // Edit distance (a swap of neighbours counts as one), giving up once it passes max.
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev2 = [], prev = [], cur;
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      cur = [i];
      var best = i;
      for (j = 1; j <= b.length; j++) {
        var c = a[i - 1] === b[j - 1] ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < best) best = v;
      }
      if (best > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }
  function knownPrefix(w) {
    for (var k = 0; k < vocabList.length; k++) if (vocabList[k].indexOf(w) === 0) return true;
    return false;
  }
  // The query with each unknown word replaced by the nearest word in the list, or '' if none.
  // The first try leaves alone any word that begins a known word; the second (strict) try
  // only words that are known words ("mathew henri" -> "mathew henry").
  function correction(raw, strict) {
    var changed = false;
    var out = raw.trim().split(/\s+/).map(function (part) {
      var w = fold(part).trim();
      if (!w || w.indexOf(' ') >= 0 || w.length < 3 || (strict ? vocab[w] : knownPrefix(w))) return part;
      var max = w.length <= 4 ? 1 : 2, best = null, bestD = max + 1;
      vocabList.forEach(function (c) {
        if (c === w) return;
        var d = distance(w, c, bestD);
        if (d < bestD || (d === bestD && best && vocab[c].n > vocab[best].n)) { bestD = d; best = c; }
      });
      if (!best || bestD > max) return part;
      changed = true;
      return vocab[best].word;
    });
    return changed ? out.join(' ') : '';
  }
  // Last try: change one word at a time to a near, common word, keeping the change that finds
  // the most ("mathew henri": both are words, but no work has both).
  function correctionOne(raw) {
    var parts = raw.trim().split(/\s+/), best = '', bestN = 0;
    for (var k = 0; k < parts.length; k++) {
      var w = fold(parts[k]).trim();
      if (w.length < 3 || w.indexOf(' ') >= 0) continue;
      var max = w.length <= 4 ? 1 : 2;
      var near = vocabList.filter(function (c) { return c !== w && Math.abs(c.length - w.length) <= max && distance(w, c, max) <= max; })
        .sort(function (a, b) { return vocab[b].n - vocab[a].n; }).slice(0, 5);
      for (var j = 0; j < near.length; j++) {
        var tryParts = parts.slice();
        tryParts[k] = vocab[near[j]].word;
        var n = textMatches(fold(tryParts.join(' ')).split(/\s+/).filter(Boolean)).length;
        if (n > bestN) { bestN = n; best = tryParts.join(' '); }
      }
    }
    return best;
  }

  // ---------- rendering ----------
  function cell(cls, content) {
    var s = document.createElement('span');
    s.className = cls;
    if (typeof content === 'string') s.textContent = content; else s.appendChild(content);
    return s;
  }
  function shelves() { return sortV === 'author' && !authorFilter; }
  // A work: its title set like a book's, the year to the right, and under it (when the author isn't already the
  // shelf it sits on) who wrote it, its kind and how many editions.
  function row(ui) {
    var u = units[ui];
    var li = document.createElement('li');
    li.className = 'w';
    li.appendChild(cell('w-t', highlighted(u.title)));
    li.appendChild(cell('w-year', u.yearText || '–'));
    var by = document.createElement('span');
    by.className = 'w-by';
    var bits = [];
    if (!shelves() && !authorFilter) by.appendChild(cell('w-who-n', highlighted(u.author)));
    if (KIND[u.type] && !typeV) bits.push(KIND[u.type]);
    if (u.ed.length > 1) bits.push(u.ed.length + ' editions');
    if (bits.length) by.appendChild(document.createTextNode((by.firstChild ? ' · ' : '') + bits.join(' · ')));
    if (by.firstChild) li.appendChild(by);
    li.dataset.u = ui;
    li.tabIndex = -1;
    li.setAttribute('aria-expanded', 'false');
    return li;
  }
  function header(L) {
    var li = document.createElement('li');
    li.className = 'letter';
    li.id = 'letter-' + (L === '#' ? 'other' : L);
    li.dataset.l = L;
    li.textContent = L === '#' ? 'Other' : L;
    return li;
  }
  // The start of an author's shelf: the name (which shows only their works), their dates, how many works.
  function shelf(it) {
    var name = it.a, li = document.createElement('li');
    li.className = 'shelf';
    li.dataset.l = it.L;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sh-name';
    b.dataset.author = name;
    b.textContent = name;
    b.setAttribute('aria-label', name + ': show only these works');
    li.appendChild(b);
    var note = authorNotes[name];
    if (note && note[0]) li.appendChild(cell('sh-dates', note[0]));
    if (authorCount[name] > 1) li.appendChild(cell('sh-n', authorCount[name] + ' works'));
    return li;
  }
  // On one author's shelf the letters say nothing (they are all the author's), so they go.
  // The page keeps room for the rows still to come, so it has its full length from the start and the scrollbar
  // never jumps back. On computers the rest is then drawn in the background, a slice per idle moment. Phones draw
  // as they scroll (thousands of rows at once make a phone stutter), just ahead of the finger.
  // Watches the last row drawn; when it nears the screen, the next rows are drawn.
  var ahead = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    if (es[es.length - 1].isIntersecting && shown < items.length) showMore();
  }, { rootMargin: '2000px 0px' }) : null;
  var wide = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches, fillGen = 0;
  function fillRest() {
    if (!wide) return;
    var gen = ++fillGen, idle = window.requestIdleCallback || function (f) { return setTimeout(f, 30); };
    (function step() {
      if (gen !== fillGen || shown >= items.length) return;
      idle(function () { if (gen !== fillGen) return; showMore(1500); step(); }, { timeout: 200 });
    })();
  }
  function grouped() { return sortV === 'title' || (sortV === 'author' && !authorFilter); }
  // The height still to come: the rows, author names and letters left, each at the average height of those drawn.
  function rest() {
    var sum = { s: 0, o: 0, n: 0 }, cnt = { s: 0, o: 0, n: 0 }, left = { s: 0, o: 0, n: 0 };
    var kind = function (it) { return typeof it === 'string' ? 's' : typeof it === 'object' ? 'o' : 'n'; };
    var kids = list.children;
    for (var k = 0; k < kids.length && k < shown; k++) { var c = kind(items[k]); sum[c] += kids[k].offsetHeight; cnt[c]++; }
    for (k = shown; k < items.length; k++) left[kind(items[k])]++;
    return ['s', 'o', 'n'].reduce(function (h, c) { return h + left[c] * (cnt[c] ? sum[c] / cnt[c] : (cnt.n ? sum.n / cnt.n : 26)); }, 0);
  }
  function showMore(n) {
    var frag = document.createDocumentFragment();
    // A page at a time in every order: thousands of rows on the page make every scroll slow on phones. The A to Z
    // bar draws as far as its letter when it is used (jump), and more is drawn as the list nears its end.
    var end = Math.min(shown + (n || PAGE), items.length);
    for (var k = shown; k < end; k++) {
      var it = items[k];
      frag.appendChild(typeof it === 'string' ? header(it) : typeof it === 'object' ? shelf(it) : row(it));
    }
    list.appendChild(frag);
    headEls = Array.prototype.slice.call(list.querySelectorAll('li.letter'));
    shown = end;
    more.hidden = shown >= items.length;
    // Room is kept for the rows still to come, so the page has its full length from the start.
    list.style.paddingBottom = shown < items.length && shown ? Math.round(rest()) + 'px' : '';
    if (ahead && list.lastElementChild) { ahead.disconnect(); if (shown < items.length) ahead.observe(list.lastElementChild); }
    more.textContent = 'Show more (' + num(items.length - shown) + ' left)';
    var first = list.querySelector('li[data-u]');
    if (first && !list.querySelector('li[tabindex="0"]')) first.tabIndex = 0;
  }

  // Where each book's text came from, named for people rather than as a web address.
  var SOURCES = [
    [/quod\.lib\.umich\.edu/, 'EEBO-TCP', 'Read it at EEBO-TCP (University of Michigan)'],
    [/ccel\.org/, 'CCEL', 'Read it at the Christian Classics Ethereal Library'],
    [/archive\.org/, 'Internet Archive', 'See the scanned book at the Internet Archive'],
    [/gutenberg\.org/, 'Project Gutenberg', 'Read it at Project Gutenberg'],
    [/standardebooks\.org/, 'Standard Ebooks', 'Read it at Standard Ebooks'],
    [/wikisource\.org/, 'Wikisource', 'Read it at Wikisource'],
    [/sefaria\.org/, 'Sefaria', 'Read it at Sefaria'],
    [/romans45\.org|spurgeon/, 'Spurgeon Archive', 'Read it at the Spurgeon Archive'],
    [/docsouth\.unc\.edu/, 'DocSouth', 'Read it at DocSouth (UNC)'],
    [/crosswire\.org/, 'CrossWire', 'Source: The CrossWire Bible Society'],
    [/tertullian\.org/, 'Tertullian Project', 'Read it at the Tertullian Project'],
    [/github\.com\/OpenGreekAndLatin/, 'Open Greek and Latin', 'Read it at the Open Greek and Latin project (files on GitHub)'],
    [/github\.com\/PerseusDL/, 'Perseus', 'Read it at the Perseus Digital Library (files on GitHub)'],
    [/github\.com\/srophe/, 'Digital Syriac Corpus', 'Read it at the Digital Syriac Corpus (files on GitHub)'],
    [/github\.com\/textcreationpartnership/, 'Text Creation Partnership', 'Read it at the Text Creation Partnership (files on GitHub)'],
    [/github\.com|githubusercontent/, 'GitHub', 'Source file on GitHub (for the technically minded)']
  ];
  // [short name for the link, longer name for the tooltip and screen readers]
  function sourceLabel(url) {
    for (var k = 0; k < SOURCES.length; k++) if (SOURCES[k][0].test(url)) return [SOURCES[k][1], SOURCES[k][2]];
    var host = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    return [host, 'Source: ' + host];
  }

  // Full titles as printed are in titles.json, fetched the first time a book is opened.
  var fullTitles = null, fullWaiting = null;
  function loadFullTitles() {
    if (fullTitles || !titlesVersion) return Promise.resolve(fullTitles);
    if (!fullWaiting) {
      fullWaiting = fetch('titles.json?v=' + encodeURIComponent(titlesVersion)).then(function (r) { return r.json(); })
        .then(function (d) { if (d.version === titlesVersion) fullTitles = d.full; return fullTitles; })
        .catch(function () { fullWaiting = null; return null; });
    }
    return fullWaiting;
  }
  function edition(i, u, many) {
    var w = works[i], box = document.createElement('div');
    box.className = 'w-ed';
    if (many) box.appendChild(cell('w-ed-year', w[2] || 'No year'));
    var full = cell('w-full', '');
    var fill = function () {
      var t = (fullTitles && fullTitles[i]) || w[1];
      if (!many && t === u.title) t = '';
      full.textContent = t;
      full.hidden = !t;
    };
    fill();
    if (!fullTitles) loadFullTitles().then(fill);
    box.appendChild(full);
    var links = document.createElement('div');
    links.className = 'w-links';
    var src = String(w[4] || '').trim().split(/\s/)[0];   // the address only, without any file list after it
    if (/^https?:\/\//i.test(src)) {   // web links only, as lookup.js does
      var a = document.createElement('a');
      a.href = src;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'w-src';
      var lab = sourceLabel(src);
      a.innerHTML = OPEN;
      a.appendChild(document.createTextNode('Read at ' + lab[0]));
      a.title = lab[1];
      links.appendChild(a);
    }
    if (w[5]) links.appendChild(cell('w-lic', w[5]));
    box.appendChild(links);
    return box;
  }
  function details(ui) {
    var u = units[ui], box = document.createElement('div');
    box.className = 'w-more';
    var note = authorNotes[u.author];
    var who = document.createElement('p');
    who.className = 'w-who';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'w-auth';
    b.dataset.author = u.author;
    b.textContent = u.author;
    b.setAttribute('aria-label', u.author + ': show only these works');
    who.appendChild(b);
    if (note && note[0]) who.appendChild(cell('w-dates', note[0]));
    if (note && note[1]) who.appendChild(cell('w-note', note[1]));
    box.appendChild(who);
    var many = u.ed.length > 1;
    u.ed.slice().sort(function (a, b) { return (parseInt(works[a][2], 10) || 9999) - (parseInt(works[b][2], 10) || 9999); })
      .forEach(function (i) { box.appendChild(edition(i, u, many)); });
    return box;
  }

  // Opening a work turns its row into a card in place: the details rise in under the title and the rows below
  // glide down to make room (moved with transforms, so the long list is not laid out again on every frame).
  function toggleRow(li, open) {
    var was = li.classList.contains('open');
    if (open === undefined) open = !was;
    if (open === was) return;
    var still = calm || !li.animate, below = [], h0 = 0;
    if (!still) {
      // The rows below that are on screen; they all move by the same amount, so one measure is enough.
      var bottom = window.innerHeight;
      for (var n = li.nextElementSibling, k = 0; n && k < 30; n = n.nextElementSibling, k++) {
        below.push(n);
        if (n.getBoundingClientRect().top > bottom) break;
      }
      h0 = li.offsetHeight + parseFloat(getComputedStyle(li).marginTop) + parseFloat(getComputedStyle(li).marginBottom);
    }
    if (open && !li.querySelector('.w-more')) li.appendChild(details(+li.dataset.u));
    li.classList.toggle('open', open);
    li.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (still) return;
    var cs = getComputedStyle(li), d = h0 - (li.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom));
    if (Math.abs(d) > 1) below.forEach(function (n) {
      n.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: 280, easing: EASE });
    });
    if (open) {
      li.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 200, easing: EASE });
      li.querySelector('.w-more').animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, delay: 40, easing: EASE, fill: 'backwards' });
    }
  }

  // ---------- author cards ----------
  // Authors the words name ("owen"), or with loose set, whose names the words merely begin ("bax").
  function authorsMatching(ws, loose) {
    if (!ws.length || ws.join('').length < (loose ? 2 : 3)) return [];
    return authorNames.filter(function (a) {
      return ws.every(function (w) { return has(authorKey[a], w); }) && (loose || ws.some(function (w) { return names(a, w); }));
    }).sort(function (a, b) { return authorCount[b] - authorCount[a]; });
  }
  // An author the search names, as the front of their shelf: name, dates, who they were, how many works.
  // The arrow shows only their works; once on their shelf, the cross goes back to everyone.
  function card(name, on) {
    var box = document.createElement(on ? 'div' : 'button');
    box.className = 'author-card' + (on ? ' on' : '');
    if (!on) {
      box.type = 'button';
      box.setAttribute('aria-label', 'Show only the works of ' + name);
      box.addEventListener('click', function () { buzz(); setAuthor(name); });
    }
    var text = document.createElement('span');
    text.className = 'ac-text';
    var h = cell('ac-name', on ? document.createTextNode(name) : highlighted(name));
    var note = authorNotes[name];
    if (note && note[0]) h.appendChild(cell('ac-dates', note[0]));
    text.appendChild(h);
    text.appendChild(cell('ac-note', (note && note[1] ? note[1] + ' · ' : '') + plural(authorCount[name], 'work', 'works')));
    box.appendChild(text);
    if (on) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ac-btn';
      b.innerHTML = CLOSE;
      b.setAttribute('aria-label', 'Show all authors');
      b.title = 'Show all authors';
      b.addEventListener('click', function () { buzz(); setAuthor(''); });
      box.appendChild(b);
    } else {
      box.appendChild(cell('ac-btn', ''));
      box.lastChild.innerHTML = ARROW;
    }
    return box;
  }
  function showCards(ws) {
    cards.textContent = '';
    if (authorFilter) { cards.appendChild(card(authorFilter, true)); cards.hidden = false; return; }
    var found = authorsMatching(ws);
    // Only when the search clearly names someone: one, two or three authors, not "john".
    if (!found.length || found.length > 3) { cards.hidden = true; return; }
    found.slice(0, 2).forEach(function (a) { cards.appendChild(card(a, false)); });
    cards.hidden = false;
  }
  function setAuthor(name) {
    authorFilter = name;
    if (name) {
      // The words that found the author have done their work; keep only any that narrow the list.
      input.value = input.value.split(/\s+/).filter(function (p) {
        var w = fold(p).trim();
        return w && !has(authorKey[name], w);
      }).join(' ');
    }
    closeSuggest();
    update();
    scheduleBooks();
    if (!name) input.focus();
  }

  // ---------- filtering ----------
  function sorted(arr) {
    var mode = sortV;
    var copy = arr.slice();
    if (mode === 'best' && scores) {
      copy.sort(function (a, b) { return (scores[b] - scores[a]) || units[a].titleNoArt.localeCompare(units[b].titleNoArt); });
    } else if (mode === 'title') {
      copy.sort(function (a, b) { return units[a].titleNoArt.localeCompare(units[b].titleNoArt); });
    } else if (mode === 'year' || mode === 'year-desc') {
      var dir = mode === 'year' ? 1 : -1;
      copy.sort(function (a, b) {
        var ya = units[a].year, yb = units[b].year;
        if (isNaN(ya) && isNaN(yb)) return a - b;
        if (isNaN(ya)) return 1;
        if (isNaN(yb)) return -1;
        return ((ya - yb) * dir) || (a - b);
      });
    }
    return copy;
  }
  function textMatches(ws) {
    var hits = [];
    for (var u = 0; u < units.length; u++) {
      if (authorFilter && units[u].author !== authorFilter) continue;
      var k = units[u].key, ok = true;
      for (var j = 0; j < ws.length; j++) { if (!has(k, ws[j])) { ok = false; break; } }
      if (ok) hits.push(u);
    }
    return hits;
  }
  function inPeriod(u, pd) { return !pd || units[u].periods[pd]; }
  function defaultSort() { return words.length ? 'best' : 'author'; }

  // ---------- the menu: order, kind and period as chips ----------
  var chipsSort = $('c-sort'), chipsType = $('c-type'), chipsPeriod = $('c-period');
  function chip(label, n, on, off, act) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fd-chip' + (on ? ' on' : '');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = label;
    if (n != null) b.appendChild(cell('fd-chip-n', num(n)));
    b.disabled = !!off;
    b.addEventListener('click', function () { buzz(); act(); });
    return b;
  }
  // Counts beside each kind and period, so a choice never leads to an empty list.
  function drawMenu(hits) {
    var tc = {}, pc = {};
    hits.forEach(function (u) {
      if (inPeriod(u, periodV)) tc[units[u].type] = (tc[units[u].type] || 0) + 1;
      if (!typeV || units[u].type === typeV) Object.keys(units[u].periods).forEach(function (p) { pc[p] = (pc[p] || 0) + 1; });
    });
    chipsSort.textContent = '';
    SORTS.forEach(function (s) {
      if (s[0] === 'best' && !words.length) return;
      chipsSort.appendChild(chip(s[1], null, sortV === s[0], false, function () { sortV = s[0]; sortChosen = true; update(); }));
    });
    chipsType.textContent = '';
    Object.keys(TYPES).forEach(function (k) {
      if (!typesSeen[k]) return;
      chipsType.appendChild(chip(TYPES[k], tc[k] || 0, typeV === k, !tc[k] && typeV !== k, function () { typeV = typeV === k ? '' : k; update(); }));
    });
    chipsPeriod.textContent = '';
    PERIODS.forEach(function (p) {
      chipsPeriod.appendChild(chip(p[1], pc[p[0]] || 0, periodV === p[0], !pc[p[0]] && periodV !== p[0], function () { periodV = periodV === p[0] ? '' : p[0]; update(); }));
    });
    // Under the box, what is on, each with a cross to take it off.
    onChips.textContent = '';
    var on = [];
    if (typeV) on.push([TYPES[typeV], function () { typeV = ''; }]);
    if (periodV) on.push([PERIODS.filter(function (p) { return p[0] === periodV; })[0][1], function () { periodV = ''; }]);
    on.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'on-chip';
      b.textContent = o[0];
      b.insertAdjacentHTML('beforeend', CLOSE);
      b.setAttribute('aria-label', o[0] + ': take off');
      b.addEventListener('click', function () { buzz(); o[1](); update(); });
      onChips.appendChild(b);
    });
  }
  var menuOpen = false;
  function setMenu(open) {
    if (open === menuOpen) return;
    menuOpen = open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    bar.classList.toggle('open', open);
    if (open) {
      menu.hidden = false;
      if (!calm && menu.animate) {
        // It grows out of the icon.
        var r = toggle.getBoundingClientRect(), m = menu.getBoundingClientRect();
        menu.style.transformOrigin = (r.left + r.width / 2 - m.left) + 'px ' + (r.top + r.height / 2 - m.top) + 'px';
        menu.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE });
      }
    } else if (!calm && menu.animate) {
      var a = menu.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 140, easing: EASE });
      a.onfinish = function () { if (!menuOpen) menu.hidden = true; };
    } else menu.hidden = true;
  }
  toggle.addEventListener('click', function () { buzz(); setMenu(!menuOpen); });
  document.addEventListener('pointerdown', function (e) { if (menuOpen && !menu.contains(e.target) && !toggle.contains(e.target)) setMenu(false); });

  function update(keepScroll, typing) {
    words = fold(input.value).split(/\s+/).filter(Boolean);
    corrected = '';
    var hits = textMatches(words);
    // Nothing at all: try the nearest spelling of each unknown word ("spurgen" -> "spurgeon").
    if (!hits.length && words.length) {
      [false, true, 'one'].some(function (how) {
        var fix = how === 'one' ? correctionOne(input.value) : correction(input.value, how);
        if (!fix) return false;
        var fw = fold(fix).split(/\s+/).filter(Boolean), fh = textMatches(fw);
        if (fh.length) { corrected = fix; words = fw; hits = fh; }
        return fh.length > 0;
      });
    }
    // While searching, best matches come first unless another order was chosen.
    if (!words.length && sortV === 'best') { sortV = 'author'; sortChosen = false; }
    if (words.length && !sortChosen) sortV = 'best';
    clearBtn.hidden = !input.value;
    hasWords();

    scores = null;
    if (words.length) { scores = {}; hits.forEach(function (u) { scores[u] = score(units[u], words); }); }
    drawMenu(hits);
    matches = sorted(hits.filter(function (u) { return (!typeV || units[u].type === typeV) && inPeriod(u, periodV); }));
    items = [];
    var last = null, lastA = null, g = grouped(), sh = shelves();
    matches.forEach(function (u) {
      if (g) {
        var L = letterOf(u);
        if (L !== last) { items.push(L); last = L; lastA = null; }
      }
      if (sh && units[u].author !== lastA) { items.push({ a: units[u].author, L: last }); lastA = units[u].author; }
      items.push(u);
    });
    list.textContent = '';
    list.classList.remove('loading');
    list.classList.toggle('shelved', sh);
    list.removeAttribute('aria-busy');
    shown = 0;

    notice.textContent = '';
    if (corrected) {
      notice.appendChild(document.createTextNode('Nothing matches “' + input.value.trim() + '”. Showing '));
      var b = document.createElement('strong');
      b.textContent = corrected;
      notice.appendChild(b);
      notice.appendChild(document.createTextNode('. '));
      var use = document.createElement('button');
      use.type = 'button';
      use.className = 'linkish';
      use.textContent = 'Use this spelling';
      use.addEventListener('click', function () { input.value = corrected; update(); input.focus(); });
      notice.appendChild(use);
    }
    notice.hidden = !corrected;
    showCards(words);

    var filtered = words.length || typeV || periodV || authorFilter;
    var total = units.length;
    if (!filtered) count.textContent = plural(total, 'title', 'titles');
    else if (!matches.length) count.textContent = 'No titles match';
    else count.textContent = plural(matches.length, 'title', 'titles');
    // With no titles, words long enough are looked for in the books; the note shows only if they find nothing too.
    $('empty').hidden = matches.length > 0 || input.value.trim().length >= 3;
    showMore();
    fillRest();
    if (!keepScroll) settle(matches.slice(0, 8).join() + '|' + (authorFilter || ''), typing);
    buildIndex();
    saveState();
    setPinned();
    placeIndex();
    var active = (typeV ? 1 : 0) + (periodV ? 1 : 0) + (sortV !== defaultSort() ? 1 : 0);
    var n = toggle.querySelector('.opts-n');
    if (n.textContent !== String(active || '')) { n.textContent = active || ''; n.hidden = !active; }
    toggle.setAttribute('aria-label', active ? 'Order and filters, ' + active + ' on' : 'Order and filters');
    if (!keepScroll) {
      // If the list has been scrolled, go back to its top, just under the pinned search bar.
      var anchor = $('list-top').getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(bar).top);
      if (window.scrollY > anchor) window.scrollTo(0, anchor);
    }
  }

  // After a search or a filter, the first rows rise into place, one after another.
  var settled = null;
  // Not while typing: the list follows each letter at once, and moving rows would only flicker.
  function settle(sig, typing) {
    if (sig === settled) return;   // same rows as before: nothing moves
    settled = sig;
    if (typing || calm || !list.animate) return;
    var rows = Array.prototype.slice.call(cards.children).concat(Array.prototype.slice.call(list.children, 0, 10));
    rows.forEach(function (el, k) {
      el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, delay: Math.min(k, 8) * 15, easing: EASE, fill: 'backwards' });
    });
  }
  function pinnedHeight() { return parseFloat(getComputedStyle(bar).top) + bar.getBoundingClientRect().height; }
  // Edges are measured to the fraction of a pixel and overlap by one, so no hairline of the list shows between the bars.
  function setPinned() { var hd = document.querySelector('header.site'); if (hd) document.documentElement.style.setProperty('--head', (hd.getBoundingClientRect().height - 1) + 'px'); pinnedH = pinnedHeight(); document.documentElement.style.setProperty('--pinned', pinnedH + 'px'); }
  window.addEventListener('resize', setPinned);

  // ---------- the A to Z bar ----------
  // The letter you are in stays pinned under the box (the browser's own sticky headings, no script while scrolling).
  // The A to Z bar shows once the list reaches the box, so it never covers the page heading, and marks the same
  // letter, found with a few position reads (a binary search over the letter headings).
  var curL = null, scrollFrame = 0;
  function placeIndex() {
    var line = pinnedH + 2, lo = 0, hi = headEls.length - 1, at = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (headEls[mid].getBoundingClientRect().top <= line) { at = mid; lo = mid + 1; } else hi = mid - 1;
    }
    az.classList.toggle('on', list.getBoundingClientRect().top <= line);
    if (!az.hidden && !dragging) markLetter(at >= 0 ? headEls[at].dataset.l : (headEls[0] && headEls[0].dataset.l));
  }
  function markLetter(L) {
    if (L === curL) return;
    curL = L;
    Array.prototype.forEach.call(az.children, function (b) { b.classList.toggle('cur', b.dataset.letter === L); });
  }
  // A jump (dragging the scroll bar, the End key, a hard fling) can land past the rows drawn so far, where the
  // watcher on the last row never sees it: draw on until the rows reach the screen again.
  function catchUp() {
    for (var k = 0; k < 4 && shown < items.length; k++) {
      var last = list.lastElementChild;
      if (!last || last.getBoundingClientRect().bottom > innerHeight + 2000) return false;
      showMore(1500);
    }
    return shown < items.length && list.lastElementChild && list.lastElementChild.getBoundingClientRect().bottom < innerHeight + 2000;
  }
  window.addEventListener('scroll', function () {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(function step() {
      scrollFrame = 0;
      if (catchUp()) { scrollFrame = requestAnimationFrame(step); return; }
      placeIndex();
    });
  }, { passive: true });

  function buildIndex() {
    az.hidden = !grouped() || matches.length < 30;
    list.classList.toggle('no-az', az.hidden);
    if (az.hidden) return;
    var have = {};
    items.forEach(function (it) { if (typeof it === 'string') have[it] = true; });
    az.textContent = '';
    curL = null;
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
    var head = list.children[idx], first = list.children[idx + 1];
    if (!head || !first) return;
    // Letter headings stay pinned once scrolled past, so their place on screen says nothing about where they
    // sit in the list. Measure from the row under the heading instead.
    window.scrollTo(0, Math.max(0, window.scrollY + first.getBoundingClientRect().top - pinnedH - head.offsetHeight + 1));
    placeIndex();
  }
  // Tap or drag on the bar. Touch events are used on phones (Safari), pointer events elsewhere. Under the finger the
  // letters swell like a magnifier that follows it smoothly (the nearest most, its neighbours less), the big letter
  // in the middle rolls to the new one, and each letter that has authors gives a light tap.
  var bubble = document.createElement('div');
  bubble.className = 'az-bubble';
  bubble.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bubble);
  var bubbleTimer, lastL = null, lastY = null, frame = 0, pendingL = null, dragging = false;
  // The bar's layout, from the bar itself and the letters' offsets (which the magnifier's transforms don't move).
  function azRows() {
    var btns = az.children;
    if (!btns.length) return null;
    var h = btns[0].offsetHeight;
    return { btns: btns, top: az.getBoundingClientRect().top + az.clientTop + btns[0].offsetTop, h: h };
  }
  // The letter under a point on the bar, from its fixed layout (not from what is drawn there).
  function letterAtY(y) {
    var r = azRows();
    if (!r) return null;
    var k = Math.max(0, Math.min(r.btns.length - 1, Math.floor((y - r.top) / r.h)));
    return r.btns[k].dataset.letter;
  }
  // The magnifier: each letter swells and leans out by how close it is to the finger, on a smooth curve, and the
  // letters around it slide apart to make room (so the letter under the finger stays under it).
  var lensY = null, lensFrame = 0, LENS_C = 3.2, LENS_M = .75;
  function erf(x) {   // Abramowitz and Stegun 7.1.26, close enough for moving letters
    var t = 1 / (1 + .3275911 * Math.abs(x));
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x);
    return x < 0 ? -y : y;
  }
  function lens(y) {
    if (calm) return;
    lensY = y;
    if (lensFrame) return;
    lensFrame = requestAnimationFrame(function () {
      lensFrame = 0;
      var r = azRows();
      if (!r || lensY === null) return;
      for (var k = 0; k < r.btns.length; k++) {
        var e = (r.top + (k + .5) * r.h - lensY) / r.h;   // letters from the finger, + below
        var w = Math.exp(-e * e / LENS_C);
        var dy = LENS_M * Math.sqrt(Math.PI * LENS_C) / 2 * erf(e / Math.sqrt(LENS_C)) * r.h;
        r.btns[k].style.transform = 'translate(' + (-w * 1.1).toFixed(3) + 'rem, ' + dy.toFixed(1) + 'px) scale(' + (1 + w * LENS_M).toFixed(3) + ')';
      }
    });
  }
  function unlens() {
    lensY = null;
    if (lensFrame) { cancelAnimationFrame(lensFrame); lensFrame = 0; }
    Array.prototype.forEach.call(az.children, function (b) { b.style.transform = ''; });
  }
  var shownL = null;
  function show(L) {
    bubble.textContent = L === '#' ? '#' : L;
    bubble.classList.add('show');
    // The big letter rolls in from the side the finger came from, like a counter turning.
    var dir = shownL ? (LETTERS.indexOf(L) > LETTERS.indexOf(shownL) ? 1 : -1) : 0;
    var same = L === shownL;
    shownL = L;
    if (!same && !calm && bubble.animate) bubble.animate(dir
      ? [{ transform: 'translate(-50%, calc(-50% + ' + (dir * 14) + 'px)) scale(.96)', opacity: .5 }, { transform: 'translate(-50%, -50%)', opacity: .95 }]
      : [{ transform: 'translate(-50%, -50%) scale(.9)', opacity: 0 }, { transform: 'translate(-50%, -50%)', opacity: .95 }],
      { duration: dir ? 170 : 220, easing: EASE });
    clearTimeout(bubbleTimer);
    Array.prototype.forEach.call(az.children, function (b) { b.classList.toggle('touch', b.dataset.letter === L); });
    markLetter(L);
  }
  // While a finger moves, jump at most once per screen refresh, to the newest letter.
  function pick(y) {
    lastY = y;
    lens(y);
    var L = letterAtY(y);
    if (!L || L === lastL) return;
    lastL = L;
    var b = az.querySelector('[data-letter="' + L + '"]');
    if (b && !b.classList.contains('empty')) buzz(6);
    show(L);
    pendingL = L;
    if (!frame) frame = requestAnimationFrame(function () { frame = 0; if (pendingL) jump(pendingL); pendingL = null; });
  }
  // On release, the letter under the finger wins; check again once the page has settled.
  function release(y) {
    if (typeof y !== 'number') y = lastY;
    var L = typeof y === 'number' ? letterAtY(y) : lastL;
    if (frame) { cancelAnimationFrame(frame); frame = 0; pendingL = null; }
    if (L) { show(L); jump(L); setTimeout(function () { jump(L); }, 120); }
    if (L && dragging) buzz(14);   // landed: a firmer tap (on iPhone the lift is when Safari allows one for sure)
    lastL = null; lastY = null;
    dragging = false;
    az.classList.remove('held');
    unlens();
    Array.prototype.forEach.call(az.children, function (b) { b.classList.remove('touch'); });
    bubbleTimer = setTimeout(function () { bubble.classList.remove('show'); shownL = null; }, 450);
  }
  function hold() { dragging = true; az.classList.add('held'); }
  az.addEventListener('touchstart', function (e) { e.preventDefault(); hold(); lastL = null; pick(e.touches[0].clientY); }, { passive: false });
  az.addEventListener('touchmove', function (e) { e.preventDefault(); pick(e.touches[0].clientY); }, { passive: false });
  az.addEventListener('touchend', function (e) { e.preventDefault(); release(e.changedTouches.length ? e.changedTouches[0].clientY : undefined); }, { passive: false });
  az.addEventListener('touchcancel', function () { release(); });
  var mouseDown = false;
  az.addEventListener('mousedown', function (e) { mouseDown = true; hold(); pick(e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', function (e) { if (mouseDown) pick(e.clientY); });
  document.addEventListener('mouseup', function (e) { if (mouseDown) { mouseDown = false; release(e.clientY); } });
  az.addEventListener('mousemove', function (e) { if (!mouseDown) lens(e.clientY); });
  az.addEventListener('mouseleave', function () { if (!mouseDown) unlens(); });
  az.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.letter) { e.preventDefault(); jump(e.target.dataset.letter); }
  });

  // ---------- suggestions under the search box ----------
  var options = [], active = -1;
  function closeSuggest() {
    suggest.hidden = true;
    suggest.textContent = '';
    options = []; active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function openSuggest() {
    var raw = input.value.trim();
    var ws = words;     // as the list has them, with any spelling correction

    if (raw.length < 2 || !ws.length || document.activeElement !== input) { closeSuggest(); return; }
    // Authors the words name come first; authors whose names they only begin come after a few titles.
    var strong = authorFilter ? [] : authorsMatching(ws).slice(0, 3);
    var weak = authorFilter ? [] : authorsMatching(ws, true).filter(function (a) { return strong.indexOf(a) < 0; }).slice(0, 2);
    var hits = textMatches(ws);
    hits.sort(function (a, b) { return (score(units[b], ws) - score(units[a], ws)) || units[a].titleNoArt.localeCompare(units[b].titleNoArt); });
    var titles = hits.slice(0, 6 - strong.length - Math.min(weak.length, 6 - strong.length - Math.min(hits.length, 3)));
    var picks = strong.map(function (a) { return { author: a }; });
    titles.slice(0, 3).forEach(function (u) { picks.push({ unit: u }); });
    weak.forEach(function (a) { if (picks.length < 6) picks.push({ author: a }); });
    titles.slice(3).forEach(function (u) { if (picks.length < 6) picks.push({ unit: u }); });
    // Last: the same words looked for in the books, unless the page is already doing that by itself.
    if (window.bookSearch && !wantsBooks(raw)) picks.push({ inside: raw });
    if (!picks.length) { closeSuggest(); return; }
    suggest.textContent = '';
    options = picks;
    active = -1;
    picks.forEach(function (p, k) {
      var li = document.createElement('li');
      li.id = 'sg-' + k;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      if (p.inside) {
        li.className = 'sg-inside';
        li.innerHTML = BOOK;
        var t = cell('sg-main', 'Search inside the books for ');
        t.appendChild(cell('sg-q', '“' + p.inside + '”'));
        li.appendChild(t);
      } else if (p.author) {
        li.className = 'sg-author';
        var m = cell('sg-main', highlighted(p.author, ws));
        var note = authorNotes[p.author];
        if (note && note[0]) m.appendChild(cell('sg-dates', note[0]));
        li.appendChild(m);
        li.appendChild(cell('sg-sub', plural(authorCount[p.author], 'work', 'works')));
      } else {
        var u = units[p.unit];
        li.className = 'sg-title';
        li.appendChild(cell('sg-main', highlighted(u.title, ws)));
        li.appendChild(cell('sg-sub', u.author + (u.yearText ? ', ' + u.yearText : '')));
      }
      li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(k); });
      suggest.appendChild(li);
    });
    suggest.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  function highlight(k) {
    active = k;
    Array.prototype.forEach.call(suggest.children, function (li, j) {
      li.classList.toggle('active', j === k);
      li.setAttribute('aria-selected', j === k ? 'true' : 'false');
    });
    if (k >= 0) input.setAttribute('aria-activedescendant', 'sg-' + k);
    else input.removeAttribute('aria-activedescendant');
  }
  function hasWords() { box.classList.toggle('fd-has', input.value.trim() !== ''); }

  // ---------- in the books: passages on the page, as you type ----------
  // One box does both. Words that find authors or titles narrow the list, and nothing is sent anywhere. Words that
  // find nothing on the list are looked for in the books once typing pauses, and the passages appear on the page.
  // Enter (or the last suggestion) looks in the books at once for any words. The server allows each visitor a few
  // searches a minute, so it is asked only after a pause, and never twice for the same words.
  var inQ = '', inTimer = 0, inGen = 0, inCache = {}, PASSAGES = 3;
  // After the server says "too many", the page stops asking by itself until the wait is over (for the rest of the
  // visit, if the day's limit is reached); Enter still asks, and shows the server's message.
  var holdUntil = 0;
  var HOLD = { visitor_minute: 60, minute: 60, busy: 5, unavailable: 60, visitor_day: Infinity, day: Infinity };
  function wantsBooks(raw) { return raw.length >= 3 && !authorFilter && !matches.length; }
  function hideBooks() { clearTimeout(inTimer); inGen++; inQ = ''; inbooks.hidden = true; inbooks.textContent = ''; box.classList.remove('fd-busy'); }
  function scheduleBooks() {
    clearTimeout(inTimer);
    var raw = input.value.trim();
    if (raw && raw === inQ) return;   // these words are already being looked for, or shown (Enter asked)
    if (!raw || !wantsBooks(raw)) { hideBooks(); return; }
    if (Date.now() < holdUntil) return;   // the server asked for a pause: Enter still asks
    inbooks.classList.add('stale');
    inTimer = setTimeout(function () { booksFor(raw); }, 1200);
  }
  function booksFor(raw) {
    clearTimeout(inTimer);
    if (!raw || !window.bookSearch || !window.bookSearch.find) return;
    if (raw === inQ && !inbooks.hidden && !inbooks.classList.contains('stale')) return;
    inQ = raw;
    var gen = ++inGen;
    if (inCache[raw]) { drawBooks(inCache[raw]); return; }
    box.classList.add('fd-busy');
    window.bookSearch.find(raw).then(function (d) {
      if (gen !== inGen) return;
      box.classList.remove('fd-busy');
      inCache[raw] = d;
      drawBooks(d);
    }, function (e) {
      if (gen !== inGen) return;
      box.classList.remove('fd-busy');
      inQ = '';
      if (e && HOLD[e.limit]) holdUntil = Date.now() + HOLD[e.limit] * 1000;
      drawBooks({ error: e && e.say ? e.say : 'The books didn\u2019t answer. Try again in a moment.' });
    });
  }
  function drawBooks(d) {
    inbooks.textContent = '';
    inbooks.classList.remove('stale');
    var h = document.createElement('h2');
    h.className = 'ib-head';
    h.textContent = 'In the books';
    inbooks.appendChild(h);
    var hits = (d && d.hits) || [];
    if (d && d.error) inbooks.appendChild(cell('ib-msg', d.error));
    else if (!hits.length) inbooks.appendChild(cell('ib-msg', 'Nothing close in the books.'));
    else if (d.note) inbooks.appendChild(cell('ib-note', d.note));
    var shownHits = [];
    hits.forEach(function (hit, k) {
      var a = window.bookSearch.passage(hit);
      if (k >= PASSAGES) a.hidden = true;
      inbooks.appendChild(a);
      if (k < PASSAGES) shownHits.push(a);
    });
    if (hits.length > PASSAGES) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'linkish ib-more';
      b.textContent = 'More passages (' + (hits.length - PASSAGES) + ')';
      b.addEventListener('click', function () {
        buzz();
        var rest = Array.prototype.filter.call(inbooks.querySelectorAll('.lk-hit'), function (x) { return x.hidden; });
        rest.forEach(function (x) { x.hidden = false; });
        b.remove();
        rise(rest);
      });
      inbooks.appendChild(b);
    }
    inbooks.hidden = false;
    $('empty').hidden = hits.length > 0 || matches.length > 0;
    rise(shownHits);
  }
  // Passages rise in one after another, then the found words are marked as with a highlighter.
  function rise(els) {
    els.forEach(function (a, i) {
      var sweep = function () { a.classList.add('lk-swept'); };
      if (calm || !a.animate) { sweep(); return; }
      a.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
        { duration: 360, delay: 40 + i * 60, easing: EASE, fill: 'backwards' }).onfinish = sweep;
    });
  }
  function choose(k) {
    var p = options[k];
    closeSuggest();
    if (!p) return;
    if (p.inside) { booksFor(input.value.trim()); return; }
    if (p.author) { setAuthor(p.author); return; }
    // A title: list it, open it and move to it.
    var u = units[p.unit];
    input.value = u.title.replace(/…$/, '');
    update();
    var li = list.querySelector('li[data-u="' + p.unit + '"]');
    if (li) { toggleRow(li, true); focusRow(li); }
  }

  // ---------- keyboard: search box, suggestions and list ----------
  function rows() { return list.querySelectorAll('li[data-u]'); }
  function focusRow(li) {
    var old = list.querySelector('li[tabindex="0"]');
    if (old && old !== li) old.tabIndex = -1;
    li.tabIndex = 0;
    li.focus({ preventScroll: true });
    li.scrollIntoView({ block: 'nearest' });
  }
  input.addEventListener('keydown', function (e) {
    var open = !suggest.hidden;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (open) highlight(Math.min(active + 1, options.length - 1));
      else { var first = rows()[0]; if (first) focusRow(first); }
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      highlight(active - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // A chosen suggestion opens it; otherwise Enter looks in the books for the words at once.
      if (open && active >= 0) choose(active);
      else {
        closeSuggest();
        if (input.value.trim()) booksFor(input.value.trim());
        // On a phone, Enter (Search) puts the keyboard away so the results can be seen.
        if (matchMedia('(pointer: coarse)').matches) input.blur();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (open) closeSuggest();
      else if (menuOpen) setMenu(false);
      else if (input.value || authorFilter) { input.value = ''; authorFilter = ''; update(); }
    }
  });
  list.addEventListener('keydown', function (e) {
    var li = e.target;
    if (!li.dataset || !li.dataset.u) return;
    var go = function (dir) {
      var n = li;
      do { n = dir > 0 ? n.nextElementSibling : n.previousElementSibling; } while (n && !n.dataset.u);
      if (!n && dir > 0 && !more.hidden) { showMore(); n = li.nextElementSibling; while (n && !n.dataset.u) n = n.nextElementSibling; }
      return n;
    };
    if (e.key === 'ArrowDown') { e.preventDefault(); var n = go(1); if (n) focusRow(n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); var p = go(-1); if (p) focusRow(p); else input.focus(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRow(li); }
    else if (e.key === 'Escape') { e.preventDefault(); if (li.classList.contains('open')) toggleRow(li, false); else input.focus(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen && document.activeElement !== input) { setMenu(false); toggle.focus(); }
  });

  // ---------- address bar: the search can be shared, and Back works ----------
  function saveState() {
    var p = new URLSearchParams();
    if (input.value.trim()) p.set('q', input.value.trim());
    if (authorFilter) p.set('author', authorFilter);
    if (sortV !== defaultSort()) p.set('sort', sortV);
    if (typeV) p.set('type', typeV);
    if (periodV) p.set('period', periodV);
    var qs = p.toString();
    history.replaceState(history.state, '', qs ? '?' + qs : location.pathname);
  }
  function loadState() {
    var p = new URLSearchParams(location.search);
    input.value = p.get('q') || '';
    if (p.get('author') && authorCount[p.get('author')]) authorFilter = p.get('author');
    var s = p.get('sort');
    if (s && SORTS.some(function (o) { return o[0] === s; })) { sortV = s; sortChosen = true; }
    if (TYPES[p.get('type')]) typeV = p.get('type');
    if (PERIODS.some(function (o) { return o[0] === p.get('period'); })) periodV = p.get('period');
  }

  // ---------- events ----------
  var timer;
  input.addEventListener('input', function () {
    clearBtn.hidden = !input.value;
    hasWords();
    clearTimeout(timer);
    timer = setTimeout(function () { update(false, true); openSuggest(); scheduleBooks(); }, 120);
  });
  input.addEventListener('focus', function () { setMenu(false); if (input.value.trim().length >= 2) openSuggest(); });
  input.addEventListener('blur', function () { setTimeout(closeSuggest, 100); });
  clearBtn.addEventListener('click', function () { input.value = ''; closeSuggest(); hideBooks(); update(); input.focus(); });
  function resetAll() {
    input.value = ''; typeV = ''; periodV = ''; authorFilter = ''; sortChosen = false; sortV = 'author';
    hideBooks(); update(); input.focus();
  }
  $('empty-clear').addEventListener('click', resetAll);
    more.addEventListener('click', function () { showMore(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { if (entries[0].isIntersecting && !more.hidden) showMore(); }, { rootMargin: '1600px' }).observe(more);
  }
  // Tap or click a book: who wrote it, its full title, its editions and where its text came from.
  // Tap an author's name (on a shelf or in a card): only their works.
  list.addEventListener('click', function (e) {
    var who = e.target.closest('[data-author]');
    if (who) { buzz(); setAuthor(who.dataset.author); return; }
    if (e.target.closest('a')) return;
    if (window.getSelection && String(window.getSelection()).length) return;   // selecting text, not opening
    var li = e.target.closest('li[data-u]');
    if (!li) return;
    toggleRow(li);
    var old = list.querySelector('li[tabindex="0"]');
    if (old && old !== li) old.tabIndex = -1;
    li.tabIndex = 0;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== input && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); input.select(); }
  });

  // ---------- start ----------
  var typesSeen = {};
  fetch('catalog.json').then(function (r) { return r.json(); }).then(function (data) {
    build(data);
    works.forEach(function (w) { typesSeen[w[3]] = true; });
    loadState();
    update(true);
    // A link with words in it looks in the books by itself, but not inside another site's frame or in a window
    // another page opened: there the visitor's Enter (or a keystroke) asks, as with lookup.js's shared searches.
    // Otherwise a page could make its visitors run searches against their own daily limit.
    var sent = false;
    try { sent = window.top !== window.self || !!window.opener; } catch (e) { sent = true; }
    if (!sent) scheduleBooks();
    // The full printed titles are read while the page is idle, so the first book opened doesn't stall its motion.
    var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1500); };
    idle(function () { loadFullTitles(); }, { timeout: 4000 });
  }).catch(function (err) {
    list.classList.remove('loading');
    list.textContent = '';
    count.textContent = 'The list could not be loaded. Try reloading the page.';
    if (window.console) console.error(err);
  });
})();
