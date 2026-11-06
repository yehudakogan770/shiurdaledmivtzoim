const { chromium } = require(process.env.PW);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1236,height:1600}});
await p.goto('file://'+process.env.D+'/_canva2-light.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);
await p.evaluate(()=>window.scrollTo(0,1600*5));await p.screenshot({path:'edprev.png'});await b.close();})();
