/* Lager lagrede oversiktsbilder: ett ferdig bilde per kommune av dagens arealklasser, vist når kartet er zoomet ut.

   Bildet hentes fra NIBIOs grunnkart for arealanalyse, 2048 x 2048 piksler om gangen, med de samme seks rene fargene som siden selv
   ber om, og regnes ned til høyst 2048 piksler på lengste side. Hver piksel lagres som en blanding av de to klassene det er mest av, i
   sjettedeler, så bildet får en liten fargetabell og blir lite. Siden bytter ut fargetabellen i nettleseren, på samme måte som for
   kartflisene. Arbeidet gjøres i en nettleser (Chromium via Playwright) med koden i src, se oversiktsbilde-side.ts, så bildet lages på
   samme måte som siden henter, leser og tolker kartet.

   Kjør fra roten av repoet:
       node verktoy/oversiktsbilde.ts 5001 5021
       node verktoy/oversiktsbilde.ts --fylke 50 --hentet "5. og 6. oktober 2026"

   Bildene legges i public/oversikt/, og public/oversikt.json oppdateres. Kommuner som alt har bilde, hoppes over uten --paa-nytt.
   Grunnkartet er lisensiert «Norge digitalt begrenset». Vær varsom med belastningen: en kommune koster 4 til 16 kall. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';
import { palettPng } from '../src/data/generelt/png.ts';
import type { lagOversikt } from './oversiktsbilde-side.ts';
import { startNettleser } from './regresjon.ts';

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: valg, positionals: kommuner } = parseArgs({
  allowPositionals: true,
  options: {
    fylke: { type: 'string' } /* alle kommunene i et fylke, etter fylkesnummer i public/kommuner.json */,
    'paa-nytt': { type: 'boolean' } /* lag bildet også når kommunen har et fra før */,
    hentet: { type: 'string' } /* tekst for når bildene er hentet, vises på siden */,
    ut: { type: 'string', default: path.join(ROT, 'public', 'oversikt') } /* mappe for bildene */,
    register: { type: 'string', default: path.join(ROT, 'public', 'oversikt.json') } /* tom tekst for å la være */
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
  console.log(
    'Bruk: node verktoy/oversiktsbilde.ts <kommunenumre> [--fylke 50] [--paa-nytt] [--hentet tekst] [--ut mappe]'
  );
  process.exit(2);
}
interface Register {
  versjon: string;
  hentet: string;
  kommuner: Record<string, number[]>;
}
const register: Register =
  valg.register && fs.existsSync(valg.register)
    ? JSON.parse(fs.readFileSync(valg.register, 'utf8'))
    : { versjon: 'årsversjon 2025', hentet: '', kommuner: {} };

/* Koden i src serveres av Vite, og nettleseren henter den gjennom en side på http://oversikt.test/. */
const vite = await createServer({ root: ROT, logLevel: 'error', server: { port: 5197 } });
await vite.listen();
const adresse = vite.resolvedUrls!.local[0].replace(/\/$/, '');
const nettleser = await startNettleser(),
  side = await nettleser.newPage();
await side.route('http://oversikt.test/**', async r => {
  const u = new URL(r.request().url());
  if (u.pathname === '/')
    return r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Oversiktsbilder</title>' });
  const svar = await fetch(adresse + u.pathname + u.search);
  return r.fulfill({
    status: svar.status,
    headers: Object.fromEntries(svar.headers),
    body: Buffer.from(await svar.arrayBuffer())
  });
});
await side.goto('http://oversikt.test/');

for (const nr of numre) {
  const fil = path.join(valg.ut!, `${nr}.png`);
  if (!valg['paa-nytt'] && register.kommuner[nr] && fs.existsSync(fil)) {
    console.log(nr, 'har bilde fra før');
    continue;
  }
  try {
    const B: Awaited<ReturnType<typeof lagOversikt>> = await side.evaluate(nr => {
      const modul = '/verktoy/oversiktsbilde-side.ts'; /* i nettleseren, fra Vite */
      return import(modul).then(m => m.lagOversikt(nr));
    }, nr);
    const png = palettPng(B.w, B.h, Buffer.from(B.indeks, 'base64'), B.farger, B.dekning, data =>
      deflateSync(data, { level: 9 })
    );
    fs.mkdirSync(valg.ut!, { recursive: true });
    fs.writeFileSync(fil, png);
    register.kommuner[nr] = B.utsnitt;
    console.log(nr, JSON.stringify({ ...B.info, kB: Math.floor(png.length / 1024) }));
    if (valg.register) {
      /* lagres for hver kommune, så en avbrutt kjøring ikke mister det som er gjort */
      if (valg.hentet) register.hentet = valg.hentet;
      fs.writeFileSync(valg.register, JSON.stringify(register));
    }
  } catch (e) {
    console.log(nr, 'FEIL', String((e as Error).message).slice(0, 200));
  }
}
await nettleser.close();
await vite.close();
