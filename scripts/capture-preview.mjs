import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const out = 'review/screenshots';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400 && response.url().startsWith('http://127.0.0.1')) errors.push(response.status() + ' ' + response.url()); });
await page.goto('http://127.0.0.1:8000/variants/concept-map/', { waitUntil: 'networkidle', timeout: 60000 });
await page.locator('#publications .pub-cite').first().waitFor();
// Remove the sticky-navigation overlay from long section screenshots.
await page.addStyleTag({ content: '.site-header { position: static !important; }' });
await page.evaluate(() => document.fonts.ready);
const expected = ['home', 'about', 'people', 'publications', 'software'];
for (const id of expected) {
  if (await page.locator('#' + id).count() !== 1) errors.push('Missing section: ' + id);
}
for (const id of ['home', 'about', 'people', 'software']) {
  const section = page.locator('#' + id);
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: out + '/' + id + '-desktop.png', animations: 'disabled', timeout: 60000 });
}
await page.evaluate(() => {
  const el = document.getElementById('publications');
  window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 20), behavior: 'instant' });
});
await page.waitForTimeout(120);
await page.screenshot({ path: out + '/publications-desktop.png', animations: 'disabled' });
const images = await page.locator('#people img').evaluateAll(els => els.map(el => ({ src: el.getAttribute('src'), complete: el.complete, width: el.naturalWidth })));
for (const img of images) if (!img.complete || img.width === 0) errors.push('Broken image: ' + img.src);
const pubs = await page.locator('#publications .pub-cite').count();
if (pubs !== 123) errors.push('Expected 123 publications, found ' + pubs);
const visibleText = await page.locator('#publications').innerText();
if (/CV-derived|bibliographic verification pending|large multi-author collaboration/i.test(visibleText)) errors.push('Internal notes visible in publications');
for (const title of ['A framework for fuzzy cognitive mapping workshops: Shark depredation as a case study','Participatory modelling across Kenyan villages facilitates insights into the complexity of human–elephant interactions']) {
  if (!visibleText.includes(title)) errors.push('Missing citation: '+title);
}
const summary = { capturedAt: new Date().toISOString(), pageTitle: await page.title(), publications: pubs, peopleImages: images, errors };
await fs.writeFile(out + '/qa-summary.json', JSON.stringify(summary, null, 2) + '\n');
await browser.close();
if (errors.length) { console.error(summary); process.exitCode = 1; } else console.log(JSON.stringify(summary, null, 2));
