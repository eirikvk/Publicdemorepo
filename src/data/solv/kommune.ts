/* Sølv for kommunen: grensen i felles form, og temaene som hentes i biter (inngrepsfri natur og grått areal) talt i kommunen. De
   telles på samme måte (tellIKommune), så det står bare her. */
import {
  andelSum,
  andelUtsnitt,
  ringer,
  ringerUtsnitt,
  tomAndel,
  type Andel,
  type Ringer
} from '../generelt/dekning.ts';
import { flerflate, utsnitt, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { arbeid } from './arbeid.ts';
import { BIT, BITNIVA, arealKm2, bitAv, bitFaktor, biterI, bitRuter, type Flis } from './felles.ts';
import type { Telling } from './oppgaver.ts';

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

/* Et tema som hentes i biter, talt i kommunen nr: ruter per verdi innenfor kommunen (n), bitene kommunen har ruter i (biter), meter
   per rute (res, 10,6) og skala. Rutene i n er alt rettet for målestokken per bit, og en kantrute teller med den delen av den som er i
   kommunen, så arealet i km² er n · res² / skala, med skala 1 000 000. */
export interface Bitruter {
  nr: string;
  n: number[];
  biter: Flis[];
  res: number;
  skala: number;
}
/* En flate i en bit, som kommunen eller et naturtema i kommunen: dekningsandelen per rute (andel, som spenn, se generelt/dekning.ts),
   eller null når hele biten er dekket (hel). antall er summen av andelene i ruter, og faktor målestokken i biten (bitFaktor). */
export interface Andelsbit {
  tc: Flis;
  antall: number;
  hel: boolean;
  andel: Andel | null;
  faktor: number;
}
/* Kommunens flate i en bit */
export type Kommunebit = Andelsbit;
export type { Telling } from './oppgaver.ts';
/* Dekningsandelen i bitene B, regnet i bakgrunnstråden med fire delrader per ruterad (dekningI i generelt/dekning.ts): én liste med
   biter per klasse, med bare bitene klassen dekker noe av. Til hver bit sendes bare ringene som har noe i den (ringerUtsnitt). */
export async function andelsbiter(
  B: Flis[],
  lagene: Ringer[],
  maske: number[],
  kategorier: number[]
): Promise<Andelsbit[][]> {
  const ut: Andelsbit[][] = Array.from({ length: Math.max(1, kategorier.length) }, () => []),
    svar = await Promise.all(
      B.map(tc => {
        const R = bitRuter(tc),
          her = lagene.map(F => ringerUtsnitt(F, R.u)),
          tom = (l: number) => her[l].start.length < 2;
        if (maske.some(tom) || (kategorier.length && kategorier.every(tom))) return null;
        return arbeid<(Andel[] | null)[]>({ type: 'andeler', lagene: her, maske, kategorier, nett: [R] });
      })
    );
  B.forEach((tc, i) => {
    const A = svar[i] && svar[i]![0];
    if (!A) return;
    const faktor = bitFaktor(tc);
    A.forEach((a, k) => {
      const antall = andelSum(a);
      if (!(antall > 0)) return;
      const hel = antall === BIT * BIT;
      ut[k].push({ tc, antall, hel, andel: hel ? null : a, faktor });
    });
  });
  return ut;
}
/* Tabellen solv.kommunebiter: bitene kommunen nr har ruter i, med dekningsandelen i hver (andelsbiter). En kantrute er med i
   kommunen med den delen av den som ligger der, så ingen rute telles i to kommuner. Andelen regnes én gang per bit, og deles av alt
   som telles i kommunen. */
export async function kommunebiter(nr: string): Promise<Kommunebit[]> {
  const g = await katalog.solv.grense(nr);
  return (await andelsbiter(biterI(g.ext), [ringer([g.koord])], [0], []))[0];
}
/* Andelen i blokken tc på nivå 10 (512 x 512 ruter), fra bitene i KB (kommunen eller et tema i den): null når hele blokken er
   dekket, en tom Andel når ingenting er det */
export function kommuneIBlokk(KB: Andelsbit[], tc: Flis): { andel: Andel | null; faktor: number } {
  const b = bitAv(tc),
    K = KB.find(k => k.tc[1] === b[1] && k.tc[2] === b[2]);
  if (!K) return { andel: tomAndel(512, 512), faktor: bitFaktor(tc) };
  if (!K.andel) return { andel: null, faktor: K.faktor };
  const f = 1 << (tc[0] - BITNIVA),
    A = andelUtsnitt(K.andel, (tc[1] - b[1] * f) * 512, (tc[2] - b[2] * f) * 512, 512, 512);
  return { andel: andelSum(A) === 512 * 512 ? null : A, faktor: K.faktor };
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
/* Teller et tema bit for bit i bitene KB, med andelen i hver rute (kommunen, eller et tema i kommunen som villreinområdene). verdier
   gir verdien per rute i en bit (fra katalogen), eller null når biten er tom, og da har alle rutene verdien tom. plass gir plassen i n
   for verdien, eller null når den ikke telles. plasser er lengden på n. Rutene telles i bakgrunnstråden, fire biter om gangen, med
   andelen i hver rute og målestokken i biten, så n er i ruter rettet for målestokken. hver kalles for hver bit med tellingen (andelen
   per verdi, og den midterste ruta som ikke er tom), når den som kaller trenger mer enn antallet. */
export async function tellIBitene(
  KB: Andelsbit[],
  plasser: number,
  verdier: (tc: Flis) => Promise<Uint8Array | null>,
  plass: (v: number) => number | null,
  tom: number,
  hver?: (tc: Flis, T: Telling) => void
): Promise<number[]> {
  const n = new Array<number>(plasser).fill(0),
    P = plasstabell(plass);
  const en = async (K: Andelsbit) => {
    const V = await verdier(K.tc);
    if (!V) {
      const p = P[tom];
      if (p >= 0) n[p] += K.antall * K.faktor;
      return;
    }
    const T = await arbeid<Telling>({ type: 'telling', V, andel: K.andel, tom });
    for (let v = 0; v < 256; v++) if (T.hist[v] && P[v] >= 0) n[P[v]] += T.hist[v] * K.faktor;
    if (hver) hver(K.tc, T);
  };
  const ko = [...KB];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let K = ko.shift(); K; K = ko.shift()) await en(K);
    })
  );
  return n;
}
/* Meter per rute i bitene (10,6) */
export const BITRES = bitRuter([BITNIVA, 0, 0]).res;
/* Teller et tema i kommunen nr bit for bit, i bitene kommunen har ruter i (solv.kommunebiter), med tellIBitene */
export async function tellIKommune(
  nr: string,
  plasser: number,
  verdier: (tc: Flis) => Promise<Uint8Array | null>,
  plass: (v: number) => number | null,
  tom: number,
  hver?: (tc: Flis, T: Telling) => void
): Promise<Bitruter> {
  const KB = await katalog.solv.kommunebiter(nr),
    n = await tellIBitene(KB, plasser, verdier, plass, tom, hver);
  return { nr, n, biter: KB.map(K => K.tc), res: BITRES, skala: 1e6 };
}

/* Tabellen solv.kommuneareal: flaten til hver kommune i km² (land, ferskvann og hav), etter kommunenummer */
export async function kommuneareal(): Promise<Record<string, number>> {
  return (await katalog.bronse.kommuneareal()).km2;
}
