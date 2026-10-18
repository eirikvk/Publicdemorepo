/* Sølv for kommunen: grensen i felles form, og temaene som hentes i biter (inngrepsfri natur og grått areal) talt i kommunen. De
   telles på samme måte (tellIKommune), så det står bare her. */
import { flerflate, utsnitt, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { arbeid } from './arbeid.ts';
import { BITNIVA, arealKm2, biterI, bitRuter, m2PerKm2, type Flis } from './felles.ts';
import type { Kommunebit, Telling } from './oppgaver.ts';

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
export type { Kommunebit, Telling } from './oppgaver.ts';
/* Om rute q i biten K er i kommunen */
export const iKommunen = (K: Kommunebit, q: number) => K.hel || ((K.ruter![q >> 3] >> (q & 7)) & 1) === 1;
/* Tabellen solv.kommunebiter: bitene kommunen nr har ruter i, med kommunens flate i hver, tegnet i bakgrunnstråden. Først et grovt
   bilde (64 x 64) for å se om kommunen berører biten, så flaten tegnes bare i bitene den berører. Flaten tegnes én gang per bit, og
   deles av temaene som telles i kommunen (tellIKommune). */
export async function kommunebiter(nr: string): Promise<Kommunebit[]> {
  const g = await katalog.solv.grense(nr);
  return arbeid<Kommunebit[]>({ type: 'kommunebiter', koord: g.koord, biter: biterI(g.ext) });
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
   når den ikke telles. plasser er lengden på n. Rutene telles i bakgrunnstråden, fire biter om gangen. hver kalles for hver bit med
   tellingen (antall ruter per verdi i kommunen, og den midterste ruta som ikke er tom), når den som kaller trenger mer enn antallet. */
export async function tellIKommune(
  nr: string,
  plasser: number,
  verdier: (tc: Flis) => Promise<Uint8Array | null>,
  plass: (v: number) => number | null,
  tom: number,
  hver?: (tc: Flis, T: Telling) => void
): Promise<Bitruter> {
  const [g, KB] = await Promise.all([katalog.solv.grense(nr), katalog.solv.kommunebiter(nr)]),
    n = new Array<number>(plasser).fill(0),
    res = bitRuter([BITNIVA, 0, 0]).res,
    P = plasstabell(plass);
  const en = async (K: Kommunebit) => {
    const V = await verdier(K.tc);
    if (!V) {
      const p = P[tom];
      if (p >= 0) n[p] += K.antall;
      return;
    }
    const T = await arbeid<Telling>({ type: 'telling', V, ruter: K.ruter, tom });
    for (let v = 0; v < 256; v++) if (T.hist[v] && P[v] >= 0) n[P[v]] += T.hist[v];
    if (hver) hver(K.tc, T);
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
