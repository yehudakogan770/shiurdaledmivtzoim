const { chromium } = require(process.env.PW); const fs = require('fs'); const path = require('path');
(async () => {
  const D = process.env.D; const b = await chromium.launch(); const p = await b.newPage();
  const sets = [
    ['Posters', (n) => /^(0\d|1[01])-.*-(light|dark)\.html$/.test(n) && !n.startsWith('card-'), 1236, 1600],
  ];
  for (const [label, match, w, h] of sets) for (const theme of ['light', 'dark']) {
    const files = fs.readdirSync(D).filter(n => match(n) && n.endsWith(`-${theme}.html`)).sort();
    let css = '', bodies = [];
    for (const f of files) {
      const html = fs.readFileSync(path.join(D, f), 'utf8');
      if (!css) css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
      if (!css.includes('f3/')) css = fs.readFileSync(path.join(D, 'f3/fonts.css'), 'utf8') + css.replace(/@font-face\s*{[^}]*}/g, '');
      bodies.push(html.match(/<body>([\s\S]*)<\/body>/)[1]);
    }
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
      body{width:auto!important;height:auto!important;overflow:visible!important}
      *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
      .glass,.foot{background:color-mix(in srgb,var(--paper) 72%,transparent)!important}
      @page{size:${w}px ${h}px;margin:0}
      .poster{page-break-after:always;break-after:page}
      .poster:last-child{page-break-after:auto}</style></head><body>${bodies.join('')}</body></html>`;
    const tmp = path.join(D, `_editable-${label}-${theme}.html`); fs.writeFileSync(tmp, doc);
    await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
    const out = path.join(D, `Canva-${label}-${theme === 'light' ? 'Light' : 'Dark'}.pdf`);
    await p.pdf({ path: out, width: `${w}px`, height: `${h}px`, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log(path.basename(out), files.length, 'pages', (fs.statSync(out).size / 1e6).toFixed(1) + 'MB');
  }
  await b.close();
})();
