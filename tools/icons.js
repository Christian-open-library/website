// Render the PNG icons and the link-preview image from docs/img/icon.svg.
// Run from anywhere:  NODE_PATH=~/Projects/node_modules node tools/icons.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const DOCS = path.resolve(__dirname, '..', 'docs');
const svg = fs.readFileSync(path.join(DOCS, 'img/icon.svg'), 'utf8');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const font = 'data:font/woff2;base64,' + fs.readFileSync(path.join(DOCS, 'fonts/geist-latin-wght-normal.woff2')).toString('base64');

// Greek and Hebrew letters from the first icon, repeated in a fixed shuffled order
const LETTERS = 'הקΣΛבνμשביטרμηυκζדשיγחΒכפטכλαגεδνπחβקΣ';
const letters = Array.from({ length: 72 }, (_, i) => `<span>${[...LETTERS][(i * 7 + 3) % [...LETTERS].length]}</span>`).join('');

const card = `<!doctype html><style>
@font-face { font-family: Geist; src: url(${font}) format("woff2"); font-weight: 100 900; }
html, body { margin: 0; }
body { width: 1200px; height: 630px; background: #fff; font-family: Geist, sans-serif; color: #1a1a1a;
       display: flex; align-items: center; gap: 64px; padding: 0 96px; box-sizing: border-box; position: relative; }
img { width: 280px; height: 280px; flex: none; }
h1 { font-size: 84px; line-height: 1.02; letter-spacing: -.03em; font-weight: 700; margin: 0 0 28px; }
p { font-size: 32px; line-height: 1.35; color: #555; margin: 0; text-wrap: balance; }
.bar { position: absolute; left: 0; right: 0; bottom: 0; height: 14px; background: #e2bc62; }
.letters { position: absolute; left: 0; right: 0; top: 0; height: 150px; overflow: hidden; font-family: 'DejaVu Serif', Georgia, serif; color: #c9a45c; font-size: 30px;
           display: grid; grid-template-columns: repeat(24, 50px); grid-auto-rows: 44px; justify-content: center; padding-top: 14px;
           -webkit-mask-image: linear-gradient(#000, transparent); mask-image: linear-gradient(#000, transparent); opacity: .5; }
.letters span { text-align: center; }
.url { position: absolute; left: 96px; bottom: 44px; font-size: 26px; color: #555; letter-spacing: .01em; }
</style><div class="letters">${letters}</div><img src="${icon}"><div><h1>Christian Open Library</h1>
<p>About 6,400 public-domain Christian books, searchable from Claude, ChatGPT, Gemini or Grok.</p></div>
<div class="url">christianopenlibrary.org</div><div class="bar"></div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  for (const [name, size] of [['favicon.png', 48], ['apple-touch-icon.png', 180], ['icon-512.png', 512]]) {
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
  console.log('wrote favicon.png, apple-touch-icon.png, icon-512.png, og.png');
})();
