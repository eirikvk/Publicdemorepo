/* Sølv for inngrepsfri natur: bildet av hele kommunen fra Miljødirektoratets kartlag (status) gjort om til sone per rute, etter
   avstand til tyngre tekniske inngrep. */
import { HALV, type Piksler } from './felles.ts';

/* Sonene: [kode i tjenesten, farge i kartet her, farge i tjenestens bilder, avstand, navn] */
export const INONSONER: [kode: string, farge: string, rgb: number[], avstand: string, navn: string][] = [
  ['v', 'inonv', [76, 171, 38], '5 km eller mer fra inngrep', 'Villmarkspreget natur'],
  ['1', 'inon1', [153, 207, 22], '3–5 km fra inngrep', 'Sone 1'],
  ['2', 'inon2', [204, 234, 127], '1–3 km fra inngrep', 'Sone 2']
];
export const UTENFOR = 255; /* rute uten sone */

/* Sonen en farge ligger nærmest: 0 villmarkspreget, 1 sone 1, 2 sone 2 */
export const inonSone = (r: number, g: number, b: number) => {
  let best = 0,
    min = 1e9;
  for (let i = 0; i < 3; i++) {
    const f = INONSONER[i][2],
      d = (r - f[0]) ** 2 + (g - f[1]) ** 2 + (b - f[2]) ** 2;
    if (d < min) {
      min = d;
      best = i;
    }
  }
  return best;
};

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
