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
    <div style="position:absolute;top:540px;${side}:70px;width:520px;display:flex;flex-direction:column;gap:14px">
      ${await feat("circle-check", ...m.f[0])}${await feat("route", ...m.f[1])}${await feat("images", ...m.f[2], "c")}
    </div>
    ${phone(`${l}-T-home`, `top:200px;${other}:90px;transform:rotate(${rtl ? -6 : 6}deg)`)}
    <div style="position:absolute;top:880px;${side}:640px">${await url()}</div>` };
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
    ${await stat("tefillin", "", "Tefillin", 6, 0, "top:200px;left:820px;transform:rotate(-4deg);background:linear-gradient(135deg,color-mix(in srgb,var(--candle-soft) 70%,transparent),var(--glass))")}
    ${await stat("flame", "c", "Candles", 3, 0, "top:430px;left:1060px;transform:rotate(3deg)")}
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
