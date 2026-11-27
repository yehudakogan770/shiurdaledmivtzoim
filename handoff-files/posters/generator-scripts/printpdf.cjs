const { chromium } = require(process.env.PW); const fs = require('fs');
(async () => {
  const D = process.env.D;
  const all = fs.readdirSync(D + '/cards').filter(f => f.endsWith('.png')).sort();
  const order = [...all.filter(f => f.endsWith('-light.png')), ...all.filter(f => f.endsWith('-dark.png'))];
  const b = await chromium.launch(); const p = await b.newPage();
  const jpg = [];
  for (const f of order) {
    await p.setContent(`<img id=i src="data:image/png;base64,${fs.readFileSync(`${D}/cards/${f}`).toString('base64')}">`);
    jpg.push(await p.evaluate(async () => { const i = document.getElementById('i'); await i.decode(); const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); return c.toDataURL('image/jpeg', 0.93); }));
  }
  // Light cards fill their own sheets, then dark: 4 per sheet, 5 x 3.5 in each.
  const nLight = order.filter(f => f.endsWith('-light.png')).length;
  const groups = [];
  for (const [s, e] of [[0, nLight], [nLight, jpg.length]]) for (let i = s; i < e; i += 4) groups.push(jpg.slice(i, Math.min(i + 4, e)));
  const sheet = (g) => `<div class="sheet">${g.map(s => `<div class="cell"><img src="${s}"></div>`).join('')}</div>`;
  await p.setContent(`<style>@page{size:11in 8.5in;margin:0}*{margin:0;padding:0}
    .sheet{width:11in;height:8.5in;display:grid;grid-template-columns:5in 5in;grid-template-rows:3.5in 3.5in;gap:.3in;padding:.6in .35in;justify-content:center;align-content:center;page-break-after:always;box-sizing:border-box}
    .sheet:last-child{page-break-after:auto}
    .cell{position:relative;width:5in;height:3.5in;outline:.5pt dashed #9aa0a6;outline-offset:.06in}
    .cell img{display:block;width:5in;height:3.5in}</style>${groups.map(sheet).join('')}`);
  await p.pdf({ path: process.env.OUT, width: '11in', height: '8.5in', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await b.close(); console.log(order.length, 'cards on', groups.length, 'sheets');
})();
