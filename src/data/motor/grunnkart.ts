/* Datamotoren, dagens klasser: hvor langt hentingen er kommet for en kommune uten lagrede klasser. Dagens
   klasser for hele kommunen står i gull.dagensKlasser: blokkene på nivå 10, lagret sammen med siden eller hentet fra NIBIO når
   kommunen velges. Kartlagene leser dagens klasser per flis fra sølv på nivået kartet viser, gjennom kartverdier.ts. */
import { se } from '../cache.ts';
import { katalog } from '../katalog.ts';
import { FLISNIVA, type Flis } from '../solv/felles.ts';
import { valgtNr } from './valgt.ts';

/* Om kommunen nr står i registeret over lagrede klasser */
const iRegisteret = (nr: string) => {
  const reg = katalog.bronse.klasseregister.naa();
  return !!(reg && reg.kommuner && reg.kommuner[nr]);
};

/* Hvor langt hentingen av blokkene fra NIBIO er kommet for valgt kommune, når den ikke har lagrede klasser og blokkene hentes nå:
   kartbildene som er hentet (ferdig), og hvor mange det er i alt, ett per blokk (av, 0 før blokkene er funnet). null ellers. */
export function hentingAvKlasser(): { ferdig: number; av: number } | null {
  const nr = valgtNr();
  if (!nr || iRegisteret(nr)) return null;
  const k = se(katalog.gull.dagensKlasser, nr);
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
