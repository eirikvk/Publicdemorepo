/* Inngrepsfri natur: arealet i hver sone etter avstand til tyngre tekniske inngrep, regnet fra ett bilde av hele kommunen fra
   Miljødirektoratets kartlag (status). */
import { HALV } from './felles.js';

/* Sonene: [kode i tjenesten, farge i kartet her, farge i tjenestens bilder, avstand, navn] */
export const INONSONER = [
  ['v', 'inonv', [76, 171, 38], '5 km eller mer fra inngrep', 'Villmarkspreget natur'],
  ['1', 'inon1', [153, 207, 22], '3–5 km fra inngrep', 'Sone 1'],
  ['2', 'inon2', [204, 234, 127], '1–3 km fra inngrep', 'Sone 2']
];
export const UTENFOR = 255; /* rute uten sone */

/* Sonen en farge ligger nærmest: 0 villmarkspreget, 1 sone 1, 2 sone 2 */
export const inonSone = (r, g, b) => {
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

/* Tolker bildet av sonene. P er bildet fra tjenesten og M kommunens flate, som piksler (RGBA) i samme rutenett med ruter på res
   meter, og skala er m2PerKm2 for kommunen. En rute hører til en sone når den er minst halvt dekket, og telles når den ligger
   i kommunen. Gir sonen per rute (UTENFOR uten sone), og arealet per sone og samlet i km², avrundet til nærmeste 10 dekar som
   SSBs tall. */
export function tolkInon(P, M, res, skala) {
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
  const soner = n.map(v => Math.round(((v * res * res) / skala) * 100) / 100);
  return { sone, soner, sum: Math.round((soner[0] + soner[1] + soner[2]) * 100) / 100 };
}
