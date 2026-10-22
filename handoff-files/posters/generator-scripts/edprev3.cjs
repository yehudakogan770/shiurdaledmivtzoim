const { chromium } = require(process.env.PW); const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1236,height:1600}});
const shots=[];
for (const t of ['light','dark']) { await p.goto('file://'+process.env.D+'/_canva2-'+t+'.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);
 for (let i=0;i<11;i++){ await p.evaluate(i=>window.scrollTo(0,1600*i),i); shots.push((await p.screenshot({type:'jpeg',quality:70})).toString('base64')); } }
const q=await b.newPage({viewport:{width:2000,height:1400}});
await q.setContent(`<body style="margin:0;padding:10px;background:#222;display:grid;grid-template-columns:repeat(11,1fr);gap:8px">${shots.map(s=>`<img style="width:100%" src="data:image/jpeg;base64,${s}">`).join('')}</body>`);
await q.screenshot({path:'canva3-sheet.png'});await b.close();})();
