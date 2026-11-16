/* The quotation checker (quote.html). Sends the words to the library's server (POST /check) and shows the answer.
   Everything from the server is put in with textContent, never as HTML. A share link keeps the quotation after the
   "#", so GitHub Pages never receives it. */
(function () {
  'use strict';
  var ENDPOINT = 'https://mcp.christianopenlibrary.org/check';
  var SITE = 'https://christianopenlibrary.org/quote.html';
  var form = document.getElementById('qc-form');
  if (!form) return;
  var quoteBox = document.getElementById('qc-quote');
  var go = document.getElementById('qc-go');
  var msg = document.getElementById('qc-msg');
  var out = document.getElementById('qc-result');
  var box = out.parentNode;
  var clearBtn = document.getElementById('qc-clear');
  var cta = document.getElementById('qc-cta');
  var busy = false;
  var waitTimer = null;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Brings the answer (or the "checking" line) into view: on a phone it would otherwise be below the screen. */
  /* The box the words are typed in is the box the answer appears in: each change of what it holds (searching,
     the answer, back to empty) is made at once and the box's height is then eased from the old to the new. */
  function morph(change) {
    var h0 = box.offsetHeight;
    change();
    var h1 = box.offsetHeight;
    if (calm || h0 === h1 || !box.animate) return;
    box.classList.add('qc-morph');
    var a = box.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }],
      { duration: Math.min(560, 260 + Math.abs(h1 - h0) * .35), easing: 'cubic-bezier(.22, .9, .25, 1)' });
    a.onfinish = a.oncancel = function () { box.classList.remove('qc-morph'); };
  }
  var KINDS = ['qc-yes', 'qc-warn', 'qc-no', 'qc-none', 'qc-busy', 'qc-done', 'qc-landed'];
  var lead = document.querySelector('.qc-lead');
  function boxState(cls) {
    KINDS.forEach(function (k) { box.classList.remove(k); });
    (cls || []).forEach(function (k) { box.classList.add(k); });
    if (lead) lead.classList.toggle('qc-alt', box.classList.contains('qc-busy'));
  }
  /* Back to an empty answer, the box ready for words (the words are kept unless told otherwise). */
  function fold(clear) {
    morph(function () {
      if (clear) setBox(''); else fit();
      out.textContent = '';
      boxState([]);
    });
  }
  function show(node, block) {
    if (node && node.scrollIntoView) node.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: block });
  }
  /* The box grows with the text, and the clear button shows only when there is something to clear. */
  function fit() {
    quoteBox.rows = box && box.classList.contains('qc-done') ? 1 : 3;   // answered: no empty lines under the words
    quoteBox.style.height = 'auto';
    quoteBox.style.height = Math.min(quoteBox.scrollHeight, 420) + 'px';
    if (clearBtn) clearBtn.hidden = !quoteBox.value;
  }
  function setBox(text) { quoteBox.value = text; fit(); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === '') continue;
      parent.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return parent;
  }
  function link(href, text) {
    if (!/^https?:\/\//i.test(String(href))) return null;
    var a = el('a', null, text);
    a.href = href;
    a.rel = 'noopener noreferrer';
    return a;
  }
  function plural(n, word) { return n.toLocaleString('en-US') + ' ' + word + (n === 1 ? '' : 's'); }
  function words(text) { return (text.match(/[\p{L}\p{N}]+/gu) || []).length; }

  /* "John Owen (1616–1683), Of the Mortification of Sin (1668), p. 11" as nodes, the title in italics. */
  function where(m) {
    var f = document.createDocumentFragment();
    // "Various" (a journal) says nothing; a title that already ends with its year doesn't need it again.
    if (m.author && !/^various$/i.test(m.author)) add(f, m.author + (m.dates ? ' (' + m.dates + ')' : '') + ', ');
    var y = typeof m.year === 'number' ? String(m.year) : '', t = String(m.title);
    var hasYear = y !== '' && (t.slice(-y.length) === y || t.slice(-y.length - 1) === y + ')');
    add(f, el('cite', null, t), hasYear ? '' : (y ? ' (' + y + ')' : ' (year not known)'), m.pages ? ', ' + m.pages : '');
    return f;
  }
  function closeness(m) {
    if (m.exact) return m.left_out ? 'every word, with words between them' : 'word for word';
    if (m.misread && m.same === m.words) return plural(m.misread, 'word') + ' differ by a letter';
    return m.same + ' of ' + m.words + ' words the same';
  }

  var HEAD = {
    exact: ['yes', 'Verified word for word'],
    scan_letters: ['warn', 'Found; compare the printed page'],
    left_out: ['warn', 'Found, with words left out'],
    reworded: ['warn', 'Found with different wording'],
    quoting: ['warn', 'Found as a quotation of someone else'],
    other_author: ['no', 'Found, but not under this name'],
    named: ['warn', 'Found only as quoted by another writer'],
    not_found: ['none', 'Not found in the library']
  };
  /* The mark beside the verdict, drawn as a pen stroke: a tick, a wave, a cross. */
  var MARK = { yes: ['M4.5 12.8l4.6 4.7L19.6 6.6'], warn: ['M3.5 13.6c2.7-4.4 5.6-4.4 8.5-1.6s5.8 2.8 8.5-1.6'],
    no: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'] };
  /* The words are shown inside the sentence around them. */
  var LOOK = 'c';

  function markSvg(kind) {
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'qc-mark');
    s.setAttribute('aria-hidden', 'true');
    (MARK[kind] || []).forEach(function (d, i) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('pathLength', '1');
      p.style.setProperty('--i', i);
      s.appendChild(p);
    });
    return MARK[kind] ? s : null;
  }

  /* The passage as pieces: [text, kind], kind 'hit' for the words submitted, 'diff' for a word of the source that
     differs from them, '' for the words around them. */
  function wordList(s) { return String(s).match(/[\p{L}\p{N}’']+/gu) || []; }
  function norm(w) { return w.normalize('NFD').replace(/[̀-ͯ’']/g, '').toLowerCase(); }
  /* Which words of the text are the words submitted (the longest sequence in common, in order). A stray short
     word far from the rest is dropped, so "the" three lines earlier isn't marked. */
  function hits(text, quote) {
    var a = wordList(text).map(norm), b = wordList(quote).map(norm), n = a.length, m = b.length, i, j;
    var on = a.map(function () { return false; });
    if (!n || !m || n * m > 300000) return on;
    var L = [];
    for (i = 0; i <= n; i++) L.push(new Uint16Array(m + 1));
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    for (i = 0, j = 0; i < n && j < m;) {
      if (a[i] === b[j]) { on[i] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
    }
    var count = on.filter(Boolean).length;
    if (count > 3) on = on.map(function (v, k) { return v && (on[k - 1] || on[k + 1] || on[k - 2] || on[k + 2]); });
    return on;
  }
  function piecesOf(text, on) {
    var out2 = [], k = 0;
    String(text).split(/([\p{L}\p{N}’']+)/u).forEach(function (s, idx) {
      if (s === '') return;
      if (idx % 2) { out2.push([s, on[k] ? 'hit' : '']); k++; } else out2.push([s, null]);
    });
    return out2;
  }
  /* The server's [[text, differs], ...]: the words that differ, and the rest as found. */
  function piecesMarked(pieces) {
    var out2 = [];
    (Array.isArray(pieces) ? pieces : []).forEach(function (p) {
      if (!Array.isArray(p) || typeof p[0] !== 'string') return;
      String(p[0]).split(/([\p{L}\p{N}’']+)/u).forEach(function (s, idx) {
        if (s !== '') out2.push([s, idx % 2 ? (p[1] === true ? 'diff' : 'hit') : null]);
      });
    });
    return out2;
  }
  function trimQuotes(s) { return String(s).trim().replace(/^[“”"‘]+|[“”"’]+$/g, '').trim(); }
  /* The sentence around the words: back to the start of the sentence, on to its end, 18 words at most. */
  function before(s) {
    s = String(s || '');
    // The words open a quotation or a sentence: what comes before belongs to something else.
    s = s.replace(/[\s“"‘]+$/, '');
    if (/[.!?:]["”’)]?$/.test(s)) return '';
    var m = s.match(/(?:^|[.!?;:]["”’]?\s+)([^.!?;:]*)$/);
    var t = m ? m[1] : s, w = t.split(/\s+/).filter(Boolean);
    if (!m && w.length <= 18) t = '…' + t;
    return w.length > 18 ? '…' + w.slice(-18).join(' ') + ' ' : t ? t + ' ' : '';
  }
  function after(s) {
    s = String(s || '');
    var m = s.match(/^[^.!?;]*[.!?;]/), t = m ? m[0] : s, w = t.split(/\s+/).filter(Boolean);
    t = w.length > 18 ? w.slice(0, 18).join(' ') + '…' : t;
    return /^[\p{L}\p{N}]/u.test(t) ? ' ' + t : t;
  }

  /* The passage set like a printed quotation: each word a span, so the highlighter can pass over them in turn. */
  function passage(pieces, opts) {
    var bq = el('blockquote', 'qc-words');
    var pre = opts.pre || '', post = opts.post || '';
    if (opts.ctx) opts.quiet = true;
    if (!pre && !opts.quiet) bq.classList.add('qc-hang');
    /* Words that begin or end inside a sentence get an ellipsis, as in print. */
    var firstWord = pieces.filter(function (x) { return x[1] !== null; })[0], lastText = pieces.length ? pieces[pieces.length - 1] : null;
    var open = !pre && (!opts.quiet || opts.ctx) && firstWord && /^\p{Ll}/u.test(firstWord[0]) ? '…' : '';
    var close = !post && !opts.quiet && !opts.ends && lastText && lastText[1] !== null ? '…' : '';
    var all = [[pre ? pre : (opts.quiet ? open : '“' + open), null]].concat(pieces, [[post ? post : (opts.quiet ? '' : close + '”'), null]])
      .filter(function (p) { return p[0] !== ''; });
    if (pre) all[0][1] = 'ctx';
    if (post) all[all.length - 1][1] = 'ctx';
    var total = 0, at = 0, diffs = 0;
    all.forEach(function (p) { if (p[1] === 'hit') total += p[0].length; });
    var SWEEP = Math.min(560, 160 + total * 4), START = 330;
    for (var i = 0; i < all.length; i++) {
      var p = all[i], kind = p[1];
      if (kind === 'hit') {
        // The space between two marked words is marked too, so the stroke runs on unbroken.
        var t = p[0];
        if (all[i + 1] && all[i + 1][1] === null && !/[\p{L}\p{N}“”"]/u.test(all[i + 1][0]) && all[i + 2] && all[i + 2][1] === 'hit') { t += all[i + 1][0]; i++; }
        var s = el('span', 'qc-hit', t);
        s.style.setProperty('--d', Math.round(START + SWEEP * at / (total || 1)) + 'ms');
        s.style.setProperty('--t', Math.max(30, Math.round(SWEEP * t.length / (total || 1))) + 'ms');
        at += t.length;
        add(bq, s);
      } else if (kind === 'diff') {
        var dsp = el('span', 'qc-diff', p[0]);
        dsp.style.setProperty('--n', diffs++);
        add(bq, dsp);
      } else if (kind === 'ctx' || (kind === '' && opts.ctx)) {
        add(bq, el('span', 'qc-ctx', p[0]));
      } else {
        add(bq, opts.ctx && /[\p{L}\p{N}]|^[^\s]/u.test(p[0]) && i > 0 && i < all.length - 1 ? el('span', 'qc-ctx', p[0]) : p[0]);
      }
    }
    bq.style.setProperty('--end', Math.round(START + SWEEP) + 'ms');
    bq.style.setProperty('--gap', Math.round(Math.min(90, 360 / Math.max(1, diffs))) + 'ms');
    return bq;
  }

  /* The words to show for a book: the source's wording, the words submitted marked in it. */
  function bookPieces(p, quote) {
    var text = trimQuotes(p.text);
    if (p.marked && !p.exact) return piecesMarked(p.marked).map(function (x, i, arr) {
      if (i === 0 && x[1] === null) x[0] = x[0].replace(/^[\s“”"‘]+/, '');
      if (i === arr.length - 1 && x[1] === null) x[0] = x[0].replace(/[\s“”"’]+$/, '');
      return x;
    });
    if (p.exact && !p.left_out) return piecesOf(text, wordList(text).map(function () { return true; }));
    return piecesOf(text, hits(text, quote));
  }

  function detailsFold(summary) {
    var f = el('details', 'qc-details');
    add(f, el('summary', null, summary));
    return f;
  }
  function sub(parent, title) { return add(parent, el('h3', 'qc-sub', title)); }
  function workList(list) {
    var ul = el('ul', 'qc-works');
    list.forEach(function (m) { add(ul, add(el('li'), where(m), ' · ' + closeness(m), m.credit ? ' · credited there to ' + m.credit : '')); });
    return ul;
  }

  function render(d) {
    d.quote = String(d.quote || '');
    d.author = d.author ? String(d.author) : '';
    var who = d.author;
    var p = d.primary && typeof d.primary === 'object' ? d.primary : null;
    /* The earliest work with the words names the credited writer next to them ("Well says Baxter, ..."). */
    var named = d.verdict === 'other_author' && who && p && p.named;
    var head = named ? HEAD.named : Object.prototype.hasOwnProperty.call(HEAD, d.verdict) ? HEAD[d.verdict] : ['none', 'Checked'];
    var kind = head[0], title = head[1];
    if (d.verdict === 'other_author' && who && !named) title = 'Not found in the works of ' + who;
    if (d.verdict === 'other_author' && !who) { kind = 'yes'; title = 'Found in the library'; }
    if (d.verdict === 'quoting' && who && p && p.credit) title = who + ' was quoting ' + p.credit;

    var line = null, words = null, cite = null, after2 = null, links = el('p', 'qc-links');
    var more = detailsFold('Details'), notes = [];

    /* Words of the Bible: the verse comes first, then the books that quote it. A verse that is only close gives
       way to a book by the writer named that has the words exactly, or at least as closely. */
    var b = d.bible && typeof d.bible === 'object' && d.bible.ref ? d.bible : null;
    if (b && b.near) {
      var bookShare = p && Number(p.words) > 0 ? Number(p.same) / Number(p.words) : 0;
      if (who && (d.verdict === 'exact' || d.verdict === 'scan_letters'
        || ((d.verdict === 'reworded' || d.verdict === 'left_out') && bookShare >= Number(b.same) / Number(b.words)))) {
        notes.push(['The words are also close to ' + String(b.ref) + ' (' + String(b.translation || '') + ').']);
        b = null;
      }
    }
    if (b) {
      var near = b.near === true, verse = trimQuotes(b.text);
      kind = near ? 'warn' : 'yes';
      title = near ? 'Close to a Bible verse' : 'Found in the Bible';
      words = passage(piecesOf(verse, hits(verse, d.quote)), LOOK === 'c' ? { ctx: true, ends: true } : {});
      cite = add(el('figcaption', 'qc-cite'), String(b.ref) + ', ' + String(b.translation || ''));
      var inAuthor = !near && who && p && d.author_works > 0 && d.verdict !== 'other_author' && d.verdict !== 'quoting';
      if (inAuthor) after2 = add(el('p', 'qc-line qc-after'), who + ' quotes it in ', el('cite', null, String(p.title)),
        (typeof p.year === 'number' && String(p.title).slice(-4) !== String(p.year) ? ' (' + p.year + ')' : '') + (p.pages ? ', ' + p.pages : '') + '.');
      if (near) {
        sub(more, 'Wording submitted');
        add(more, el('p', 'qc-given', d.quote));
        notes.push([Number(b.same) + ' of the ' + Number(b.words) + ' words submitted are in this verse, in the same order. Compared with the library’s seven translations, this one is the closest; the wording submitted may be from another, or quoted from memory.']);
        if (p && d.verdict === 'exact' && !p.licensed) notes.push(['The wording submitted is word for word in ', where(p), '.']);
      }
      var also = Array.isArray(b.more) ? b.more.slice(0, 6).map(String) : [], rest = (Number(b.total) || 1) - 1 - also.length;
      if (also.length) notes.push(['Also at ' + also.join(', ') + (rest > 0 ? ' and ' + plural(rest, 'other verse') : '') + '.']);
      if (!near && who && d.author_works > 0 && !inAuthor) notes.push(['None of the library’s ' + plural(d.author_works, 'work') + ' by ' + who + ' contains these words.']);
      var quoted = near ? [] : (p ? [p] : []).concat(Array.isArray(d.others) ? d.others.slice(0, 50) : []);
      if (quoted.length) {
        var nq = Math.max(quoted.length, (Number(d.others_total) || 0) + (p ? 1 : 0));
        sub(more, 'Quoted in ' + plural(nq, 'work') + ' in the library');
        add(more, workList(quoted));
        if (nq > quoted.length) add(more, el('p', 'qc-small', 'And ' + (nq - quoted.length) + ' more. Earliest first.'));
      }
    } else {
      if (!p) {
        line = 'No work in the library has these words or a close match. That does not prove them false: the library holds about 7,100 works, not everything ever written.';
        if (who) notes.push([d.author_works > 0 ? 'The library holds ' + plural(d.author_works, 'work') + ' by ' + who + ', not the complete writings.'
          : 'The library holds no works by ' + who + '.']);
      } else if (named) {
        line = (d.author_works > 0 ? 'None of the library’s ' + plural(d.author_works, 'work') + ' by ' + who + ' has these words.'
          : 'The library holds no works by ' + who + '.') + ' The earliest work that has them gives them as ' + who + '’s:';
        notes.push([who + ' may have written them in a work, edition or translation the library does not hold.']);
      } else if (d.verdict === 'other_author') {
        line = !who ? 'The earliest work in the library with these words:'
          : d.author_works > 0 ? 'None of the library’s ' + plural(d.author_works, 'work') + ' by ' + who + ' has these words. The earliest work that does:'
          : 'The library holds no works by ' + who + '. The earliest work with these words:';
        if (who && d.author_works > 0) notes.push(['This does not prove ' + who + ' never said it: the library does not hold the complete writings.']);
      } else if (d.verdict === 'scan_letters') {
        notes.push([plural(p.misread, 'word') + ' in the book’s text ' + (p.misread === 1 ? 'differs' : 'differ') + ' by one letter. The text was read by computer from a scan; the printed page is the authority.']);
      } else if (d.verdict === 'left_out') {
        notes.push(['Every word submitted is in the passage, in this order, with other words between them.']);
      } else if (d.verdict === 'quoting' && p.credit) {
        notes.push(['The line that follows these words in the source credits them to ' + p.credit + '.']);
      }
      if (p && p.licensed) {
        line = add(el('span'), 'It is in ', where(p), '. This present-day church document is used by permission of its owner, so this page shows where it is, not the text.');
        if (p.source) add(links, link(p.source, 'Read the official copy'));
      } else if (p) {
        var pcs = bookPieces(p, d.quote), ctx = LOOK === 'c' && (p.before || p.after);
        words = passage(pcs, ctx ? { ctx: true, pre: before(p.before), post: after(p.after) } : { ends: !p.after || /^[\s"”’)]*[.!?;:]/.test(p.after) });
        cite = add(el('figcaption', 'qc-cite'), where(p));
        if (p.scan) add(links, link(p.scan.url, p.scan.kind === 'page' ? 'View the printed page' : 'Find it in the scan'));
        else if (p.source) add(links, link(p.source, p.source_label === 'Official copy' ? 'Official copy' : 'See the source text'));
        if (!p.exact || d.verdict === 'left_out') {
          sub(more, 'Wording submitted');
          add(more, p.given_marked ? passage(piecesMarked(p.given_marked), { quiet: true }) : el('p', 'qc-given', d.quote));
        }
        if (p.before || p.after) {
          sub(more, 'In context');
          add(more, add(el('p', 'qc-context'), before(p.before), el('mark', null, trimQuotes(p.text)), after(p.after)));
        }
        if (p.scan && p.source) notes.push(['The library’s text: ', link(p.source, p.source_label === 'Official copy' ? 'official copy' : 'source'), '.']);
        if (p.ocr) notes.push(['This text was read by computer from a scan and may contain misread letters. Compare the printed page before quoting.']);
        if (!p.credit && p.quoting) notes.push(['The writer appears to be quoting someone at this point.']);
      }
      var others = Array.isArray(d.others) ? d.others.slice(0, 50) : [], total = Number(d.others_total) || others.length;
      if (others.length) {
        sub(more, 'Also in ' + plural(total, 'other work'));
        add(more, workList(others));
        if (total > others.length) add(more, el('p', 'qc-small', 'And ' + (total - others.length) + ' more. Earliest first.'));
      }
      if (d.common) notes.push(['These exact words are in many works. They may be a Bible verse, a proverb or a common saying.']);
      if (d.earlier) notes.push([(d.earlier.exact ? 'The same words are' : 'Similar words are') + ' in an earlier work: ', where(d.earlier), '.' + (who ? ' ' + who + ' may have been quoting it.' : '')]);
      (Array.isArray(d.notes) ? d.notes.slice(0, 20) : []).forEach(function (n) { notes.push([String(n)]); });
      if (p && p.about) notes.push([p.author + ': ' + p.about + '.']);
      if (p && p.church) notes.push([p.church]);
    }
    if (notes.length) {
      if (more.children.length > 1) sub(more, 'Notes');
      var nl = el('ul', 'qc-notes');
      notes.forEach(function (parts) { add(nl, add.apply(null, [el('li')].concat(parts))); });
      add(more, nl);
    }

    var card = el('article', 'qc-card qc-' + kind + (calm ? '' : ' qc-reveal'));
    card.tabIndex = -1;
    add(card, el('span', 'qc-top'), add(el('h2', 'qc-verdict'), markSvg(kind), el('span', 'qc-title', title)));
    if (line) add(card, add(el('p', 'qc-line'), line));
    if (words) add(card, add(el('figure', 'qc-quote'), words, cite));
    if (after2) add(card, after2);
    if (links.firstChild) add(card, links);
    var rest2 = el('div', 'qc-rest');
    if (more.children.length > 1) add(rest2, more);
    add(card, rest2);
    finish(card, rest2, d, title, kind);
  }

  var ICON = {
    share: 'M12 3.5v11M8 7.2l4-3.7 4 3.7M7.5 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5',
    image: 'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5zM3.5 16l4.6-4.6a1.2 1.2 0 0 1 1.7 0l6.7 6.7M14 13.5l1.6-1.6a1.2 1.2 0 0 1 1.7 0l3.2 3.2M15.5 9a1.5 1.5 0 1 0 0-.01',
    done: 'M5 12.5l4.5 4.5L19 7.5'
  };
  function iconBtn(d, label) {
    var b = el('button', 'qc-icon');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
    return b;
  }
  /* A tick on the button and a word beside it for a moment ("Link copied"). */
  function said(b, text) {
    var path = b.querySelector('path'), was = path.getAttribute('d'), note = b.parentNode.querySelector('.qc-said');
    path.setAttribute('d', ICON.done);
    b.classList.add('qc-ok');
    if (note) { note.textContent = text; note.classList.add('qc-on'); }
    setTimeout(function () { path.setAttribute('d', was); b.classList.remove('qc-ok'); if (note) note.classList.remove('qc-on'); }, 2200);
  }

  /* The buttons under a result; then the result takes the place of the "searching" card. */
  function finish(card, rest, d, title, kind) {
    /* Two small buttons beside the verdict: share the link, share the picture. A new check is the box's ×. */
    var acts = el('div', 'qc-acts');
    var btn = iconBtn(ICON.share, 'Share link');
    btn.addEventListener('click', function () { shareIt(d, title, btn); });
    var pic = iconBtn(ICON.image, 'Share image');
    pic.disabled = true;
    var file = null;
    /* Drawn now, so the click can hand it to the share sheet at once (Safari shares only straight from a tap). */
    picture(d, title, kind, card).then(function (f) { file = f; pic.disabled = !f; }, function () { pic.hidden = true; });
    pic.addEventListener('click', function () { if (file) sharePicture(file, pic); });
    add(acts, el('span', 'qc-said'), btn, pic);
    var h2 = card.querySelector('.qc-verdict'), head = el('div', 'qc-head');
    card.insertBefore(head, h2);
    add(head, h2, acts);
    morph(function () {
      out.textContent = '';
      add(out, card);
      boxState(['qc-done', 'qc-' + kind]);
      fit();
    });
    if (!calm) { void box.offsetWidth; box.classList.add('qc-landed'); }
    if (cta) cta.hidden = false;
    show(box, 'start');
    card.focus({ preventScroll: true });
    if (!calm) buzz();
  }

  /* A light tap as the answer lands: the vibration call where there is one; on iPhones, a switch control toggled
     out of sight (Safari answers a switch with a tap of the Taptic Engine). Nothing happens elsewhere. */
  function buzz() {
    try {
      if (navigator.vibrate) { navigator.vibrate(12); return; }
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

  function shareUrl(q, a) {
    return SITE + '#q=' + encodeURIComponent(q) + (a ? '&a=' + encodeURIComponent(a) : '');
  }
  function shareIt(d, title, btn) {
    var url = shareUrl(d.quote, d.author || '');
    var short = d.quote.length > 90 ? d.quote.slice(0, 87).replace(/\s+\S*$/, '') + '…' : d.quote;
    var text = '“' + short + '”' + (d.author ? ' (' + d.author + ')' : '') + ': ' + title + '. Checked against the text of 7,100 books:';
    if (navigator.share) {
      navigator.share({ title: 'Check a quote', text: text, url: url }).catch(function () {});
      return;
    }
    var done = function () { said(btn, 'Link copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + ' ' + url).then(done, function () { prompt('Copy this link:', url); });
    } else {
      prompt('Copy this link:', url);
    }
  }

  /* The result as a picture (1080 wide, as tall as it needs, light), drawn like the card: the verdict and its mark, the words with
     the same marking, where they are, and the site's address. */
  var PIC = { yes: '#2f7a4b', warn: '#8a5a00', no: '#b3261e', none: '#555555' };
  var SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
  function citeText(m) {
    var y = typeof m.year === 'number' ? String(m.year) : '', t = String(m.title || '');
    var hasYear = y !== '' && (t.slice(-y.length) === y || t.slice(-y.length - 1) === y + ')');
    return (m.author && !/^various$/i.test(m.author) ? m.author + ', ' : '') + t + (hasYear || !y ? '' : ' (' + y + ')')
      + (m.pages ? ', ' + m.pages : '');
  }
  function picture(d, title, kind, card) {
    var c = document.createElement('canvas');
    if (!c.getContext || !c.toBlob) return Promise.reject(new Error('no canvas'));
    var fonts = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('600 40px Geist'), document.fonts.load('400 40px Geist')]).catch(function () {})
      : Promise.resolve();
    var icon = new Image();
    var iconReady = new Promise(function (ok) { icon.onload = icon.onerror = function () { ok(); }; icon.src = 'img/icon-512.png'; });
    // The words as the card shows them (without the sentence around them), each with its marking.
    var toks = [], cut = false, bq = card.querySelector('.qc-quote .qc-words'), citeEl = card.querySelector('.qc-quote .qc-cite');
    if (bq) Array.prototype.forEach.call(bq.childNodes, function (n) {
      var k = n.nodeType === 1 ? (n.classList.contains('qc-hit') ? 'hit' : n.classList.contains('qc-diff') ? 'diff' : n.classList.contains('qc-ctx') ? 'ctx' : '') : '';
      // The sentence around the words is left out; its punctuation stays.
      // Where the sentence is cut, its punctuation on either side goes too.
      if (k === 'ctx' && /[\p{L}\p{N}]/u.test(n.textContent)) {
        while (toks.length && !/[\p{L}\p{N}]/u.test(toks[toks.length - 1][0])) toks.pop();
        cut = true;
        return;
      }
      String(n.textContent).split(/(\s+)/).forEach(function (s) {
        if (!s) return;
        var word = /[\p{L}\p{N}]/u.test(s);
        if (cut && !word) return;
        if (cut && word && toks.length) toks.push([' ', '']);
        cut = false;
        toks.push([s, k === 'ctx' ? '' : k]);
      });
    });
    // No space at either end, none doubled, none before a stop or comma, and no stop or comma first.
    toks = toks.reduce(function (acc, t) {
      var sp = /^\s+$/.test(t[0]), prev = acc[acc.length - 1];
      if (sp && (!prev || /^\s+$/.test(prev[0]))) return acc;
      if (!sp && /^[^\p{L}\p{N}“‘…]+$/u.test(t[0]) && /^[,.;:!?’”)]/.test(t[0])) {
        if (prev && /^\s+$/.test(prev[0])) acc.pop();
        if (!acc.length) return acc;
      }
      acc.push(sp ? [' ', t[1]] : t);
      return acc;
    }, []);
    while (toks.length && /^\s+$/.test(toks[toks.length - 1][0])) toks.pop();
    if (bq && bq.classList.contains('qc-hang') === false && toks.length) { toks.unshift(['“', '']); toks.push(['”', '']); }
    var cite = citeEl ? citeEl.textContent : '';
    if (!bq) { toks = []; d.quote.split(/(\s+)/).forEach(function (s) { if (s) toks.push([s, '']); }); toks.unshift(['“', '']); toks.push(['”', '']); cite = d.author ? 'As credited to ' + d.author : ''; }
    var lineEl = card.querySelector('.qc-line');
    return Promise.all([fonts, iconReady]).then(function () {
      /* The picture is as tall as what it holds: laid out first, then drawn. */
      var W = 1080, M = 88, F = 'Geist, system-ui, -apple-system, sans-serif';
      c.width = W; c.height = 10;
      var g = c.getContext('2d');
      var col = PIC[kind] || PIC.none;
      function lines(text, font, width) {
        g.font = font;
        var out2 = [], line = '';
        String(text).split(/\s+/).forEach(function (w) {
          if (!w) return;
          var t = line ? line + ' ' + w : w;
          if (line && g.measureText(t).width > width) { out2.push(line); line = w; } else { line = t; }
        });
        if (line) out2.push(line);
        return out2;
      }
      function draw(ls, x, y, lh) { ls.forEach(function (l, i) { g.fillText(l, x, y + i * lh); }); return y + ls.length * lh; }
      function layout(sz) {
        g.font = '400 ' + sz + 'px ' + SERIF;
        var rs = [[]], x = 0, max = W - M * 2;
        toks.forEach(function (t) {
          var w = g.measureText(t[0]).width, sp = /^\s+$/.test(t[0]);
          if (sp) { if (rs[rs.length - 1].length) { rs[rs.length - 1].push([' ', t[1], w]); x += w; } return; }
          if (x + w > max && rs[rs.length - 1].length) {
            var last = rs[rs.length - 1];
            while (last.length && last[last.length - 1][0] === ' ') last.pop();
            rs.push([]); x = 0;
          }
          rs[rs.length - 1].push([t[0], t[1], w]); x += w;
        });
        return rs;
      }
      var tx = MARK[kind] && window.Path2D ? M + 74 : M;
      var titleLines = lines(title, '650 46px ' + F, W - tx - M);
      var noteLines = lineEl && !bq ? lines(lineEl.textContent, '400 32px ' + F, W - M * 2) : [];
      var citeFont = '400 30px ' + F, citeLines = cite ? lines(cite, citeFont, W - M * 2) : [];
      var size, lh, rows, MAXROWS = 9;
      for (size = 60; size >= 34; size -= 2) {
        lh = Math.round(size * 1.42);
        rows = layout(size);
        if (rows.length <= MAXROWS) break;
      }
      if (rows.length > MAXROWS) { rows = rows.slice(0, MAXROWS); rows[MAXROWS - 1].push(['…”', '', 0]); }
      var headY = M + 34, wordsTop = headY + (titleLines.length - 1) * 58 + (noteLines.length ? 40 + noteLines.length * 46 : 0) + 64;
      var citeY = wordsTop + rows.length * lh + 26, footTop = citeY + (citeLines.length ? citeLines.length * 42 + 40 : 0) + 24;
      var H = footTop + 98 + 66;
      c.height = H;
      g = c.getContext('2d');
      g.textBaseline = 'alphabetic';
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
      g.fillStyle = col; g.fillRect(0, 0, W, 12);

      // The verdict, with its mark drawn as a stroke.
      if (tx !== M) {
        g.save(); g.translate(M - 6, headY - 46); g.scale(2.5, 2.5);
        g.strokeStyle = col; g.lineWidth = 2.1; g.lineCap = 'round'; g.lineJoin = 'round';
        MARK[kind].forEach(function (dd) { g.stroke(new Path2D(dd)); });
        g.restore();
      }
      g.fillStyle = col; g.font = '650 46px ' + F;
      var y = draw(titleLines, tx, headY, 58);
      if (noteLines.length) { g.fillStyle = '#2e2e2e'; g.font = '400 32px ' + F; draw(noteLines, M, y - 58 + 40 + 46, 46); }

      // The words, with the highlighter behind the words found.
      y = wordsTop + size;
      g.font = '400 ' + size + 'px ' + SERIF;
      rows.forEach(function (r) {
        var x = M;
        r.forEach(function (t, i) {
          var w = t[2] || g.measureText(t[0]).width;
          var next = r[i + 1];
          if (t[1] === 'hit' && !(t[0] === ' ' && !(next && next[1] === 'hit'))) { g.fillStyle = '#f6e2a0'; g.fillRect(x, y - size * 0.62, w, size * 0.82); }
          if (t[1] === 'diff') { g.fillStyle = PIC.warn; g.fillRect(x, y + size * 0.16, w, Math.max(3, size * 0.06)); }
          x += w;
        });
        x = M;
        g.fillStyle = '#1a1a1a';
        r.forEach(function (t) { g.fillText(t[0], x, y); x += t[2] || g.measureText(t[0]).width; });
        y += lh;
      });
      if (citeLines.length) { g.font = citeFont; g.fillStyle = '#555555'; draw(citeLines, M, citeY + 30, 42); }

      // The site.
      g.fillStyle = '#e3e3e3'; g.fillRect(M, footTop, W - M * 2, 2);
      if (icon.naturalWidth) g.drawImage(icon, M, footTop + 34, 64, 64);
      var fx = icon.naturalWidth ? M + 88 : M;
      g.fillStyle = '#1a1a1a'; g.font = '700 32px ' + F; g.fillText('Christian Open Library', fx, footTop + 62);
      g.fillStyle = '#555555'; g.font = '400 26px ' + F;
      g.fillText('Checked against 7,100 books · christianopenlibrary.org/quote', fx, footTop + 98);
      return new Promise(function (ok) { c.toBlob(ok, 'image/png'); });
    }).then(function (blob) {
      if (!blob) throw new Error('no image');
      try { return new File([blob], 'quote-check.png', { type: 'image/png' }); } catch (e) { blob.name = 'quote-check.png'; return blob; }
    });
  }
  function sharePicture(file, btn) {
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(function () {});
      return;
    }
    var a = el('a');
    a.href = URL.createObjectURL(file);
    a.download = 'quote-check.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    said(btn, 'Image saved');
  }

  /* One box: the quotation as people copy it, with the credit if there is one:
       "words" — C. H. Spurgeon, Morning and Evening  |  words -Spurgeon  |  words, then "~ John Owen" on a new line
       Spurgeon said, "words"  |  Spurgeon: "words"
     A credit must look like a name (1 to 6 capitalized words), so a dash inside the quotation isn't taken for
     one. What follows the name (a comma, "in", a title in brackets, a date) is dropped. */
  var SMALL = /^(of|de|du|la|le|van|von|der|den|the|and|à|da|di)$/i;
  function nameOf(s) {
    s = s.replace(/^\s*by\s+/i, '').split(/\s*(?:[,;(\[:]|\s(?:in|from|on)\s|\d)/)[0].trim();
    s = s.replace(/[\s”"'*_]+$/, '');
    var w = s.split(/\s+/).filter(Boolean);
    if (!w.length || w.length > 6 || s.length > 60 || !/^\p{Lu}/u.test(w[0])) return '';
    for (var i = 0; i < w.length; i++) {
      if (!/^[\p{L}.'’-]+$/u.test(w[i])) return '';
      if (!/^\p{Lu}/u.test(w[i]) && !SMALL.test(w[i])) return '';
    }
    return s.replace(/,$/, '');
  }
  function unquote(t) { return t.replace(/^[\s“”‘’"'«»]+|[\s“”‘’"'«»]+$/g, ''); }
  function split(text) {
    var t = text.trim(), m, who;
    // The last dash: "\s-" (a hyphen needs a space before it, so "Jean-Baptiste" stays whole), or a long dash or ~.
    m = t.match(/^([\s\S]*\S)\s+(?:—|–|~|-{1,2})\s*([^\n—–~]{1,120})$/) || t.match(/^([\s\S]*\S)\s*(?:—|–|~)\s*([^\n—–~]{1,120})$/);
    if (m && (who = nameOf(m[2]))) return { quote: unquote(m[1]), author: who };
    m = t.match(/^([^\n"“:]{2,60}?)\s+(?:said|says|wrote|writes)\s*[,:]?\s*([“"][\s\S]+)$/i) || t.match(/^([^\n"“:]{2,60}?):\s*([“"][\s\S]+)$/);
    if (m && (who = nameOf(m[1]))) return { quote: unquote(m[2]), author: who };
    return { quote: unquote(t), author: '' };
  }
  function joined(q, a) { return a ? '“' + q + '” — ' + a : q; }

  function say(text) {
    msg.textContent = text;
    msg.hidden = !text;
  }

  /* A cut at a fixed length can split an emoji in two, and half of one can't be sent or put in a link. */
  function cut(text, n) { return text.slice(0, n).replace(/[\uD800-\uDBFF]$/, ''); }

  /* direct: the quotation and name from a share link, used as they are (the box's text isn't read again). */
  function check(direct) {
    if (busy) return;
    var parts = direct || split(quoteBox.value);
    var q = cut(parts.quote, 1500), a = cut(parts.author || '', 100);
    if (!q) { say('Type or paste the words to check.'); quoteBox.focus(); return; }
    if (words(q) < 4) { say('That is too short to check: give at least 4 words.'); quoteBox.focus(); return; }
    say('');
    busy = true;
    go.disabled = true;
    go.textContent = 'Checking…';
    quoteBox.blur();
    /* While it searches, a light runs round the edge of the box; nothing else changes until the answer comes. */
    var wait = el('span', 'qc-wait sr', 'Searching 7,100 books');
    wait.setAttribute('role', 'status');
    out.textContent = '';
    add(out, wait);
    boxState(['qc-busy']);
    show(box, 'start');
    clearTimeout(waitTimer);
    waitTimer = setTimeout(function () { go.textContent = 'Still checking…'; wait.textContent = 'Still searching. Long quotations take a little longer.'; }, 9000);
    var stop = window.AbortController ? new AbortController() : null;
    var giveUp = setTimeout(function () { if (stop) stop.abort(); }, 30000);
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(a ? { quote: q, author: a } : { quote: q }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: stop ? stop.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (res) {
      if (res.ok && res.d && res.d.verdict) {
        render(res.d);
      } else {
        fold(false);
        say((res.d && res.d.error) || 'The checker didn’t answer. Please try again in a moment.');
        show(msg, 'center');
      }
    }).catch(function () {
      fold(false);
      say('The checker couldn’t be reached. Check your connection and try again.');
      show(msg, 'center');
    }).then(function () {
      clearTimeout(waitTimer);
      clearTimeout(giveUp);
      busy = false;
      go.disabled = false;
      go.textContent = 'Check quote';
    });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); if (!busy && !calm) buzz(); check(); });
  function noHash() { if (location.hash && history.replaceState) history.replaceState(null, '', location.pathname + location.search); }
  quoteBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); check(); }
  });
  /* Changing the words folds the answer away: it was the answer to other words. */
  quoteBox.addEventListener('input', function () {
    if (box.classList.contains('qc-done')) fold(false); else fit();
    if (!msg.hidden) say('');
  });
  if (clearBtn) clearBtn.addEventListener('click', function () { fold(true); say(''); noHash(); quoteBox.focus(); });

  /* A shared link: #q=...&a=... */
  function fromHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    var q = '', a = '';
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      var v;
      try { v = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { return; }
      if (kv.slice(0, i) === 'q') q = cut(v, 1500);
      if (kv.slice(0, i) === 'a') a = cut(v, 100);
    });
    if (q) {
      setBox(joined(q, a));
      // The check runs by itself only in a page the visitor opened: not inside another site's frame, and not in a
      // window another page opened and can keep reloading. There the box is filled in and waits for a click.
      if (window.top === window.self && !window.opener) check({ quote: q, author: a });
    }
  }
  fromHash();
})();
