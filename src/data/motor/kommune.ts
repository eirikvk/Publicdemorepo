/* Datamotoren, kommunen: listen over kommuner, valg av kommune, og det sidene viser, som bes om med en gang. Alt hentes gjennom
   katalogen. Sidene spør selv etter det de trenger, men slik er det meste klart før noen spør, og sidene kan byttes uten å vente. */
import { nårBrukerEndret, se } from '../cache.ts';
import { katalog } from '../katalog.ts';
import type { Fylke, Kommune } from '../solv/felles.ts';
import { oppdaterEgne } from './egne.ts';
import { stoppRegning } from './grunnkart.ts';
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
/* Når brukeren har endret noe (egne områder, eller kartet som er hentet), regnes det sidene viser ut på nytt med en gang */
nårBrukerEndret(regnGull);

/* Velger kommunen nr. Det som gjelder kommunen, leses fra katalogen med kommunenummeret, så ingenting fra forrige kommune kan vises
   for denne. */
export function velgKommune(nr: string) {
  const t = finn(nr);
  if (!t) return;
  app.valgt = t[1];
  stoppRegning();
  oppdaterEgne(t[1].nr);
  endret();
  regnGull(t[1].nr);
}
/* Første kommune i et fylke, når fylket byttes */
export const velgFylke = (nr: string) => {
  const f = kommuner().find(x => x.nr === nr);
  if (f) velgKommune(f.kommuner[0].nr);
};
