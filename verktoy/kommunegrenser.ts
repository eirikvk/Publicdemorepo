/* Lagrer kommunegrensen og kommunens andel per rute i bitene for noen kommuner, sammen med siden. De er det ferdige svaret for
   solv.grense og solv.kommunebiter, så siden slipper å hente grensen fra Kartverket og regne ut andelen når kommunen velges.
   Arbeidet gjøres i en nettleser (Chromium via Playwright) med katalogen i src, se kommunegrenser-side.ts, altså med de samme
   ETL-funksjonene som siden bruker når det ikke finnes noe lagret. Her står bare det å lagre.

   Kjør fra roten av repoet:
       node verktoy/kommunegrenser.ts 5001 5612 --hentet "18. oktober 2026"
       node verktoy/kommunegrenser.ts --lagrede --hentet "18. oktober 2026"

   Med --lagrede tas alle kommunene som har dagens klasser eller detaljklassene lagret (public/klasser.json og
   public/detaljklasser.json). Grensen legges i public/kommunegrenser/<nr>.json, andelen i public/kommunegrenser/<nr>-andel.bin.gz,
   og registeret i public/kommunegrenser.json. Grensen er Kartverkets, lisensiert CC BY 4.0. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import type { lagKommune } from './kommunegrenser-side.ts';
import { startNettleser } from './regresjon.ts';

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: valg, positionals: kommuner } = parseArgs({
  allowPositionals: true,
  options: {
    lagrede: { type: 'boolean' } /* alle kommunene med lagrede klasser eller detaljklasser */,
    hentet: { type: 'string' } /* tekst for når grensene er hentet, vises på siden */,
    ut: {
      type: 'string',
      default: path.join(ROT, 'public')
    } /* mappen kommunegrenser/ og kommunegrenser.json legges i */
  }
});
const numre = new Set(kommuner);
if (valg.lagrede)
  for (const fil of ['klasser.json', 'detaljklasser.json']) {
    const f = path.join(ROT, 'public', fil);
    if (fs.existsSync(f))
      for (const nr of Object.keys(JSON.parse(fs.readFileSync(f, 'utf8')).kommuner || {})) numre.add(nr);
  }
if (!numre.size) {
  console.log('Bruk: node verktoy/kommunegrenser.ts <kommunenumre> [--lagrede] [--hentet tekst] [--ut mappe]');
  process.exit(2);
}
/* Registeret: når grensene er hentet, og kommunene */
interface Register {
  hentet: string;
  kommuner: string[];
}
const regfil = path.join(valg.ut!, 'kommunegrenser.json'),
  register: Register = fs.existsSync(regfil)
    ? JSON.parse(fs.readFileSync(regfil, 'utf8'))
    : { hentet: '', kommuner: [] },
  mappe = path.join(valg.ut!, 'kommunegrenser');

/* Koden i src serveres av Vite, og nettleseren henter den gjennom en side på http://grenser.test/. Registeret over lagrede grenser
   finnes ikke der, så katalogen lager svarene selv. */
const vite = await createServer({ root: ROT, logLevel: 'error', server: { port: 5199 } });
await vite.listen();
const adresse = vite.resolvedUrls!.local[0].replace(/\/$/, '');
const nettleser = await startNettleser(),
  side = await nettleser.newPage();
await side.route('http://grenser.test/**', async r => {
  const u = new URL(r.request().url());
  if (u.pathname === '/')
    return r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Lagrede kommunegrenser</title>' });
  if (u.pathname === '/kommunegrenser.json') return r.fulfill({ status: 404, body: '' });
  const svar = await fetch(adresse + u.pathname + u.search);
  return r.fulfill({
    status: svar.status,
    headers: Object.fromEntries(svar.headers),
    body: Buffer.from(await svar.arrayBuffer())
  });
});
await side.goto('http://grenser.test/');
const modul = '/verktoy/kommunegrenser-side.ts'; /* i nettleseren, fra Vite */

fs.mkdirSync(mappe, { recursive: true });
for (const nr of [...numre].sort()) {
  const t0 = Date.now();
  try {
    const K: Awaited<ReturnType<typeof lagKommune>> = await side.evaluate(
      ([m, nr]) => import(m).then(s => s.lagKommune(nr)),
      [modul, nr]
    );
    const grense = JSON.stringify(K.grense),
      andel = Buffer.from(K.andel, 'base64');
    fs.writeFileSync(path.join(mappe, `${nr}.json`), grense);
    fs.writeFileSync(path.join(mappe, `${nr}-andel.bin.gz`), andel);
    register.kommuner = [...new Set([...register.kommuner, nr])].sort();
    if (valg.hentet) register.hentet = valg.hentet;
    fs.writeFileSync(
      regfil,
      JSON.stringify(register)
    ); /* for hver kommune, så en avbrutt kjøring ikke mister det som er gjort */
    console.log(
      nr,
      JSON.stringify({
        biter: K.biter,
        grenseKB: Math.round(grense.length / 1024),
        andelKB: Math.round(andel.length / 1024),
        sekunder: Math.round((Date.now() - t0) / 1000)
      })
    );
  } catch (e) {
    console.log(nr, 'FEIL', String((e as Error).message).slice(0, 200));
  }
}
await nettleser.close();
await vite.close();
