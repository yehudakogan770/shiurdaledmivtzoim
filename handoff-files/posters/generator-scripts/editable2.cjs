const { chromium } = require(process.env.PW); const fs = require('fs'); const path = require('path');
(async () => {
  const D = process.env.D; const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1236, height: 1600 } });
  const f3 = fs.readFileSync(path.join(D, 'f3/fonts.css'), 'utf8');
  const f4 = fs.readFileSync(path.join(D, 'f4/fonts.css'), 'utf8');
  const NOROT = `[style*="rotate"]{transform:none!important}`;
  for (const theme of ['light', 'dark']) {
    const files = fs.readdirSync(D).filter(n => /^(0\d|1[01])-.*\.html$/.test(n) && n.endsWith(`-${theme}.html`)).sort();
    let css = '', pages = [];
    for (const f of files) {
      let html = fs.readFileSync(path.join(D, f), 'utf8');
      html = html.replace(/<style>/, `<style>${f3}${f4}`).replace(/"Google Sans Flex"/g, '"DM Sans"').replace(/@font-face\s*{[^}]*f2\/[^}]*}/g, '');
      // Background pass: everything except the writing.
      const bgHtml = html.replace('</style>', `${NOROT}*{-webkit-text-fill-color:transparent!important;text-shadow:none!important}
        .phone .scr::before{-webkit-text-fill-color:currentColor!important}
        .h[style*="background-clip"]{-webkit-text-fill-color:transparent}</style>`);
      const tmp = path.join(D, '_bg.html'); fs.writeFileSync(tmp, bgHtml);
      await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
      const bg = 'data:image/jpeg;base64,' + (await p.screenshot({ type: 'jpeg', quality: 90 })).toString('base64');
      if (!css) css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
      const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
        .replace(/<div class="poster([^"]*)">/, (m, c) => `<div class="poster${c}" style="background:url(${bg}) 0 0/100% 100% no-repeat !important">`);
      pages.push(body);
    }
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${css}
      body{width:auto!important;height:auto!important;overflow:visible!important}
      @page{size:1236px 1600px;margin:0}
      .poster{page-break-after:always;break-after:page}.poster:last-child{page-break-after:auto}
      ${NOROT}
      .poster *{background:none!important;border-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;filter:none!important;outline:none!important}
      .poster img,.poster svg,.phone,.flare{visibility:hidden!important}
      .h[style*="background-clip"]{visibility:hidden!important}
      .poster *{font-variant-ligatures:none}</style></head><body>${pages.join('')}</body></html>`;
    const tmp = path.join(D, `_canva2-${theme}.html`); fs.writeFileSync(tmp, doc);
    await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
    const out = path.join(D, `Canva3-Posters-${theme === 'light' ? 'Light' : 'Dark'}.pdf`);
    await p.pdf({ path: out, width: '1236px', height: '1600px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log(path.basename(out), files.length, (fs.statSync(out).size / 1e6).toFixed(1) + 'MB');
  }
  await b.close();
})();
