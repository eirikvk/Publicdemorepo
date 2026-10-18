/* Datamotoren, dagens klasser: hvilken arealklasse hver piksel har i dag, fra grunnkartet til NIBIO. Kartlagene for planlagt
   utbygging, inngrepsfri natur og grått areal tegnes oppå det.
   Dagens klasser for kommunen står i gull.dagensKlasser: blokkene for hele kommunen (solv.klassekart), lagret sammen med siden eller
   hentet fra NIBIO når kommunen velges, eller det sammensatte kartet av flisene som er hentet (solv.sammensatt) når blokkene ikke kan
   lages. Mens blokkene hentes, viser kartet det sammensatte kartet, som fylles flis for flis. Kartlagene leser dagens klasser per flis
   fra sølv på nivået kartet viser, gjennom kartverdier.ts.
   Det sammensatte kartet er en kilde fra brukeren: det er kartet brukeren har sett på. Datamotoren bestemmer bare når: hver ny flis
   legges inn med en gang, og når kartet har stått stille med nye fliser, sier datamotoren fra (brukerEndret), så gull regnes ut på
   nytt. Selve tegningen står i sølv (solv/grunnkart.ts).
   Bildene har klassene i rene farger (DATAFARGE i solv/klasser.ts). Klassen leses av fargen med klasseAv. Kartet får egne kopier i
   visningsfargene, se ui/kart/grunnkart.ts. */
import { opptatt } from '../bronse/henting.ts';
import { alle, brukerEndret, se, vedGlemt, vedNy } from '../cache.ts';
import { overlapper } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { FLISNIVA, flisAvNavn, flisUtsnitt, flisnavn, type Flis } from '../solv/felles.ts';
import { tegnISamling, type Oversikt, type Samling } from '../solv/grunnkart.ts';
import { lesBilde } from '../solv/raster.ts';
import { valgtNr, verdi } from './valgt.ts';
import { app, endret, tidSlutt, varsle } from './tilstand.ts';

/* Om kommunen nr står i registeret over lagrede klasser */
const iRegisteret = (nr: string) => {
  const reg = katalog.bronse.klasseregister.naa();
  return !!(reg && reg.kommuner && reg.kommuner[nr]);
};
/* Om kommunen nr har lagrede klasser: den står i registeret, og blokkene har ikke feilet */
export function lagret(nr: string) {
  if (!iRegisteret(nr)) return false;
  const r = se(katalog.solv.klassekart, nr);
  return !(r && r.status === 'feil');
}

/* Hvor langt hentingen av blokkene fra NIBIO er kommet for valgt kommune, når den ikke har lagrede klasser og blokkene hentes nå:
   kartbildene som er hentet (ferdig), og hvor mange det er i alt, ett per blokk (av, 0 før blokkene er funnet). null ellers. */
export function hentingAvKlasser(): { ferdig: number; av: number } | null {
  const nr = valgtNr();
  if (!nr || iRegisteret(nr)) return null;
  const k = se(katalog.solv.klassekart, nr);
  if (!k || k.status !== 'henter') return null;
  const b = se(katalog.solv.blokker, [nr, FLISNIVA]);
  if (!b || b.status !== 'ok') return { ferdig: 0, av: 0 };
  const hentet = (tc: Flis) => {
    const r = se(katalog.bronse.grunnkartflis, tc);
    return !!r && r.status === 'ok';
  };
  let ferdig = 0;
  for (const tc of b.verdi!) if (hentet(tc)) ferdig++;
  return { ferdig, av: b.verdi!.length };
}

/* Dagens klasser for valgt kommune, fra gull. oversikt er bildet zoomet ut: blokkene satt sammen, eller det sammensatte kartet. Mens
   blokkene hentes fra NIBIO, er det det sammensatte kartet, som fylles etter hvert. bareHentetKart sier at tallene bare gjelder den
   delen av kommunen nettleseren har hentet kart for. */
const dagensKlasserNaa = () => verdi(katalog.gull.dagensKlasser);
export function oversikt(): Oversikt | null {
  const D = dagensKlasserNaa();
  if (D) return D.ov;
  const s = hentingAvKlasser() ? verdi(katalog.solv.sammensatt) : null;
  return s ? s.ov : null;
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
/* Et sammensatt kart eller et kart satt sammen av blokkene som går ut av cachen, frigjøres, og kartet får beskjed så det kan kaste
   sin kopi */
vedGlemt(katalog.solv.sammensatt, s => {
  s.c.width = 0;
  varsle('samlingFjernet', s.c);
});
vedGlemt(katalog.solv.klassekart, ov => {
  ov.lerret.width = 0;
  varsle('samlingFjernet', ov.lerret);
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
      const D = dagensKlasserNaa();
      if (D && D.delvis) planleggRegning(); /* tallene bygger på det sammensatte kartet */
      else if (hentingAvKlasser()) endret(); /* hvor langt hentingen av blokkene er kommet */
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
