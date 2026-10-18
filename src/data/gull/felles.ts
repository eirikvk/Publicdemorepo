/* Gull, felles: små hjelpere som flere av svarene bruker. */
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { HALV, bitRuter, type Flis } from '../solv/felles.ts';
import type { Flerflate } from '../generelt/geometri.ts';
import { flaterPiksler } from '../solv/raster.ts';

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

/* Rutene innenfor en maske M (RGBA, der en rute er med når den er minst halvt dekket, HALV): antall ruter i masken (alle), og antall
   per plass i n. plass gir plassen i n for verdien i ruta (verdier), eller null når ruta ikke telles, og plasser er lengden på n.
   verdier er null når alle rutene har verdien tom. Brukes til å telle inngrepsfri natur og grått areal i villreinområdene. */
export function tellIMaske(
  M: ArrayLike<number>,
  verdier: ArrayLike<number> | null,
  plasser: number,
  plass: (v: number) => number | null,
  tom = 0
) {
  const n = new Array<number>(plasser).fill(0),
    ruter = M.length >> 2,
    pt = plass(tom);
  let alle = 0;
  for (let q = 0; q < ruter; q++) {
    if (M[4 * q + 3] < HALV) continue;
    alle++;
    const p = verdier ? plass(verdier[q]) : pt;
    if (p !== null) n[p]++;
  }
  return { alle, n };
}

/* Teller rutene innenfor flatene (unionen av dem, klippet mot kommunen innenfor) bit for bit, som tellIMaske: antall ruter i
   flatene (alle), og antall per plass i n. verdier gir verdien per rute i en bit, eller null når alle rutene har verdien tom. Bare
   bitene i biter som flatene berører, telles. Brukes til å telle inngrepsfri natur og grått areal i villreinområdene. */
export async function tellIBiter(
  biter: Flis[],
  verdier: (tc: Flis) => Promise<ArrayLike<number> | null>,
  flater: { koord: Flerflate; ext: number[] }[],
  innenfor: Flerflate,
  plasser: number,
  plass: (v: number) => number | null,
  tom: number
) {
  const n = new Array<number>(plasser).fill(0);
  let alle = 0;
  for (const tc of biter) {
    const R = bitRuter(tc),
      her = flater.filter(f => f.ext[0] < R.u[2] && f.ext[2] > R.u[0] && f.ext[1] < R.u[3] && f.ext[3] > R.u[1]);
    if (!her.length) continue;
    const V = await verdier(tc),
      M = flaterPiksler(
        her.map(f => f.koord),
        R,
        innenfor
      ),
      T = tellIMaske(M, V, plasser, plass, tom);
    alle += T.alle;
    T.n.forEach((v, i) => (n[i] += v));
  }
  return { alle, n };
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

/* Landarealet i kommunen nr i km², summen av de tre klassene fra SSB. 0 når tallene ikke kan hentes, og da regnes ingen andeler av
   landarealet ut. */
export const landareal = (nr: string): Promise<number> =>
  katalog.solv.arealtall(nr).then(
    T => T.land,
    () => 0
  );
