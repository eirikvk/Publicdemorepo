/* Sølv, tolking av kartbildene til verdier per rute: grått areal, inngrepsfri natur og kommuneplanen. Rene funksjoner uten katalogen,
   så de kan kjøres i bakgrunnstråden (arbeider.ts) like godt som på siden. Modulene for hvert tema (graa.ts, inon.ts og
   kommuneplan.ts) gir dem videre. */
import { naermesteFarge } from '../generelt/farge.ts';
import { HALV, SYNLIG, type Piksler } from './felles.ts';

/* null når ingen ruter har noe (alle er tom), ellers v */
export const ellerTom = (v: Uint8Array, tom: number) => {
  for (let q = 0; q < v.length; q++) if (v[q] !== tom) return v;
  return null;
};

/* Grått areal. Trinnene etter andel vegetasjon i flaten: [farge, navn, fra og med prosent, til prosent] */
export const GRAATRINN: [farge: string, navn: string, fra: number, til: number][] = [
  ['graa1', 'Under 1 % vegetasjon', 0, 1],
  ['graa2', '1–25 % vegetasjon', 1, 25],
  ['graa3', '25–50 % vegetasjon', 25, 50],
  ['graa4', '50–75 % vegetasjon', 50, 75],
  ['graa5', '75–100 % vegetasjon', 75, 101]
];
/* Trinnet for en piksel i bildet av flatene med oppgitt vegetasjon. Stilen som sendes til NIBIO, tegner trinn n i rødt med styrke
   51 · n. r er den røde fargen og a dekningen. Gir 0 ikke grått, 1–5 andel vegetasjon fra lavest til høyest, og 6 grått uten oppgitt
   andel (veier og lignende). */
export const graaTrinn = (r: number, a: number) =>
  a < HALV ? 0 : r < 26 ? 6 : Math.min(5, Math.max(1, Math.round(r / 51)));
/* Tolker de to bildene av en bit. P er bildet av alt grått areal og V bildet av flatene med oppgitt andel vegetasjon, begge som
   piksler (RGBA) i samme rutenett. En rute er grå når den er minst halvt dekket. Gir trinnet per rute. */
export function tolkGraa(P: Piksler, V: Piksler) {
  const kl = new Uint8Array(P.length / 4);
  for (let i = 0, q = 0; i < P.length; i += 4, q++)
    kl[q] = V[i + 3] >= HALV ? graaTrinn(Math.max(26, V[i]), 255) : P[i + 3] >= HALV ? 6 : 0;
  return kl;
}

/* Inngrepsfri natur. Sonene: [kode i tjenesten, farge i kartet her, farge i tjenestens bilder, avstand, navn] */
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

/* Kommuneplanen. Planlagt utbygging per rute i en flis, fra kartbildet P fra DiBK (piksler): 1 der minst halve ruta ligger i en
   planflate (halvregelen), ellers 0 */
export function planIFlis(P: Piksler): Uint8Array {
  const pl = new Uint8Array(P.length / 4);
  for (let i = 3, q = 0; i < P.length; i += 4, q++) if (P[i] >= HALV) pl[q] = 1;
  return pl;
}
/* Planlaget per rute i et kartbilde fra DiBK (piksler): 1 der ruta er tegnet (minst 100 av 255, SYNLIG), ellers 0 */
export function planlagPerRute(P: Piksler): Uint8Array {
  const pl = new Uint8Array(P.length / 4);
  for (let i = 3, q = 0; i < P.length; i += 4, q++) if (P[i] >= SYNLIG) pl[q] = 1;
  return pl;
}
