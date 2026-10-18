/* Sølv for kommunen: grensen i felles form, og temaene som hentes i biter (inngrepsfri natur og grått areal) talt i kommunen. De
   telles på samme måte (tellIKommune), så det står bare her. */
import { flerflate, utsnitt, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { BIT, BITNIVA, HALV, arealKm2, biterI, bitRuter, m2PerKm2, type Flis } from './felles.ts';
import { flatePiksler } from './raster.ts';

/* Kommunegrensen: flerflaten i UTM33, utsnittet og flaten i km² (land og vann) */
export interface Grense {
  nr: string;
  koord: Flerflate;
  ext: Utsnitt;
  km2: number;
}
/* Tabellen solv.grense: kommunegrensen fra Kartverket som flerflate, med utsnitt og flate rettet for målestokken i UTM */
export async function grense(nr: string): Promise<Grense> {
  const koord = flerflate(await katalog.bronse.kommunegrense(nr)),
    ext = utsnitt(koord);
  return { nr, koord, ext, km2: arealKm2(koord, ext) };
}

/* Et tema som hentes i biter, talt i kommunen nr: antall ruter per verdi innenfor kommunen (n), bitene kommunen har ruter i
   (biter), meter per rute (res, 10,6) og skala (m2PerKm2 for kommunen), så arealet kan regnes ut */
export interface Bitruter {
  nr: string;
  n: number[];
  biter: Flis[];
  res: number;
  skala: number;
}
/* Kommunens flate i en bit, etter halvregelen (en rute er i kommunen når flaten dekker minst halve ruta): antall ruter i kommunen,
   hel når hele biten er i kommunen, og ellers én bit per rute (ruter, 1 i kommunen), så en bit tar 512 kB og ikke 16 MB */
export interface Kommunebit {
  tc: Flis;
  antall: number;
  hel: boolean;
  ruter: Uint8Array | null;
}
/* Om rute q i biten K er i kommunen */
export const iKommunen = (K: Kommunebit, q: number) => K.hel || ((K.ruter![q >> 3] >> (q & 7)) & 1) === 1;
/* Tabellen solv.kommunebiter: bitene kommunen nr har ruter i, med kommunens flate i hver. Først et grovt bilde (64 x 64) for å se
   om kommunen berører biten, så flaten tegnes bare i bitene den berører. Flaten tegnes én gang per bit, og deles av temaene som telles
   i kommunen (tellIKommune). */
export async function kommunebiter(nr: string): Promise<Kommunebit[]> {
  const g = await katalog.solv.grense(nr),
    ut: Kommunebit[] = [];
  for (const tc of biterI(g.ext)) {
    const R = bitRuter(tc),
      grov = flatePiksler(g.koord, { u: R.u, res: R.res * (R.w / 64), w: 64, h: 64 });
    let berort = false;
    for (let i = 3; i < grov.length && !berort; i += 4) berort = grov[i] > 0;
    if (!berort) continue;
    const M = flatePiksler(g.koord, R),
      ruter = new Uint8Array((BIT * BIT) >> 3);
    let antall = 0;
    for (let q = 0; q < BIT * BIT; q++)
      if (M[4 * q + 3] >= HALV) {
        antall++;
        ruter[q >> 3] |= 1 << (q & 7);
      }
    if (!antall) continue;
    const hel = antall === BIT * BIT;
    ut.push({ tc, antall, hel, ruter: hel ? null : ruter });
  }
  return ut;
}

/* Plassen for hver verdi fra 0 til 255 (verdiene i bitene er bytes), -1 når den ikke telles. Slått opp én gang, så tellingen ikke
   kaller en funksjon per rute. */
export function plasstabell(plass: (v: number) => number | null): Int16Array {
  const T = new Int16Array(256);
  for (let v = 0; v < 256; v++) {
    const p = plass(v);
    T[v] = p === null ? -1 : p;
  }
  return T;
}
/* Teller et tema i kommunen nr bit for bit, i bitene kommunen har ruter i (solv.kommunebiter). verdier gir verdien per rute i en
   bit (fra katalogen), eller null når biten er tom, og da har alle rutene verdien tom. plass gir plassen i n for verdien, eller null
   når den ikke telles. plasser er lengden på n. Fire biter hentes om gangen. hver kalles for hver bit med verdiene (V) og kommunens
   flate (K), når den som kaller trenger mer enn antallet. */
export async function tellIKommune(
  nr: string,
  plasser: number,
  verdier: (tc: Flis) => Promise<ArrayLike<number> | null>,
  plass: (v: number) => number | null,
  tom: number,
  hver?: (tc: Flis, V: ArrayLike<number> | null, K: Kommunebit) => void
): Promise<Bitruter> {
  const [g, KB] = await Promise.all([katalog.solv.grense(nr), katalog.solv.kommunebiter(nr)]),
    n = new Array<number>(plasser).fill(0),
    res = bitRuter([BITNIVA, 0, 0]).res,
    T = plasstabell(plass);
  const en = async (K: Kommunebit) => {
    const V = await verdier(K.tc);
    if (!V) {
      const p = T[tom];
      if (p >= 0) n[p] += K.antall;
    } else if (K.hel)
      for (let q = 0; q < V.length; q++) {
        const p = T[V[q]];
        if (p >= 0) n[p]++;
      }
    else
      for (let q = 0; q < V.length; q++) {
        if (!((K.ruter![q >> 3] >> (q & 7)) & 1)) continue;
        const p = T[V[q]];
        if (p >= 0) n[p]++;
      }
    if (hver) hver(K.tc, V, K);
  };
  const ko = [...KB];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let K = ko.shift(); K; K = ko.shift()) await en(K);
    })
  );
  return { nr, n, biter: KB.map(K => K.tc), res, skala: m2PerKm2(g.ext) };
}

/* Tabellen solv.kommuneareal: flaten til hver kommune i km² (land, ferskvann og hav), etter kommunenummer */
export async function kommuneareal(): Promise<Record<string, number>> {
  return (await katalog.bronse.kommuneareal()).km2;
}
