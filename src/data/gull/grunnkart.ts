/* Gull for grunnkartet: dagens klasser for kommunen, på tvers av de to kildene i sølv. For kommunene med lagrede klasser brukes
   blokkene (solv.blokker, solv.klasser og solv.klassekart), og da er hele kommunen med. Ellers brukes det sammensatte kartet av
   flisene som er hentet (solv.sammensatt), og da gjelder alt som bygger på det, bare den delen av kommunen som er hentet.
   Utbyggingen (gull/utbygging.ts), kartet og sidene leser dagens klasser herfra. */
import type { Flerflate } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { flisAvNavn, type Flis } from '../solv/felles.ts';
import type { Oversikt } from '../solv/grunnkart.ts';

/* Dagens klasser for kommunen: bildet zoomet ut (ov), og kommunens flate det klippes mot (koord). blokker er blokkene på nivå 9
   når kommunen har lagrede klasser, og da er hele kommunen med. Ellers sier delvis at bare det som er hentet, er med, og fliser er
   flisene som er hentet. */
export interface DagensKlasser {
  ov: Oversikt;
  koord: Flerflate;
  blokker: Flis[] | null;
  fliser: Flis[] | null;
  delvis: boolean;
}

/* Tabellen gull.dagensKlasser: dagens klasser for kommunen nr. Blokkene når kommunen står i registeret over lagrede klasser og
   de kan hentes, ellers det sammensatte kartet. null før det er hentet noe kart i en kommune uten lagrede klasser. */
export async function dagensKlasser(nr: string): Promise<DagensKlasser | null> {
  const [reg, g] = await Promise.all([katalog.bronse.klasseregister(), katalog.solv.grense(nr)]);
  if (reg && reg.kommuner && reg.kommuner[nr]) {
    const L = await Promise.all([katalog.solv.blokker(nr), katalog.solv.klassekart(nr)]).catch(() => null);
    if (L) return { ov: L[1], koord: g.koord, blokker: L[0], fliser: null, delvis: false };
  }
  const s = await katalog.solv.sammensatt(nr);
  if (!s.har.size) return null;
  return { ov: s.ov, koord: g.koord, blokker: null, fliser: [...s.har].map(flisAvNavn), delvis: true };
}
