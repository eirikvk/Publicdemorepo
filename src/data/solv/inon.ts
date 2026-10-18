/* Sølv for inngrepsfri natur: bildet av hver bit fra Miljødirektoratets kartlag (status) gjort om til sone per rute, etter avstand
   til tyngre tekniske inngrep, og sonene talt i kommunen. */
import { katalog } from '../katalog.ts';
import { arbeid } from './arbeid.ts';
import { bitRuter, type Flis, type Rutebilde } from './felles.ts';
import { tellIKommune, type Bitruter } from './kommune.ts';
import { UTENFOR } from './tolking.ts';
export { INONSONER, UTENFOR, inonSone, tolkInon } from './tolking.ts';

/* Sonen per rute i en bit (0 villmarkspreget, 1 sone 1, 2 sone 2, UTENFOR uten sone), med bitens rutenett. sone er null når biten
   ikke har noen soner, så tomme biter ikke tar plass. */
export interface Inonsoner extends Rutebilde {
  sone: Uint8Array | null;
}
/* Sonen i et punkt (x, y) i meter, fra biten D. UTENFOR utenfor biten. */
export const soneVed = (D: Inonsoner, x: number, y: number) => {
  const px = Math.floor((x - D.u[0]) / D.res),
    py = Math.floor((D.u[3] - y) / D.res);
  return !D.sone || px < 0 || py < 0 || px >= D.w || py >= D.h ? UTENFOR : D.sone[py * D.w + px];
};
/* Tabellen solv.inonbit: sonen per rute i biten tc, tolket i bakgrunnstråden (tolkInon) */
export async function inonbit(tc: Flis): Promise<Inonsoner> {
  return {
    ...bitRuter(tc),
    sone: await arbeid<Uint8Array | null>({ type: 'inon', P: await katalog.bronse.inonbit(tc) })
  };
}
/* Tabellen solv.inon: antall ruter per sone innenfor kommunen nr, og bitene kommunen har ruter i */
export async function inon(nr: string): Promise<Bitruter> {
  return tellIKommune(
    nr,
    3,
    tc => katalog.solv.inonbit(tc).then(D => D.sone),
    s => (s === UTENFOR ? null : s),
    UTENFOR
  );
}
