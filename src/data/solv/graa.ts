/* Sølv for grått areal: de to bildene av hver bit fra kart over grå arealer (NIBIO, testversjon) gjort om til trinn per rute, etter
   andel vegetasjon, og trinnene talt i kommunen. Grått areal er areal som alt er tatt i bruk eller sterkt påvirket av bygge- og
   anleggsaktivitet. */
import { katalog } from '../katalog.ts';
import { arbeid } from './arbeid.ts';
import { bitRuter, type Flis, type Rutebilde } from './felles.ts';
import { tellIKommune, type Bitruter } from './kommune.ts';
export { GRAATRINN, ellerTom, graaTrinn, tolkGraa } from './tolking.ts';

/* Trinnet per rute i en bit (0 ikke grått, 1–5 andel vegetasjon, 6 uten oppgitt andel), med bitens rutenett. kl er null når
   biten ikke har noe grått areal, så tomme biter ikke tar plass. */
export interface Graatrinn extends Rutebilde {
  kl: Uint8Array | null;
}

/* Trinnet i et punkt (x, y) i meter, fra biten D. 0 utenfor biten. */
export const graaVed = (D: Graatrinn, x: number, y: number) => {
  const px = Math.floor((x - D.u[0]) / D.res),
    py = Math.floor((D.u[3] - y) / D.res);
  return !D.kl || px < 0 || py < 0 || px >= D.w || py >= D.h ? 0 : D.kl[py * D.w + px];
};
/* Tabellen solv.graabit: trinnet per rute i biten tc, tolket i bakgrunnstråden (tolkGraa) */
export async function graabit(tc: Flis): Promise<Graatrinn> {
  const [P, V] = await Promise.all([0, 1].map(lag => katalog.bronse.graabit([lag, tc])));
  return { ...bitRuter(tc), kl: await arbeid<Uint8Array | null>({ type: 'graa', P, V }) };
}
/* Tabellen solv.graa: antall ruter per trinn (plass 1–6) innenfor kommunen nr, og bitene kommunen har ruter i */
export async function graa(nr: string): Promise<Bitruter> {
  return tellIKommune(
    nr,
    7,
    tc => katalog.solv.graabit(tc).then(D => D.kl),
    t => t || null,
    0
  );
}
