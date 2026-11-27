// Posters in the site's own look: its glow background, frosted glass cards, Google Sans Flex,
// real screens from the site, and the corner light from the original Canva poster.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const P = path.dirname(new URL(import.meta.url).pathname);
const ICONS = "/home/user/ShiurDaledMivtoim/node_modules/lucide-react/dist/esm/icons/";
let THEME = "light";
const pick = (f) => f.replace("-T-", `-${THEME}-`).replace("-O-", THEME === "light" ? "-dark-" : "-light-");
const img = (f) => "data:image/jpeg;base64," + fs.readFileSync(`${P}/shotsjpg/${pick(f)}.jpg`).toString("base64");

async function icon(name, size = 48, sw = 2) {
  let inner;
  if (name === "tefillin") inner = `<rect x="6.5" y="3.5" width="11" height="10.5" rx="1.2"/><path d="M9.5 6.5v3.2a1.3 1.3 0 0 0 1.3 1.3h2.4a1.3 1.3 0 0 0 1.3-1.3V6.5M12 6.5V11"/><rect x="4.5" y="14" width="15" height="3.5" rx="1"/><path d="M4.5 15.75C2.5 15.75 2 18.5 3 20.5M19.5 15.75c2 0 2.5 2.75 1.5 4.75"/>`;
  else {
    const { __iconData } = await import(ICONS + name + ".mjs");
    inner = __iconData.node.map(([t, a]) => `<${t} ${Object.entries(a).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
const logo = (s) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#106a7a"/><path d="M7.5 9.5h17.5a1.5 1.5 0 0 1 0 3h-2.4V23a1.9 1.9 0 0 1-3.8 0V12.5H7.5a1.5 1.5 0 0 1 0-3z" fill="#fff"/></svg>`;

// The corner light, drawn like the one on the Canva poster: a bright core, a soft halo and fine rays.
function flare() {
  let rays = "";
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * 360 + rnd() * 6;
    const len = 110 + rnd() * (rnd() > 0.75 ? 400 : 220);
    const w = 0.8 + rnd() * 2;
    rays += `<polygon points="0,${-w} ${len},0 0,${w}" fill="url(#ray)" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}" transform="rotate(${a.toFixed(1)})"/>`;
  }
  return `<svg class="flare" width="900" height="900" viewBox="-450 -450 900 900">
    <defs>
      <radialGradient id="halo"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".05" stop-color="#fff" stop-opacity=".95"/><stop offset=".16" stop-color="#fff" stop-opacity=".45"/><stop offset=".4" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="ray"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="1.1"/></filter>
    </defs>
    <circle r="450" fill="url(#halo)"/>
    <g filter="url(#soft)">${rays}</g>
    <ellipse rx="300" ry="5" fill="url(#halo)" opacity=".8"/>
    <circle r="26" fill="#fff"/>
  </svg>`;
}

const fonts = fs.readFileSync(P + "/f2/fonts.css", "utf8");
const css = `${fonts}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;height:1920px;overflow:hidden}
.poster{--paper:#efedf0;--ink:#1b1b1e;--muted:#45464c;--accent:#006878;--accent-soft:#c4ecf5;--candle:#755b00;--candle-soft:#fbe3a1;
  --g1:rgba(16,106,122,.42);--g2:rgba(140,226,250,.7);--g3:rgba(255,214,110,.58);--glass:rgba(255,255,255,.55);--edge:rgba(255,255,255,.8);--shadow:0 18px 50px rgba(30,60,70,.16);
  position:relative;width:1080px;height:1920px;overflow:hidden;color:var(--ink);font-family:"Google Sans Flex","Heebo",sans-serif;
  background:radial-gradient(38% 26% at 100% 0%,var(--g1),transparent 75%),radial-gradient(60% 40% at 10% 12%,var(--g2),transparent 70%),radial-gradient(55% 40% at 100% 4%,var(--g1),transparent 70%),
    radial-gradient(60% 40% at 18% 78%,var(--g3),transparent 70%),radial-gradient(55% 45% at 95% 92%,var(--g1),transparent 70%),var(--paper)}
.poster.dark{--paper:#131315;--ink:#e4e2e4;--muted:#c6c6cc;--accent:#84d2e5;--accent-soft:#004e5b;--candle:#e6c361;--candle-soft:#574400;
  --g1:rgba(22,128,146,.58);--g2:rgba(0,96,112,.68);--g3:rgba(120,92,0,.52);--glass:rgba(31,32,34,.5);--edge:rgba(255,255,255,.12);--shadow:0 18px 50px rgba(0,0,0,.4)}
.flare{position:absolute;right:-430px;top:-440px;pointer-events:none;opacity:.6}
.dark .flare{display:none}
.glass{background:var(--glass);backdrop-filter:blur(22px) saturate(170%);border:1.5px solid var(--edge);box-shadow:var(--shadow);border-radius:24px}
.brand{position:absolute;top:70px;left:80px;display:flex;align-items:center;gap:18px;font-size:30px;font-weight:600;letter-spacing:-.01em}
.rtl .brand{left:auto;right:80px}
.eyebrow{color:var(--accent);font-weight:600;font-size:34px;letter-spacing:.01em}
.h{font-weight:700;letter-spacing:-.02em;word-spacing:.06em;line-height:1}
.muted{color:var(--muted)}
.url{display:inline-flex;align-items:center;gap:14px;padding:20px 38px;border-radius:999px;background:var(--accent);color:var(--paper);font-weight:700;font-size:34px;letter-spacing:-.01em;box-shadow:0 14px 34px rgba(0,104,120,.3)}
.dark .url{color:#00363f}
.foot{position:absolute;left:50%;transform:translateX(-50%);bottom:34px;white-space:nowrap;text-align:center;font-size:20px;line-height:1.55;color:var(--muted);z-index:5;padding:8px 24px;border-radius:999px;background:var(--glass);backdrop-filter:blur(18px) saturate(160%);border:1px solid var(--edge)}
.foot i{font-style:italic}
.phone{position:absolute;width:430px;height:916px;border-radius:72px;padding:14px;background:linear-gradient(145deg,#2c2d31,#0d0d0f);
  box-shadow:0 40px 90px rgba(10,30,40,.35),inset 0 0 0 2px rgba(255,255,255,.12)}
.phone .scr{position:relative;width:402px;height:870px;border-radius:58px;overflow:hidden;background:#efedf0;padding-top:54px}
.phone .scr.d{background:#131315}
.phone .scr::before{content:'9:41';position:absolute;top:17px;left:44px;font-weight:600;font-size:19px;color:#1b1b1e}
.phone .scr.d::before{color:#e4e2e4}
.phone img{display:block;width:402px;height:auto}
.phone::after{content:"";position:absolute;top:30px;left:50%;transform:translateX(-50%);width:120px;height:34px;border-radius:20px;background:#000}
.feat{display:flex;align-items:center;gap:24px;padding:26px 30px}
.feat .ic{flex:none;width:76px;height:76px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)}
.feat .ic.c{background:var(--candle-soft);color:var(--candle)}
.feat b{display:block;font-size:31px;font-weight:600;letter-spacing:-.01em}
.feat span{display:block;font-size:23px;color:var(--muted);margin-top:4px}
.rtl{direction:rtl}
.bsd{position:absolute;top:30px;right:44px;z-index:6;font-family:"David Libre","Heebo",serif;font-weight:700;font-size:28px;line-height:1;color:var(--ink)}
.rtl .h{letter-spacing:-.01em}
`;

const FOOT = {
  en: `If you have any money in your <i>Pushka</i>, please help out <i>Mivtzoim</i> · Cash App $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com`,
  he: `רוצים לעזור למבצעים? כל סכום עוזר · <span dir="ltr">Cash App $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com</span>`,
  es: `Si tienes dinero en tu <i>Pushka</i>, ayuda a los <i>Mivtzoim</i> · Cash App $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com`,
  fr: `Si tu as de l'argent dans ta <i>Pushka</i>, aide les <i>Mivtzoim</i> · Cash App $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com`,
};
const NAME = { en: "Shiur Daled Mivtzoim", he: "שיעור ד' מבצעים", es: "Shiur Dalet Mivtzoim", fr: "Chiour Dalet Mivtsaïm" };
const brand = (l) => `<div class="brand">${logo(62)}<span>${NAME[l]}</span></div>`;
const url = async () => `<div class="url">${await icon("globe", 38, 2.2)}<span dir="ltr">sdmivtzoim.com</span></div>`;
const feat = async (ic, b, s, c = "") => `<div class="glass feat"><div class="ic ${c}">${await icon(ic, 40)}</div><div><b>${b}</b><span>${s}</span></div></div>`;
const phone = (shot, style) => `<div class="phone" style="${style}"><div class="scr ${pick(shot).includes('dark') ? 'd' : ''}"><img src="${img(shot)}"></div></div>`;

// The main poster, the same in four languages.

const ph = (f) => "data:image/jpeg;base64," + fs.readFileSync(`${P}/photosjpg/${f}.jpg`).toString("base64");
const extra = `
.status .brand{top:120px;left:70px}
.status .foot{white-space:normal;width:940px;bottom:90px;font-size:26px!important;line-height:1.5;border-radius:28px;padding:16px 28px}
.big{font-weight:800;letter-spacing:-.03em;line-height:.95}
.task{display:flex;align-items:center;gap:28px;padding:30px 34px;border-radius:32px}
.task .n{flex:none;width:92px;height:92px;border-radius:50%;display:grid;place-items:center;font-size:44px;font-weight:800;color:#fff;background:var(--accent)}
.dark .task .n{color:#00363f}
.task .n.c{background:var(--candle)}
.task b{display:block;font-size:44px;font-weight:700;letter-spacing:-.01em}
.task span{display:block;font-size:28px;color:var(--muted);margin-top:4px}
.pill{display:inline-flex;align-items:center;gap:12px;padding:12px 26px;border-radius:999px;background:var(--candle-soft);color:var(--candle);font-weight:700;font-size:30px}
.pics img{position:absolute;object-fit:cover;border-radius:22px;border:8px solid #fff;box-shadow:0 20px 50px rgba(10,30,40,.3)}
.dark .pics img{border-color:#2a2b2e}
`;
async function status() {
  return `<div class="brand">${logo(66)}<span>Shiur Daled Mivtzoim</span></div>
  <div style="position:absolute;top:290px;left:70px;right:70px">
    <span class="pill">${await icon("bell-ring", 32, 2.4)} Friday reminder</span>
    <div class="big" style="font-size:150px;margin-top:34px">Don't<br>forget!</div>
    <div class="muted" style="font-size:40px;margin-top:26px;line-height:1.3">Before Shabbos, two quick things:</div>
  </div>
  <div class="pics">
    <img src="${ph("e1da3977")}" style="right:60px;top:300px;width:330px;height:250px;transform:rotate(7deg)">
    <img src="${ph("c75194d2")}" style="right:150px;top:560px;width:230px;height:290px;transform:rotate(-6deg)">
  </div>
  <div style="position:absolute;top:960px;left:70px;right:70px;display:grid;gap:26px">
    <div class="glass task"><div class="n">1</div><div><b>Fill in this week's Mivtzoim</b><span>Tefillin, candles and everything you did</span></div></div>
    <div class="glass task"><div class="n c">2</div><div><b>Upload your photos</b><span>Share the moments from your route</span></div></div>
  </div>
  <div style="position:absolute;top:1400px;left:0;right:0;text-align:center">
    <div style="font-size:34px;font-weight:600" class="muted">It takes one minute</div>
    <div style="margin-top:24px">${await url()}</div>
  </div>`;
}
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
fs.mkdirSync(P + "/status", { recursive: true });
for (const theme of ["light", "dark"]) {
  THEME = theme;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}${extra}</style></head><body>
  <div class="poster status ${theme === "dark" ? "dark" : ""}">${flare()}<div class="bsd" dir="rtl">בס״ד</div>${await status()}<div class="foot">${FOOT.en}</div></div></body></html>`;
  fs.writeFileSync(`${P}/status-${theme}.html`, html);
  await pg.goto("file://" + `${P}/status-${theme}.html`);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${P}/status/Reminder-${theme}.png` });
}
await b.close();
