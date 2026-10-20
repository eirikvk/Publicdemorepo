/* Gull, felles: små hjelpere som flere av svarene bruker. */
import { summen, tiDekar } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { GRENSE_FLYTTET } from '../solv/felles.ts';
import { KL } from '../solv/klasser.ts';
import type { Arealtall } from '../solv/ssb.ts';

/* Andelen del er av av, i prosent. null når det ikke er noe å regne andelen av. */
export const andel = (del: number, av: number): number | null => (av > 0 ? (del / av) * 100 : null);

/* Et tema som hentes i biter (inngrepsfri natur og grått areal), for kommunen nr. Mens det hentes, og når det feilet, er det bare
   tilstanden. Når det er hentet, har det også arealet samlet i km² (sum), og det som er eget for temaet (E). */
export type Kommunebilde<E> = { nr: string; tilstand: 'henter' | 'feil' } | HentetBilde<E>;
/* Et kommunebilde som er hentet, og D hvis det er det */
export type HentetBilde<E> = { nr: string; tilstand: 'ok'; sum: number } & E;
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

/* Et areal i km² avrundet til nærmeste 10 dekar (0,01 km²), som SSBs tall (generelt/tall.ts) */
export { tiDekar };
/* Arealet i km² per klasse og samlet, fra antall ruter per klasse (n) i et rutenett med ruter på res meter. skala er m2PerKm2 for
   kommunen. Både klassene og summen avrundes til nærmeste 10 dekar. Brukes for sonene i inngrepsfri natur og trinnene i grått
   areal. */
export function arealFraRuter(n: ArrayLike<number>, res: number, skala: number) {
  const km2 = Array.from(n, v => tiDekar((v * res * res) / skala));
  return { km2, sum: tiDekar(summen(km2)) };
}

/* Arealtallene fra SSB summert til klassene på land, i ett år t (nyeste år når t ikke er gitt): bebygd, jordbruk og natur i km² (a),
   landarealet (summen av de tre), året, og innsjø og elv. SSBs arealklasser summeres etter KL, med SSBs egne summer for jordbruk og
   skog (D.samlet), som tabellen 09594 gir dem. */
export interface Klasseareal {
  a: number[];
  land: number;
  aar: string;
  ferskvann: { inn: number; elv: number };
}
const verdi = (D: Arealtall, kode: string, t: number) =>
  (D.samlet[kode] || (D.klasser.find(k => k.kode === kode) || { km2: [] }).km2)[t] || 0;
const perKlasseI = (D: Arealtall, t: number) => KL.map(x => summen(x[3].map(c => verdi(D, c, t))));
export function perKlasse(D: Arealtall, t = D.aar.length - 1): Klasseareal {
  const a = perKlasseI(D, t);
  return { a, land: summen(a), aar: D.aar[t], ferskvann: { inn: verdi(D, '22.01', t), elv: verdi(D, '22.02', t) } };
}
/* Arealet per klasse i 2017 (a0) og i nyeste år (a1), til utbredelsesregnskapet, eller null hvis serien ikke rekker tilbake til
   2017. endret sier at kommunens samlede areal er så forskjellig at grensen trolig er flyttet, og da skal årgangene ikke
   sammenlignes. */
export interface Historie {
  nr: string;
  fra: string;
  til: string;
  a0: number[];
  a1: number[];
  endret: boolean;
}
export function historie(D: Arealtall): Historie | null {
  const nT = D.aar.length,
    f = D.aar.indexOf('2017'),
    alt = (t: number) => summen(perKlasseI(D, t)) + verdi(D, '22.01', t) + verdi(D, '22.02', t);
  if (f < 0 || nT - f < 2 || !alt(f) || !alt(nT - 1)) return null;
  return {
    nr: D.nr,
    fra: D.aar[f],
    til: D.aar[nT - 1],
    a0: perKlasseI(D, f),
    a1: perKlasseI(D, nT - 1),
    endret: Math.abs(alt(nT - 1) - alt(f)) / alt(nT - 1) > GRENSE_FLYTTET
  };
}

/* Landarealet i kommunen nr i km², summen av de tre klassene fra SSB i nyeste år. 0 når tallene ikke kan hentes, og da regnes ingen
   andeler av landarealet ut. */
export const landareal = (nr: string): Promise<number> =>
  katalog.solv.arealtall(nr).then(
    D => perKlasse(D).land,
    () => 0
  );
