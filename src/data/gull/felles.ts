/* Gull, felles: små hjelpere som flere av svarene bruker. */
import { summen } from '../generelt/tall.ts';

/* Andelen del er av av, i prosent. null når det ikke er noe å regne andelen av. */
export const andel = (del: number, av: number): number | null => (av > 0 ? (del / av) * 100 : null);

/* Hvor langt et tema som hentes som ett bilde av kommunen er kommet, og arealet når det er hentet */
export interface Bildetema {
  nr: string;
  tilstand: 'henter' | 'feil' | 'ok';
  sum?: number;
}
export type Bildestatus = 'henter' | 'feil' | 'ok' | 'ingen';

/* Tilstanden for et tema som hentes som ett bilde av kommunen (inngrepsfri natur og grått areal): henter, feil, ingen eller ok */
export const bildeStatus = (D: Bildetema | null): Bildestatus =>
  !D || D.tilstand === 'henter' ? 'henter' : D.tilstand !== 'ok' ? 'feil' : D.sum! > 0 ? 'ok' : 'ingen';

/* Et areal i km² avrundet til nærmeste 10 dekar (0,01 km²), som SSBs tall */
export const tiDekar = (km2: number) => Math.round(km2 * 100) / 100;
/* Arealet i km² per klasse og samlet, fra antall ruter per klasse (n) i et rutenett med ruter på res meter. skala er m2PerKm2 for
   kommunen. Både klassene og summen avrundes til nærmeste 10 dekar. Brukes for sonene i inngrepsfri natur og trinnene i grått
   areal. */
export function arealFraRuter(n: ArrayLike<number>, res: number, skala: number) {
  const km2 = Array.from(n, v => tiDekar((v * res * res) / skala));
  return { km2, sum: tiDekar(summen(km2)) };
}
