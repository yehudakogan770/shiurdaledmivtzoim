const { chromium } = require(process.env.PW); const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1240,height:300}});
const im=f=>'data:image/png;base64,'+fs.readFileSync('out3/'+f).toString('base64');
await p.setContent(`<body style="margin:0;display:flex;gap:20px;background:#888">${['05-just-got-easier-dark.png','01-main-english-light.png'].map(f=>`<div style="width:610px;height:300px;overflow:hidden;position:relative"><img src="${im(f)}" style="position:absolute;right:0;top:0;width:1200px"></div>`).join('')}</body>`);
await p.screenshot({path:'bsd.png'});await b.close();})();
