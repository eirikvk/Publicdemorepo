/* Sølv for grått areal: de to bildene av hver bit fra kart over grå arealer (NIBIO, testversjon) gjort om til trinn per rute, etter
   andel vegetasjon, og trinnene talt i kommunen. Grått areal er areal som alt er tatt i bruk eller sterkt påvirket av bygge- og
   anleggsaktivitet. Og trinnet per piksel i kartet, én sannhet per nivå (solv.graatrinn og solv.graatrinnUt, se nivaer.ts), med
   grønt i bebygd område etter den samme regelen som tallene (graaOgGront). */
import { katalog } from '../katalog.ts';
import { arbeid } from './arbeid.ts';
import { FLISNIVA, bitAv, bitRuter, type Flis, type Rutebilde } from './felles.ts';
import { iBlokk, type Klasser } from './grunnkart.ts';
import { BEB } from './klasser.ts';
import { tellIKommune, type Bitruter } from './kommune.ts';
import { biterIFlisen, flestIFlisen, graaHalvpart, rutenIFlis } from './nivaer.ts';
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

/* Tabellen solv.graatrinn: trinnet per piksel i flisen tc [z, x, y] fra nivå 10, 0 for ikke grått. På nivå 10 er det rutene i biten
   tallene regnes av (solv.graabit), så kartet henter ingenting nytt. Finere nivåer leses av de to kartbildene for flisen
   (bronse.graaflis) med den samme funksjonen som bitene (tolkGraa): skarpere, men ingen tall regnes av dem. */
export async function graatrinn(tc: Flis): Promise<Klasser> {
  if (tc[0] < FLISNIVA) throw new Error('trinnene per flis finnes fra nivå 10');
  const kl = new Uint8Array(512 * 512);
  if (tc[0] === FLISNIVA) {
    const b = bitAv(tc),
      D = await katalog.solv.graabit(b);
    if (D.kl) rutenIFlis(D.kl, b, tc, kl);
  } else {
    const [P, V] = await Promise.all([0, 1].map(lag => katalog.bronse.graaflis([lag, tc]))),
      T = await arbeid<Uint8Array | null>({ type: 'graa', P, V, side: 512 });
    if (T) kl.set(T);
  }
  return { ...iBlokk(tc), kl };
}
/* Tabellen solv.graatrinnUt: trinnet per piksel i flisen [z, x, y] under nivå 10 for kommunen nr, kalt med [nr, z, x, y]: kartet
   zoomet ut. Hver piksel er n x n ruter i kommunens biter (solv.graabit), og halvregelen gjelder som for én rute (graaHalvpart i
   nivaer.ts). */
export async function graatrinnUt([nr, z, x, y]: [string, number, number, number]): Promise<Klasser> {
  if (z >= FLISNIVA) throw new Error('trinnene zoomet ut er under nivå 10');
  const tc: Flis = [z, x, y],
    kl = new Uint8Array(512 * 512),
    B = biterIFlisen(
      (await katalog.solv.kommunebiter(nr)).map(K => K.tc),
      tc
    );
  await Promise.all(
    B.map(async b => {
      const D = await katalog.solv.graabit(b);
      if (D.kl) flestIFlisen(D.kl, b, tc, kl, 7, graaHalvpart);
    })
  );
  return { ...iBlokk(tc), kl };
}
/* Grønt i bebygd område i kartet: verdien etter trinnene 1–6 */
export const GRONT = 7;
/* Grått areal og grønt i bebygd område per piksel, fra trinnet T og dagens klasse K (plassen i ALLE pluss én) på samme nivå:
   trinnet der det er grått, GRONT der det er bebygd, men ikke grått, og ellers 0. Den samme regelen som tallene (gull/graa.ts). */
export function graaOgGront(T: ArrayLike<number>, K: ArrayLike<number> | null): Uint8Array {
  const ut = new Uint8Array(T.length);
  for (let q = 0; q < T.length; q++) ut[q] = T[q] ? T[q] : K && K[q] === BEB + 1 ? GRONT : 0;
  return ut;
}
