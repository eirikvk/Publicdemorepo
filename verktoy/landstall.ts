/* Landstabellen: tallene for alle kommunene, regnet ut på forhånd. Kjører gull.kommunetall (src/data/gull/landstall.ts) for hver
   kommune i siden selv, i en nettleser (Chromium via Playwright), så tallene regnes med den samme koden og de samme kildene som
   siden bruker når kommunen er valgt. Svarene skrives fortløpende som én linje JSON per kommune, så en kjøring som stopper, kan
   fortsette der den slapp. Kommuner som feiler, prøves på nytt til slutt.

   Kjør:         node verktoy/landstall.ts ut/landstall.jsonl
   Bare noen:    node verktoy/landstall.ts ut/landstall.jsonl --bare 5001,5612
   Ferdig bygg:  node verktoy/landstall.ts ut/landstall.jsonl --kilde dist

   Én kommune om gangen, så tjenestene ikke får mer enn når én person bruker siden. Det tar flere timer for hele landet, og bør
   kjøres når tjenestene har lite trafikk. Filene som legges ut (Parquet, med STAC), lages av svarene med skriptet i bøtta
   eirikvk/naturdata på Hugging Face (landstall/publiser.py). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import { bygg, startNettleser } from './regresjon.ts';

const HER = path.dirname(fileURLToPath(import.meta.url)),
  ROT = path.resolve(HER, '..');
const TYPER: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.geojson': 'application/geo+json'
};
/* Hvor lenge én kommune kan ta før den regnes som feilet, og hvor mange kommuner en side regner før den lages på nytt (så minnet
   ikke vokser) */
const MAKS_MS = 15 * 60 * 1000,
  PER_SIDE = 12;

type Kommune = [nr: string, navn: string];
function kommunene(): Kommune[] {
  const L = JSON.parse(fs.readFileSync(path.join(ROT, 'public', 'kommuner.json'), 'utf8')) as [
    string,
    string,
    [string, string, ...number[]][]
  ][];
  return L.flatMap(([, , K]) => K.map(([nr, navn]) => [nr, navn] as Kommune)).sort((a, b) => a[0].localeCompare(b[0]));
}
/* Kommunene som allerede er regnet ut i filen ut */
function ferdige(ut: string) {
  const F = new Set<string>();
  if (fs.existsSync(ut))
    for (const l of fs.readFileSync(ut, 'utf8').split('\n'))
      if (l.trim())
        try {
          F.add(JSON.parse(l).nr);
        } catch (e) {}
  return F;
}
/* En side med siden fra kilde på http://demo.test/, med datamotoren åpen (?teknisk) og uten valgt kommune */
async function nySide(nettleser: Awaited<ReturnType<typeof startNettleser>>, kilde: string) {
  const ctx = await nettleser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route('http://demo.test/**', r => {
    const fil = path.join(
      kilde,
      decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, '') || 'index.html'
    );
    if (!fil.startsWith(kilde) || !fs.existsSync(fil)) return r.fulfill({ status: 404, body: 'finnes ikke' });
    return r.fulfill({ path: fil, contentType: TYPER[path.extname(fil)] || 'application/octet-stream' });
  });
  await p.goto('http://demo.test/index.html?teknisk');
  await p.waitForFunction(() => !!window.motor, null, { timeout: 60000 });
  return p;
}
/* Tallene for kommunen nr, eller feilen */
async function regn(p: Page, nr: string) {
  return p.evaluate(
    ([nr, maks]) =>
      Promise.race([
        window.motor!.katalog.gull.kommunetall(nr),
        new Promise((_, nei) => setTimeout(() => nei(new Error('brukte for lang tid')), maks))
      ]),
    [nr, MAKS_MS] as const
  );
}

async function kjor(kilde: string, ut: string, bare: string[] | null) {
  const alle = kommunene().filter(([nr]) => !bare || bare.includes(nr)),
    F = ferdige(ut);
  let igjen = alle.filter(([nr]) => !F.has(nr));
  console.log(`${alle.length} kommuner, ${alle.length - igjen.length} ferdige fra før, ${igjen.length} igjen`);
  fs.mkdirSync(path.dirname(path.resolve(ut)), { recursive: true });
  const nettleser = await startNettleser();
  for (let runde = 1; runde <= 3 && igjen.length; runde++) {
    const feilet: Kommune[] = [];
    let p: Page | null = null,
      regnet = 0;
    for (const [nr, navn] of igjen) {
      if (!p || regnet >= PER_SIDE) {
        if (p) await p.context().close();
        p = await nySide(nettleser, kilde);
        regnet = 0;
      }
      const t0 = Date.now();
      try {
        const v = (await regn(p, nr)) as object;
        fs.appendFileSync(ut, JSON.stringify({ ...v, navn, ms: Date.now() - t0 }) + '\n');
        console.log(
          `${new Date().toISOString().slice(11, 19)} ${nr} ${navn}: ${((Date.now() - t0) / 1000).toFixed(0)} s`
        );
      } catch (e) {
        feilet.push([nr, navn]);
        console.log(`${nr} ${navn}: feilet (${e instanceof Error ? e.message.split('\n')[0] : e})`);
        /* en feil kan la siden være i en rar tilstand: neste kommune får en ny side */
        regnet = PER_SIDE;
      }
      regnet++;
    }
    if (p) await p.context().close();
    igjen = feilet;
    if (igjen.length) console.log(`Runde ${runde}: ${igjen.length} feilet, prøver igjen`);
  }
  await nettleser.close();
  console.log(
    igjen.length
      ? `Ferdig, men disse feilet: ${igjen.map(k => k.join(' ')).join(', ')}`
      : 'Ferdig, alle kommunene er med.'
  );
  return igjen.length;
}

const arg = process.argv.slice(2),
  valg = (n: string) => {
    const i = arg.indexOf(n);
    if (i < 0) return null;
    const v = arg[i + 1];
    arg.splice(i, 2);
    return v;
  };
const bare = valg('--bare'),
  kildeValg = valg('--kilde'),
  ut = arg[0];
if (!ut) {
  console.log('Bruk: node verktoy/landstall.ts <ut.jsonl> [--kilde <bygget mappe>] [--bare 5001,5612]');
  process.exit(2);
}
process.exit((await kjor(kildeValg ? path.resolve(kildeValg) : bygg(ROT), ut, bare ? bare.split(',') : null)) ? 1 : 0);
