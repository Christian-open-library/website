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
  var clearBtn = document.getElementById('qc-clear');
  var tries = document.querySelectorAll('.qc-try button');
  var cta = document.getElementById('qc-cta');
  var busy = false;
  var waitTimer = null;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Brings the answer (or the "checking" line) into view: on a phone it would otherwise be below the screen. */
  function show(node, block) {
    if (node && node.scrollIntoView) node.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: block });
  }
  /* The box grows with the text, and the clear button shows only when there is something to clear. */
  function fit() {
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
  /* [[text, differs], ...] from the server: the words that differ become <strong>. */
  function marked(pieces) {
    var span = el('span');
    (Array.isArray(pieces) ? pieces : []).forEach(function (p) {
      if (!Array.isArray(p) || typeof p[0] !== 'string' || p[0] === '') return;
      add(span, p[1] === true ? el('strong', null, p[0]) : p[0]);
    });
    return span;
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
    left_out: ['warn', 'Found, with words omitted'],
    reworded: ['warn', 'Found with different wording'],
    quoting: ['warn', 'Found as a quotation of someone else'],
    other_author: ['no', 'Found, but not under this name'],
    named: ['warn', 'Found only as quoted'],
    not_found: ['none', 'Not found in the library']
  };

  var MARK = { yes: '✓', warn: '≈', no: '✗', none: '?' };

  function render(d) {
    out.textContent = '';
    d.quote = String(d.quote || '');
    d.author = d.author ? String(d.author) : '';
    var who = d.author;
    var p = d.primary;
    /* The earliest work with the words names the credited writer next to them ("Well says Baxter, ..."). */
    var named = d.verdict === 'other_author' && who && p && p.named;
    var head = named ? HEAD.named : Object.prototype.hasOwnProperty.call(HEAD, d.verdict) ? HEAD[d.verdict] : ['none', 'Checked'];
    var card = el('article', 'qc-card qc-' + head[0]);
    card.tabIndex = -1;
    var title = head[1];
    if (d.verdict === 'other_author' && who) title = named ? 'Found only as quoted by another writer' : 'Not found in the works of ' + who;
    if (d.verdict === 'quoting' && who && p && p.credit) title = who + ' was quoting ' + p.credit;
    var mark = el('span', 'qc-mark', MARK[head[0]] || '?');
    mark.setAttribute('aria-hidden', 'true');
    add(card, add(el('h2', 'qc-verdict'), mark, el('span', null, title)));

    /* Words of the Bible: the verse comes first, then the books that quote it. */
    var b = d.bible && typeof d.bible === 'object' && d.bible.ref ? d.bible : null;
    /* A verse that is only close gives way to a book by the writer named that has the words exactly, or at least
       as closely; the verse is then mentioned in a note. */
    var nearNote = '';
    if (b && b.near) {
      var bookShare = p && Number(p.words) > 0 ? Number(p.same) / Number(p.words) : 0;
      var bookWins = who && (d.verdict === 'exact' || d.verdict === 'scan_letters'
        || ((d.verdict === 'reworded' || d.verdict === 'left_out') && bookShare >= Number(b.same) / Number(b.words)));
      if (bookWins) {
        nearNote = 'The words are close to ' + String(b.ref) + ' (' + String(b.translation || '') + ').';
        b = null;
      }
    }
    if (b) {
      var near = b.near === true;
      card.className = 'qc-card ' + (near ? 'qc-warn' : 'qc-yes');
      mark.textContent = near ? MARK.warn : MARK.yes;
      title = (near ? 'Close to the Bible: ' : 'Found in the Bible: ') + String(b.ref);
      card.firstChild.lastChild.textContent = title;
      if (near) add(card, el('p', 'qc-line', Number(b.same) + ' of the ' + Number(b.words) + ' words submitted are in this verse, in the same order. The wording submitted may be from a translation the library does not hold, or quoted from memory.'));
      var inAuthor = !near && who && p && d.author_works > 0 && d.verdict !== 'other_author' && d.verdict !== 'quoting';
      if (inAuthor) add(card, add(el('p', 'qc-line'), who + ' quotes these words in ', el('cite', null, String(p.title)), (typeof p.year === 'number' && String(p.title).slice(-4) !== String(p.year) ? ' (' + p.year + ')' : '') + (p.pages ? ', ' + p.pages : '') + '.'));
      add(card, add(el('figure', 'qc-quote'), add(el('blockquote', 'qc-words'), String(b.text || '')),
        add(el('figcaption', 'qc-cite'), String(b.ref) + ', ' + String(b.translation || ''))));
      if (near) add(card, el('p', 'qc-label', 'Wording submitted'), add(el('blockquote', 'qc-words qc-given'), d.quote));
      var bn = el('ul', 'qc-notes'), also = Array.isArray(b.more) ? b.more.slice(0, 6).map(String) : [];
      var rest = (Number(b.total) || 1) - 1 - also.length;
      if (also.length) add(bn, el('li', null, 'Also at ' + also.join(', ') + (rest > 0 ? ' and ' + plural(rest, 'other verse') : '') + '.'));
      if (!near && who && d.author_works > 0 && !inAuthor) add(bn, el('li', null, 'None of the library’s ' + plural(d.author_works, 'work') + ' by ' + who + ' contains these words.'));
      if (near && p && d.verdict === 'exact' && !p.licensed) add(bn, add(el('li'), 'The wording submitted is word for word in ', where(p), '.'));
      add(bn, el('li', null, near ? 'Compared with seven translations; this verse is the closest. Compare it with your own Bible before quoting.' : 'Compared word for word with the translation named. Capitals and punctuation are not compared.'));
      add(card, bn);
      var quoted = near ? [] : (p ? [p] : []).concat(Array.isArray(d.others) ? d.others.slice(0, 50) : []);
      if (quoted.length) {
        var n = Math.max(quoted.length, (Number(d.others_total) || 0) + (p ? 1 : 0));
        var qf = el('details', 'qc-fold'), ql = el('ul');
        add(qf, el('summary', null, 'Quoted in ' + plural(n, 'work') + ' in the library'));
        quoted.forEach(function (m) { add(ql, add(el('li'), where(m), ' · ' + closeness(m))); });
        add(qf, ql);
        if (n > quoted.length) add(qf, el('p', 'qc-small', 'And ' + (n - quoted.length) + ' more. Earliest first.'));
        add(card, qf);
      }
      finish(card, d, title);
      return;
    }

    /* One short line under the verdict; the book itself is named under the words, like a citation. */
    var line = '', notes = [];
    if (!p) {
      line = 'No work in the library has these words or a close match.';
      notes.push(['This does not prove the quotation is false. The library holds about 7,100 works, not everything ever written.']);
      if (who) notes.push([d.author_works > 0
        ? 'The library holds ' + plural(d.author_works, 'work') + ' by ' + who + ', not the complete writings.'
        : 'The library holds no works by ' + who + '.']);
    } else if (d.verdict === 'scan_letters') {
      line = plural(p.misread, 'word') + ' in the book’s text ' + (p.misread === 1 ? 'differs' : 'differ') + ' by one letter. The text was read by computer from a scan; the printed page is the authority.';
    } else if (d.verdict === 'left_out') {
      line = 'Every word submitted is in the passage, in this order, with other words between them.';
    } else if (d.verdict === 'reworded') {
      line = p.same + ' of the ' + p.words + ' words submitted match, in the same order. The wording in the source is below.';
    } else if (d.verdict === 'quoting') {
      line = 'The line that follows these words in the source credits them to ' + p.credit + '.';
    } else if (named) {
      line = 'The earliest work in the library with these words gives them as ' + who + '’s. '
        + (d.author_works > 0 ? 'None of the library’s ' + plural(d.author_works, 'work') + ' by ' + who + ' contains them.'
          : 'The library holds no works by ' + who + '.');
      notes.push(['Read the passage in context. ' + who + ' may well have written these words in a work, edition or translation the library does not hold.']);
    } else if (d.verdict === 'other_author') {
      line = !who ? 'Earliest work in the library with these words:'
        : d.author_works > 0 ? 'None of the library’s ' + plural(d.author_works, 'work') + ' by ' + who + ' contains these words. Earliest work that does:'
        : 'The library holds no works by ' + who + ', so it cannot confirm the attribution. Earliest work with these words:';
      if (who && d.author_works > 0) notes.push(['This does not prove ' + who + ' never said it: the library does not hold the complete writings.']);
    }
    if (line) add(card, el('p', 'qc-line', line));

    if (p && p.licensed) {
      add(card, add(el('p', 'qc-line'), 'It is in ', where(p), '.'),
        add(el('p', 'qc-line qc-permission'), 'This is a present-day church document the library uses by permission of its owner, so this page shows where it is, not the text. ',
          p.source ? link(p.source, 'Read the official copy') : null));
    } else if (p) {
      var fig = el('figure', 'qc-quote');
      if (!p.exact) add(fig, el('p', 'qc-label', 'Wording in the source'));
      add(fig, add(el('blockquote', 'qc-words'), p.exact ? p.text : (p.marked ? marked(p.marked) : p.text)),
        add(el('figcaption', 'qc-cite'), where(p)));
      add(card, fig);
      if (!p.exact) {
        add(card, el('p', 'qc-label', 'Wording submitted'),
          add(el('blockquote', 'qc-words qc-given'), p.given_marked ? marked(p.given_marked) : d.quote));
      }
      var links = el('p', 'qc-links');
      if (p.scan) add(links, link(p.scan.url, p.scan.kind === 'page' ? 'View the printed page' : 'Find it in the scan'));
      if (p.source) add(links, link(p.source, p.source_label === 'Official copy' ? 'Official copy' : 'Source of the library’s text'));
      if (links.firstChild) add(card, links);
      if (p.ocr) notes.push(['This text was read by computer from a scan and may contain misread letters. Compare the printed page before quoting.']);
    }
    if (d.common) notes.push(['These exact words are in many works. They may be a Bible verse, a proverb or a common saying.']);
    if (d.earlier) notes.push([(d.earlier.exact ? 'The same words are' : 'Similar words are') + ' in an earlier work: ', where(d.earlier), '.' + (who ? ' ' + who + ' may have been quoting it.' : '')]);
    if (p && !p.credit && p.quoting) notes.push(['The writer appears to be quoting someone at this point. Read the passage in context.']);
    if (nearNote) notes.push([nearNote]);
    (Array.isArray(d.notes) ? d.notes.slice(0, 20) : []).forEach(function (n) { notes.push([String(n)]); });
    if (p && p.about) notes.push([p.author + ': ' + p.about + '.']);
    if (p && p.church) notes.push([p.church]);
    if (notes.length) {
      var nl = el('ul', 'qc-notes');
      notes.forEach(function (parts) { add(nl, add.apply(null, [el('li')].concat(parts))); });
      add(card, nl);
    }

    if (p && !p.licensed && (p.before || p.after)) {
      var ctx = el('details', 'qc-fold');
      add(ctx, el('summary', null, 'Read the passage in context'),
        add(el('p'), p.before ? p.before + ' ' : '', el('mark', null, p.text), p.after ? ' ' + p.after : ''));
      add(card, ctx);
    }
    var others = Array.isArray(d.others) ? d.others.slice(0, 50) : [], total = Number(d.others_total) || others.length;
    if (others.length) {
      var also = el('details', 'qc-fold');
      add(also, el('summary', null, 'Also in ' + plural(total, 'other work')));
      var ul = el('ul');
      others.forEach(function (m) {
        add(ul, add(el('li'), where(m), ' · ' + closeness(m), m.credit ? ' · credited there to ' + m.credit : ''));
      });
      add(also, ul);
      if (total > others.length) add(also, el('p', 'qc-small', 'And ' + (total - others.length) + ' more. Earliest first.'));
      add(card, also);
    }

    finish(card, d, title);
  }

  /* The buttons under a result; then the result is shown. */
  function finish(card, d, title) {
    var share = el('p', 'qc-share');
    var btn = el('button', 'btn btn-secondary', 'Share result');
    btn.type = 'button';
    btn.addEventListener('click', function () { shareIt(d, title, btn); });
    var again = el('button', 'btn btn-secondary', 'New check');
    again.type = 'button';
    again.addEventListener('click', function () {
      setBox('');
      say('');
      noHash();
      window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
      quoteBox.focus({ preventScroll: true });
    });
    add(share, btn, again);
    add(card, share);
    add(out, card);
    if (cta) cta.hidden = false;
    show(card, 'start');
    card.focus({ preventScroll: true });
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
    var done = function () { btn.textContent = 'Link copied ✓'; setTimeout(function () { btn.textContent = 'Share result'; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + ' ' + url).then(done, function () { prompt('Copy this link:', url); });
    } else {
      prompt('Copy this link:', url);
    }
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
    Array.prototype.forEach.call(tries, function (b) { b.disabled = true; });
    quoteBox.blur();
    out.textContent = '';
    /* A quiet placeholder in the shape of the answer, with a thin line moving along its top edge. */
    var wait = el('div', 'qc-card qc-wait');
    wait.setAttribute('role', 'status');
    var waitText = el('p', 'qc-wait-label', 'Searching 7,100 books');
    add(wait, add(el('span', 'qc-wait-track'), el('span', 'qc-wait-bar')), waitText,
      el('span', 'qc-bone qc-bone-1'), el('span', 'qc-bone qc-bone-2'), el('span', 'qc-bone qc-bone-3'));
    add(out, wait);
    show(wait, 'center');
    clearTimeout(waitTimer);
    waitTimer = setTimeout(function () { waitText.textContent = 'Still searching. Long quotations take a little longer.'; }, 9000);
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
        out.textContent = '';
        say((res.d && res.d.error) || 'The checker didn’t answer. Please try again in a moment.');
        show(msg, 'center');
      }
    }).catch(function () {
      out.textContent = '';
      say('The checker couldn’t be reached. Check your connection and try again.');
      show(msg, 'center');
    }).then(function () {
      clearTimeout(waitTimer);
      clearTimeout(giveUp);
      Array.prototype.forEach.call(tries, function (b) { b.disabled = false; });
      busy = false;
      go.disabled = false;
      go.textContent = 'Check quote';
    });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); check(); });
  function noHash() { if (location.hash && history.replaceState) history.replaceState(null, '', location.pathname + location.search); }
  quoteBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); check(); }
  });
  Array.prototype.forEach.call(tries, function (b) {
    b.addEventListener('click', function () {
      setBox(joined(b.getAttribute('data-q'), b.getAttribute('data-a') || ''));
      check();
    });
  });
  quoteBox.addEventListener('input', function () { fit(); if (!msg.hidden) say(''); });
  if (clearBtn) clearBtn.addEventListener('click', function () { setBox(''); say(''); noHash(); quoteBox.focus(); });

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
