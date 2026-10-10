/* Datamotoren, kommunen: listen over kommuner, valg av kommune, og det som hentes og regnes ut med en gang når en kommune velges.
   Alt som hentes, går gjennom katalogen. Visningen spør selv etter det den trenger (les-gjennom), men slik er det meste klart før
   noen spør, og sidene kan byttes uten å vente. */
import { ferdig, hent, se } from './katalog.ts';
import {
  AREALTALL,
  GRAA,
  GRENSE,
  HISTORIE,
  INON,
  KARTLAGT,
  KOMMUNER,
  OVERSIKTSBILDE,
  OVERSIKTSREGISTER,
  PLANINFO,
  TEMAAREAL,
  TEMAINNE,
  TEMAOMRADER
} from './datasett.ts';
import type { Fylke, Kommune } from '../solv/felles.ts';
import { lagret, startSamling, stoppRegning } from './grunnkart.ts';
import { NATURTEMA, type Naturtema } from './naturtema.ts';
import { regnAlt, regnKryss } from './plan.ts';
import { app, endret } from './tilstand.ts';

/* Fylkene med kommunene sine, sortert etter navn. Tom til listen er hentet. */
export const kommuner = (): Fylke[] => ferdig(KOMMUNER, '') || [];
/* Kommunelisten kunne ikke hentes */
export const listeFeil = () => {
  const e = se(KOMMUNER, '');
  return !!e && e.status === 'feil';
};
/* Listen over fylker og kommuner, og registeret over lagrede oversiktsbilder. Kalles én gang når siden åpnes. */
export async function hentKommuner() {
  try {
    await hent(KOMMUNER, '');
  } catch (e) {
    return false;
  }
  await hent(OVERSIKTSREGISTER, '');
  return true;
}

export const finn = (nr: string): [Fylke, Kommune] | null => {
  for (const f of kommuner()) for (const k of f.kommuner) if (k.nr === nr) return [f, k];
  return null;
};

const stille = () => {}; /* en feil står i katalogen, og siden viser den */

/* Det sidene viser for kommunen nr, hentes og regnes ut med en gang. Grensen kommer først, fordi temaene, planen og bildene av hele
   kommunen klippes mot den. */
function hentForSidene(nr: string) {
  regnAlt();
  /* Med lagret oversiktsbilde regnes planlagt utbygging ut for hele kommunen når bildet er hentet. Feiler det, brukes det
     sammensatte kartet i stedet. */
  if (lagret(nr)) hent(OVERSIKTSBILDE, nr).then(regnAlt, () => startSamling(nr).catch(stille));
  hent(AREALTALL, nr).catch(stille);
  hent(HISTORIE, nr).catch(stille);
  hent(GRENSE, nr).then(() => {
    regnAlt();
    hent(PLANINFO, nr).then(regnAlt, regnAlt);
    hent(INON, nr).catch(stille);
    hent(GRAA, nr).then(regnKryss, stille);
    for (const tema of NATURTEMA) hentTema(tema, nr);
    if (!lagret(nr)) startSamling(nr).catch(stille);
  }, stille);
}
/* Et naturtema: områdene, arealet, og for verdsatt natur det kartlagte og arealet innenfor det. Kryssingen følger når områdene
   er hentet. */
function hentTema(tema: Naturtema, nr: string) {
  const x = { tema, nr };
  hent(TEMAOMRADER, x).then(() => {
    hent(TEMAAREAL, x).catch(stille);
    regnKryss();
    if (tema.dekning)
      hent(KARTLAGT, nr).then(() => {
        if (tema.klasser) hent(TEMAINNE, x).catch(stille);
        regnKryss();
      }, stille);
  }, stille);
}

/* Velger kommunen nr. Det som gjelder kommunen, leses fra katalogen med kommunenummeret, så ingenting fra forrige kommune kan vises
   for denne. */
export function velgKommune(nr: string) {
  const t = finn(nr);
  if (!t) return;
  app.valgt = t[1];
  stoppRegning();
  endret();
  hentForSidene(t[1].nr);
}
/* Første kommune i et fylke, når fylket byttes */
export const velgFylke = (nr: string) => {
  const f = kommuner().find(x => x.nr === nr);
  if (f) velgKommune(f.kommuner[0].nr);
};
