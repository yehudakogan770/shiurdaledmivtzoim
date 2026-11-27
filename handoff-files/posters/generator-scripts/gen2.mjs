// Posters in the site's own look: its glow background, frosted glass cards, Google Sans Flex,
// real screens from the site, and the corner light from the original Canva poster.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW);
const P = path.dirname(new URL(import.meta.url).pathname);
const ICONS = "/home/user/ShiurDaledMivtoim/node_modules/lucide-react/dist/esm/icons/";
const img = (f) => "data:image/png;base64," + fs.readFileSync(`${P}/shots/${f}.png`).toString("base64");

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
body{width:1200px;height:1600px;overflow:hidden}
.poster{--paper:#efedf0;--ink:#1b1b1e;--muted:#45464c;--accent:#006878;--accent-soft:#c4ecf5;--candle:#755b00;--candle-soft:#fbe3a1;
  --g1:rgba(16,106,122,.42);--g2:rgba(140,226,250,.7);--g3:rgba(255,214,110,.58);--glass:rgba(255,255,255,.55);--edge:rgba(255,255,255,.8);--shadow:0 18px 50px rgba(30,60,70,.16);
  position:relative;width:1200px;height:1600px;overflow:hidden;color:var(--ink);font-family:"Google Sans Flex","Heebo",sans-serif;
  background:radial-gradient(38% 26% at 100% 0%,var(--g1),transparent 75%),radial-gradient(60% 40% at 10% 12%,var(--g2),transparent 70%),radial-gradient(55% 40% at 100% 4%,var(--g1),transparent 70%),
    radial-gradient(60% 40% at 18% 78%,var(--g3),transparent 70%),radial-gradient(55% 45% at 95% 92%,var(--g1),transparent 70%),var(--paper)}
.poster.dark{--paper:#131315;--ink:#e4e2e4;--muted:#c6c6cc;--accent:#84d2e5;--accent-soft:#004e5b;--candle:#e6c361;--candle-soft:#574400;
  --g1:rgba(22,128,146,.58);--g2:rgba(0,96,112,.68);--g3:rgba(120,92,0,.52);--glass:rgba(31,32,34,.5);--edge:rgba(255,255,255,.12);--shadow:0 18px 50px rgba(0,0,0,.4)}
.flare{position:absolute;right:-380px;top:-400px;pointer-events:none;mix-blend-mode:screen}
.poster:not(.dark) .flare{mix-blend-mode:normal;opacity:.95}
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
.rtl .h{letter-spacing:-.01em}
`;

const FOOT = {
  en: `If you have any money in your <i>Pushka</i> please help out <i>Mivtzoim</i> · CashApp $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com`,
  he: `רוצים לעזור למבצעים? כל סכום עוזר · <span dir="ltr">CashApp $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com</span>`,
  es: `Si tienes dinero en tu <i>Pushka</i>, ayuda a los <i>Mivtzoim</i> · CashApp $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com`,
  fr: `Si tu as de l'argent dans ta <i>Pushka</i>, aide les <i>Mivtzoim</i> · CashApp $sdmivtzoim87 · Zelle sdmivtzoim87@gmail.com`,
};
const NAME = { en: "Shiur Daled Mivtzoim", he: "שיעור ד' מבצעים", es: "Shiur Dalet Mivtzoim", fr: "Chiour Dalet Mivtsaïm" };
const brand = (l) => `<div class="brand">${logo(62)}<span>${NAME[l]}</span></div>`;
const url = async () => `<div class="url">${await icon("globe", 38, 2.2)}<span dir="ltr">sdmivtzoim.com</span></div>`;
const feat = async (ic, b, s, c = "") => `<div class="glass feat"><div class="ic ${c}">${await icon(ic, 40)}</div><div><b>${b}</b><span>${s}</span></div></div>`;
const phone = (shot, style) => `<div class="phone" style="${style}"><div class="scr ${shot.includes('dark') ? 'd' : ''}"><img src="${img(shot)}"></div></div>`;

// The main poster, the same in four languages.
const MAIN = {
  en: { eb: "Did you hear?", t: "The new site<br>is here.", s: "Your whole week of Mivtzoim, in one place.",
    f: [["Log every Mivtza", "One tap and it's counted"], ["Your route, stop by stop", "Know where you've been"], ["The week in photos", "Share the moments"]] },
  he: { eb: "שמעתם?", t: "האתר החדש<br>כבר כאן.", s: "כל המבצעים של השבוע — במקום אחד.",
    f: [["כל מבצע נרשם", "לחיצה אחת — וזה נספר"], ["המסלול שלכם", "תחנה אחרי תחנה"], ["תמונות השבוע", "לשתף את הרגעים"]] },
  es: { eb: "¿Ya lo oíste?", t: "El nuevo sitio<br>ya está aquí.", s: "Toda tu semana de Mivtzoim, en un solo lugar.",
    f: [["Registra cada Mivtza", "Un toque y ya cuenta"], ["Tu ruta, parada a parada", "Sabes dónde ya pasaste"], ["Las fotos de la semana", "Comparte los momentos"]] },
  fr: { eb: "Tu as entendu ?", t: "Le nouveau site<br>est là.", s: "Toute ta semaine de Mivtsaïm, au même endroit.",
    f: [["Chaque Mivtsa noté", "Un geste et c'est compté"], ["Ton parcours, arrêt par arrêt", "Tu sais où tu es passé"], ["Les photos de la semaine", "Partage les moments"]] },
};
async function mainPoster(l) {
  const m = MAIN[l], rtl = l === "he";
  const side = rtl ? "right" : "left", other = rtl ? "left" : "right";
  return { lang: l, rtl, html: `${brand(l)}
    <div style="position:absolute;top:210px;${side}:80px;width:1040px">
      <div class="eyebrow">${m.eb}</div>
      <div class="h" style="font-size:${l === "en" ? 128 : 112}px;margin-top:18px">${m.t}</div>
      <div class="muted" style="font-size:36px;margin-top:26px;max-width:640px;line-height:1.3">${m.s}</div>
    </div>
    <div style="position:absolute;top:800px;${side}:80px;width:560px;display:flex;flex-direction:column;gap:22px">
      ${await feat("circle-check", ...m.f[0])}${await feat("route", ...m.f[1])}${await feat("images", ...m.f[2], "c")}
    </div>
    ${phone(`${l}-light-home`, `top:560px;${other}:70px;transform:rotate(${rtl ? -5 : 5}deg)`)}
    <div style="position:absolute;bottom:130px;${side}:80px">${await url()}</div>` };
}

const posters = [
  ["01-main-english", () => mainPoster("en")],
  ["02-main-hebrew", () => mainPoster("he")],
  ["03-main-spanish", () => mainPoster("es")],
  ["04-main-french", () => mainPoster("fr")],
  // Dark: three big steps across, the phone rising from the bottom.
  ["05-just-got-easier", async () => ({ dark: true, html: `${brand("en")}
    <div style="position:absolute;top:220px;left:0;right:0;text-align:center">
      <div class="eyebrow">5787</div>
      <div class="h" style="font-size:150px;margin-top:14px">Mivtzoim<br><span style="color:var(--accent)">just got easier.</span></div>
    </div>
    <div style="position:absolute;top:660px;left:80px;right:80px;display:grid;grid-template-columns:repeat(3,1fr);gap:24px">
      ${(await Promise.all([["globe", "Open", "sdmivtzoim.com"], ["pointer", "Tap", "your Mivtza"], ["circle-check", "Done", "you're counted"]].map(async ([ic, a, b], i) =>
        `<div class="glass" style="padding:34px 30px;text-align:center"><div style="font-size:26px;color:var(--muted);font-weight:600">STEP ${i + 1}</div>
         <div style="margin:18px auto;width:96px;height:96px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">${await icon(ic, 50)}</div>
         <div style="font-size:44px;font-weight:700">${a}</div><div class="muted" style="font-size:26px;margin-top:4px">${b}</div></div>`))).join("")}
    </div>
    <div style="position:absolute;top:1010px;left:0;right:0;text-align:center">${await url()}</div>
    ${phone("en-dark-home", "top:1140px;left:50%;margin-left:-215px")}` })],
  // Light: the site's own counter cards, big.
  ["06-counted", async () => ({ html: `${brand("en")}
    <div style="position:absolute;top:220px;left:80px">
      <div class="h" style="font-size:120px">Every Tefillin.<br>Every candle.<br><span style="color:var(--accent)">Counted.</span></div>
    </div>
    <div class="glass" style="position:absolute;top:760px;left:80px;width:500px;height:470px;padding:46px;transform:rotate(-4deg);background:linear-gradient(135deg,rgba(255,240,205,.75),rgba(255,255,255,.55))">
      <div style="display:flex;align-items:center;gap:22px;font-size:36px"><div class="feat" style="padding:0"><div class="ic">${await icon("tefillin", 44)}</div></div>Tefillin</div>
      <div style="font-size:200px;font-weight:400;line-height:1.1;margin-top:20px">6</div>
      <div style="display:flex;align-items:center;gap:16px;font-size:28px"><span style="background:#b6f2cf;color:#0b5130;border-radius:999px;padding:6px 18px;font-weight:600">↗ +6</span><span class="muted">vs last week</span></div>
    </div>
    <div class="glass" style="position:absolute;top:840px;left:620px;width:500px;height:470px;padding:46px;transform:rotate(3deg)">
      <div style="display:flex;align-items:center;gap:22px;font-size:36px"><div class="feat" style="padding:0"><div class="ic c">${await icon("flame", 44)}</div></div>Candles</div>
      <div style="font-size:200px;font-weight:400;line-height:1.1;margin-top:20px">3</div>
      <div style="display:flex;align-items:center;gap:16px;font-size:28px"><span style="background:#b6f2cf;color:#0b5130;border-radius:999px;padding:6px 18px;font-weight:600">↗ +3</span><span class="muted">vs last week</span></div>
    </div>
    <div class="muted" style="position:absolute;top:1370px;left:80px;font-size:32px;max-width:620px;line-height:1.3">Log each Mivtza the moment it happens.</div>
    <div style="position:absolute;bottom:130px;right:80px">${await url()}</div>` })],
  // Dark, type only: the notebook crossed out, then one word.
  ["07-easy", async () => ({ dark: true, html: `${brand("en")}
    <div style="position:absolute;top:250px;left:80px;right:80px">
      <div class="eyebrow">Tracking Mivtzoim?</div>
      <div class="h muted" style="font-size:96px;margin-top:30px;opacity:.55">Not impossible.</div>
      <div class="h muted" style="font-size:96px;opacity:.75">Not even hard.</div>
      <div class="h" style="font-size:330px;margin-top:10px;letter-spacing:-.06em;background:linear-gradient(100deg,#84d2e5,#e6c361);-webkit-background-clip:text;color:transparent">Easy.</div>
    </div>
    <div style="position:absolute;top:1100px;left:80px;right:80px;display:flex;align-items:center;gap:30px">
      <div class="glass" style="flex:1;padding:34px;display:flex;align-items:center;gap:24px"><div style="position:relative;color:var(--muted)">${await icon("notebook-pen", 70, 1.6)}<div style="position:absolute;left:-8px;right:-8px;top:50%;height:4px;background:#ffb4ab;transform:rotate(-30deg);border-radius:4px"></div></div><div style="font-size:30px" class="muted">It used to take<br>a notebook.</div></div>
      <div style="color:var(--accent)">${await icon("arrow-right", 60)}</div>
      <div class="glass" style="flex:1;padding:34px;display:flex;align-items:center;gap:24px;border-color:rgba(132,210,229,.45)"><div style="color:var(--accent)">${await icon("smartphone", 70, 1.6)}</div><div style="font-size:30px">Now it takes<br><b>one tap.</b></div></div>
    </div>
    <div style="position:absolute;bottom:130px;left:80px">${await url()}</div>` })],
  // Light: a route drawn as a path of stops, with the real route screen.
  ["08-route", async () => ({ html: `${brand("en")}
    <div style="position:absolute;top:210px;left:80px">
      <div class="eyebrow">Friday stores, Kingston Ave, the shuk…</div>
      <div class="h" style="font-size:118px;margin-top:16px">Your route,<br>in your pocket.</div>
    </div>
    <svg style="position:absolute;top:620px;left:40px" width="640" height="820" viewBox="0 0 640 820" fill="none">
      <path d="M90 40 C 380 60, 420 230, 200 300 S 60 520, 330 560 S 560 700, 420 790" stroke="#006878" stroke-width="6" stroke-dasharray="2 18" stroke-linecap="round" opacity=".7"/>
    </svg>
    ${(await Promise.all([[120, 620, "Bakery", true], [300, 880, "Pharmacy", true], [130, 1120, "Post office", false], [330, 1240, "Shoe store", false]].map(async ([x, y, n, d], i) =>
      `<div class="glass" style="position:absolute;left:${x}px;top:${y}px;display:flex;align-items:center;gap:16px;padding:16px 26px 16px 16px;border-radius:999px">
        <div style="width:58px;height:58px;border-radius:50%;display:grid;place-items:center;font-size:26px;font-weight:700;${d ? "background:#1d6b47;color:#fff" : "border:3px solid #45464c;color:#45464c"}">${d ? await icon("check", 30, 3) : i + 1}</div>
        <span style="font-size:30px;font-weight:600;${d ? "text-decoration:line-through;opacity:.6" : ""}">${n}</span></div>`))).join("")}
    ${phone("en-light-route", "top:560px;right:70px;transform:rotate(4deg)")}
    <div style="position:absolute;bottom:130px;left:80px">${await url()}</div>` })],
  // Light: computer and phone together.
  ["09-everywhere", async () => ({ html: `${brand("en")}
    <div style="position:absolute;top:210px;left:0;right:0;text-align:center">
      <div class="eyebrow">Keeping track?</div>
      <div class="h" style="font-size:132px;margin-top:16px">Never been<br>easier.</div>
      <div class="muted" style="font-size:34px;margin-top:22px">On your phone. On your computer. Always up to date.</div>
    </div>
    <div style="position:absolute;top:720px;left:60px;width:960px">
      <div style="border-radius:28px 28px 0 0;padding:18px;background:linear-gradient(145deg,#2c2d31,#0d0d0f);box-shadow:0 40px 90px rgba(10,30,40,.3)">
        <img src="${img("en-light-desk-home")}" style="display:block;width:100%;border-radius:12px">
      </div>
      <div style="height:30px;margin:0 -50px;border-radius:0 0 30px 30px;background:linear-gradient(#d9d9de,#a9a9b0);box-shadow:0 20px 40px rgba(10,30,40,.25)"></div>
    </div>
    ${phone("en-dark-home", "top:800px;right:50px;transform:scale(.72);transform-origin:top right")}
    <div style="position:absolute;bottom:130px;left:80px">${await url()}</div>` })],
  // Dark: history, every week saved, with a big glass stat.
  ["10-every-week", async () => ({ dark: true, html: `${brand("en")}
    ${phone("en-light-history", "top:250px;left:80px;transform:rotate(-4deg)")}
    <div style="position:absolute;top:300px;left:600px;right:80px">
      <div class="eyebrow">Your History</div>
      <div class="h" style="font-size:112px;margin-top:16px">Every week.<br>Saved.</div>
      <div class="muted" style="font-size:32px;margin-top:26px;line-height:1.35">See what you did this week, last week, and every week before.</div>
    </div>
    <div class="glass" style="position:absolute;top:900px;left:600px;right:80px;padding:40px">
      <div class="muted" style="font-size:28px">This week</div>
      <div style="display:flex;align-items:baseline;gap:18px;margin-top:6px"><span style="font-size:150px;line-height:1">9</span><span style="font-size:34px">Mivtzoim</span></div>
      <div style="display:flex;gap:16px;margin-top:22px;font-size:26px">
        <span style="display:flex;align-items:center;gap:10px;background:var(--accent-soft);color:var(--accent);padding:10px 20px;border-radius:999px">${await icon("tefillin", 30)} 6 Tefillin</span>
        <span style="display:flex;align-items:center;gap:10px;background:var(--candle-soft);color:var(--candle);padding:10px 20px;border-radius:999px">${await icon("flame", 30)} 3 Candles</span>
      </div>
    </div>
    <div style="position:absolute;bottom:130px;left:600px">${await url()}</div>` })],
];

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1200, height: 1600 } });
fs.mkdirSync(P + "/out2", { recursive: true });
for (const [name, make] of posters) {
  const p = await make();
  const l = p.lang || "en";
  const html = `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="poster ${p.dark ? "dark" : ""} ${p.rtl ? "rtl" : ""}">${flare()}${p.html}<div class="foot">${FOOT[l]}</div></div></body></html>`;
  fs.writeFileSync(`${P}/${name}.html`, html);
  await pg.goto("file://" + `${P}/${name}.html`);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${P}/out2/${name}.png` });
}
await b.close();
