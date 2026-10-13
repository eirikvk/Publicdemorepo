/* Lager public/kommuneareal.json: flaten til hver kommune i km², med land, ferskvann og hav innenfor kommunegrensen, regnet av
   Kartverkets grenser på samme måte som solv.grense gjør for én kommune. De syntetiske tabellene bruker den til havet i alle
   kommunene, så siden slipper å hente grensene til alle kommunene. Filen er liten, og må lages på nytt når kommunene endres.

   Kjør fra roten av repoet:
       node verktoy/kommuneareal.ts --hentet "13. oktober 2026" */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { flerflate, utsnitt, type GeoJsonFlate } from '../src/data/generelt/geometri.ts';
import { arealKm2 } from '../src/data/solv/felles.ts';

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: valg } = parseArgs({ options: { hentet: { type: 'string', default: '' } } });
const KV = 'https://api.kartverket.no/kommuneinfo/v1';

const fylker: [string, string, [string][]][] = JSON.parse(
  fs.readFileSync(path.join(ROT, 'public', 'kommuner.json'), 'utf8')
);
const numre = fylker.flatMap(f => f[2].map(k => k[0])).sort();
const km2: Record<string, number> = {};
/* Flaten til én kommune, med tre forsøk */
async function flate(nr: string): Promise<number> {
  for (let forsok = 1; ; forsok++) {
    try {
      const r = await fetch(`${KV}/kommuner/${nr}/omrade?utkoordsys=25833`);
      if (!r.ok) throw new Error(String(r.status));
      const koord = flerflate(((await r.json()) as { omrade: GeoJsonFlate }).omrade);
      return arealKm2(koord, utsnitt(koord));
    } catch (e) {
      if (forsok === 3) throw e;
    }
  }
}
/* Seks kall om gangen */
let neste = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (neste < numre.length) {
      const nr = numre[neste++];
      km2[nr] = Math.round((await flate(nr)) * 100) / 100;
    }
  })
);
const ut = {
  kilde: 'Kartverket, kommunegrensene (kommuneinfo), flaten i km² rettet for målestokken i UTM 33',
  hentet: valg.hentet,
  km2: Object.fromEntries(numre.map(nr => [nr, km2[nr]]))
};
fs.writeFileSync(path.join(ROT, 'public', 'kommuneareal.json'), JSON.stringify(ut) + '\n');
console.log(`${numre.length} kommuner, ${Math.round(Object.values(km2).reduce((a, b) => a + b, 0))} km² i alt`);
