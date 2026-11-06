const { chromium } = require(process.env.PW); const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:2000,height:1640}});
const f=fs.readdirSync('out2').filter(x=>x.endsWith('.png')).sort();
await p.setContent(`<body style="margin:0;padding:20px;background:#222;display:grid;grid-template-columns:repeat(5,1fr);gap:20px">${f.map(x=>`<img style="width:100%" src="data:image/png;base64,${fs.readFileSync('out2/'+x).toString('base64')}">`).join('')}</body>`);
await p.screenshot({path:'sheet2.png'});await b.close();})();
