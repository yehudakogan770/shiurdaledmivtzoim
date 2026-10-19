const { chromium } = require(process.env.PW); const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:2000,height:1300}});
const f=fs.readdirSync('cards').filter(x=>x.endsWith('-light.png')).sort();
await p.setContent(`<body style="margin:0;padding:16px;background:#222;display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${f.map(x=>`<img style="width:100%" src="data:image/png;base64,${fs.readFileSync('cards/'+x).toString('base64')}">`).join('')}</body>`);
await p.screenshot({path:'cardsheet.png'});await b.close();})();
