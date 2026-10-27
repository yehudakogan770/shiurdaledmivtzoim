const { chromium } = require(process.env.PW); const fs = require('fs');
(async () => {
  const D = process.env.D, names = [...new Set(fs.readdirSync(D + '/out3').filter(f => f.endsWith('.png')).map(f => f.replace(/-(light|dark)\.png$/, '')))].sort();
  const files = names.flatMap(n => [`${n}-light.png`, `${n}-dark.png`]);
  const b = await chromium.launch(); const p = await b.newPage();
  // Re-encode as high-quality JPEG to keep the PDF a sensible size.
  const jpg = [];
  for (const f of files) {
    await p.setContent(`<img id=i src="data:image/png;base64,${fs.readFileSync(`${D}/out3/${f}`).toString('base64')}">`);
    jpg.push(await p.evaluate(async () => { const i = document.getElementById('i'); await i.decode(); const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; c.getContext('2d').drawImage(i, 0, 0); return c.toDataURL('image/jpeg', 0.92); }));
  }
  await p.setContent(`<style>@page{size:1200px 1600px;margin:0}body{margin:0}img{display:block;width:1200px;height:1600px;page-break-after:always}img:last-child{page-break-after:auto}</style>${jpg.map(s => `<img src="${s}">`).join('')}`);
  await p.pdf({ path: process.env.OUT, width: '1200px', height: '1600px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await b.close(); console.log(files.length, 'pages');
})();
