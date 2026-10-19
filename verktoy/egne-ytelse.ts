/* Ytelsen for egne områder og opplastet plan: laster opp en plan på hovedsiden og måler hvor lang tid det tar før sammenligningen
   med kommuneplanen er regnet ut og vist: først tabellene uten fordelingen per økosystemtype, så med den (den trenger grunnkartet med
   detaljklassene, som hentes fra NIBIO for kommuner der det ikke er lagret). Viser også hvilke steg som tok tiden (tidtakingen fra
   cachen, window.motor.bruk). Tidene der er summen for hvert steg, også mens det venter på det det bygger på, så de overlapper. Siden
   åpnes på nytt for hver plan, så ingenting er husket fra før, men dagens klasser og kartet er hentet før planen lastes opp.

   Planene er testplanen for Trondheim (verktoy/testdata/testplan-bygg.geojson) og planer med så mange flater som oppgis, laget her
   med et fast frø: rektangler med sider på 60–250 meter spredt over midten av kommunen, der to av tre er framtidig bebyggelse og
   resten LNF.

   Bygget av hovedsiden må ligge i dist/ (npm run bygg). Kjør: node verktoy/egne-ytelse.ts [--kommune 5001] [--flater 12,300,1000] */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startNettleser } from './regresjon.ts';

const HER = path.dirname(fileURLToPath(import.meta.url)),
  DIST = path.resolve(HER, '..', 'dist'),
  arg = (navn: string, standard: string) => {
    const i = process.argv.indexOf(navn);
    return i > 0 ? process.argv[i + 1] : standard;
  },
  NR = arg('--kommune', '5001'),
  FLATER = arg('--flater', '300')
    .split(',')
    .map(Number)
    .filter(n => n > 0);

/* En plan med n flater over midten av utsnittet ext (UTM33), som GeoJSON i samme format som DiBKs nedlasting av plandata */
function lagPlan(n: number, ext: number[]) {
  const MIDT = [(ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2],
    B = (ext[2] - ext[0]) * 0.5,
    H = (ext[3] - ext[1]) * 0.5;
  let t = 7;
  const r = () => (t = (t * 9301 + 49297) % 233280) / 233280;
  const features = Array.from({ length: n }, (_, i) => {
    const x = MIDT[0] + (r() - 0.5) * B,
      y = MIDT[1] + (r() - 0.5) * H,
      b = 60 + r() * 190,
      h = 60 + r() * 190,
      bygg = i % 3 !== 2;
    return {
      type: 'Feature',
      properties: {
        arealformål: bygg ? ['1110', '1130', '1300', '1500', '2010'][i % 5] : '5100',
        arealbruksstatus: '2',
        'arealplanId.kommunenummer': NR,
        'arealplanId.planidentifikasjon': 'syntetisk'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [x, y],
            [x + b, y],
            [x + b, y + h],
            [x, y + h],
            [x, y]
          ]
        ]
      }
    };
  });
  const fil = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'egne-')), `syntetisk-${n}.geojson`);
  fs.writeFileSync(
    fil,
    JSON.stringify({
      type: 'FeatureCollection',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::25833' } },
      features
    })
  );
  return fil;
}

const planer: [navn: string, fil: number | string][] = [
  ...(NR === '5001'
    ? [['testplanen (12 flater)', path.join(HER, 'testdata', 'testplan-bygg.geojson')] as [string, string]]
    : []),
  ...FLATER.map((n): [string, number] => [`syntetisk, ${n} flater`, n])
];
const nettleser = await startNettleser(),
  ut: string[] = [];
for (const [navn, plan] of planer) {
  const p = await (await nettleser.newContext({ viewport: { width: 1280, height: 900 } })).newPage(),
    feil: string[] = [];
  p.on('pageerror', e => feil.push(e.message));
  await p.route('http://demo.test/**', r => {
    let f = path.join(DIST, decodeURIComponent(new URL(r.request().url()).pathname));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    return f.startsWith(DIST) && fs.existsSync(f) ? r.fulfill({ path: f }) : r.continue();
  });
  await p.goto(`http://demo.test/?teknisk#${NR}/framtid`);
  /* Klar: kommunen er valgt, utbyggingen er regnet ut, og ingenting hentes */
  await p.waitForFunction(() => !!(window.motor && window.motor.utbyggingen() && !window.motor.app.laster), null, {
    timeout: 300000,
    polling: 200
  });
  await p.waitForTimeout(1500);
  const fil =
    typeof plan === 'string'
      ? plan
      : lagPlan(
          plan,
          await p.evaluate(() => {
            const M = window.motor!;
            return Array.from(M.verdi(M.katalog.solv.grense)!.ext);
          })
        );
  await p.evaluate(() => window.motor!.nullstillBruk());
  const t0 = Date.now();
  await p.setInputFiles('#planfil', fil);
  /* Tabellene står, og ingen områder venter på tallene. Så er også fordelingen per økosystemtype med. */
  await p.waitForFunction(
    () => {
      const e = document.querySelector('.egne');
      return (
        !!e && !!e.querySelector('.samlet table') && !/Regner …/.test(e.querySelector('.egneliste')!.textContent || '')
      );
    },
    null,
    { timeout: 600000, polling: 100 }
  );
  const kjerne = Date.now() - t0;
  await p.waitForFunction(() => !/Regner/.test(document.querySelector('.egne')!.textContent || ''), null, {
    timeout: 600000,
    polling: 100
  });
  const ms = Date.now() - t0,
    tider = await p.evaluate(() =>
      Object.entries(window.motor!.bruk)
        .map(([n, b]) => [n, Math.round(b.sum), b.n] as [string, number, number])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
    ),
    rader = await p.locator('.egne .samlet tbody tr').count();
  ut.push(
    `\n${navn}: ${(kjerne / 1000).toFixed(1)} s til tabellene var vist, ${(ms / 1000).toFixed(1)} s med økosystemtypene, ${rader} rader for kommunen`
  );
  for (const [n, sum, k] of tider) ut.push(`  ${n.padEnd(36)} ${String(sum).padStart(7)} ms  (${k} ganger)`);
  if (feil.length) ut.push('  Feil: ' + feil.join(' | '));
  console.log(ut.slice(-tider.length - 1 - (feil.length ? 1 : 0)).join('\n'));
  await p.context().close();
}
await nettleser.close();
