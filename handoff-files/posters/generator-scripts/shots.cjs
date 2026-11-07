const { chromium, devices } = require(process.env.PW); const fs = require('fs'); const { execFileSync } = require('child_process');
const S = process.env.S, OUT = S + '/posters/shots', base = 'http://127.0.0.1:8767/shiurdaledmivtzoim/';
(async () => {
  const b = await chromium.launch();
  const run = async (lang, scheme, desk) => {
    const c = await b.newContext(desk ? { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: scheme } : { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: scheme });
    await c.addInitScript((l) => { try { sessionStorage.setItem('sdm-photos-promo-shown', '1'); localStorage.setItem('sdm-install-dismissed', '1'); localStorage.setItem('sdm-language', l); } catch {} }, lang);
    await c.route(/fonts\.(googleapis|gstatic)\.com/, async (route) => { const url = route.request().url(); const f = `${S}/cdn/` + url.replace(/[^a-z0-9.]/gi, '_').slice(0, 200);
      if (!fs.existsSync(f)) execFileSync('curl', ['-sSL', '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', '-o', f, url]);
      await route.fulfill({ body: fs.readFileSync(f), contentType: url.includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }); });
    const p = await c.newPage();
    const shot = async (name) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/${lang}-${scheme}${desk ? '-desk' : ''}-${name}.png` }); };
    await p.goto(base + 'login/?mode=signup'); await p.waitForSelector('#login-name');
    await p.fill('#login-name', 'Kingston Ave'); await p.fill('#login-username', 'mendel'); await p.fill('#login-email', 'm@example.com');
    await p.fill('#login-password', 'secret1'); await p.fill('#login-password2', 'secret1');
    await p.click('button[type=submit]'); await p.waitForSelector('#week-picker'); await p.waitForTimeout(500);
    const pre = { en: 'Add 1 ', he: 'הוסף 1 ', fr: 'Ajouter 1 ', es: 'Agregar 1 ' }[lang];
    const add = async (k, n) => { for (let i = 0; i < n; i++) { await p.locator(`button[aria-label^="${pre}"]`).nth(k).click(); await p.waitForTimeout(120); } };
    await add(0, 6); await add(1, 3);
    if (lang === 'en' && !desk) {
      await p.goto(base + 'routes/new/'); await p.waitForSelector('#route-name'); await p.fill('#route-name', 'Friday stores');
      for (const [nm, a] of [['Bakery', '400 Kingston Ave'], ["Goldberg's Pharmacy", '412 Kingston Ave'], ['Post office', '450 Kingston Ave'], ['Shoe store', '470 Kingston Ave']]) {
        await p.fill('#new-stop-name', nm); await p.fill('#new-stop-address', a); await p.keyboard.press('Escape').catch(() => {});
        await p.click('main button.justify-self-start:has-text("Add stop")'); await p.waitForTimeout(200); }
      await p.locator('main button[type=submit]').last().click(); await p.waitForSelector('main ol li'); await p.waitForTimeout(500);
      await p.locator('main ol li button[aria-pressed]').first().click(); await p.waitForTimeout(200);
      await p.locator('main ol li button[aria-pressed]').nth(1).click(); await p.waitForTimeout(7000);
      await shot('route');
      await p.goto(base + 'history/'); await p.waitForTimeout(1000); await shot('history');
      await p.goto(base + 'log/'); await p.waitForTimeout(1000); await shot('log');
    }
    await p.goto(base); await p.waitForTimeout(1500); await shot('home');
    await p.locator('#week-picker').evaluate(e => e.scrollIntoView({ block: 'center' })).catch(() => {}); await shot('home-week');
    await c.close();
  };
  for (const l of ['he', 'es', 'fr']) await run(l, 'dark', false);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
