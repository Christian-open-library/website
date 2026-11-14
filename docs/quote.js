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
  var authorBox = document.getElementById('qc-author');
  var go = document.getElementById('qc-go');
  var msg = document.getElementById('qc-msg');
  var out = document.getElementById('qc-result');
  var busy = false;

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
    var a = el('a', null, text);
    a.href = href;
    a.rel = 'noopener';
    return a;
  }
  /* "**word**" marks from the server become <strong>. */
  function marked(text) {
    var span = el('span');
    String(text).split('**').forEach(function (part, i) {
      if (part === '') return;
      add(span, i % 2 ? el('strong', null, part) : part);
    });
    return span;
  }
  function plural(n, word) { return n.toLocaleString('en-US') + ' ' + word + (n === 1 ? '' : 's'); }
  function words(text) { return (text.match(/[\p{L}\p{N}]+/gu) || []).length; }

  /* "John Owen (1616–1683), Of the Mortification of Sin (1668), p. 11" as nodes, the title in italics. */
  function where(m) {
    var f = document.createDocumentFragment();
    if (m.author) add(f, m.author + (m.dates ? ' (' + m.dates + ')' : '') + ', ');
    add(f, el('cite', null, m.title), m.year ? ' (' + m.year + ')' : ' (year not known)', m.pages ? ', ' + m.pages : '');
    return f;
  }
  function closeness(m) {
    if (m.exact) return m.left_out ? 'every word, with words between them' : 'word for word';
    if (m.misread && m.same === m.words) return plural(m.misread, 'word') + ' differ by a letter';
    return m.same + ' of ' + m.words + ' words the same';
  }

  var HEAD = {
    exact: ['yes', 'Found word for word'],
    scan_letters: ['warn', 'Found, but check the scan'],
    left_out: ['warn', 'Found, with words left out'],
    reworded: ['warn', 'Found, but worded differently'],
    quoting: ['warn', 'Found, but they were quoting someone'],
    other_author: ['no', 'Found, but not by them'],
    not_found: ['none', 'Not found in the library']
  };

  function render(d) {
    out.textContent = '';
    var head = HEAD[d.verdict] || ['none', 'Checked'];
    var who = d.author;
    var p = d.primary;
    var card = el('article', 'qc-card qc-' + head[0]);
    var title = head[1];
    if (d.verdict === 'other_author' && who) title = 'Found, but not by ' + who;
    if (d.verdict === 'quoting' && who && p && p.credit) title = 'Found, but ' + who + ' was quoting ' + p.credit;
    add(card, el('h2', 'qc-verdict', title));
    var asked = el('p', 'qc-asked');
    add(asked, '“' + d.quote + '”', who ? ' — credited to ' + who : '');
    add(card, asked);

    var lines = [];
    if (!p) {
      lines.push(['No book in the library has these words or anything close to them. That doesn’t prove they’re made up: the library has about 6,400 books, not everything ever written.']);
      if (who) lines.push([d.author_works > 0
        ? 'The library has ' + plural(d.author_works, 'work') + ' by ' + who + ', not everything they wrote.'
        : 'The library has no works by ' + who + '.']);
    } else if (d.verdict === 'exact') {
      lines.push(['These words are in ', where(p), '.']);
    } else if (d.verdict === 'scan_letters') {
      lines.push(['The words are in ', where(p), ', except that ' + plural(p.misread, 'word') + ' in the book’s text ' + (p.misread === 1 ? 'differs' : 'differ') + ' by a letter. The text was read by computer from a scan, so open the printed page to see which is right.']);
    } else if (d.verdict === 'left_out') {
      lines.push(['Every word you gave is in ', where(p), ', in this order, but with other words between them. Read the full wording before you use it.']);
    } else if (d.verdict === 'reworded') {
      lines.push(['The closest wording is in ', where(p), ': ' + p.same + ' of the ' + p.words + ' words you gave are there, in the same order. The quotation has drifted; use the real wording.']);
    } else if (d.verdict === 'quoting') {
      lines.push(['The words are in ', where(p), ', but a line after them credits them to ' + p.credit + '. They are ' + p.credit + '’s words, quoted by ' + who + '.']);
    } else if (d.verdict === 'other_author') {
      lines.push(['The earliest book in the library with these words is ', where(p), '.']);
      if (who) lines.push([d.author_works > 0
        ? 'None of the library’s ' + plural(d.author_works, 'work') + ' by ' + who + ' has them. That doesn’t prove ' + who + ' never said it, but the credit isn’t confirmed.'
        : 'The library has no works by ' + who + ', so it can’t confirm the credit.']);
    }
    if (d.common) lines.push(['These exact words are in many books, so they may be a Bible verse, a proverb or a common saying. The earliest book the library has isn’t necessarily where they started.']);
    if (d.earlier) lines.push([(d.earlier.exact ? 'The same words are' : 'Similar words are') + ' in an earlier book: ', where(d.earlier), '.' + (who ? ' ' + who + ' may have been quoting it.' : '')]);
    if (p && !p.credit && p.quoting) lines.push(['Just before these words the writer seems to be quoting someone. Read the sentences around them.']);
    (d.notes || []).forEach(function (n) { lines.push([n]); });
    lines.forEach(function (parts) { add(card, add.apply(null, [el('p', 'qc-line')].concat(parts))); });

    if (p) {
      if (p.licensed) {
        add(card, add(el('p', 'qc-line qc-permission'), 'This is a present-day church document the library uses by permission of its owner, so this page shows where it is, not the text. ',
          p.source ? link(p.source, 'Read the official copy') : null));
      } else {
        if (p.exact) {
          add(card, el('p', 'qc-label', 'The library’s wording'), add(el('blockquote', 'qc-words'), p.text));
        } else {
          add(card, el('p', 'qc-label', 'The real wording'), add(el('blockquote', 'qc-words'), marked(p.marked || p.text)),
            el('p', 'qc-label', 'The wording you gave'), add(el('blockquote', 'qc-words qc-given'), marked(p.given_marked || d.quote)));
          add(card, el('p', 'qc-small', 'Words that differ are in bold. Spelling, capitals and punctuation aren’t compared.'));
        }
        if (p.before || p.after) {
          var ctx = el('details', 'qc-context');
          add(ctx, el('summary', null, 'Read it in context'),
            add(el('p'), p.before ? p.before + ' ' : '', el('mark', null, p.text), p.after ? ' ' + p.after : ''));
          add(card, ctx);
        }
        var links = el('p', 'qc-links');
        if (p.scan) add(links, link(p.scan.url, p.scan.kind === 'page' ? 'See the printed page' : 'Find it on the scan'));
        if (p.source) add(links, link(p.source, p.source_label === 'Official copy' ? 'Official copy' : 'Where the library’s copy came from'));
        if (links.firstChild) add(card, links);
        if (p.ocr) add(card, el('p', 'qc-small', 'This book’s text was read by computer from a scan, so some letters may be wrong. The printed page shows what’s really there.'));
      }
      if (p.about) add(card, el('p', 'qc-small', p.author + ': ' + p.about + '.'));
      if (p.church) add(card, el('p', 'qc-small', p.church));
    }

    if (d.others && d.others.length) {
      var also = el('details', 'qc-others');
      add(also, el('summary', null, 'Also in ' + plural(d.others_total, 'other book') + ', earliest first'));
      var ul = el('ul');
      d.others.forEach(function (m) {
        add(ul, add(el('li'), where(m), ' · ' + closeness(m), m.credit ? ' · credited there to ' + m.credit : ''));
      });
      add(also, ul);
      if (d.others_total > d.others.length) add(also, el('p', 'qc-small', 'And ' + (d.others_total - d.others.length) + ' more.'));
      add(card, also);
    }

    var share = el('p', 'qc-share');
    var btn = el('button', 'btn btn-secondary', 'Share this check');
    btn.type = 'button';
    btn.addEventListener('click', function () { shareIt(d, title, btn); });
    add(share, btn);
    add(card, share);
    add(out, card);
  }

  function shareUrl(q, a) {
    return SITE + '#q=' + encodeURIComponent(q) + (a ? '&a=' + encodeURIComponent(a) : '');
  }
  function shareIt(d, title, btn) {
    var url = shareUrl(d.quote, d.author || '');
    var short = d.quote.length > 90 ? d.quote.slice(0, 87).replace(/\s+\S*$/, '') + '…' : d.quote;
    var text = '“' + short + '”' + (d.author ? ' (' + d.author + ')' : '') + ': ' + title + '. Checked against 6,400 books:';
    if (navigator.share) {
      navigator.share({ title: 'Did they really say it?', text: text, url: url }).catch(function () {});
      return;
    }
    var done = function () { btn.textContent = 'Link copied'; setTimeout(function () { btn.textContent = 'Share this check'; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + ' ' + url).then(done, function () { prompt('Copy this link:', url); });
    } else {
      prompt('Copy this link:', url);
    }
  }

  function say(text) {
    msg.textContent = text;
    msg.hidden = !text;
  }

  function check() {
    if (busy) return;
    var q = quoteBox.value.replace(/^[\s“”"']+|[\s“”"']+$/g, '');
    var a = authorBox.value.trim().replace(/^[—–-]+\s*/, '');
    if (!q) { say('Type or paste the words to check.'); quoteBox.focus(); return; }
    if (words(q) < 4) { say('That is too short to check: give at least 4 words.'); quoteBox.focus(); return; }
    say('');
    busy = true;
    go.disabled = true;
    go.textContent = 'Checking…';
    out.textContent = '';
    add(out, el('p', 'qc-wait', 'Checking 6,400 books…'));
    if (history.replaceState) history.replaceState(null, '', '#q=' + encodeURIComponent(q) + (a ? '&a=' + encodeURIComponent(a) : ''));
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(a ? { quote: q, author: a } : { quote: q }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
    }).then(function (res) {
      if (res.ok && res.d && res.d.verdict) {
        render(res.d);
      } else {
        out.textContent = '';
        say((res.d && res.d.error) || 'The checker didn’t answer. Please try again in a moment.');
      }
    }).catch(function () {
      out.textContent = '';
      say('The checker couldn’t be reached. Check your connection and try again.');
    }).then(function () {
      busy = false;
      go.disabled = false;
      go.textContent = 'Check it';
    });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); check(); });
  quoteBox.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); check(); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('.qc-try button'), function (b) {
    b.addEventListener('click', function () {
      quoteBox.value = b.getAttribute('data-q');
      authorBox.value = b.getAttribute('data-a') || '';
      check();
    });
  });

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
      if (kv.slice(0, i) === 'q') q = v.slice(0, 1500);
      if (kv.slice(0, i) === 'a') a = v.slice(0, 100);
    });
    if (q) {
      quoteBox.value = q;
      authorBox.value = a;
      check();
    }
  }
  fromHash();
})();
