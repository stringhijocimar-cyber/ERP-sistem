import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.ATLAS_PLAYWRIGHT_MODULE ?? 'playwright');
const server = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); });
await mkdir('qa', { recursive: true });
let browser;
try { browser = await chromium.launch({ headless: true, ...(process.env.ATLAS_CHROME_PATH ? { executablePath: process.env.ATLAS_CHROME_PATH } : {}), args: ['--no-sandbox'] }); }
catch (e) { server.kill(); throw e; }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const result = { checks: [], errors };
const check = text => { result.checks.push(text); console.log(`PASS ${text}`); };
async function noOverflow(label) { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, label); }
try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
  assert.match(await page.locator('h1').innerText(), /Mais contexto/);
  assert.equal(await page.locator('[data-asset]').count(), 13);
  await noOverflow('radar initial'); check('Initial radar has 13 assets, no fabricated live quotes and no overflow');
  await page.locator('[data-action="demo"]').click();
  await page.locator('.banner').waitFor();
  assert.match(await page.locator('.banner').innerText(), /fictícios/);
  await page.screenshot({ path: 'qa/01-radar.png', fullPage: true });
  check('Demo is explicit and opt-in');
  await page.locator('[data-nav="profile"]').first().click();
  await page.locator('[data-action="start-profile"]').click();
  for (let step = 0; step < 4; step++) {
    const names = await page.locator('#profile-form input').evaluateAll(inputs => [...new Set(inputs.map(i => i.name))]);
    for (const name of names) await page.locator(`input[name="${name}"][value="${name === 'knowledge' ? 2 : 3}"]`).check();
    await page.locator('#profile-form button[type=submit]').click();
  }
  assert.equal(await page.locator('.profile-level').innerText(), 'Arrojado');
  check('Full suitability questionnaire stores and applies the derived profile');
  await page.screenshot({ path: 'qa/05-perfil.png', fullPage: true });
  await page.locator('[data-nav="radar"]').first().click();
  await page.locator('[data-filter="fii"]').click();
  assert.equal(await page.locator('[data-asset]').count(), 3);
  await page.locator('[data-filter="all"]').click();
  await page.locator('#search').fill('VALE');
  assert.equal(await page.locator('[data-asset]').count(), 1);
  await page.locator('#search').fill('');
  await page.locator('[data-asset="PETR4"]').click();
  await page.waitForFunction(() => document.querySelector('.chart'));
  await page.waitForFunction(() => !document.body.innerText.includes('Calculando a validação em segundo plano'), null, { timeout: 90000 });
  assert.equal(await page.locator('[data-action="paper-open"]').isDisabled(), true);
  assert.match(await page.locator('main').innerText(), /Dados fictícios: apenas demonstração/);
  await noOverflow('analysis');
  await page.screenshot({ path: 'qa/02-analise.png', fullPage: true });
  check('Asset filters, search, real candlestick rendering and demo trading veto work');
  await page.locator('[data-mode="day"]').click();
  assert.match(await page.locator('main').innerText(), /5 minutos/);
  await page.locator('[data-mode="swing"]').click();
  check('Changing horizon changes the demo candle interval');
  await page.locator('[data-nav="macro"]').click();
  assert.match(await page.locator('main').innerText(), /Informação tem que ter fonte/);
  await noOverflow('macro');
  await page.screenshot({ path: 'qa/03-cenario.png', fullPage: true });
  await page.locator('[data-nav="paper"]').click();
  await page.locator('#exercise-form button[type=submit]').click();
  assert.match(await page.locator('main').innerText(), /SEM COTAÇÃO REAL/);
  assert.match(await page.locator('main').innerText(), /140,78/);
  await page.locator('#risk-form input[name="riskPct"]').fill('0.25');
  await page.locator('#risk-form button[type=submit]').click();
  assert.match(await page.locator('main').innerText(), /0,25%/);
  await noOverflow('simulator');
  await page.screenshot({ path: 'qa/04-simulador.png', fullPage: true });
  check('Manual paper exercise deducts costs and risk controls persist');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action="export"]').click();
  const download = await downloadPromise; await download.saveAs('qa/diario.csv');
  check('CSV export produces a downloadable diary');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.banner').count(), 0);
  await page.locator('[data-nav="profile"]').first().click();
  assert.equal(await page.locator('.profile-level').innerText(), 'Arrojado');
  check('Profile persists; demo quotes do not silently become a live cache after restart');
  await page.route('https://**/*', route => route.abort('failed'));
  await page.locator('[data-nav="analysis"]').click();
  await page.locator('[data-action="refresh-selected"]').click();
  await page.waitForFunction(() => !document.querySelector('[role=progressbar]'));
  assert.match(await page.locator('.analysis-price').innerText(), /^—/);
  assert.equal(await page.locator('[data-action="paper-open"]').isDisabled(), true);
  check('Failed live provider leaves no executable plan and no fake quote');
  await page.locator('[data-nav="radar"]').first().click();
  await page.locator('[data-action="demo"]').click();
  for (const width of [360, 412, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await noOverflow(`viewport ${width}`);
  }
  await page.screenshot({ path: 'qa/06-desktop.png', fullPage: true });
  check('Layouts fit 360px, 390px, 412px, 768px and 1280px');
  assert.equal(errors.length, 0, errors.join('\n'));
  check('No uncaught browser errors');
} finally {
  await writeFile('qa/ui-result.json', JSON.stringify(result, null, 2));
  await browser.close(); server.kill();
}
