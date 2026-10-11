/* Datamotoren, dagens klasser: hvilken arealklasse hver piksel har i dag, fra grunnkartet til NIBIO. Kartlagene for planlagt
   utbygging, inngrepsfri natur og grått areal tegnes oppå det.
   Dagens klasser for kommunen står i gull.dagensKlasser: det lagrede oversiktsbildet (solv.oversikt), eller det sammensatte kartet av
   flisene som er hentet (solv.sammensatt). Zoomet inn brukes kartbildene fra NIBIO, én flis om gangen (bronse.grunnkartflis).
   Det sammensatte kartet er en kilde fra brukeren: det er kartet brukeren har sett på. Datamotoren bestemmer bare når: hver ny flis
   legges inn med en gang, og når kartet har stått stille med nye fliser, sier datamotoren fra (brukerEndret), så gull regnes ut på
   nytt. Selve tegningen står i sølv (solv/grunnkart.ts).
   Bildene har klassene i rene farger (DATAFARGE i solv/klasser.ts). Klassen leses av fargen med klasseAv. Kartet får egne kopier i
   visningsfargene, se ui/kart/grunnkart.ts. */
import { opptatt } from '../bronse/henting.ts';
import { alle, brukerEndret, se, vedGlemt, vedNy } from '../cache.ts';
import { overlapper, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { FLISNIVA, flisAvNavn, flisUtsnitt, flisnavn, type Flis } from '../solv/felles.ts';
import { dagensKlasserIFlis, tegnISamling, type Oversikt, type Samling } from '../solv/grunnkart.ts';
import { lesBilde } from '../solv/raster.ts';
import { valgtNr, verdi } from './valgt.ts';
import { app, tidSlutt, varsle } from './tilstand.ts';

/* Utsnittet det lagrede oversiktsbildet for kommunen nr dekker, når kommunen står i registeret og bildet ikke har feilet */
export function lagretUtsnitt(nr: string): Utsnitt | null {
  const reg = katalog.bronse.oversiktsregister.naa(),
    ext = reg && reg.kommuner && reg.kommuner[nr];
  if (!ext) return null;
  const r = se(katalog.solv.oversikt, nr);
  return r && r.status === 'feil' ? null : ext;
}
export const lagret = (nr: string) => !!lagretUtsnitt(nr);

/* Dagens klasser for valgt kommune, fra gull. oversikt er bildet zoomet ut: det lagrede oversiktsbildet, eller det sammensatte
   kartet. bareHentetKart sier at tallene bare gjelder den delen av kommunen nettleseren har hentet kart for. */
const dagensKlasserNaa = () => verdi(katalog.gull.dagensKlasser);
export function oversikt(): Oversikt | null {
  const D = dagensKlasserNaa();
  return D ? D.ov : null;
}
export const bareHentetKart = () => {
  const D = dagensKlasserNaa();
  return !!D && D.delvis;
};

/* Det sammensatte kartet for valgt kommune, når det finnes */
export function samlingen(): Samling | null {
  const nr = valgtNr(),
    r = nr ? se(katalog.solv.sammensatt, nr) : null;
  return r && r.status === 'ok' ? r.verdi! : null;
}
/* Et sammensatt kart som går ut av cachen, frigjøres, og kartet får beskjed så det kan kaste sin kopi */
vedGlemt(katalog.solv.sammensatt, s => {
  s.c.width = 0;
  varsle('samlingFjernet', s.c);
});
/* Hver ny flis fra NIBIO legges inn med en gang i de sammensatte kartene den berører. Det hentes ingenting nytt for dette. */
vedNy(katalog.bronse.grunnkartflis, (buf, n) => {
  const tc = flisAvNavn(n),
    u = flisUtsnitt(tc);
  for (const [, s] of alle(katalog.solv.sammensatt)) if (overlapper(u, s.ext)) leggISamling(s, tc, buf);
});
/* En flis inn i det sammensatte kartet s, hvis den ikke er der fra før. Selve tegningen står i sølv (tegnISamling). Er det kartet for
   valgt kommune, får kartet beskjed (hendelsen nyFlis) om hvor flisen ble lagt, så det kan fargelegge sin kopi, og gull regnes ut på
   nytt når kartet står stille. */
function leggISamling(s: Samling, tc: Flis, buf: ArrayBuffer): Promise<void> {
  const n = flisnavn(tc);
  if (s.har.has(n)) return Promise.resolve();
  return lesBilde(buf)
    .then(bm => {
      if (s.har.has(n) || !s.c.width) {
        if (bm.close) bm.close();
        return;
      }
      const t0 = performance.now(),
        sted = tegnISamling(s, tc, bm);
      if (bm.close) bm.close();
      if (s !== samlingen()) return;
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
   kartbildet fra NIBIO, ellers fra gull.dagensKlasser: det lagrede oversiktsbildet, eller det sammensatte kartet. null hvis de ikke
   finnes ennå. Selve tegningen står i sølv (dagensKlasserIFlis). */
export async function dagensKlasser(tc: Flis): Promise<Uint8ClampedArray | null> {
  const nr = valgtNr(),
    D = dagensKlasserNaa(),
    t0 = performance.now();
  const K = await dagensKlasserIFlis(tc, {
    flis: tc[0] >= FLISNIVA ? await katalog.bronse.grunnkartflis(tc) : undefined,
    ov: D && D.ov,
    lest: D && D.ov.buf && nr ? await katalog.solv.oversiktLest(nr) : null,
    koord: D && D.koord
  });
  tidSlutt('dagens klasser', t0);
  return K;
}
