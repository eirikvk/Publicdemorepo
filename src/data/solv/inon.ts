/* Sølv for inngrepsfri natur: bildet av hele kommunen fra Miljødirektoratets kartlag (status) gjort om til sone per rute, etter
   avstand til tyngre tekniske inngrep. */
import { naermesteFarge } from '../generelt/farge.ts';
import { katalog } from '../katalog.ts';
import { HALV, type Piksler } from './felles.ts';
import { tolketBilde, type Kommuneruter } from './kommune.ts';

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

/* Tolker bildet av sonene. P er bildet fra tjenesten og M kommunens flate, som piksler (RGBA) i samme rutenett. En rute hører til en
   sone når den er minst halvt dekket. Gir sonen per rute (UTENFOR uten sone), og antall ruter per sone innenfor kommunen. */
export function tolkInon(P: Piksler, M: Piksler) {
  const n = [0, 0, 0],
    sone = new Uint8Array(P.length / 4).fill(UTENFOR);
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
    if (M[i + 3] >= HALV) n[s]++;
  }
  return { sone, n };
}

/* Tabellen solv.inon: sonen per rute i bildet av kommunen, og antall ruter per sone innenfor kommunen */
export type InonRuter = Kommuneruter<{ sone: Uint8Array }>;
export async function inon(nr: string): Promise<InonRuter> {
  return tolketBilde(nr, [await katalog.bronse.inonbilde(nr)], ([P], M) => tolkInon(P, M));
}
