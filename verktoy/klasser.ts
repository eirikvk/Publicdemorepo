/* Lager de lagrede klassene: dagens klasser per blokk på nivå 10 (10,6 meter) for noen kommuner, lagret sammen med
   siden. De er det ferdige svaret for solv.klasser, så siden slipper å hente kartbildene fra NIBIO for hele kommunen. Arbeidet gjøres i en nettleser
   (Chromium via Playwright) med katalogen i src, se klasser-side.ts. Svaret lages altså av den samme ETL-funksjonen som siden
   bruker når det ikke finnes noe lagret. Her står bare det å lagre: hver blokk som et lite bilde med fargetabell (KLASSETABELL i
   src/data/solv/klasser.ts), og registeret over hvilke blokker hver kommune har.

   Kjør fra roten av repoet:
       node verktoy/klasser.ts 5001 5021
       node verktoy/klasser.ts --fylke 50 --hentet "11. oktober 2026"
       node verktoy/klasser.ts 5001 --detalj --hentet "13. oktober 2026"

   Med --detalj lages detaljklassene (19 klasser fra NIBIO og to restklasser, solv.detaljklasser) i stedet, bare på nivå 10, i
   public/detaljklasser/ og public/detaljklasser.json. Detaljklassen leses innenfor dagens klasse i ruta, og dagens klasser tas da
   fra de lagrede når kommunen har dem, så de to stemmer overens. En blokk koster ett kall mot NIBIO, og ett til for dagens klasser
   når de ikke er lagret.

   Blokkene legges i public/klasser/z/x/y.png, og public/klasser.json oppdateres. Blokker som alt er lagret, hoppes over uten
   --paa-nytt. En blokk koster ett kall mot NIBIO. Grunnkartet er lisensiert «Norge digitalt begrenset». Tallene regnes bare på nivå
   10, så det er det eneste nivået som lagres. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';
import { palettPng } from '../src/data/generelt/png.ts';
import { DETALJTABELL, KLASSETABELL } from '../src/data/solv/klasser.ts';
import type { blokkerFor, lagBlokk } from './klasser-side.ts';
import { startNettleser } from './regresjon.ts';

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: valg, positionals: kommuner } = parseArgs({
  allowPositionals: true,
  options: {
    fylke: { type: 'string' } /* alle kommunene i et fylke, etter fylkesnummer i public/kommuner.json */,
    'paa-nytt': { type: 'boolean' } /* lag blokkene også når de er lagret fra før */,
    hentet: { type: 'string' } /* tekst for når klassene er laget, vises på siden */,
    niva: { type: 'string', default: '10' } /* nivåene som lages */,
    detalj: { type: 'boolean' } /* detaljklassene i stedet for dagens klasser, bare på nivå 10 */,
    ut: { type: 'string', default: path.join(ROT, 'public') } /* mappen klasser/ og klasser.json legges i */
  }
});
const numre = [...kommuner];
if (valg.fylke) {
  const fylker: [string, string, [string][]][] = JSON.parse(
    fs.readFileSync(path.join(ROT, 'public', 'kommuner.json'), 'utf8')
  );
  numre.push(
    ...fylker
      .filter(f => f[0] === valg.fylke)
      .flatMap(f => f[2].map(k => k[0]))
      .sort()
  );
}
if (!numre.length) {
  console.log('Bruk: node verktoy/klasser.ts <kommunenumre> [--fylke 50] [--paa-nytt] [--hentet tekst] [--ut mappe]');
  process.exit(2);
}
const DETALJ = !!valg.detalj,
  NAVN = DETALJ ? 'detaljklasser' : 'klasser',
  TABELL = DETALJ ? DETALJTABELL : KLASSETABELL,
  NIVAER = DETALJ ? [10] : valg.niva!.split(',').map(Number);
if (NIVAER.some(z => z !== 10)) throw new Error('blokkene lages bare på nivå 10');
/* Registeret: blokkene [x, y] per kommune og nivå */
interface Register {
  versjon: string;
  hentet: string;
  kommuner: Record<string, Record<string, number[][]>>;
}
const regfil = path.join(valg.ut!, NAVN + '.json'),
  register: Register = fs.existsSync(regfil)
    ? JSON.parse(fs.readFileSync(regfil, 'utf8'))
    : { versjon: 'årsversjon 2025', hentet: '', kommuner: {} };
const blokkfil = (z: number, [x, y]: number[]) => path.join(valg.ut!, NAVN, String(z), String(x), `${y}.png`);
const DEKNING = TABELL.map((_, i) => (i ? 255 : 0)); /* plass 0 er gjennomsiktig */

/* Koden i src serveres av Vite, og nettleseren henter den gjennom en side på http://klasser.test/. Registeret for det som lages,
   finnes ikke der, så katalogen lager svarene selv. Med --detalj finnes registeret over dagens klasser, så de lagrede brukes. */
const vite = await createServer({ root: ROT, logLevel: 'error', server: { port: 5198 } });
await vite.listen();
const adresse = vite.resolvedUrls!.local[0].replace(/\/$/, '');
const nettleser = await startNettleser(),
  side = await nettleser.newPage();
await side.route('http://klasser.test/**', async r => {
  const u = new URL(r.request().url());
  if (u.pathname === '/')
    return r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Lagrede klasser</title>' });
  if (u.pathname === '/' + NAVN + '.json' || u.pathname === '/detaljklasser.json')
    return r.fulfill({ status: 404, body: '' });
  const svar = await fetch(adresse + u.pathname + u.search);
  return r.fulfill({
    status: svar.status,
    headers: Object.fromEntries(svar.headers),
    body: Buffer.from(await svar.arrayBuffer())
  });
});
await side.goto('http://klasser.test/');
const modul = '/verktoy/klasser-side.ts'; /* i nettleseren, fra Vite */

const laget = new Set<string>(); /* blokker som er laget i denne kjøringen */
/* Blokkene for kommunen nr på nivå z: de som mangler, lages fire om gangen, så køen mot NIBIO i nettleseren (høyst fire kall)
   holdes full. Gir blokkene, hvor mange som er nye, og størrelsen på filene. */
async function lagNiva(nr: string, z: number) {
  const B: Awaited<ReturnType<typeof blokkerFor>> = await side.evaluate(
    ([m, nr, z]) => import(m as string).then(s => s.blokkerFor(nr, z)),
    [modul, nr, z]
  );
  let nye = 0,
    byte = 0;
  const igjen = B.filter(b => {
    const fil = blokkfil(z, b);
    if (!laget.has(fil) && (valg['paa-nytt'] || !fs.existsSync(fil))) return true;
    byte += fs.statSync(fil).size;
    return false;
  });
  const lag = async (b: number[]) => {
    const fil = blokkfil(z, b),
      K: Awaited<ReturnType<typeof lagBlokk>> = await side.evaluate(
        ([m, z, x, y, d]) => import(m as string).then(s => s.lagBlokk(z, x, y, d)),
        [modul, z, b[0], b[1], DETALJ] as const
      );
    const png = palettPng(512, 512, Buffer.from(K.kl, 'base64'), TABELL, DEKNING, data =>
      deflateSync(data, { level: 9 })
    );
    fs.mkdirSync(path.dirname(fil), { recursive: true });
    fs.writeFileSync(fil, png);
    laget.add(fil);
    nye++;
    byte += png.length;
  };
  for (let i = 0; i < igjen.length; i += 4) await Promise.all(igjen.slice(i, i + 4).map(lag));
  return { B, nye, kB: Math.round(byte / 1024) };
}
for (const nr of numre) {
  const t0 = Date.now();
  try {
    const ut: Record<string, unknown> = {};
    for (const z of NIVAER) {
      const { B, nye, kB } = await lagNiva(nr, z);
      register.kommuner[nr] = { ...register.kommuner[nr], [z]: B };
      ut[z] = { blokker: B.length, nye, kB };
    }
    if (valg.hentet) register.hentet = valg.hentet;
    fs.writeFileSync(
      regfil,
      JSON.stringify(register)
    ); /* for hver kommune, så en avbrutt kjøring ikke mister det som er gjort */
    console.log(nr, JSON.stringify({ ...ut, sekunder: Math.round((Date.now() - t0) / 1000) }));
  } catch (e) {
    console.log(nr, 'FEIL', String((e as Error).message).slice(0, 200));
  }
}
await nettleser.close();
await vite.close();
