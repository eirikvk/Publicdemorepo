/* Gull, felles: små hjelpere som flere av svarene bruker. */
import { summen } from '../generelt/tall.ts';
import type { Rutebilde } from '../solv/felles.ts';

/* Andelen del er av av, i prosent. null når det ikke er noe å regne andelen av. */
export const andel = (del: number, av: number): number | null => (av > 0 ? (del / av) * 100 : null);

/* Et tema som hentes som ett bilde av kommunen (inngrepsfri natur og grått areal), for kommunen nr. Mens det hentes, og når det
   feilet, er det bare tilstanden. Når det er hentet, har det også arealet samlet i km² (sum), rutenettet bildet er tolket i, og det
   som er eget for temaet (E). */
export type Kommunebilde<E> = { nr: string; tilstand: 'henter' | 'feil' } | HentetBilde<E>;
/* Et kommunebilde som er hentet, og D hvis det er det */
export type HentetBilde<E> = { nr: string; tilstand: 'ok'; sum: number } & Rutebilde & E;
export const hentet = <E>(D: Kommunebilde<E> | null): HentetBilde<E> | null => (D && D.tilstand === 'ok' ? D : null);

/* Det sidene viser for et kommunebilde: henter, feil, ingen (hentet, men ingenting i kommunen), eller ok med tallene (T) */
export type Bildetall<T> =
  { tilstand: 'henter' } | { tilstand: 'feil' } | { tilstand: 'ingen' } | ({ tilstand: 'ok' } & T);
/* Tallene for et kommunebilde D. tall gir tallene når det er hentet og kommunen har noe. */
export function bildetall<E, T>(D: Kommunebilde<E> | null, tall: (H: HentetBilde<E>) => T): Bildetall<T> {
  if (!D || D.tilstand === 'henter') return { tilstand: 'henter' };
  if (D.tilstand !== 'ok') return { tilstand: 'feil' };
  return D.sum > 0 ? { tilstand: 'ok', ...tall(D) } : { tilstand: 'ingen' };
}

/* Et areal i km² avrundet til nærmeste 10 dekar (0,01 km²), som SSBs tall */
export const tiDekar = (km2: number) => Math.round(km2 * 100) / 100;
/* Arealet i km² per klasse og samlet, fra antall ruter per klasse (n) i et rutenett med ruter på res meter. skala er m2PerKm2 for
   kommunen. Både klassene og summen avrundes til nærmeste 10 dekar. Brukes for sonene i inngrepsfri natur og trinnene i grått
   areal. */
export function arealFraRuter(n: ArrayLike<number>, res: number, skala: number) {
  const km2 = Array.from(n, v => tiDekar((v * res * res) / skala));
  return { km2, sum: tiDekar(summen(km2)) };
}
