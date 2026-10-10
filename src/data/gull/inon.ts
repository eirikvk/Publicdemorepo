/* Gull for inngrepsfri natur: arealet per sone i kommunen. */
import { katalog } from '../katalog.ts';
import { andel, arealFraRuter, bildetall, landareal, type Bildetall, type Kommunebilde } from './felles.ts';

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
