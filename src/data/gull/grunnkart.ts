/* Gull for grunnkartet: dagens klasser for kommunen, på tvers av de to kildene i sølv. Det lagrede oversiktsbildet brukes der det
   finnes (solv.oversikt). Ellers brukes det sammensatte kartet av flisene som er hentet (solv.sammensatt), og da gjelder alt som
   bygger på det, bare den delen av kommunen som er hentet. Utbyggingen (gull/utbygging.ts), kartet og sidene leser dagens klasser
   herfra. Dagens klasser i én flis lages av svaret med dagensKlasserIFlis i solv/grunnkart.ts. */
import type { Flerflate } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { flisAvNavn, type Flis } from '../solv/felles.ts';
import type { Oversikt } from '../solv/grunnkart.ts';

/* Dagens klasser for kommunen: bildet (ov), og for det sammensatte kartet kommunens flate det klippes mot (koord). delvis sier at
   bare det som er hentet, er med, og fliser er da flisene som er hentet. Det lagrede bildet lest inn står ikke her, men i
   solv.oversiktLest, som bare husker ett bilde: det tar mye minne. */
export interface DagensKlasser {
  ov: Oversikt;
  koord: Flerflate | null;
  delvis: boolean;
  fliser: Flis[] | null;
}

/* Tabellen gull.dagensKlasser: dagens klasser for kommunen nr. Det lagrede oversiktsbildet når kommunen har et og det kan hentes,
   ellers det sammensatte kartet. null før det er hentet noe kart i en kommune uten lagret oversiktsbilde. */
export async function dagensKlasser(nr: string): Promise<DagensKlasser | null> {
  const reg = await katalog.bronse.oversiktsregister().catch(() => null),
    ov = reg && reg.kommuner && reg.kommuner[nr] ? await katalog.solv.oversikt(nr).catch(() => null) : null;
  if (ov) return { ov, koord: null, delvis: false, fliser: null };
  const [g, s] = await Promise.all([katalog.solv.grense(nr), katalog.solv.sammensatt(nr)]);
  if (!s.har.size) return null;
  return { ov: s.ov, koord: g.koord, delvis: true, fliser: [...s.har].map(flisAvNavn) };
}
