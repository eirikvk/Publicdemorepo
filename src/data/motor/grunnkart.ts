/* Datamotoren, dagens klasser: hvilken arealklasse hver piksel har i dag, fra grunnkartet til NIBIO. Kartlagene for planlagt
   utbygging, inngrepsfri natur og grått areal tegnes oppå det.
   Dagens klasser kommer fra tre steder i katalogen:
   - Zoomet inn: kartbildene fra NIBIO, én flis om gangen (bronse.grunnkartflis).
   - Zoomet ut, i kommuner med lagret oversiktsbilde: bildet av hele kommunen (solv.oversikt).
   - Zoomet ut ellers: det sammensatte kartet, som datamotoren fyller med flisene som er hentet (solv.sammensatt). Det er en
     kilde fra brukeren: det er kartet brukeren har sett på. Tegningen står i sølv (solv/grunnkart.ts); her bestemmes bare når. Når kartet har stått stille med nye fliser, sier datamotoren fra
     (brukerEndret), og utbyggingen regnes ut på nytt (gull/utbygging.ts).
   Bildene har klassene i rene farger (DATAFARGE i solv/klasser.ts). Klassen leses av fargen med klasseAv. Kartet får egne kopier i
   visningsfargene, se ui/kart/grunnkart.ts. */
import { FLISNIVA, flisIAdresse, grunnkartUrl } from '../bronse/nibio-grunnkart.ts';
import { opptatt } from '../bronse/henting.ts';
import { alle, brukerEndret, se, vedGlemt, vedNy } from '../cache.ts';
import { overlapper, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { OPPLOSNINGER, flisUtsnitt, type Flis } from '../solv/felles.ts';
import {
  dagensKlasserIFlis,
  flisnavn,
  nySamling,
  tegnISamling,
  type Oversikt,
  type Samling
} from '../solv/grunnkart.ts';
import { lesBilde } from '../solv/raster.ts';
import { valgtNr } from './valgt.ts';
import { app, endret, tidSlutt, varsle } from './tilstand.ts';

/* Utsnittet det lagrede oversiktsbildet for kommunen nr dekker, når kommunen står i registeret og bildet ikke har feilet */
export function lagretUtsnitt(nr: string): Utsnitt | null {
  const reg = katalog.bronse.oversiktsregister.naa(),
    ext = reg && reg.kommuner && reg.kommuner[nr];
  if (!ext) return null;
  const r = se(katalog.solv.oversikt, nr);
  return r && r.status === 'feil' ? null : ext;
}
export const lagret = (nr: string) => !!lagretUtsnitt(nr);
/* Tallene gjelder bare den delen av kommunen nettleseren har hentet kart for (kommuner uten lagret oversiktsbilde) */
export const bareHentetKart = () => {
  const o = oversikt();
  return !!o && !!o.dynamisk;
};

/* Det sammensatte kartet for valgt kommune, når det finnes */
export function samlingen(): Samling | null {
  const nr = valgtNr(),
    r = nr ? se(katalog.solv.sammensatt, nr) : null;
  return r && r.status === 'ok' ? r.verdi! : null;
}
/* Dagens klasser zoomet ut for valgt kommune: det lagrede oversiktsbildet, eller det sammensatte kartet når det har fått fliser */
export function oversikt(): Oversikt | null {
  const nr = valgtNr();
  if (!nr) return null;
  if (lagret(nr)) return katalog.solv.oversikt.naa(nr);
  const s = samlingen();
  return s && s.har.size ? s.ov : null;
}

/* Kommuner uten lagret oversiktsbilde: datamotoren setter sammen sitt eget kart av flisene som er hentet. Zoomer man ut igjen,
   finnes dermed dagens klasser for det man alt har sett, og planlagt utbygging kan regnes ut for den delen. Det hentes ingenting
   nytt for dette. Velges kommunen igjen, brukes samlingen fra sist, og alle fliser cachen har som berører kommunen, legges inn. */
export async function startSamling(nr: string) {
  const e = (await katalog.solv.grense(nr)).ext,
    s = katalog.solv.sammensatt.straks(nr, () =>
      nySamling(e, OPPLOSNINGER[FLISNIVA] / 2)
    ); /* ikke finere enn flisene */
  if (s !== samlingen()) return;
  if (s.har.size) endret();
  fyllSamling(s);
}
/* Et sammensatt kart som går ut av cachen, frigjøres, og kartet får beskjed så det kan kaste sin kopi */
vedGlemt(katalog.solv.sammensatt, s => {
  s.c.width = 0;
  varsle('samlingFjernet', s.c);
});
/* Alle fliser cachen har som berører samlingen, legges inn, én om gangen og uten nye kall */
async function fyllSamling(s: Samling) {
  for (const [url, buf] of alle(katalog.bronse.grunnkartflis)) {
    if (s !== samlingen()) return;
    const f = flisIAdresse(url);
    if (f && overlapper(f.b, s.ext)) await leggISamling(f.tc, buf);
  }
}
/* Hver ny flis fra NIBIO legges inn i det sammensatte kartet for valgt kommune */
vedNy(katalog.bronse.grunnkartflis, (buf, url) => {
  const f = flisIAdresse(url);
  if (f) leggISamling(f.tc, buf);
});
/* En flis inn i det sammensatte kartet for valgt kommune, hvis den ikke er der fra før og kommunen fortsatt er valgt når bildet er lest
   inn. Selve tegningen står i sølv (tegnISamling). Kartet får beskjed (hendelsen nyFlis) om hvor flisen ble lagt, så det kan
   fargelegge sin kopi. */
function leggISamling(tc: Flis, buf: ArrayBuffer): Promise<void> {
  const s = samlingen(),
    n = flisnavn(tc);
  if (!s || s.har.has(n)) return Promise.resolve();
  return lesBilde(buf)
    .then(bm => {
      if (s !== samlingen() || s.har.has(n)) {
        if (bm.close) bm.close();
        return;
      }
      const t0 = performance.now(),
        sted = tegnISamling(s, tc, bm);
      if (bm.close) bm.close();
      if (s.har.size === 1) endret(); /* det sammensatte kartet finnes nå */
      varsle('nyFlis', s.c, sted);
      planleggRegning();
      tidSlutt('sammensatt kart', t0);
    })
    .catch(() => {});
}

/* Nye fliser i det sammensatte kartet: når kartet har stått stille litt og ingenting lastes lenger, sier datamotoren fra om at
   kartet brukeren har sett på, er endret (brukerEndret). Da regnes utbyggingen ut på nytt, uten at kartet hakker mens man flytter
   det. Starter man å flytte igjen, venter den til neste stopp. */
let regnTimer: ReturnType<typeof setTimeout> | undefined;
export let regningVenter = false;
export function planleggRegning() {
  regningVenter = true;
  clearTimeout(regnTimer);
  regnTimer = setTimeout(() => {
    if (app.kartFlyttes) return; /* kartetFlyttes(false) tar opp tråden igjen */
    if (opptatt()) return planleggRegning(); /* tallene venter til alt er hentet */
    regningVenter = false;
    const nr = valgtNr();
    if (nr) brukerEndret(nr);
  }, 400);
}
/* Kartet sier fra når det begynner og slutter å flytte seg */
export function kartetFlyttes(paa: boolean) {
  app.kartFlyttes = paa;
  if (paa) clearTimeout(regnTimer);
  else if (regningVenter) planleggRegning();
}
/* Ny kommune: utregningen for den forrige gjelder ikke lenger */
export const stoppRegning = () => {
  clearTimeout(regnTimer);
  regningVenter = false;
};

/* Dagens klasser i flisen tc på 512 x 512 piksler for valgt kommune, i de rene fargene fra NIBIO, til kartlagene. Zoomet inn fra
   kartbildet fra NIBIO, ellers fra det som er zoomet ut: det lagrede oversiktsbildet, eller det sammensatte kartet. null hvis de ikke
   finnes ennå. Selve tegningen står i sølv (dagensKlasserIFlis). */
export async function dagensKlasser(tc: Flis): Promise<Uint8ClampedArray | null> {
  const nr = valgtNr(),
    ov = oversikt(),
    grense = nr ? se(katalog.solv.grense, nr) : null,
    t0 = performance.now();
  const K = await dagensKlasserIFlis(tc, {
    flis: tc[0] >= FLISNIVA ? await katalog.bronse.grunnkartflis(grunnkartUrl(flisUtsnitt(tc))) : undefined,
    ov,
    lest: ov && ov.buf && nr ? await katalog.solv.oversiktLest(nr) : null,
    koord: grense && grense.status === 'ok' ? grense.verdi!.koord : null
  });
  tidSlutt('dagens klasser', t0);
  return K;
}
