const { chromium } = require(process.env.PW); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1236, height: 1600 } });
  const imgs = [];
  for (const t of ['light', 'dark']) {
    const html = fs.readFileSync(`06-counted-${t}.html`, 'utf8').replace('</style>', '.poster > *:not(.flare){display:none!important}</style>');
    fs.writeFileSync('_bgonly.html', html); await p.goto('file://' + process.cwd() + '/_bgonly.html'); await p.waitForTimeout(300);
    const buf = await p.screenshot({ type: 'png' }); fs.writeFileSync(`Background-${t}.png`, buf); imgs.push(buf.toString('base64'));
  }
  await p.setContent(`<style>@page{size:8.5in 11in;margin:0}body{margin:0}img{display:block;width:8.5in;height:11in;page-break-after:always}img:last-child{page-break-after:auto}</style>${imgs.map(s => `<img src="data:image/png;base64,${s}">`).join('')}`);
  await p.pdf({ path: 'Shiur-Daled-Mivtzoim-Backgrounds-8.5x11.pdf', width: '8.5in', height: '11in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await b.close(); })();
