/* Gull for naturregnskapet fra SSB: det sidene viser av SSBs to tabeller for naturregnskapet (datasettet «Naturregnskap fra SSB» i
   sølv, solv/naturregnskap.ts): arealet per økosystemtype i 2024, og endringen mellom bebygd og de andre økosystemtypene fra 2017 til
   2024. Tabellene leses med økosystemtypene i grunnkartet (HOVEDOKOSYSTEMER), så sidene bruker de samme navnene som for grunnkartet.
   Foreløpig er tallene i sølv syntetiske. Når SSBs tabeller kommer, byttes sølv ut, og alt her står som det er. Feltet syntetisk
   følger tallene fra sølv, så sidene kan si det.

   Av de to lages det tvillingen viser: kortene, nedbyggingen, regnskapet, og de samme tabellene for alle kommunene i Norge
   (gull.okosystemerNorge) med sammenligningen for kommunen (gull.sammenligning). */
import { summen, tiDekar } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { HOVEDOKOSYSTEMER, KL, OKOSYSTEMTYPER, type KlasseId } from '../solv/klasser.ts';
import type { Kommuneendring, Okosystemareal, Okosystemendring } from '../solv/naturregnskap.ts';
import { andel } from './felles.ts';

/* Et hovedøkosystem i en tabell: koden i grunnkartet, navnet og klassen blant dagens seks */
type Hovedokosystem = (typeof HOVEDOKOSYSTEMER)[number];
const LAND: KlasseId[] = ['beb', 'jor', 'nat'];
/* Summen av verdiene i A for økosystemtypene hos SSB som svarer til hovedøkosystemet h, avrundet til 10 dekar */
const iGrunnkartet = (A: Record<string, number>, h: Hovedokosystem) =>
  tiDekar(summen(OKOSYSTEMTYPER.filter(o => o.grunnkart === h.kode).map(o => A[o.kode] || 0)));

/* Arealet per hovedøkosystem i ett år */
export interface Fordelingsrad extends Hovedokosystem {
  km2: number;
}
/* Arealet per økosystemtype hos SSB for én kommune (A, km² per kode) som arealet per hovedøkosystem i grunnkartet */
export const fordelingAv = (A: Record<string, number>): Fordelingsrad[] =>
  HOVEDOKOSYSTEMER.map(h => ({ ...h, km2: iGrunnkartet(A, h) }));

/* Arealet mellom bebygd og én landklasse i perioden: fra klassen til bebygd, og fra bebygd til klassen */
export interface Endringsrad extends Hovedokosystem {
  tilBebygd: number;
  fraBebygd: number;
}
/* Endringen mellom bebygd og de andre økosystemtypene for én kommune (E fra sølv) for hver landklasse i grunnkartet */
export const endringAv = (E: Kommuneendring): Endringsrad[] =>
  HOVEDOKOSYSTEMER.filter(h => h.gruppe === 'jor' || h.gruppe === 'nat').map(h => ({
    ...h,
    tilBebygd: iGrunnkartet(E.tilBebygd, h),
    fraBebygd: iGrunnkartet(E.fraBebygd, h)
  }));

/* Tabellen gull.okosystemfordeling: arealet per hovedøkosystem i kommunen i 2024, av SSBs tabell (solv.okosystemareal) */
export interface Okosystemfordeling {
  kommune: string;
  aar: string;
  syntetisk: boolean;
  kilde: string;
  klasser: Fordelingsrad[];
}
/* Kommunen nr i tabellen T fra sølv. Mangler den, feiler svaret. */
function kommunenI<V>(T: { kommuner: Record<string, V> }, nr: string): V {
  const K = T.kommuner[nr];
  if (!K) throw new Error(`kommunen ${nr} er ikke med i tabellen fra SSB`);
  return K;
}
export async function okosystemfordeling(nr: string): Promise<Okosystemfordeling> {
  const A = await katalog.solv.okosystemareal();
  return { kommune: nr, aar: A.aar, syntetisk: A.syntetisk, kilde: A.kilde, klasser: fordelingAv(kommunenI(A, nr)) };
}
/* Tabellen gull.bebygdEndring: arealet mellom bebygd og hver av de andre landklassene i kommunen fra 2017 til 2024, av SSBs tabell
   (solv.okosystemendring). endret: kommunegrensen er flyttet, og årene kan ikke sammenlignes. flyttet: grensen er flyttet, men
   endringen er regnet likevel. */
export interface BebygdEndring {
  fra: string;
  til: string;
  klasser: Endringsrad[];
  uforklart: number;
  kommune: string;
  syntetisk: boolean;
  kilde: string;
  endret: boolean;
  flyttet: boolean;
}
export async function bebygdEndring(nr: string): Promise<BebygdEndring> {
  const E = await katalog.solv.okosystemendring(),
    K = kommunenI(E, nr);
  return {
    fra: E.fra,
    til: E.til,
    klasser: endringAv(K),
    uforklart: K.uforklart,
    kommune: nr,
    syntetisk: E.syntetisk,
    kilde: E.kilde,
    endret: K.endret,
    flyttet: K.flyttet
  };
}

/* Natur, jordbruk og bebygd i dag og endringen fra 2017, summert fra de to tabellene: arealet i 2024, andelen av landarealet, endringen
   (bebygd opp, natur og jordbruk ned), og endringen i prosent av arealet i 2017 */
export interface Hovedklasse {
  id: KlasseId;
  km2: number;
  andel: number | null;
  endring: number | null;
  pst: number | null;
}
export function byggHovedklasser(F: Fordelingsrad[], E: Endringsrad[] | null): Hovedklasse[] {
  const areal = (id: KlasseId) => summen(F.filter(r => r.gruppe === id).map(r => r.km2)),
    land = summen(LAND.map(areal)),
    netto = (id: KlasseId) =>
      E
        ? id === 'beb'
          ? summen(E.map(r => r.tilBebygd - r.fraBebygd))
          : -summen(E.filter(r => r.gruppe === id).map(r => r.tilBebygd - r.fraBebygd))
        : null;
  return LAND.map(id => {
    const km2 = areal(id),
      d = netto(id);
    return {
      id,
      km2,
      andel: land > 0 ? (km2 / land) * 100 : null,
      endring: d,
      pst: d !== null && km2 - d > 0 ? (d / (km2 - d)) * 100 : null
    };
  });
}

/* Tabellen gull.oversiktKort: kortene på oversikten i tvillingen, natur, jordbruk og bebygd, summert fra de to tabellene over.
   Endringen er null når årene ikke kan sammenlignes. */
export interface OversiktKort {
  fra: string | null;
  til: string | null;
  syntetisk: boolean;
  kilde: string;
  klasser: (Hovedklasse & { navn: string })[];
}
export async function oversiktKort(nr: string): Promise<OversiktKort> {
  const [F, E] = await Promise.all([katalog.gull.okosystemfordeling(nr), katalog.gull.bebygdEndring(nr)]);
  const sammenlign = !E.endret,
    K = byggHovedklasser(F.klasser, sammenlign ? E.klasser : null),
    navn = (id: KlasseId) => KL.find(k => k[0] === id)![1];
  return {
    fra: sammenlign ? E.fra : null,
    til: sammenlign ? E.til : null,
    syntetisk: F.syntetisk || E.syntetisk,
    kilde: F.kilde,
    klasser: (['nat', 'jor', 'beb'] as KlasseId[]).map(id => ({ ...K.find(k => k.id === id)!, navn: navn(id) }))
  };
}

/* Hvor mye av hver landklasse som ble bygget ned, med arealet i 2024 og andelen av arealet i 2017, og summen for natur og jordbruk.
   Arealet i 2017 er arealet i 2024 med det som gikk til og fra bebygd lagt tilbake. */
export interface Nedbyggingsrad {
  kode: string;
  navn: string;
  gruppe: KlasseId;
  km2: number;
  nedbygd: number;
  andel: number | null;
}
export function byggNedbygging(F: Fordelingsrad[], E: Endringsrad[]) {
  const rader = E.map((r): Nedbyggingsrad => {
      const km2 = (F.find(x => x.kode === r.kode) || { km2: 0 }).km2;
      return {
        kode: r.kode,
        navn: r.navn,
        gruppe: r.gruppe,
        km2,
        nedbygd: r.tilBebygd,
        andel: andel(r.tilBebygd, km2 + r.tilBebygd - r.fraBebygd)
      };
    }),
    sum = (id: KlasseId) => {
      const R = rader.filter(r => r.gruppe === id),
        ned = summen(R.map(r => r.nedbygd)),
        for_ = summen(R.map(r => r.km2)) + ned;
      return { nedbygd: ned, for: for_, andel: andel(ned, for_) };
    };
  return { rader, natur: sum('nat'), jordbruk: sum('jor') };
}
/* Tabellen gull.nedbygging: nedbyggingen fra 2017 til 2024 i kommunen, fra de to tabellene over */
export interface Nedbygging extends ReturnType<typeof byggNedbygging> {
  fra: string;
  til: string;
  syntetisk: boolean;
  kilde: string;
  endret: boolean;
  flyttet: boolean;
  uforklart: number;
}
export async function nedbygging(nr: string): Promise<Nedbygging> {
  const [F, E] = await Promise.all([katalog.gull.okosystemfordeling(nr), katalog.gull.bebygdEndring(nr)]);
  return {
    fra: E.fra,
    til: E.til,
    syntetisk: F.syntetisk || E.syntetisk,
    kilde: F.kilde,
    endret: E.endret,
    flyttet: E.flyttet,
    uforklart: E.uforklart,
    ...byggNedbygging(F.klasser, E.klasser)
  };
}

/* Regnskapet for hvert hovedøkosystem på land: arealet ved start (inngående), endringen mot bebygd og arealet ved slutt (utgående).
   Arealet ved start er arealet ved slutt med det som gikk til og fra bebygd lagt tilbake, så summen for land er den samme begge år. */
export interface Regnskapsrad {
  kode: string;
  navn: string;
  gruppe: KlasseId;
  inngaende: number;
  endring: number;
  utgaende: number;
}
export function byggRegnskap(F: Fordelingsrad[], E: Endringsrad[]): Regnskapsrad[] {
  const netto = summen(E.map(r => r.tilBebygd - r.fraBebygd));
  return F.filter(h => LAND.includes(h.gruppe)).map(h => {
    const r = E.find(x => x.kode === h.kode),
      endring = h.gruppe === 'beb' ? netto : r ? r.fraBebygd - r.tilBebygd : 0;
    return {
      kode: h.kode,
      navn: h.navn,
      gruppe: h.gruppe,
      inngaende: tiDekar(h.km2 - endring),
      endring: tiDekar(endring),
      utgaende: h.km2
    };
  });
}
/* Tabellen gull.okosystemregnskap: regnskapet per hovedøkosystem på land fra 2017 til 2024, fra de to tabellene over. endret:
   kommunegrensen er flyttet, så årene kan ikke sammenlignes. */
export interface Okosystemregnskap {
  fra: string;
  til: string;
  syntetisk: boolean;
  kilde: string;
  endret: boolean;
  rader: Regnskapsrad[];
}
export async function okosystemregnskap(nr: string): Promise<Okosystemregnskap> {
  const [F, E] = await Promise.all([katalog.gull.okosystemfordeling(nr), katalog.gull.bebygdEndring(nr)]);
  return {
    fra: E.fra,
    til: E.til,
    syntetisk: F.syntetisk || E.syntetisk,
    kilde: F.kilde,
    endret: E.endret,
    rader: byggRegnskap(F.klasser, E.klasser)
  };
}

/* De to tabellene for alle kommunene i Norge, lest som for én kommune, og summen for Norge. Summen av endringen tar bare med
   kommunene som kan sammenlignes (sammenlignbare): alle unntatt de der årene ikke kan sammenlignes (endret i solv.okosystemendring). */
export interface KommuneISum {
  nr: string;
  endret: boolean;
  flyttet: boolean;
  fordeling: Fordelingsrad[];
  endring: Endringsrad[];
}
export interface OkosystemerNorge {
  fra: string;
  til: string;
  syntetisk: boolean;
  kilde: string;
  kommuner: KommuneISum[];
  sammenlignbare: number;
  norge: { fordeling: Fordelingsrad[]; endring: Endringsrad[] };
}
/* Uten tall for endringen for en kommune: ingen endring, og årene kan ikke sammenlignes */
const UTEN_ENDRING: Kommuneendring = { tilBebygd: {}, fraBebygd: {}, endret: true, flyttet: false, uforklart: 0 };
export function byggNorge(A: Okosystemareal, E: Okosystemendring): OkosystemerNorge {
  const kommuner = Object.keys(A.kommuner)
      .sort((a, b) => a.localeCompare(b))
      .map((nr): KommuneISum => {
        const K = E.kommuner[nr] || UTEN_ENDRING;
        return {
          nr,
          endret: K.endret,
          flyttet: K.flyttet,
          fordeling: fordelingAv(A.kommuner[nr]),
          endring: endringAv(K)
        };
      }),
    med = kommuner.filter(k => !k.endret);
  return {
    fra: E.fra,
    til: E.til,
    syntetisk: A.syntetisk || E.syntetisk,
    kilde: A.kilde,
    kommuner,
    sammenlignbare: med.length,
    norge: {
      fordeling: HOVEDOKOSYSTEMER.map((h, i) => ({
        ...h,
        km2: tiDekar(summen(kommuner.map(k => k.fordeling[i].km2)))
      })),
      endring: endringAv(UTEN_ENDRING).map((h, i) => ({
        ...h,
        tilBebygd: tiDekar(summen(med.map(k => k.endring[i].tilBebygd))),
        fraBebygd: tiDekar(summen(med.map(k => k.endring[i].fraBebygd)))
      }))
    }
  };
}
/* Tabellen gull.okosystemerNorge: de to tabellene fra SSB for alle kommunene (solv.okosystemareal og solv.okosystemendring) */
export async function okosystemerNorge(): Promise<OkosystemerNorge> {
  const [A, E] = await Promise.all([katalog.solv.okosystemareal(), katalog.solv.okosystemendring()]);
  return byggNorge(A, E);
}

/* Plassen til kommunen blant kommunene som kan sammenlignes, der 1 er den som bygget ned mest: etter arealet (plass) og etter andelen
   av arealet i 2017 (plassAndel), av antall kommuner (av). Plassen er null når kommunen ikke kan sammenlignes. */
export interface Plassering {
  km2: number;
  andel: number | null;
  plass: number | null;
  plassAndel: number | null;
  av: number;
}
/* Andelen av landarealet i kommunen og i Norge */
export interface Andeler {
  kommune: number | null;
  norge: number | null;
}
/* Kommunen sammenlignet med resten av Norge: andelen av naturen som er bygget ned i Norge (naturtap, med snittet for en kommune),
   andelen av naturen som er bygget ned i kommunen og i Norge (natur), plassen for jordbruk og våtmark som er bygget ned, og skog og
   våtmark som andel av landarealet */
export interface Sammenligning {
  fra: string;
  til: string;
  syntetisk: boolean;
  kilde: string;
  endret: boolean;
  naturtap: { km2: number; andelAvNorge: number | null; snitt: number };
  natur: Andeler;
  jordbruk: Plassering;
  vatmark: Plassering;
  skog: Andeler;
  vatmarkAreal: Andeler;
}
export function byggSammenligning(N: OkosystemerNorge, nr: string): Sammenligning | null {
  const k = N.kommuner.find(x => x.nr === nr);
  if (!k) return null;
  const ned = (x: { fordeling: Fordelingsrad[]; endring: Endringsrad[] }) => byggNedbygging(x.fordeling, x.endring),
    med = N.kommuner.filter(x => !x.endret).map(x => ({ nr: x.nr, n: ned(x) })),
    egen = ned(k),
    norge = ned(N.norge),
    /* plassen etter verdien v, der den største er 1 */
    plass = (v: (n: ReturnType<typeof ned>) => number | null) => {
      const min = v(egen);
      if (k.endret || min === null) return null;
      return 1 + med.filter(x => x.nr !== nr && (v(x.n) || 0) > min).length;
    },
    plassering = (v: (n: ReturnType<typeof ned>) => { nedbygd: number; andel: number | null }): Plassering => ({
      km2: v(egen).nedbygd,
      andel: v(egen).andel,
      plass: plass(n => v(n).nedbygd),
      plassAndel: plass(n => v(n).andel),
      av: med.length
    }),
    vat = (n: ReturnType<typeof ned>) => n.rader.find(r => r.kode === 'vatmark')!,
    landandel = (F: Fordelingsrad[], kode: string) =>
      andel(
        (F.find(r => r.kode === kode) || { km2: 0 }).km2,
        summen(F.filter(r => LAND.includes(r.gruppe)).map(r => r.km2))
      ),
    sumNorge = norge.natur.nedbygd;
  return {
    fra: N.fra,
    til: N.til,
    syntetisk: N.syntetisk,
    kilde: N.kilde,
    endret: k.endret,
    naturtap: {
      km2: egen.natur.nedbygd,
      andelAvNorge: !k.endret && sumNorge > 0 ? (egen.natur.nedbygd / sumNorge) * 100 : null,
      snitt: med.length ? 100 / med.length : 0
    },
    natur: { kommune: egen.natur.andel, norge: norge.natur.andel },
    jordbruk: plassering(n => n.jordbruk),
    vatmark: plassering(vat),
    skog: { kommune: landandel(k.fordeling, 'skog'), norge: landandel(N.norge.fordeling, 'skog') },
    vatmarkAreal: { kommune: landandel(k.fordeling, 'vatmark'), norge: landandel(N.norge.fordeling, 'vatmark') }
  };
}
/* Tabellen gull.sammenligning: kommunen sammenlignet med resten av Norge, fra de syntetiske tabellene for alle kommunene */
export async function sammenligning(nr: string): Promise<Sammenligning | null> {
  return byggSammenligning(await katalog.gull.okosystemerNorge(), nr);
}
