const { chromium } = require(process.env.PW); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  const conv = async (src, dst, max) => {
    const ext = src.endsWith('.png') ? 'png' : 'jpeg';
    await p.setContent(`<img id=i src="data:image/${ext};base64,${fs.readFileSync(src).toString('base64')}">`);
    const d = await p.evaluate(async (max) => { const i = document.getElementById('i'); await i.decode(); const k = Math.min(1, max / Math.max(i.naturalWidth, i.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.88); }, max);
    fs.writeFileSync(dst, Buffer.from(d.split(',')[1], 'base64')); };
  fs.mkdirSync('shotsjpg', { recursive: true }); fs.mkdirSync('photosjpg', { recursive: true });
  for (const f of fs.readdirSync('shots')) await conv('shots/' + f, 'shotsjpg/' + f.replace('.png', '.jpg'), 2600);
  for (const f of fs.readdirSync('photos')) await conv('photos/' + f, 'photosjpg/' + f.replace('-image.jpg', '.jpg'), 1800);
  await b.close(); })();
