/* Sølv for grått areal: de to bildene av hver bit fra kart over grå arealer (NIBIO, testversjon) gjort om til trinn per rute, etter
   andel vegetasjon, og trinnene talt i kommunen. Grått areal er areal som alt er tatt i bruk eller sterkt påvirket av bygge- og
   anleggsaktivitet. */
import { katalog } from '../katalog.ts';
import { BIT, HALV, bitRuter, type Flis, type Piksler, type Rutebilde } from './felles.ts';
import { tellIKommune, type Bitruter } from './kommune.ts';
import { bildePiksler } from './raster.ts';

/* Trinnet per rute i en bit (0 ikke grått, 1–5 andel vegetasjon, 6 uten oppgitt andel), med bitens rutenett */
export interface Graatrinn extends Rutebilde {
  kl: Uint8Array;
}

/* Trinnene etter andel vegetasjon i flaten: [farge, navn, fra og med prosent, til prosent] */
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

/* Trinnet i et punkt (x, y) i meter, fra biten D. 0 utenfor biten. */
export const graaVed = (D: Graatrinn, x: number, y: number) => {
  const px = Math.floor((x - D.u[0]) / D.res),
    py = Math.floor((D.u[3] - y) / D.res);
  return px < 0 || py < 0 || px >= D.w || py >= D.h ? 0 : D.kl[py * D.w + px];
};

/* Tabellen solv.graabit: trinnet per rute i biten tc */
export async function graabit(tc: Flis): Promise<Graatrinn> {
  const [P, V] = await Promise.all([0, 1].map(lag => katalog.bronse.graabit([lag, tc])));
  return { ...bitRuter(tc), kl: tolkGraa(await bildePiksler(P, BIT, BIT), await bildePiksler(V, BIT, BIT)) };
}
/* Tabellen solv.graa: antall ruter per trinn (plass 1–6) innenfor kommunen nr, og bitene kommunen har ruter i */
export async function graa(nr: string): Promise<Bitruter> {
  return tellIKommune(
    nr,
    7,
    tc => katalog.solv.graabit(tc).then(D => D.kl),
    t => t || null
  );
}
