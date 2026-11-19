// Render the PNG icons and the link-preview image from docs/img/icon.svg.
// Run from anywhere:  NODE_PATH=~/Projects/node_modules node tools/icons.js [--og]   (needs Playwright + Chromium)
// --og redraws only the link-preview card (the nightly does this, so the work count stays current).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DOCS = path.resolve(__dirname, '..', 'docs');
const svg = fs.readFileSync(path.join(DOCS, 'img/icon.svg'), 'utf8');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const font = 'data:font/woff2;base64,' + fs.readFileSync(path.join(DOCS, 'fonts/geist-latin-wght-normal.woff2')).toString('base64');

// Link-preview card in the site's own look: name, the facts row and the example question from the home page.
// The work count comes from docs/catalog.json, shown as "Over N" with N the hundred below it (7,632 -> Over 7,600;
// exactly 7,600 -> Over 7,500), so the nightly can redraw it and it is always true.
const works = JSON.parse(fs.readFileSync(path.join(DOCS, 'catalog.json'), 'utf8')).works.length;
const over = (Math.floor((works - 1) / 100) * 100).toLocaleString('en-US');
const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const chat = `<svg viewBox="0 0 24 24" fill="none" stroke="#e2bc62" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16v10H9l-5 4z"/></svg>`;
const card = `<!doctype html><style>
@font-face { font-family: Geist; src: url(${font}) format("woff2"); font-weight: 100 900; }
html, body { margin: 0; }
body { width: 1200px; height: 630px; background: #fff; font-family: Geist, sans-serif; color: #1a1a1a; padding: 58px 80px 0; box-sizing: border-box; position: relative; }
header { display: flex; align-items: center; gap: 26px; }
header img { width: 92px; height: 92px; }
h1 { font-size: 78px; line-height: 1; letter-spacing: -.035em; font-weight: 700; margin: 0; }
ul { list-style: none; display: flex; justify-content: space-between; margin: 30px 0 0; padding: 16px 0; border-top: 1.5px solid #e3e3e3; border-bottom: 1.5px solid #e3e3e3;
     font-size: 26px; font-weight: 500; color: #1a1a1a; white-space: nowrap; }
li { display: flex; align-items: center; gap: 11px; }
li svg { width: 28px; height: 28px; }
.demo { display: grid; grid-template-columns: 38% 1fr; margin-top: 32px; border: 1.5px solid #d4d4d4; border-radius: 18px; overflow: hidden; height: 212px; }
.q { background: #1a1a1a; color: #fff; padding: 0 28px; display: flex; flex-direction: column; justify-content: center; gap: 12px; font-size: 28px; font-weight: 600; line-height: 1.3; }
.q svg { width: 30px; height: 30px; }
.a { background: #f4f4f1; padding: 0 30px; display: flex; flex-direction: column; justify-content: center; }
blockquote { margin: 0 0 14px; padding-left: 22px; border-left: 5px solid #e2bc62; font: 30px/1.38 'Liberation Serif', 'DejaVu Serif', serif; color: #1a1a1a; }
.src { font-size: 20px; color: #555; white-space: nowrap; }
.url { position: absolute; left: 80px; bottom: 30px; font-size: 23px; color: #555; }
</style>
<header><img src="${icon}"><h1>Christian Open Library</h1></header>
<ul>
<li>${ic('<path d="M3 5.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H3zM21 5.5h-6a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5H21z"/>')}Over ${over} works</li>
<li>${ic('<path d="M12 2v5M10 4h4M5 21V12l7-5 7 5v9M10 21v-4a2 2 0 0 1 4 0v4"/>')}80+ denominations</li>
<li>${ic('<circle cx="12" cy="12" r="9"/><path d="M10.5 9.5a3 3 0 1 0 0 5M16.5 9.5a3 3 0 1 0 0 5"/>')}Public domain</li>
<li>${ic('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>')}Open code</li>
</ul>
<div class="demo"><div class="q">${chat}What did Spurgeon say about Psalm 23?</div>
<div class="a"><blockquote>“I do not want, I cannot want; I never shall want with such a Shepherd as I have.”</blockquote>
<div class="src">Charles Spurgeon, <i>Metropolitan Tabernacle Pulpit</i>, vol. 42 (1896)</div></div></div>
<div class="url">christianopenlibrary.org</div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  const ogOnly = process.argv.includes('--og');
  if (!ogOnly) for (const [name, size] of [['favicon.png', 48], ['apple-touch-icon.png', 180], ['icon-512.png', 512]]) {
    await p.setViewportSize({ width: size, height: size });
    // apple-touch-icon: square, iOS rounds the corners itself
    const bg = name === 'apple-touch-icon.png' ? 'background:#1a1a1a' : 'background:transparent';
    await p.setContent(`<body style="margin:0;${bg}"><img src="${icon}" width="${size}" height="${size}" style="display:block"></body>`);
    await p.screenshot({ path: path.join(DOCS, 'img', name), omitBackground: name !== 'apple-touch-icon.png' });
  }
  await p.setViewportSize({ width: 1200, height: 630 });
  await p.setContent(card);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(DOCS, 'img/og.png') });
  await b.close();
  console.log(ogOnly ? `wrote og.png (over ${over} works)` : `wrote favicon.png, apple-touch-icon.png, icon-512.png, og.png (over ${over} works)`);
})();
