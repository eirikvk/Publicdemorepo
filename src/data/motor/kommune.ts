/* Datamotoren, kommunen: listen over kommuner, valg av kommune, og det sidene viser, som bes om med en gang. Alt hentes gjennom
   katalogen. Sidene spør selv etter det de trenger, men slik er det meste klart før noen spør, og sidene kan byttes uten å vente. */
import { nårGullUtdatert, se } from '../cache.ts';
import { katalog } from '../katalog.ts';
import type { Fylke, Kommune } from '../solv/felles.ts';
import { lagret, startSamling, stoppRegning } from './grunnkart.ts';
import { regnAlt } from './plan.ts';
import { valgtNr } from './valgt.ts';
import { app, endret } from './tilstand.ts';

/* Fylkene med kommunene sine, sortert etter navn. Tom til listen er hentet. */
export const kommuner = (): Fylke[] => katalog.bronse.kommuner.naa() || [];
/* Kommunelisten kunne ikke hentes */
export const listeFeil = () => {
  const r = se(katalog.bronse.kommuner, undefined);
  return !!r && r.status === 'feil';
};
/* Listen over fylker og kommuner, og registeret over lagrede oversiktsbilder. Kalles én gang når siden åpnes. */
export async function hentKommuner() {
  try {
    await katalog.bronse.kommuner();
  } catch (e) {
    return false;
  }
  await katalog.bronse.oversiktsregister();
  return true;
}

export const finn = (nr: string): [Fylke, Kommune] | null => {
  for (const f of kommuner()) for (const k of f.kommuner) if (k.nr === nr) return [f, k];
  return null;
};

const stille = () => {}; /* en feil står i cachen, og siden viser den */
/* Alt sidene viser for kommunen nr: alle tabellene i gull. De henter selv det de bygger på. */
function regnGull(nr: string) {
  if (nr === valgtNr()) for (const t of Object.values(katalog.gull)) t(nr).catch(stille);
}
/* Når planrutenettet eller det kartlagte er nytt, regnes det sidene viser ut på nytt med en gang */
nårGullUtdatert(regnGull);

/* Det sidene viser for kommunen nr, og planrutenettet. Planrutenettet regnes ut når grensen, opplysningen om kommuneplanen og dagens
   klasser zoomet ut finnes: det lagrede oversiktsbildet, eller det sammensatte kartet for kommuner uten. */
function hentForSidene(nr: string) {
  regnAlt();
  if (lagret(nr)) katalog.solv.oversikt(nr).then(regnAlt, () => startSamling(nr).catch(stille));
  katalog.solv.grense(nr).then(() => {
    regnAlt();
    katalog.solv.planinfo(nr).then(regnAlt, regnAlt);
    if (!lagret(nr)) startSamling(nr).catch(stille);
  }, stille);
  regnGull(nr);
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
