// Builds the 10 posters as HTML, then renders each to PNG.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const P = path.dirname(new URL(import.meta.url).pathname);
const ICONS = "/home/user/ShiurDaledMivtoim/node_modules/lucide-react/dist/esm/icons/";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
async function icon(name, size = 96, sw = 1.75) {
  let inner;
  if (name === "tefillin") {
    inner = `<rect x="6.5" y="3.5" width="11" height="10.5" rx="1.2"/><path d="M9.5 6.5v3.2a1.3 1.3 0 0 0 1.3 1.3h2.4a1.3 1.3 0 0 0 1.3-1.3V6.5M12 6.5V11"/><rect x="4.5" y="14" width="15" height="3.5" rx="1"/><path d="M4.5 15.75C2.5 15.75 2 18.5 3 20.5M19.5 15.75c2 0 2.5 2.75 1.5 4.75"/>`;
  } else {
    const { __iconData } = await import(ICONS + name + ".mjs");
    inner = __iconData.node.map(([tag, a]) => `<${tag} ${Object.entries(a).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
const logo = (s = 84) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#ffffff"/><path d="M7.5 9.5h17.5a1.5 1.5 0 0 1 0 3h-2.4V23a1.9 1.9 0 0 1-3.8 0V12.5H7.5a1.5 1.5 0 0 1 0-3z" fill="#2f6670"/></svg>`;

const css = `
${fs.readFileSync(P + "/fonts/fonts.css", "utf8")}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:1600px;overflow:hidden;font-family:Montserrat,sans-serif;color:#fff}
.poster{position:relative;width:1200px;height:1600px;overflow:hidden;
  background:
    radial-gradient(70% 38% at 50% 27%, rgba(225,238,240,.55), transparent 70%),
    radial-gradient(60% 40% at 8% 100%, rgba(214,204,192,.65), transparent 70%),
    radial-gradient(70% 50% at 100% 70%, rgba(52,104,114,.55), transparent 70%),
    linear-gradient(165deg, #5d8a93 0%, #6f969d 38%, #7f9fa4 62%, #a8b5b4 100%);}
.flare{position:absolute;right:-170px;top:-170px;width:560px;height:560px;border-radius:50%;
  background:radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,.85) 6%, rgba(255,255,255,.35) 20%, transparent 62%);}
.rays{position:absolute;right:-420px;top:-420px;width:1060px;height:1060px;border-radius:50%;opacity:.45;
  background:repeating-conic-gradient(from 8deg, rgba(255,255,255,.55) 0deg 1.2deg, transparent 1.2deg 13deg);
  -webkit-mask:radial-gradient(circle, #000 0%, transparent 52%);mask:radial-gradient(circle, #000 0%, transparent 52%)}
.band{position:absolute;left:0;right:0;top:250px;height:500px;
  background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.16) 50%, rgba(255,255,255,.04));
  border-top:1px solid rgba(255,255,255,.18);border-bottom:1px solid rgba(255,255,255,.12)}
.frame{position:absolute;border-color:rgba(255,255,255,.85);border-style:solid;border-width:0}
.tl1{left:46px;top:46px;width:640px;height:420px;border-top-width:3px;border-left-width:3px}
.tl2{left:76px;top:76px;width:400px;height:300px;border-top-width:3px;border-left-width:3px;opacity:.7}
.br1{right:46px;bottom:46px;width:640px;height:420px;border-bottom-width:3px;border-right-width:3px}
.br2{right:76px;bottom:76px;width:400px;height:300px;border-bottom-width:3px;border-right-width:3px;opacity:.7}
.content{position:absolute;inset:0;padding:120px 110px 0;display:flex;flex-direction:column;align-items:center}
.brand{display:flex;align-items:center;gap:18px;font-weight:700;letter-spacing:.32em;font-size:22px;text-transform:uppercase;opacity:.95}
.eyebrow{margin-top:120px;font-weight:800;font-size:40px;letter-spacing:.18em;text-transform:uppercase;text-shadow:0 2px 18px rgba(20,60,70,.25)}
.title{margin-top:12px;font-family:"Bowlby One",sans-serif;text-align:center;line-height:.98;font-size:118px;text-transform:uppercase;
  text-shadow:0 6px 28px rgba(20,60,70,.28);letter-spacing:.01em}
.sub{margin-top:30px;font-weight:600;font-size:34px;text-align:center;opacity:.96;max-width:900px;line-height:1.3}
.steps{margin-top:96px;display:flex;flex-direction:column;gap:30px;width:900px}
.step{position:relative;display:flex;align-items:center;min-height:132px;padding:18px 40px 18px 170px;border-radius:66px;
  background:linear-gradient(180deg, rgba(64,116,126,.92), rgba(56,104,114,.92));border:3px solid rgba(255,255,255,.72);
  box-shadow:0 14px 34px rgba(20,60,70,.22), inset 0 1px 0 rgba(255,255,255,.25);font-weight:800;font-size:36px;text-transform:uppercase;letter-spacing:.02em;line-height:1.15}
.step .ic{position:absolute;left:-30px;top:50%;transform:translateY(-50%);width:150px;height:150px;border-radius:50%;display:grid;place-items:center;color:#fff;
  background:radial-gradient(circle at 35% 30%, #5f97a1, #2f6670 75%);border:3px solid rgba(255,255,255,.8);box-shadow:0 10px 26px rgba(20,60,70,.32)}
.step .n{font-weight:600;margin-right:14px;opacity:.9}
.url{position:absolute;left:50%;transform:translateX(-50%);bottom:178px;display:flex;align-items:center;gap:14px;padding:18px 40px;border-radius:999px;
  background:#fff;color:#2f6670;font-weight:800;font-size:36px;letter-spacing:.02em;box-shadow:0 14px 34px rgba(20,60,70,.25)}
.foot{position:absolute;left:0;right:0;bottom:98px;text-align:center;font-weight:500;font-size:22px;opacity:.92;line-height:1.6}
.foot i{font-style:italic}
.rtl{direction:rtl;font-family:Heebo,sans-serif}
.rtl .title{font-family:Heebo,sans-serif;font-weight:900;letter-spacing:0}
.rtl .eyebrow,.rtl .brand{letter-spacing:.05em}
.rtl .step{padding:18px 170px 18px 40px;text-transform:none;font-family:Heebo;font-weight:700;font-size:40px}
.rtl .step .ic{left:auto;right:-30px}
.rtl .step .n{margin-right:0;margin-left:14px}
.tiles{margin-top:90px;display:grid;grid-template-columns:1fr 1fr;gap:28px;width:900px}
.tile{border-radius:36px;padding:34px 30px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;
  background:rgba(255,255,255,.14);border:3px solid rgba(255,255,255,.6);box-shadow:0 14px 34px rgba(20,60,70,.18);
  font-weight:800;font-size:32px;text-transform:uppercase;letter-spacing:.03em;line-height:1.15}
.tile small{display:block;font-weight:500;font-size:22px;text-transform:none;letter-spacing:0;opacity:.92;margin-top:6px}
.big{font-family:"Bowlby One";font-size:150px;line-height:.92;text-align:center;text-transform:uppercase;text-shadow:0 6px 28px rgba(20,60,70,.28)}
.line{font-family:"Bowlby One";text-transform:uppercase;text-align:center;font-size:96px;line-height:1.02;text-shadow:0 6px 28px rgba(20,60,70,.28)}
.dim{opacity:.6}
`;

const FOOT = {
  en: `If you have any money in your <i>Pushka</i> please help out <i>Mivtzoim</i><br>CashApp - $sdmivtzoim87 &nbsp;&nbsp; Zelle - sdmivtzoim87@gmail.com`,
  he: `רוצים לעזור למבצעים? כל סכום עוזר<br><span dir="ltr">CashApp - $sdmivtzoim87 &nbsp;&nbsp; Zelle - sdmivtzoim87@gmail.com</span>`,
  es: `Si tienes dinero en tu <i>Pushka</i>, ayuda a los <i>Mivtzoim</i><br>CashApp - $sdmivtzoim87 &nbsp;&nbsp; Zelle - sdmivtzoim87@gmail.com`,
  fr: `Si tu as de l'argent dans ta <i>Pushka</i>, aide les <i>Mivtzoim</i><br>CashApp - $sdmivtzoim87 &nbsp;&nbsp; Zelle - sdmivtzoim87@gmail.com`,
};

async function steps(items, numbered = true) {
  const out = [];
  for (const [i, [ic, text]] of items.entries())
    out.push(`<div class="step"><div class="ic">${await icon(ic, 76, 1.8)}</div><div>${numbered ? `<span class="n">${i + 1}.</span>` : ""}${text}</div></div>`);
  return `<div class="steps">${out.join("")}</div>`;
}
async function tiles(items) {
  const out = [];
  for (const [ic, a, b] of items) out.push(`<div class="tile">${await icon(ic, 84, 1.6)}<div>${a}<small>${b}</small></div></div>`);
  return `<div class="tiles">${out.join("")}</div>`;
}
const brand = (label = "Shiur Daled Mivtzoim") => `<div class="brand">${logo(64)}<span>${label}</span></div>`;
const url = async () => `<div class="url">${(await icon("globe", 40, 2.2)).replace('stroke="currentColor"', 'stroke="#2f6670"')}sdmivtzoim.com</div>`;

const posters = [
  ["01-did-you-hear", "en", async () => `${brand()}
    <div class="eyebrow">Did you hear?</div>
    <div class="title">The new site<br>is here</div>
    <div class="sub">Shiur Daled Mivtzoim is now online — your whole week of Mivtzoim, in one place.</div>
    ${await steps([["circle-check", "Log every Mivtza"], ["route", "See your route"], ["images", "The week in photos"]], false)}
    ${await url()}`],
  ["02-just-got-easier", "en", async () => `${brand()}
    <div class="eyebrow">5787</div>
    <div class="title">Mivtzoim<br>just got<br>easier</div>
    ${await steps([["globe", "Open sdmivtzoim.com"], ["pointer", "Tap your Mivtza"], ["circle-check", "That's it — you're counted"]])}
    ${await url()}`],
  ["03-keeping-track", "en", async () => `${brand()}
    <div class="eyebrow">Keeping track?</div>
    <div class="title">Never been<br>easier</div>
    ${await tiles([["tefillin", "Tefillin", "Every person, counted"], ["flame", "Shabbos Candles", "Every candle, counted"], ["route", "Your Route", "Every stop, in order"], ["rotate-ccw-clock", "History", "Every week, saved"]])}
    ${await url()}`],
  ["04-hebrew", "he", async () => `${brand("שיעור ד׳ מבצעים")}
    <div class="eyebrow">שמעתם?</div>
    <div class="title" style="font-size:130px;line-height:1.05">האתר החדש<br>כבר כאן</div>
    <div class="sub" style="font-size:38px">המבצעים — עכשיו קל יותר מתמיד</div>
    ${await steps([["circle-check", "כל מבצע נרשם בלחיצה אחת"], ["route", "המסלול שלכם — תמיד בכיס"], ["images", "תמונות השבוע במקום אחד"]], false)}
    ${await url()}`],
  ["05-spanish", "es", async () => `${brand()}
    <div class="eyebrow">¿Ya lo oíste?</div>
    <div class="title" style="font-size:104px;line-height:1.12">Mivtzoim,<br>más fácil<br>que nunca</div>
    ${await steps([["circle-check", "Cada Mivtza con un toque"], ["route", "Tu ruta, siempre a mano"], ["images", "Las fotos de la semana"]], false)}
    ${await url()}`],
  ["06-french", "fr", async () => `${brand()}
    <div class="eyebrow">Tu as entendu ?</div>
    <div class="title" style="font-size:100px">Les Mivtzoim,<br>plus simples<br>que jamais</div>
    ${await steps([["circle-check", "Chaque Mivtza en un geste"], ["route", "Ton parcours, sous la main"], ["images", "Les photos de la semaine"]], false)}
    ${await url()}`],
  ["07-every-tefillin", "en", async () => `${brand()}
    <div style="margin-top:250px;display:flex;gap:70px;color:#f1f7f8;filter:drop-shadow(0 8px 16px rgba(20,60,70,.3))">${await icon("tefillin", 170, 1.4)}${await icon("flame", 170, 1.4)}</div>
    <div class="line" style="margin-top:60px">Every Tefillin.</div>
    <div class="line">Every candle.</div>
    <div class="big" style="margin-top:30px;font-size:170px">Counted.</div>
    <div class="sub" style="margin-top:56px;font-size:38px">Log each Mivtza the moment it happens — and watch the whole Shiur's week add up.</div>
    ${await url()}`],
  ["08-not-hard", "en", async () => `${brand()}
    <div class="eyebrow" style="margin-top:290px">Tracking Mivtzoim?</div>
    <div class="line" style="margin-top:40px"><span class="dim">Not impossible.</span></div>
    <div class="line"><span class="dim">Not even hard.</span></div>
    <div class="big" style="margin-top:34px;font-size:200px">Easy.</div>
    <div class="sub" style="margin-top:60px;font-size:40px">It used to take a notebook.<br>Now it takes one tap.</div>
    ${await url()}`],
  ["09-in-your-pocket", "en", async () => `${brand()}
    <div class="eyebrow">Add it to your phone</div>
    <div class="title" style="font-size:108px">Your route,<br>in your pocket</div>
    ${await steps([["globe", "Open sdmivtzoim.com"], ["share", "Tap the Share button"], ["square-plus", "Add to Home Screen"]])}
    ${await url()}`],
  ["10-week-in-pictures", "en", async () => `${brand()}
    <div class="eyebrow">See this week's photos</div>
    <div class="title">The whole<br>week in<br>pictures</div>
    ${await steps([["camera", "Snap a photo on Mivtzoim"], ["images", "Share it with the Shiur"], ["sparkles", "Relive the week together"]], false)}
    ${await url()}`],
];

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1200, height: 1600 } });
fs.mkdirSync(P + "/out", { recursive: true });
for (const [name, lang, body] of posters) {
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="poster ${lang === "he" ? "rtl" : ""}"><div class="band"></div><div class="rays"></div><div class="flare"></div>
  <div class="frame tl1"></div><div class="frame tl2"></div><div class="frame br1"></div><div class="frame br2"></div>
  <div class="content">${await body()}</div><div class="foot">${FOOT[lang]}</div></div></body></html>`;
  fs.writeFileSync(`${P}/${name}.html`, html);
  await pg.goto("file://" + `${P}/${name}.html`);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(150);
  await pg.screenshot({ path: `${P}/out/${name}.png` });
}
await b.close();
