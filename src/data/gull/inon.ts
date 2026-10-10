/* Gull for inngrepsfri natur: arealet per sone i kommunen. */
import { andel, bildetall, type Kommunebilde } from './felles.ts';

/* Inngrepsfri natur for kommunen: når den er hentet, areal per sone (villmarkspreget, sone 1, sone 2) i km², og sonen per rute i
   kommunebildet (0 villmarkspreget, 1 sone 1, 2 sone 2, UTENFOR uten sone) */
export type Inon = Kommunebilde<{ soner: number[]; sone: Uint8Array }>;

/* Det temasiden og oversikten viser: tilstanden, og når kommunen har inngrepsfri natur, arealet samlet og per sone og andelen av
   landarealet. D er inngrepsfri natur for kommunen, og land landarealet i km². */
export const byggInon = (D: Inon | null, land: number) =>
  bildetall(D, H => ({ sum: H.sum, soner: H.soner, andelLand: andel(H.sum, land) }));
