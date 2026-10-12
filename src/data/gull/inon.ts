/* Gull for inngrepsfri natur: arealet per sone i kommunen, og i villreinområdene. */
import { katalog } from '../katalog.ts';
import { HALV } from '../solv/felles.ts';
import { UTENFOR } from '../solv/inon.ts';
import { flaterPiksler } from '../solv/raster.ts';
import { andel, arealFraRuter, bildetall, landareal, tiDekar, type Bildetall, type Kommunebilde } from './felles.ts';

/* Inngrepsfri natur for kommunen: når den er hentet, areal per sone (villmarkspreget, sone 1, sone 2) i km², og sonen per rute i
   kommunebildet (0 villmarkspreget, 1 sone 1, 2 sone 2, UTENFOR uten sone) */
export type Inon = Kommunebilde<{ soner: number[]; sone: Uint8Array }>;

/* Det temasiden og oversikten viser: tilstanden, og når kommunen har inngrepsfri natur, arealet samlet og per sone og andelen av
   landarealet. D er inngrepsfri natur for kommunen, og land landarealet i km². */
export const byggInon = (D: Inon | null, land: number) =>
  bildetall(D, H => ({ sum: H.sum, soner: H.soner, andelLand: andel(H.sum, land) }));

/* Tabellen gull.inon: det temasiden, oversikten og kartet viser for kommunen nr: ok med tallene, eller ingen når kommunen ikke har
   inngrepsfri natur. Arealet samlet (sum) og per sone (soner) står med uansett. */
export type Inontall = Bildetall<{ sum: number; soner: number[]; andelLand: number | null }> & {
  sum: number;
  soner: number[];
};
export async function inon(nr: string): Promise<Inontall> {
  const [S, land] = await Promise.all([katalog.solv.inon(nr), landareal(nr)]),
    A = arealFraRuter(S.n, S.res, S.skala);
  return { ...byggInon({ ...S, nr, tilstand: 'ok', soner: A.km2, sum: A.sum }, land), sum: A.sum, soner: A.km2 };
}

/* Inngrepsfri natur i villreinområdene: arealet av villreinområdene i kommunen (villrein), inngrepsfri natur i dem samlet (sum) og per
   sone (soner), og andelen av villreinområdene som er inngrepsfri, i prosent */
export interface InonIVillrein {
  villrein: number;
  sum: number;
  soner: number[];
  andel: number | null;
}
/* Tabellen gull.inonIVillrein: villreinområdene (solv.villrein) tegnet i rutenettet for inngrepsfri natur (solv.inon) og klippet
   mot kommunen. En rute hører til villreinområdene når de dekker minst halve ruta, og der områder overlapper, telles ruta én gang.
   Begge arealene telles i det samme rutenettet, så andelen ikke påvirkes av forskjellen mellom flaten og rutene. null når kommunen
   ikke har villreinområder. */
export async function inonIVillrein(nr: string): Promise<InonIVillrein | null> {
  const [S, V, g] = await Promise.all([katalog.solv.inon(nr), katalog.solv.villrein(nr), katalog.solv.grense(nr)]);
  if (!V.omrader.length) return null;
  const M = flaterPiksler(
      V.omrader.map(o => o.koord),
      S,
      g.koord
    ),
    n = [0, 0, 0];
  let alle = 0;
  for (let q = 0; q < S.sone.length; q++) {
    if (M[4 * q + 3] < HALV) continue;
    alle++;
    if (S.sone[q] !== UTENFOR) n[S.sone[q]]++;
  }
  const A = arealFraRuter(n, S.res, S.skala),
    villrein = tiDekar((alle * S.res * S.res) / S.skala);
  return { villrein, sum: A.sum, soner: A.km2, andel: andel(A.sum, villrein) };
}
