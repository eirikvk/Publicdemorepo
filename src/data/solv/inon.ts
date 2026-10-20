/* Sølv for inngrepsfri natur: ett datasett med år. Bildet av hver bit fra Miljødirektoratets kartlag for hvert år gjort om til sone
   per rute, etter avstand til tyngre tekniske inngrep (solv.inonbit). Arealet i kommunen regnes i gull (gull.inonAreal). Og sonen per
   piksel i kartet for nyeste år, én sannhet per nivå (solv.inonsoner og solv.inonsonerUt, se nivaer.ts), i naturen (inonINatur). */
import { katalog } from '../katalog.ts';
import { arbeid } from './arbeid.ts';
import { FLISNIVA, bitAv, bitRuter, type Flis, type Rutebilde } from './felles.ts';
import { iBlokk, type Klasser } from './grunnkart.ts';
import { NAT } from './klasser.ts';
import { biterIFlisen, flestIFlisen, rutenIFlis, soneHalvpart } from './nivaer.ts';
import { INON_NYESTE, UTENFOR } from './tolking.ts';
export { INONAAR, INON_NYESTE, INONSONER, UTENFOR, inonSone, tolkInon } from './tolking.ts';

/* Sonen per rute i en bit (0 villmarkspreget, 1 sone 1, 2 sone 2, UTENFOR uten sone), med bitens rutenett. sone er null når biten
   ikke har noen soner, så tomme biter ikke tar plass. */
export interface Inonsoner extends Rutebilde {
  sone: Uint8Array | null;
}
/* Tabellen solv.inonbit: sonen per rute i biten tc for året aar, tolket i bakgrunnstråden (tolkInon). Kalles med [aar, tc]. */
export async function inonbit([aar, tc]: [number, Flis]): Promise<Inonsoner> {
  return {
    ...bitRuter(tc),
    sone: await arbeid<Uint8Array | null>({ type: 'inon', P: await katalog.bronse.inonbit([aar, tc]) })
  };
}
/* Sonen i bitene oversatt til flisene: sonen pluss én, og 0 uten sone */
const SONEPLASS = Uint8Array.from({ length: 256 }, (_, v) => (v < 3 ? v + 1 : 0));
/* Tabellen solv.inonsoner: sonen per piksel i flisen tc [z, x, y] fra nivå 10: 0 uten sone, 1 villmarkspreget, 2 sone 1, 3 sone 2.
   Alltid rutene i biten tallene regnes av (solv.inonbit): på nivå 10 én rute per piksel, og finere nivåer ruta pikselen ligger i. Kartet
   henter derfor ingenting nytt når det zoomes inn, og sonegrensene følger rutene på 10,6 meter. */
export async function inonsoner(tc: Flis): Promise<Klasser> {
  if (tc[0] < FLISNIVA) throw new Error('sonene per flis finnes fra nivå 10');
  const b = bitAv(tc),
    D = await katalog.solv.inonbit([INON_NYESTE, b]),
    kl = new Uint8Array(512 * 512);
  if (D.sone) rutenIFlis(D.sone, b, tc, kl, SONEPLASS);
  return { ...iBlokk(tc), kl };
}
/* Tabellen solv.inonsonerUt: sonen per piksel i flisen [z, x, y] under nivå 10 for kommunen nr, kalt med [nr, z, x, y]: kartet
   zoomet ut. Hver piksel er n x n ruter i kommunens biter (solv.inonbit), med halvregelen per avstand (soneHalvpart i nivaer.ts). */
export async function inonsonerUt([nr, z, x, y]: [string, number, number, number]): Promise<Klasser> {
  if (z >= FLISNIVA) throw new Error('sonene zoomet ut er under nivå 10');
  const tc: Flis = [z, x, y],
    kl = new Uint8Array(512 * 512),
    B = biterIFlisen(
      (await katalog.solv.kommunebiter(nr)).map(K => K.tc),
      tc
    );
  await Promise.all(
    B.map(async b => {
      const D = await katalog.solv.inonbit([INON_NYESTE, b]);
      if (D.sone) flestIFlisen(D.sone, b, tc, kl, 3, soneHalvpart);
    })
  );
  return { ...iBlokk(tc), kl };
}
/* Inngrepsfri natur per piksel i kartet: sonen S (som i solv.inonsoner) der dagens klasse K på samme nivå er natur, ellers 0 */
export function inonINatur(S: ArrayLike<number>, K: ArrayLike<number> | null): Uint8Array {
  const ut = new Uint8Array(S.length);
  if (K) for (let q = 0; q < S.length; q++) if (K[q] === NAT + 1) ut[q] = S[q];
  return ut;
}
