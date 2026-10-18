/* Gull for inngrepsfri natur: arealet per sone i kommunen, og i villreinområdene. */
import { katalog } from '../katalog.ts';
import { UTENFOR } from '../solv/inon.ts';
import { BITRES, tellIBitene } from '../solv/kommune.ts';
import { andel, arealFraRuter, bildetall, landareal, tiDekar, type Bildetall, type Kommunebilde } from './felles.ts';

/* Inngrepsfri natur for kommunen: når den er hentet, areal per sone (villmarkspreget, sone 1, sone 2) i km² */
export type Inon = Kommunebilde<{ soner: number[] }>;

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
  return { ...byggInon({ nr, tilstand: 'ok', soner: A.km2, sum: A.sum }, land), sum: A.sum, soner: A.km2 };
}

/* Inngrepsfri natur i villreinområdene: arealet av villreinområdene i kommunen (villrein), inngrepsfri natur i dem samlet (sum) og per
   sone (soner), og andelen av villreinområdene som er inngrepsfri, i prosent */
export interface InonIVillrein {
  villrein: number;
  sum: number;
  soner: number[];
  andel: number | null;
}
/* Tabellen gull.inonIVillrein: inngrepsfri natur (solv.inonbit) i villreinområdene i kommunen, talt med andelen av hver rute som
   ligger i villreinområdene og i kommunen (solv.villreinAndel). Der områder overlapper, telles ruta én gang. Arealet av villreinområdene
   er det samme som i gull.villrein. null når kommunen ikke har villreinområder. */
export async function inonIVillrein(nr: string): Promise<InonIVillrein | null> {
  const V = await katalog.solv.villreinAndel(nr);
  if (!(V.sum > 0)) return null;
  const n = await tellIBitene(
      V.biter[0],
      3,
      tc => katalog.solv.inonbit(tc).then(D => D.sone),
      v => (v !== UTENFOR ? v : null),
      UTENFOR
    ),
    A = arealFraRuter(n, BITRES, 1e6),
    villrein = tiDekar(V.sum);
  return { villrein, sum: A.sum, soner: A.km2, andel: andel(A.sum, villrein) };
}
