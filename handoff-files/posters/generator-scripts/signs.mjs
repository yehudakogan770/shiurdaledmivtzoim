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
body{width:var(--W);height:var(--H);overflow:hidden}
.poster{--paper:#efedf0;--ink:#1b1b1e;--muted:#45464c;--accent:#006878;--accent-soft:#c4ecf5;--candle:#755b00;--candle-soft:#fbe3a1;
  --g1:rgba(16,106,122,.42);--g2:rgba(140,226,250,.7);--g3:rgba(255,214,110,.58);--glass:rgba(255,255,255,.55);--edge:rgba(255,255,255,.8);--shadow:0 18px 50px rgba(30,60,70,.16);
  position:relative;width:var(--W);height:var(--H);overflow:hidden;color:var(--ink);font-family:"Google Sans Flex","Heebo",sans-serif;
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


const ph = (f) => { const file = fs.readdirSync("/tmp/claude-0/-home-user-ShiurDaledMivtoim/4028b542-0984-514d-bb38-dc99f7c41423/scratchpad/week").find((x) => x.startsWith(f + ".")); return `data:image/${file.endsWith("webp") ? "webp" : "jpeg"};base64,` + fs.readFileSync("/tmp/claude-0/-home-user-ShiurDaledMivtoim/4028b542-0984-514d-bb38-dc99f7c41423/scratchpad/week/" + file).toString("base64"); };
const extra = `
.flow{position:absolute;inset:0;display:flex;flex-direction:column;padding:120px 80px 200px}
.flow .brand{position:static}
.flow>*{flex-shrink:0}
.big{font-weight:800;letter-spacing:-.035em;line-height:.95}
.pill{align-self:flex-start;display:inline-flex;align-items:center;gap:12px;padding:12px 26px;border-radius:999px;background:var(--candle-soft);color:var(--candle);font-weight:700;font-size:30px}
.steps3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.st{padding:26px 18px;text-align:center;border-radius:28px}
.st .ic{margin:0 auto 12px;width:78px;height:78px;border-radius:50%;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)}
.st b{display:block;font-size:34px;font-weight:700}
.st span{display:block;font-size:22px;color:var(--muted);margin-top:4px}
.paper{position:relative;width:var(--pw);height:calc(var(--pw) * 1.3);border-radius:18px;background:#fbfaf5;box-shadow:0 20px 50px rgba(10,30,40,.25);transform:rotate(-7deg);padding:40px 34px;flex:none}
.dark .paper{background:#e9e6dc}
.paper i{display:block;height:4px;border-radius:2px;background:#c9ccd2;margin:0 0 28px}
.paper .x{position:absolute;inset:-20px;display:grid;place-items:center;color:#d6453d}
.photos img{position:absolute;object-fit:cover;border-radius:22px;border:8px solid #fff;box-shadow:0 20px 50px rgba(10,30,40,.3)}
.dark .photos img{border-color:#2a2b2e}
.foot{white-space:normal!important;width:calc(var(--W) - 140px);bottom:44px!important;font-size:22px!important;border-radius:26px!important;padding:14px 26px!important}
`;
const ticketCss = `
.ticket{position:relative;display:flex;width:900px;height:380px;transform:rotate(-4deg);filter:drop-shadow(0 30px 50px rgba(10,30,40,.3))}
.ticket .tl{width:300px;display:grid;place-items:center;background:linear-gradient(150deg,#f5b82e,#e8892e);border-radius:36px 0 0 36px;color:#fff;border-right:6px dashed rgba(255,255,255,.7)}
.ticket .tr{flex:1;background:linear-gradient(150deg,var(--accent),#0a4f5c);border-radius:0 36px 36px 0;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 50px}
.dark .ticket .tr{background:linear-gradient(150deg,#1f8ea3,#0a4f5c)}
.ticket .t1{font-size:68px;font-weight:800;letter-spacing:.02em}
.ticket .t2{font-size:34px;opacity:.85;margin-top:4px;text-transform:uppercase;letter-spacing:.2em}
.ticket .t3{display:flex;align-items:center;gap:12px;font-size:30px;margin-top:28px;color:#ffd875;font-weight:600}
.ticket::before,.ticket::after{content:"";position:absolute;left:282px;width:40px;height:40px;border-radius:50%;background:var(--paper)}
.deadline{display:flex;align-items:center;gap:26px;padding:26px 46px;border-radius:999px;background:linear-gradient(120deg,#e85d75,#f08a3d);color:#fff;box-shadow:0 20px 50px rgba(232,93,117,.35);transform:rotate(2deg)}
.deadline span{display:block;font-size:26px;text-transform:uppercase;letter-spacing:.2em;opacity:.9}
.deadline b{display:block;font-size:58px;font-weight:800;line-height:1}
.ticket::before{top:-20px}.ticket::after{bottom:-20px}
`;
const step = async (ic, b, s) => `<div class="glass st"><div class="ic">${await icon(ic, 40)}</div><b>${b}</b><span>${s}</span></div>`;

async function paperSign(tall) {
  return `<div class="flow" style="${tall ? "" : "padding-bottom:180px"}">
    <div class="brand">${logo(66)}<span>Shiur Daled Mivtzoim</span></div>
    <div style="height:${tall ? 90 : 70}px"></div>
    <span class="pill">${await icon("sparkles", 30, 2.4)} Mivtzoim went digital</span>
    <div class="big" style="font-size:${tall ? 150 : 130}px;margin-top:24px">No more<br><span style="color:var(--accent)">pen &amp; paper.</span></div>
    <div class="muted" style="font-size:38px;margin-top:24px;line-height:1.3">Log your Mivtzoim on the website. It takes seconds, from anywhere.</div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:40px;min-height:0;padding:30px 0">
      <div class="paper">${"<i></i>".repeat(8)}<div class="x">${await icon("x", 300, 2.2)}</div></div>
      <div style="color:var(--accent)">${await icon("arrow-right", 70, 2.4)}</div>
      <div style="position:relative;flex:none;width:${tall ? 370 : 200}px;height:${tall ? 788 : 426}px;transform:rotate(5deg)">${phone("en-T-home", `position:absolute;left:0;top:0;transform:scale(${tall ? 0.86 : 0.465});transform-origin:top left`)}</div>
    </div>
    <div class="steps3">${await step("globe", "Open", "sdmivtzoim.com")}${await step("pointer", "Tap", "your Mivtza")}${await step("circle-check", "Done", "it's counted")}</div>
  </div>`;
}

async function photoSign(tall) {
  const H = tall ? 1080 : 470;
  return `<div class="flow" style="${tall ? "" : "padding-bottom:180px"}">
    <div class="brand">${logo(66)}<span>Shiur Daled Mivtzoim</span></div>
    <div style="height:${tall ? 80 : 60}px"></div>
    <span class="pill">${await icon("camera", 30, 2.4)} Don't forget your photos</span>
    <div class="big" style="font-size:${tall ? 160 : 130}px;margin-top:24px">Snap it.<br><span style="color:var(--accent)">Share it.</span></div>
    <div class="muted" style="font-size:38px;margin-top:24px;line-height:1.3">Upload this week's Mivtzoim photos, so everyone can see them.</div>
    <div class="photos" style="position:relative;flex:1;min-height:${H}px;margin-top:40px">
      <img src="${ph("w34")}" style="left:0;top:10px;width:100%;height:420px;transform:rotate(-2deg)">
      <img src="${ph("w15")}" style="left:0;top:450px;width:52%;height:300px;transform:rotate(3deg)">
      <img src="${ph("w39")}" style="right:0;top:465px;width:46%;height:300px;transform:rotate(-3deg)">
      <img src="${ph("w25")}" style="left:2%;top:785px;width:46%;height:280px;transform:rotate(-2deg)">
      <img src="${ph("w03")}" style="right:0;top:775px;width:52%;height:290px;transform:rotate(2.5deg)">
    </div>
    <div class="steps3">${await step("camera", "Snap", "on Mivtzoim")}${await step("upload", "Upload", "on the Photos page")}${await step("images", "Enjoy", "the whole week")}</div>
  </div>`;
}


async function raffleSign(tall) {
  const cols = ["#f5b82e", "#e85d75", "#3fb6d3", "#7c6cf2", "#2fae6b", "#ff8a3d"];
  let seed = 11; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  let conf = "";
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 1080, y = 80 + rnd() * 2150, w = 10 + rnd() * 16, h = rnd() > 0.5 ? w : w * 2.4, r = rnd() * 360, c = cols[i % cols.length];
    if (y > 520 && y < 1180 && x > 60 && x < 1020) continue;
    conf += `<span style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${c};border-radius:${rnd() > 0.6 ? "50%" : "3px"};transform:rotate(${r}deg);opacity:.85"></span>`;
  }
  return `<div style="position:absolute;inset:0;pointer-events:none">${conf}</div>
  <div class="flow">
    <div class="brand">${logo(66)}<span>Shiur Daled Mivtzoim</span></div>
    <div style="height:80px"></div>
    <span class="pill">${await icon("party-popper", 30, 2.4)} Weekly raffle</span>
    <div class="big" style="font-size:150px;margin-top:28px">Fill it out.<br><span style="background:linear-gradient(100deg,var(--accent),var(--candle));-webkit-background-clip:text;color:transparent">You're in!</span></div>
    <div class="muted" style="font-size:38px;margin-top:24px;line-height:1.3">Log your Mivtzoim on the website <b style="color:var(--ink)">before Tuesday</b> and you're entered into the raffle.</div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:90px;min-height:0">
      <div class="deadline">${await icon("alarm-clock", 64, 2.2)}<div><span>Deadline</span><b>Before Tuesday</b></div></div>
      <div class="ticket">
        <div class="tl"><div class="gift">${await icon("gift", 120, 1.8)}</div></div>
        <div class="tr">
          <div class="t1">RAFFLE ENTRY</div>
          <div class="t2">Admit one</div>
          <div class="t3">${await icon("star", 26, 2.4)} Fill it out before Tuesday ${await icon("star", 26, 2.4)}</div>
        </div>
      </div>
    </div>
    <div class="steps3">${await step("clipboard-check", "Log", "before Tuesday")}${await step("ticket", "Get entered", "into the raffle")}${await step("trophy", "Win", "good luck!")}</div>
  </div>`;
}

const b = await chromium.launch();
fs.mkdirSync(P + "/signs", { recursive: true });
for (const [size, W, H] of [["phone", 1080, 2340]]) {
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  for (const [name, make] of [["No-more-paper", paperSign], ["Upload-photos", photoSign], ["Raffle", raffleSign]]) for (const theme of ["light", "dark"]) {
    THEME = theme;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${ticketCss}:root{--W:${W}px;--H:${H}px;--pw:330px}${css}${extra}</style></head><body>
    <div class="poster ${theme === "dark" ? "dark" : ""}">${flare()}<div class="bsd" dir="rtl">בס״ד</div>${await make(true)}<div class="foot">${FOOT.en}</div></div></body></html>`;
    fs.writeFileSync(`${P}/sign.html`, html);
    await pg.goto("file://" + `${P}/sign.html`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(200);
    await pg.screenshot({ path: `${P}/signs/${name}-${size}-${theme}.png` });
  }
  await pg.close();
}
await b.close();
