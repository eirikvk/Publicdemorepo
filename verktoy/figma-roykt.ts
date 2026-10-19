/* Røyktest for tvillingen fra Figma (srcFigma/): åpner hver side for Trondheim i en mobilnettleser, også kartsiden med hvert tema, og
   sjekker at siden har en overskrift, ikke er bredere enn skjermen og ikke gir feil, og at Tilbake går til forrige side. Bygget av begge sidene må ligge i dist/.

   Kjør: npm run bygg && npm run bygg-figma && node verktoy/figma-roykt.ts */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMAER } from '../srcFigma/temaer.ts';
import { startNettleser } from './regresjon.ts';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist'),
  BREDDE = 390;
const SIDER = [
  '',
  'naturtapet',
  'utforsk',
  ...TEMAER.map(t => 'utforsk/' + t.id),
  'kart',
  ...TEMAER.map(t => 'kart/' + t.id),
  'hjelp'
];

const nettleser = await startNettleser(),
  p = await (await nettleser.newContext({ viewport: { width: BREDDE, height: 844 } })).newPage(),
  feil: string[] = [];
p.on('pageerror', e => feil.push('sidefeil: ' + e.message));
await p.route('http://demo.test/**', r => {
  let fil = path.join(DIST, decodeURIComponent(new URL(r.request().url()).pathname));
  if (fs.existsSync(fil) && fs.statSync(fil).isDirectory()) fil = path.join(fil, 'index.html');
  return fil.startsWith(DIST) && fs.existsSync(fil) ? r.fulfill({ path: fil }) : r.fulfill({ status: 404, body: '' });
});
await p.goto('http://demo.test/figma/?teknisk#5001');
await p.waitForFunction(() => !!(window as unknown as { motor?: { app: { valgt: unknown } } }).motor?.app.valgt, null, {
  timeout: 60000
});
for (const side of [...SIDER, 'finnes-ikke']) {
  await p.evaluate(h => (location.hash = h), '#5001' + (side ? '/' + side : ''));
  await p.waitForTimeout(1500);
  const h1 = await p.locator('h1').first().textContent(),
    bredde = await p.evaluate(() => document.documentElement.scrollWidth),
    ukjent = h1 === 'Fant ikke siden';
  if (!h1 || ukjent !== (side === 'finnes-ikke')) feil.push(`${side || 'oversikt'}: overskriften er «${h1}»`);
  if (side.startsWith('kart/') && !(await p.locator('.kartvalg .md-chip--active').count()))
    feil.push(`${side}: ingen brikke er valgt`);
  if (bredde > BREDDE) feil.push(`${side || 'oversikt'}: siden er ${bredde} px bred`);
  console.log(`${(side || 'oversikt').padEnd(30)} ${h1}`);
}
await p.goBack();
await p.waitForTimeout(500);
if (!p.url().endsWith('#5001/hjelp')) feil.push('Tilbake gikk til ' + p.url());
await nettleser.close();
feil.forEach(f => console.log(f));
console.log(feil.length ? `\n${feil.length} feil.` : '\nIngen feil.');
process.exit(feil.length ? 1 : 0);
