/* Gull for grunnkartet: dagens klasser for kommunen, på tvers av de to kildene i sølv. Først blokkene (solv.blokker, solv.klasser og
   solv.klassekart), og da er hele kommunen med. For kommunene med lagrede klasser ligger blokkene ferdig sammen med siden. For de
   andre, og for blokker som ikke kan leses, lager sølv dem av kartbildene fra NIBIO når kommunen velges, med den samme funksjonen
   som laget de lagrede. Kan ikke blokkene lages, brukes det sammensatte kartet av flisene som er hentet (solv.sammensatt), og da
   gjelder alt som bygger på det, bare den delen av kommunen som er hentet.
   Utbyggingen (gull/utbygging.ts), kartet og sidene leser dagens klasser herfra. */
import type { Flerflate } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { flisAvNavn, type Flis } from '../solv/felles.ts';
import type { Oversikt } from '../solv/grunnkart.ts';

/* Dagens klasser for kommunen: bildet zoomet ut (ov), og kommunens flate det klippes mot (koord). lagret sier at kommunen har
   lagrede klasser. Er delvis usann, er hele kommunen med, i blokkene fra solv.blokker og solv.klasser. Er den sann, er bare det som er
   hentet, med, og fliser er flisene som er hentet. */
export interface DagensKlasser {
  ov: Oversikt;
  koord: Flerflate;
  lagret: boolean;
  fliser: Flis[] | null;
  delvis: boolean;
}

/* Tabellen gull.dagensKlasser: dagens klasser for kommunen nr. Blokkene når de kan lages, ellers det sammensatte kartet. null når
   ingen av delene finnes: blokkene feilet, og det er ikke hentet noe kart. */
export async function dagensKlasser(nr: string): Promise<DagensKlasser | null> {
  const [reg, g, ov] = await Promise.all([
      katalog.bronse.klasseregister(),
      katalog.solv.grense(nr),
      katalog.solv.klassekart(nr).catch(() => null) /* startes med en gang, så framdriften vises fra starten */
    ]),
    lagret = !!(reg && reg.kommuner && reg.kommuner[nr]);
  if (ov) return { ov, koord: g.koord, lagret, fliser: null, delvis: false };
  const s = await katalog.solv.sammensatt(nr);
  if (!s.har.size) return null;
  return { ov: s.ov, koord: g.koord, lagret, fliser: [...s.har].map(flisAvNavn), delvis: true };
}
