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
const img = (f) => "data:image/png;base64," + fs.readFileSync(`${P}/shots/${pick(f)}.png`).toString("base64");

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
body{width:1500px;height:1050px;overflow:hidden}
.poster{--paper:#efedf0;--ink:#1b1b1e;--muted:#45464c;--accent:#006878;--accent-soft:#c4ecf5;--candle:#755b00;--candle-soft:#fbe3a1;
  --g1:rgba(16,106,122,.42);--g2:rgba(140,226,250,.7);--g3:rgba(255,214,110,.58);--glass:rgba(255,255,255,.55);--edge:rgba(255,255,255,.8);--shadow:0 18px 50px rgba(30,60,70,.16);
  position:relative;width:1500px;height:1050px;overflow:hidden;color:var(--ink);font-family:"Google Sans Flex","Heebo",sans-serif;
  background:radial-gradient(38% 26% at 100% 0%,var(--g1),transparent 75%),radial-gradient(60% 40% at 10% 12%,var(--g2),transparent 70%),radial-gradient(55% 40% at 100% 4%,var(--g1),transparent 70%),
    radial-gradient(60% 40% at 18% 78%,var(--g3),transparent 70%),radial-gradient(55% 45% at 95% 92%,var(--g1),transparent 70%),var(--paper)}
.poster.dark{--paper:#131315;--ink:#e4e2e4;--muted:#c6c6cc;--accent:#84d2e5;--accent-soft:#004e5b;--candle:#e6c361;--candle-soft:#574400;
  --g1:rgba(22,128,146,.58);--g2:rgba(0,96,112,.68);--g3:rgba(120,92,0,.52);--glass:rgba(31,32,34,.5);--edge:rgba(255,255,255,.12);--shadow:0 18px 50px rgba(0,0,0,.4)}
.flare{position:absolute;right:-430px;top:-440px;pointer-events:none;opacity:.6}
.dark .flare{display:none}
.glass{background:var(--glass);backdrop-filter:blur(22px) saturate(170%);border:1.5px solid var(--edge);box-shadow:var(--shadow);border-radius:24px}
.brand{position:absolute;top:56px;left:70px;display:flex;align-items:center;gap:18px;font-size:30px;font-weight:600;letter-spacing:-.01em}
.rtl .brand{left:auto;right:70px}
.eyebrow{color:var(--accent);font-weight:600;font-size:34px;letter-spacing:.01em}
.h{font-weight:700;letter-spacing:-.02em;word-spacing:.06em;line-height:1}
.muted{color:var(--muted)}
.url{display:inline-flex;align-items:center;gap:14px;padding:20px 38px;border-radius:999px;background:var(--accent);color:var(--paper);font-weight:700;font-size:34px;letter-spacing:-.01em;box-shadow:0 14px 34px rgba(0,104,120,.3)}
.dark .url{color:#00363f}
.foot{position:absolute;left:50%;transform:translateX(-50%);bottom:22px;font-size:19px !important;white-space:nowrap;text-align:center;font-size:20px;line-height:1.55;color:var(--muted);z-index:5;padding:8px 24px;border-radius:999px;background:var(--glass);backdrop-filter:blur(18px) saturate(160%);border:1px solid var(--edge)}
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
.card .feat{padding:16px 22px;gap:18px}
.card .feat .ic{width:60px;height:60px}
.card .feat b{font-size:27px}
.card .feat span{font-size:20px}
.card .url{font-size:30px;padding:16px 32px}
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
const phone = (shot, style) => `<div class="phone" style="${style}"><div class="scr ${pick(shot).includes('dark') ? 'd' : ''}"><img src="${img(shot)}"></div></div>`;

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
// Landscape cards (5 x 3.5 in at 300 dpi), four to a printed sheet.
const ph = (f) => "data:image/jpeg;base64," + fs.readFileSync(`${P}/photos/${f}-image.jpg`).toString("base64");
const stat = async (ic, c, label, n, d, style) => `<div class="glass" style="position:absolute;width:380px;height:360px;padding:36px;${style}">
  <div style="display:flex;align-items:center;gap:18px;font-size:30px"><div class="feat" style="padding:0"><div class="ic ${c}" style="width:64px;height:64px">${await icon(ic, 36)}</div></div>${label}</div>
  <div style="font-size:150px;line-height:1.1;margin-top:14px">${n}</div>
  <div style="display:flex;align-items:center;gap:14px;font-size:24px"><span style="background:#b6f2cf;color:#0b5130;border-radius:999px;padding:5px 16px;font-weight:600">↗ +${n}</span><span class="muted">vs last week</span></div></div>`;

async function mainCard(l) {
  const m = MAIN[l], rtl = l === "he";
  const side = rtl ? "right" : "left", other = rtl ? "left" : "right";
  return { lang: l, rtl, html: `${brand(l)}
    <div style="position:absolute;top:160px;${side}:70px;width:860px">
      <div class="eyebrow" style="font-size:30px">${m.eb}</div>
      <div class="h" style="font-size:${l === "en" ? 104 : 92}px;margin-top:12px">${m.t}</div>
      <div class="muted" style="font-size:30px;margin-top:18px">${m.s}</div>
    </div>
    <div style="position:absolute;top:492px;${side}:70px;width:520px;display:flex;flex-direction:column;gap:14px">
      ${await feat("circle-check", ...m.f[0])}${await feat("route", ...m.f[1])}${await feat("images", ...m.f[2], "c")}
    </div>
    ${phone(`${l}-T-home`, `top:200px;${other}:90px;transform:rotate(${rtl ? -6 : 6}deg)`)}
    <div style="position:absolute;top:880px;${side}:70px">${await url()}</div>` };
}

const cards = [
  ["01-main-english", () => mainCard("en")],
  ["02-main-hebrew", () => mainCard("he")],
  ["03-main-spanish", () => mainCard("es")],
  ["04-main-french", () => mainCard("fr")],
  ["05-just-got-easier", async () => ({ html: `${brand("en")}
    <div style="position:absolute;top:170px;left:70px">
      <div class="eyebrow" style="font-size:30px">5787</div>
      <div class="h" style="font-size:118px;margin-top:10px">Mivtzoim<br><span style="color:var(--accent)">just got easier.</span></div>
    </div>
    <div style="position:absolute;top:560px;left:70px;width:900px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px">
      ${(await Promise.all([["globe", "Open", "sdmivtzoim.com"], ["pointer", "Tap", "your Mivtza"], ["circle-check", "Done", "you're counted"]].map(async ([ic, a, b], i) =>
        `<div class="glass" style="padding:26px 20px;text-align:center"><div style="font-size:22px;color:var(--muted);font-weight:600">STEP ${i + 1}</div>
         <div style="margin:14px auto;width:80px;height:80px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">${await icon(ic, 42)}</div>
         <div style="font-size:38px;font-weight:700">${a}</div><div class="muted" style="font-size:23px;margin-top:2px">${b}</div></div>`))).join("")}
    </div>
    ${phone("en-T-home", "top:230px;right:70px;transform:rotate(5deg)")}
    <div style="position:absolute;top:880px;left:70px">${await url()}</div>` })],
  ["06-counted", async () => ({ html: `${brand("en")}
    <div style="position:absolute;top:180px;left:70px">
      <div class="h" style="font-size:108px">Every Tefillin.<br>Every candle.<br><span style="color:var(--accent)">Counted.</span></div>
      <div class="muted" style="font-size:30px;margin-top:28px">Log each Mivtza the moment it happens.</div>
    </div>
    ${await stat("tefillin", "", "Tefillin", 6, 0, "top:190px;left:760px;transform:rotate(-4deg);background:linear-gradient(135deg,color-mix(in srgb,var(--candle-soft) 70%,transparent),var(--glass))")}
    ${await stat("flame", "c", "Candles", 3, 0, "top:500px;left:1070px;transform:rotate(3deg)")}
    <div style="position:absolute;top:880px;left:70px">${await url()}</div>` })],
  ["07-easy", async () => ({ html: `${brand("en")}
    <div style="position:absolute;top:170px;left:70px">
      <div class="eyebrow" style="font-size:30px">Tracking Mivtzoim?</div>
      <div class="h muted" style="font-size:76px;margin-top:20px;opacity:.55">Not impossible.</div>
      <div class="h muted" style="font-size:76px;opacity:.75">Not even hard.</div>
      <div class="h" style="font-size:250px;margin-top:6px;letter-spacing:-.06em;background:linear-gradient(100deg,var(--accent),var(--candle));-webkit-background-clip:text;color:transparent">Easy.</div>
    </div>
    <div style="position:absolute;top:300px;right:70px;width:500px;display:flex;flex-direction:column;align-items:center;gap:22px">
      <div class="glass" style="width:100%;padding:30px;display:flex;align-items:center;gap:22px"><div style="position:relative;color:var(--muted)">${await icon("notebook-pen", 64, 1.6)}<div style="position:absolute;left:-8px;right:-8px;top:50%;height:4px;background:#ffb4ab;transform:rotate(-30deg);border-radius:4px"></div></div><div style="font-size:28px" class="muted">It used to take<br>a notebook.</div></div>
      <div style="color:var(--accent);transform:rotate(90deg)">${await icon("arrow-right", 54)}</div>
      <div class="glass" style="width:100%;padding:30px;display:flex;align-items:center;gap:22px"><div style="color:var(--accent)">${await icon("smartphone", 64, 1.6)}</div><div style="font-size:28px">Now it takes<br><b>one tap.</b></div></div>
    </div>
    <div style="position:absolute;top:880px;left:70px">${await url()}</div>` })],
  ["08-route", async () => ({ html: `${brand("en")}
    <div style="position:absolute;top:170px;left:70px">
      <div class="eyebrow" style="font-size:30px">Friday stores, Kingston Ave, the shuk…</div>
      <div class="h" style="font-size:104px;margin-top:12px">Your route,<br>in your pocket.</div>
    </div>
    <svg style="position:absolute;top:470px;left:60px" width="760" height="380" viewBox="0 0 760 380" fill="none">
      <path d="M60 50 C 260 20, 300 170, 420 150 S 640 120, 680 250 S 520 360, 380 330" stroke="#006878" stroke-width="6" stroke-dasharray="2 18" stroke-linecap="round" opacity=".7"/>
    </svg>
    ${(await Promise.all([[80, 490, "Bakery", true], [400, 590, "Pharmacy", true], [650, 700, "Post office", false], [330, 780, "Shoe store", false]].map(async ([x, y, n, d], i) =>
      `<div class="glass" style="position:absolute;left:${x}px;top:${y}px;display:flex;align-items:center;gap:14px;padding:12px 22px 12px 12px;border-radius:999px">
        <div style="width:50px;height:50px;border-radius:50%;display:grid;place-items:center;font-size:23px;font-weight:700;${d ? "background:#1d6b47;color:#fff" : "border:3px solid var(--muted);color:var(--muted)"}">${d ? await icon("check", 26, 3) : i + 1}</div>
        <span style="font-size:27px;font-weight:600;${d ? "text-decoration:line-through;opacity:.6" : ""}">${n}</span></div>`))).join("")}
    ${phone("en-T-route", "top:190px;right:80px;transform:rotate(5deg)")}
    <div style="position:absolute;top:900px;left:70px">${await url()}</div>` })],
  ["09-everywhere", async () => ({ html: `${brand("en")}
    <div style="position:absolute;top:170px;left:70px;width:560px">
      <div class="eyebrow" style="font-size:30px">Keeping track?</div>
      <div class="h" style="font-size:110px;margin-top:12px">Never been easier.</div>
      <div class="muted" style="font-size:30px;margin-top:22px;line-height:1.3">On your phone. On your computer. Always up to date.</div>
    </div>
    <div style="position:absolute;top:230px;left:680px;width:740px">
      <div style="border-radius:24px 24px 0 0;padding:14px;background:linear-gradient(145deg,#2c2d31,#0d0d0f);box-shadow:0 40px 90px rgba(10,30,40,.3)">
        <img src="${img("en-T-desk-home")}" style="display:block;width:100%;border-radius:10px">
      </div>
      <div style="height:24px;margin:0 -40px;border-radius:0 0 24px 24px;background:linear-gradient(#d9d9de,#a9a9b0);box-shadow:0 20px 40px rgba(10,30,40,.25)"></div>
    </div>
    ${phone("en-O-home", "top:470px;left:600px;transform:scale(.62);transform-origin:top left")}
    <div style="position:absolute;top:880px;left:70px">${await url()}</div>` })],
  ["10-every-week", async () => ({ html: `${brand("en")}
    ${phone("en-O-history", "top:170px;left:90px;transform:rotate(-5deg)")}
    <div style="position:absolute;top:170px;left:640px;right:70px">
      <div class="eyebrow" style="font-size:30px">Your History</div>
      <div class="h" style="font-size:104px;margin-top:12px">Every week. Saved.</div>
      <div class="muted" style="font-size:28px;margin-top:20px;line-height:1.35">See what you did this week, last week, and every week before.</div>
    </div>
    <div class="glass" style="position:absolute;top:560px;left:640px;width:600px;padding:30px 36px">
      <div class="muted" style="font-size:24px">This week</div>
      <div style="display:flex;align-items:baseline;gap:16px"><span style="font-size:120px;line-height:1">9</span><span style="font-size:30px">Mivtzoim</span></div>
      <div style="display:flex;gap:14px;margin-top:16px;font-size:23px">
        <span style="display:flex;align-items:center;gap:8px;background:var(--accent-soft);color:var(--accent);padding:8px 18px;border-radius:999px">${await icon("tefillin", 26)} 6 Tefillin</span>
        <span style="display:flex;align-items:center;gap:8px;background:var(--candle-soft);color:var(--candle);padding:8px 18px;border-radius:999px">${await icon("flame", 26)} 3 Candles</span>
      </div>
    </div>
    <div style="position:absolute;top:900px;left:640px">${await url()}</div>` })],
  ["11-photos", async () => {
    const frame = (f, style, pos = "center") => `<div class="glass" style="position:absolute;padding:10px;border-radius:26px;${style}"><img src="${ph(f)}" style="display:block;width:100%;height:100%;object-fit:cover;object-position:${pos};border-radius:18px"></div>`;
    return { html: `${brand("en")}
    <div style="position:absolute;top:150px;left:70px">
      <div class="eyebrow" style="font-size:28px">See this week's photos</div>
      <div class="h" style="font-size:84px;margin-top:8px">Out on <span style="color:var(--accent)">Mivtzoim.</span></div>
    </div>
    ${frame("e1da3977", "top:330px;left:60px;width:880px;height:560px;transform:rotate(-1deg)", "center 60%")}
    ${frame("bcd442a8", "top:110px;left:990px;width:220px;height:280px;transform:rotate(3deg)", "center 35%")}
    ${frame("c75194d2", "top:140px;left:1235px;width:210px;height:270px;transform:rotate(-2deg)", "center 55%")}
    ${frame("3a5b784d", "top:450px;left:985px;width:450px;height:330px;transform:rotate(2deg)", "center 55%")}
    <div style="position:absolute;top:840px;left:990px;display:flex;flex-direction:column;align-items:flex-start;gap:12px">
      <span style="font-size:26px;font-weight:600">Share yours on</span>${await url()}
    </div>` };
  }],
];

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1500, height: 1050 } });
fs.mkdirSync(P + "/cards", { recursive: true });
for (const [name, make] of cards) for (const theme of ["light", "dark"]) {
  if (process.env.ONLY && !name.startsWith(process.env.ONLY)) continue;
  THEME = theme;
  const p = await make();
  const l = p.lang || "en";
  const html = `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="poster card ${theme === "dark" ? "dark" : ""} ${p.rtl ? "rtl" : ""}">${flare()}<div class="bsd" dir="rtl">בס״ד</div>${p.html}<div class="foot">${FOOT[l]}</div></div></body></html>`;
  fs.writeFileSync(`${P}/card-${name}-${theme}.html`, html);
  await pg.goto("file://" + `${P}/card-${name}-${theme}.html`);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${P}/cards/${name}-${theme}.png` });
}
await b.close();
