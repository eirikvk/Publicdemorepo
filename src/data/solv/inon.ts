/* Sølv for inngrepsfri natur: bildet av hver bit fra Miljødirektoratets kartlag (status) gjort om til sone per rute, etter avstand
   til tyngre tekniske inngrep, og sonene talt i kommunen. */
import { naermesteFarge } from '../generelt/farge.ts';
import { katalog } from '../katalog.ts';
import { BIT, HALV, bitRuter, type Flis, type Piksler, type Rutebilde } from './felles.ts';
import { tellIKommune, type Bitruter } from './kommune.ts';
import { bildePiksler } from './raster.ts';

/* Sonene: [kode i tjenesten, farge i kartet her, farge i tjenestens bilder, avstand, navn] */
export const INONSONER: [kode: string, farge: string, rgb: number[], avstand: string, navn: string][] = [
  ['v', 'inonv', [76, 171, 38], '5 km eller mer fra inngrep', 'Villmarkspreget natur'],
  ['1', 'inon1', [153, 207, 22], '3–5 km fra inngrep', 'Sone 1'],
  ['2', 'inon2', [204, 234, 127], '1–3 km fra inngrep', 'Sone 2']
];
export const UTENFOR = 255; /* rute uten sone */

/* Sonen en farge ligger nærmest: 0 villmarkspreget, 1 sone 1, 2 sone 2 */
const SONEFARGER = INONSONER.map(s => s[2]);
export const inonSone = (r: number, g: number, b: number) => naermesteFarge(r, g, b, SONEFARGER);

/* Tolker bildet av sonene i en bit, som piksler (RGBA). En rute hører til en sone når den er minst halvt dekket. Gir sonen per rute,
   UTENFOR uten sone. */
export function tolkInon(P: Piksler) {
  const sone = new Uint8Array(P.length / 4).fill(UTENFOR);
  let forrige = -1,
    s = 0;
  for (let i = 0, q = 0; i < P.length; i += 4, q++) {
    if (P[i + 3] < HALV) continue;
    const kode = (P[i] << 16) | (P[i + 1] << 8) | P[i + 2];
    if (kode !== forrige) {
      forrige = kode;
      s = inonSone(P[i], P[i + 1], P[i + 2]);
    } /* like nabofarger tolkes én gang */
    sone[q] = s;
  }
  return sone;
}

/* Sonen per rute i en bit (0 villmarkspreget, 1 sone 1, 2 sone 2, UTENFOR uten sone), med bitens rutenett */
export interface Inonsoner extends Rutebilde {
  sone: Uint8Array;
}
/* Sonen i et punkt (x, y) i meter, fra biten D. UTENFOR utenfor biten. */
export const soneVed = (D: Inonsoner, x: number, y: number) => {
  const px = Math.floor((x - D.u[0]) / D.res),
    py = Math.floor((D.u[3] - y) / D.res);
  return px < 0 || py < 0 || px >= D.w || py >= D.h ? UTENFOR : D.sone[py * D.w + px];
};
/* Tabellen solv.inonbit: sonen per rute i biten tc */
export async function inonbit(tc: Flis): Promise<Inonsoner> {
  return { ...bitRuter(tc), sone: tolkInon(await bildePiksler(await katalog.bronse.inonbit(tc), BIT, BIT)) };
}
/* Tabellen solv.inon: antall ruter per sone innenfor kommunen nr, og bitene kommunen har ruter i */
export async function inon(nr: string): Promise<Bitruter> {
  return tellIKommune(
    nr,
    3,
    tc => katalog.solv.inonbit(tc).then(D => D.sone),
    s => (s === UTENFOR ? null : s)
  );
}
