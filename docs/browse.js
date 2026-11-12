// Browse page: loads catalog.json (served from this site), then searches, filters
// and lists it in the browser. Nothing is sent anywhere.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var input = $('q'), sortSel = $('sort'), typeSel = $('type'), periodSel = $('period');
  var toggle = $('opts-toggle'), bar = document.querySelector('.finder-bar');
  var resetBtn = $('reset'), list = $('works'), count = $('count'), more = $('more'), az = $('az');
  var clearBtn = $('q-clear'), suggest = $('suggest'), cards = $('authors'), notice = $('notice');
  var bestOpt = sortSel.querySelector('option[value="best"]');
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

  // works: one row of the catalog per edition. units: what the list shows, one per work, with
  // its editions (same author, kind and title) folded together.
  var works = [], authorNotes = {}, titlesVersion = '';
  var units = [];
  var authorCount = {}, authorKey = {}, surnameKey = {}, authorNames = [];
  var vocab = {}, vocabList = [];   // folded word -> { n, word }, for "did you mean"
  var matches = [], items = [], shown = 0, words = [], scores = null;
  var authorFilter = '', sortChosen = false, corrected = '';

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
  function letterOf(u) { return sortSel.value === 'title' ? initial(units[u].titleNoArt) : units[u].letter; }
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
  function row(ui) {
    var u = units[ui];
    var li = document.createElement('li');
    var label = u.title + (u.type && u.type !== 'book' ? ' (' + u.type + ')' : '');
    var t = cell('w-title', cell('w-t', highlighted(label)));
    t.firstChild.title = label;
    if (u.ed.length > 1) t.appendChild(cell('w-eds', u.ed.length + ' editions'));
    li.appendChild(t);
    li.appendChild(cell('w-author', highlighted(u.author)));
    li.appendChild(cell('w-year', u.yearText || '–'));
    li.dataset.u = ui;
    li.tabIndex = -1;
    li.setAttribute('aria-expanded', 'false');
    return li;
  }
  function header(L) {
    var li = document.createElement('li');
    li.className = 'letter';
    li.id = 'letter-' + (L === '#' ? 'other' : L);
    li.textContent = L === '#' ? 'Other' : L;
    return li;
  }
  function grouped() { return sortSel.value === 'author' || sortSel.value === 'title'; }
  function showMore() {
    var frag = document.createDocumentFragment();
    // In author or title order the whole list is drawn at once, so the A to Z bar never waits on loading.
    var end = grouped() ? items.length : Math.min(shown + PAGE, items.length);
    for (var k = shown; k < end; k++) {
      var it = items[k];
      frag.appendChild(typeof it === 'string' ? header(it) : row(it));
    }
    list.appendChild(frag);
    shown = end;
    more.hidden = shown >= items.length;
    more.textContent = 'Show more (' + num(items.length - shown) + ' left)';
    var first = list.querySelector('li[data-u]');
    if (first && !list.querySelector('li[tabindex="0"]')) first.tabIndex = 0;
  }

  // Where each book's text came from, named for people rather than as a web address.
  var SOURCES = [
    [/quod\.lib\.umich\.edu/, 'Read it at EEBO-TCP (University of Michigan)'],
    [/ccel\.org/, 'Read it at the Christian Classics Ethereal Library'],
    [/archive\.org/, 'See the scanned book at the Internet Archive'],
    [/gutenberg\.org/, 'Read it at Project Gutenberg'],
    [/standardebooks\.org/, 'Read it at Standard Ebooks'],
    [/wikisource\.org/, 'Read it at Wikisource'],
    [/sefaria\.org/, 'Read it at Sefaria'],
    [/romans45\.org|spurgeon/, 'Read it at the Spurgeon Archive'],
    [/docsouth\.unc\.edu/, 'Read it at DocSouth (UNC)'],
    [/crosswire\.org/, 'Source: The CrossWire Bible Society'],
    [/tertullian\.org/, 'Read it at the Tertullian Project'],
    [/github\.com|githubusercontent/, 'Source file (for the technically minded)']
  ];
  function sourceLabel(url) {
    for (var k = 0; k < SOURCES.length; k++) if (SOURCES[k][0].test(url)) return SOURCES[k][1];
    return 'Source: ' + url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
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
      full.textContent = t ? (many ? t : 'Full title: ' + t) : '';
      full.hidden = !t;
    };
    fill();
    if (!fullTitles) loadFullTitles().then(fill);
    box.appendChild(full);
    var links = document.createElement('div');
    links.className = 'w-links';
    if (w[4]) {
      var a = document.createElement('a');
      a.href = w[4];
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = sourceLabel(w[4]) + ' ↗';
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
    if (note) {
      var who = document.createElement('p');
      who.className = 'w-who';
      who.textContent = u.author + (note[0] ? ' (' + note[0] + ')' : '') + (note[1] ? ', ' + note[1] : '');
      box.appendChild(who);
    }
    var many = u.ed.length > 1;
    if (many) {
      var h = document.createElement('p');
      h.className = 'w-eds-head';
      h.textContent = u.ed.length + ' editions in the library';
      box.appendChild(h);
    }
    u.ed.slice().sort(function (a, b) { return (parseInt(works[a][2], 10) || 9999) - (parseInt(works[b][2], 10) || 9999); })
      .forEach(function (i) { box.appendChild(edition(i, u, many)); });
    return box;
  }
  function toggleRow(li, open) {
    if (open === undefined) open = !li.classList.contains('open');
    li.classList.toggle('open', open);
    if (open && !li.querySelector('.w-more')) li.appendChild(details(+li.dataset.u));
    li.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // ---------- author cards ----------
  // Authors the words name ("owen"), or with loose set, whose names the words merely begin ("bax").
  function authorsMatching(ws, loose) {
    if (!ws.length || ws.join('').length < (loose ? 2 : 3)) return [];
    return authorNames.filter(function (a) {
      return ws.every(function (w) { return has(authorKey[a], w); }) && (loose || ws.some(function (w) { return names(a, w); }));
    }).sort(function (a, b) { return authorCount[b] - authorCount[a]; });
  }
  function card(name, on) {
    var box = document.createElement('div');
    box.className = 'author-card' + (on ? ' on' : '');
    var text = document.createElement('div');
    text.className = 'ac-text';
    var h = document.createElement('p');
    h.className = 'ac-name';
    h.appendChild(on ? document.createTextNode(name) : highlighted(name));
    var note = authorNotes[name];
    if (note && note[0]) h.appendChild(cell('ac-dates', note[0]));
    text.appendChild(h);
    var sub = document.createElement('p');
    sub.className = 'ac-note';
    sub.textContent = (note && note[1] ? note[1] + ' · ' : '') + plural(authorCount[name], 'work', 'works') + ' in the library';
    text.appendChild(sub);
    box.appendChild(text);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ac-btn';
    if (on) {
      b.textContent = 'Show all authors';
      b.addEventListener('click', function () { setAuthor(''); });
    } else {
      b.textContent = authorCount[name] === 1 ? 'Show only this' : 'Show only these';
      b.setAttribute('aria-label', 'Show only the works of ' + name);
      b.addEventListener('click', function () { setAuthor(name); });
    }
    box.appendChild(b);
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
    if (!name) input.focus();
  }

  // ---------- filtering ----------
  function sorted(arr) {
    var mode = sortSel.value;
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
  // Counts beside each choice, so a choice never leads to an empty list.
  function refreshCounts(hits) {
    var t = typeSel.value, pd = periodSel.value, tc = {}, pc = {};
    hits.forEach(function (u) {
      if (inPeriod(u, pd)) tc[units[u].type] = (tc[units[u].type] || 0) + 1;
      if (!t || units[u].type === t) Object.keys(units[u].periods).forEach(function (p) { pc[p] = (pc[p] || 0) + 1; });
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
  function defaultSort() { return words.length ? 'best' : 'author'; }

  function update(keepScroll) {
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
    if (!words.length && sortSel.value === 'best') { sortSel.value = 'author'; sortChosen = false; }
    if (words.length && !sortChosen) sortSel.value = 'best';
    bestOpt.hidden = bestOpt.disabled = !words.length;
    clearBtn.hidden = !input.value;

    scores = null;
    if (words.length) { scores = {}; hits.forEach(function (u) { scores[u] = score(units[u], words); }); }
    refreshCounts(hits);
    var t = typeSel.value, pd = periodSel.value;
    matches = sorted(hits.filter(function (u) { return (!t || units[u].type === t) && inPeriod(u, pd); }));
    items = [];
    var last = null, g = grouped();
    matches.forEach(function (u) {
      if (g) {
        var L = letterOf(u);
        if (L !== last) { items.push(L); last = L; }
      }
      items.push(u);
    });
    list.textContent = '';
    list.classList.remove('loading');
    list.removeAttribute('aria-busy');
    shown = 0;

    notice.textContent = '';
    if (corrected) {
      notice.appendChild(document.createTextNode('Nothing matches “' + input.value.trim() + '”. Showing results for '));
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

    var filtered = words.length || t || pd || authorFilter;
    resetBtn.hidden = !filtered;
    var total = units.length;
    if (!filtered) count.textContent = num(total) + ' works';
    else if (!matches.length) count.textContent = 'No works match.';
    else count.textContent = num(matches.length) + ' of ' + num(total) + ' works' + (sortSel.value === 'best' && matches.length > 1 ? ', best matches first' : '');
    $('empty').hidden = matches.length > 0;
    $('empty-q').textContent = 'Search the Christian Open Library for ' + (input.value.trim() || 'this') + '.';
    showMore();
    buildIndex();
    saveState();
    setPinned();
    placeIndex();
    var active = (typeSel.value ? 1 : 0) + (periodSel.value ? 1 : 0) + (sortSel.value !== defaultSort() ? 1 : 0);
    toggle.textContent = active ? 'Filter (' + active + ')' : 'Filter';
    if (!keepScroll) {
      // If the list has been scrolled, go back to its top, just under the pinned search bar.
      var anchor = $('list-top').getBoundingClientRect().top + window.scrollY - parseFloat(getComputedStyle(bar).top);
      if (window.scrollY > anchor) window.scrollTo(0, anchor);
    }
  }

  function pinnedHeight() { return parseFloat(getComputedStyle(bar).top) + bar.offsetHeight; }
  function setPinned() { document.documentElement.style.setProperty('--pinned', pinnedHeight() + 'px'); }
  toggle.addEventListener('click', function () {
    var open = !bar.classList.contains('open');
    bar.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    setPinned();
  });
  window.addEventListener('resize', setPinned);
  // Show the letters only once the list has reached the pinned search bar, so they never
  // cover the page heading and never move while a finger is on them.
  function placeIndex() {
    az.classList.toggle('on', list.getBoundingClientRect().top <= pinnedHeight() + 2);
  }
  window.addEventListener('scroll', placeIndex, { passive: true });

  // ---------- A to Z bar ----------
  function buildIndex() {
    az.hidden = !grouped() || matches.length < 30;
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
    var head = list.children[idx], first = list.children[idx + 1];
    if (!head || !first) return;
    // Letter headings stay pinned once scrolled past, so their position on screen says nothing
    // about where they sit in the list. Measure from the first book under the heading instead.
    var target = window.scrollY + first.getBoundingClientRect().top - pinnedHeight() - head.offsetHeight + 1;
    window.scrollTo(0, Math.max(0, target));
    placeIndex();
  }
  // Tap or drag on the bar. Touch events are used on phones (Safari), pointer events elsewhere.
  var bubble = document.createElement('div');
  bubble.className = 'az-bubble';
  bubble.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bubble);
  var bubbleTimer, lastL = null, lastY = null, frame = 0, pendingL = null;
  // The letter under a point on the bar, from its fixed layout (not from what is drawn there).
  function letterAtY(y) {
    var btns = az.children;
    if (!btns.length) return null;
    var first = btns[0].getBoundingClientRect(), last = btns[btns.length - 1].getBoundingClientRect();
    var h = (last.bottom - first.top) / btns.length;
    var k = Math.floor((y - first.top) / h);
    k = Math.max(0, Math.min(btns.length - 1, k));
    return btns[k].dataset.letter;
  }
  function show(L) {
    bubble.textContent = L === '#' ? 'Other' : L;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
  }
  // While a finger moves, jump at most once per screen refresh, to the newest letter.
  function pick(y) {
    lastY = y;
    var L = letterAtY(y);
    if (!L || L === lastL) return;
    lastL = L;
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
    lastL = null; lastY = null;
    bubbleTimer = setTimeout(function () { bubble.classList.remove('show'); }, 450);
  }
  az.addEventListener('touchstart', function (e) { e.preventDefault(); lastL = null; pick(e.touches[0].clientY); }, { passive: false });
  az.addEventListener('touchmove', function (e) { e.preventDefault(); pick(e.touches[0].clientY); }, { passive: false });
  az.addEventListener('touchend', function (e) { e.preventDefault(); release(e.changedTouches.length ? e.changedTouches[0].clientY : undefined); }, { passive: false });
  az.addEventListener('touchcancel', function () { release(); });
  var mouseDown = false;
  az.addEventListener('mousedown', function (e) { mouseDown = true; pick(e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', function (e) { if (mouseDown) pick(e.clientY); });
  document.addEventListener('mouseup', function (e) { if (mouseDown) { mouseDown = false; release(e.clientY); } });
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
    if (!picks.length) { closeSuggest(); return; }
    suggest.textContent = '';
    options = picks;
    active = -1;
    picks.forEach(function (p, k) {
      var li = document.createElement('li');
      li.id = 'sg-' + k;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      if (p.author) {
        li.className = 'sg-author';
        li.appendChild(cell('sg-main', highlighted(p.author, ws)));
        li.appendChild(cell('sg-sub', 'Author · ' + plural(authorCount[p.author], 'work', 'works')));
      } else {
        var u = units[p.unit];
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
  function choose(k) {
    var p = options[k];
    closeSuggest();
    if (!p) return;
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
      if (open && active >= 0) choose(active);
      else {
        closeSuggest();
        // On a phone, Enter (Search) puts the keyboard away so the results can be seen.
        if (matchMedia('(pointer: coarse)').matches) input.blur();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (open) closeSuggest();
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

  // ---------- address bar: the search can be shared, and Back works ----------
  function saveState() {
    var p = new URLSearchParams();
    if (input.value.trim()) p.set('q', input.value.trim());
    if (authorFilter) p.set('author', authorFilter);
    if (sortSel.value !== defaultSort()) p.set('sort', sortSel.value);
    if (typeSel.value) p.set('type', typeSel.value);
    if (periodSel.value) p.set('period', periodSel.value);
    var qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }
  function loadState() {
    var p = new URLSearchParams(location.search);
    input.value = p.get('q') || '';
    if (p.get('author') && authorCount[p.get('author')]) authorFilter = p.get('author');
    var s = p.get('sort');
    if (s && Array.prototype.some.call(sortSel.options, function (o) { return o.value === s; })) { sortSel.value = s; sortChosen = true; }
    if (p.get('type')) typeSel.value = p.get('type');
    if (p.get('period')) periodSel.value = p.get('period');
  }

  // ---------- events ----------
  var timer;
  input.addEventListener('input', function () {
    clearBtn.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(function () { update(); openSuggest(); }, 120);
  });
  input.addEventListener('focus', function () { if (input.value.trim().length >= 2) openSuggest(); });
  input.addEventListener('blur', function () { setTimeout(closeSuggest, 100); });
  clearBtn.addEventListener('click', function () { input.value = ''; closeSuggest(); update(); input.focus(); });
  sortSel.addEventListener('change', function () { sortChosen = true; });
  [sortSel, typeSel, periodSel].forEach(function (s) {
    s.addEventListener('change', function () {
      // On a phone, fold the panel away after a choice; the button still shows how many are on.
      if (getComputedStyle(toggle).display !== 'none') { bar.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
      update();
    });
  });
  resetBtn.addEventListener('click', function () {
    input.value = ''; typeSel.value = ''; periodSel.value = ''; authorFilter = ''; sortChosen = false; sortSel.value = 'author';
    update(); input.focus();
  });
  $('empty-clear').addEventListener('click', function () { resetBtn.click(); });
  more.addEventListener('click', showMore);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { if (entries[0].isIntersecting && !more.hidden) showMore(); }, { rootMargin: '800px' }).observe(more);
  }
  // Tap or click a book: who wrote it, its full title, its editions and where its text came from.
  list.addEventListener('click', function (e) {
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
  fetch('catalog.json').then(function (r) { return r.json(); }).then(function (data) {
    build(data);
    var typesSeen = {};
    works.forEach(function (w) { typesSeen[w[3]] = true; });
    Object.keys(TYPES).forEach(function (k) { if (typesSeen[k]) { var o = document.createElement('option'); o.value = k; typeSel.appendChild(o); } });
    PERIODS.forEach(function (p) { var o = document.createElement('option'); o.value = p[0]; periodSel.appendChild(o); });
    loadState();
    if (typeSel.value || periodSel.value || sortChosen) { bar.classList.add('open'); toggle.setAttribute('aria-expanded', 'true'); }
    update(true);
  }).catch(function () {
    list.classList.remove('loading');
    list.textContent = '';
    count.textContent = 'The list could not be loaded. Try reloading the page.';
  });
})();
