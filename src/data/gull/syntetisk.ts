/* Gull, syntetiske tabeller: to tabeller som står i stedet for SSBs tabeller for naturregnskapet til de publiseres (25. november
   2026), i samme form som dem: kommune, hovedøkosystem og år (eller periode), med areal i km². De lages av SSBs arealstatistikk
   (tabell 09594) alene, med faste tommelfingerregler, så de kan lages for alle kommunene av ett kall til SSB. Når SSBs tabeller
   kommer, hentes de i bronse og tolkes i sølv, og disse tabellene leser dem i stedet. Det som bygger på dem, endres ikke. Feltet
   syntetisk sier hvilke tall som er syntetiske, så sidene kan si det. Tallene skal bare ha riktig størrelsesorden.

   1. Arealet per hovedøkosystem i 2024 (gull.okosystemfordeling, byggFordeling). SSBs arealklasser oversettes med den faste nøkkelen
      (ssbTilHovedokosystem i solv/klasser.ts). Havet er resten av kommunens flate (solv.kommuneareal) når land og ferskvann er
      trukket fra. Kyststrender, svaberg og dyner er en fast andel av havet (KYST_AV_HAV), tatt fra hei og buskmark og lite
      vegetert mark.
   2. Arealet mellom bebygd og hver av de andre landklassene fra 2017 til 2024 (gull.bebygdEndring, byggEndring), med en grådig
      tommelfingerregel: økningen i hver bebygd klasse hos SSB tas først fra jordbruket, så langt det gikk ned, og resten fra naturen
      etter arealet.
      Arealet er tall for to år, ikke målte overganger, og SSB skriver at forskjellen mellom årgangene også kommer av bedre
      kartlegging. Det er et grovt anslag.

   Av de to lages det tvillingen viser: kortene, nedbyggingen, regnskapet, og de samme tabellene for alle kommunene i Norge
   (gull.okosystemerNorge) med sammenligningen for kommunen (gull.sammenligning). */
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { HAV_MIN_ANDEL, HAV_MIN_KM2 } from '../solv/felles.ts';
import { HOVEDOKOSYSTEMER, KL, ssbTilHovedokosystem, type KlasseId } from '../solv/klasser.ts';
import type { Arealdetaljer } from '../solv/ssb.ts';
import { andel, tiDekar } from './felles.ts';

/* Kilden til de syntetiske tallene, slik sidene skal oppgi den */
export const SYNTETISK =
  'Syntetiske tall laget av SSBs arealstatistikk, til SSBs tabeller for naturregnskapet kommer 25. november 2026.';
/* Andelen av havet som regnes som kyststrender, svaberg og dyner. I grunnkartet for Trondheim er de 0,08 km² mot 187 km² hav
   (0,04 %). Med 0,1 % blir de rett størrelsesorden også der kysten er mer åpen. */
export const KYST_AV_HAV = 0.001;

/* Et hovedøkosystem i en tabell: koden i grunnkartet, navnet og klassen blant dagens seks */
type Hovedokosystem = (typeof HOVEDOKOSYSTEMER)[number];
const LAND: KlasseId[] = ['beb', 'jor', 'nat'];
/* Plassen til året aar i SSB-tallene, eller det siste året før, eller det siste året */
function aaret(D: Arealdetaljer, aar: string) {
  const i = D.aar.indexOf(aar);
  if (i >= 0) return i;
  const for_ = D.aar.filter(a => a < aar);
  return for_.length ? D.aar.indexOf(for_[for_.length - 1]) : D.aar.length - 1;
}
/* SSB-arealet per hovedøkosystem i året nummer i. Uklassifisert ubebygd område er ikke med. */
function perHovedokosystem(D: Arealdetaljer, i: number) {
  const m = new Map<string, number>();
  D.klasser.forEach(k => {
    const h = ssbTilHovedokosystem(k);
    if (h) m.set(h, (m.get(h) || 0) + k.km2[i]);
  });
  return m;
}

/* Arealet per hovedøkosystem i ett år */
export interface Fordelingsrad extends Hovedokosystem {
  km2: number;
}
/* Fordelingen i året aar av SSBs arealklasser D og kommunens flate i km² (land, ferskvann og hav). Havet er resten når land og
   ferskvann er trukket fra, og 0 når resten er så liten at den bare er avvik mellom grense og statistikk (som gull.landOgVann).
   Kyststrender, svaberg og dyner er KYST_AV_HAV av havet, tatt fra hei og buskmark og lite vegetert mark etter arealet. */
export function byggFordeling(D: Arealdetaljer, aar: string, flate: number): Fordelingsrad[] {
  const i = aaret(D, aar),
    a = perHovedokosystem(D, i),
    alt = summen(D.klasser.map(k => k.km2[i])),
    rest = flate - alt,
    hav = rest < Math.max(HAV_MIN_KM2, flate * HAV_MIN_ANDEL) ? 0 : rest,
    hei = a.get('heiBuskmark') || 0,
    lite = a.get('liteVegetertMark') || 0,
    kyst = Math.min(KYST_AV_HAV * hav, hei + lite),
    tatt = hei + lite > 0 ? kyst / (hei + lite) : 0;
  a.set('hav', hav);
  a.set('kyststrenderSvabergDyner', kyst);
  a.set('heiBuskmark', hei * (1 - tatt));
  a.set('liteVegetertMark', lite * (1 - tatt));
  return HOVEDOKOSYSTEMER.map(h => ({ ...h, km2: tiDekar(a.get(h.kode) || 0) }));
}

/* Arealet mellom bebygd og én landklasse i perioden: fra klassen til bebygd, og fra bebygd til klassen */
export interface Endringsrad extends Hovedokosystem {
  tilBebygd: number;
  fraBebygd: number;
}
/* Endringen mellom bebygd og de andre landklassene fra året fra til året til, av SSBs arealklasser D, med en grådig
   tommelfingerregel:
   1. Økningen i bebygd er summen av økningene i SSBs bebygde klasser (01–14) hver for seg. En nedgang i en bebygd klasse regnes som
      bedre kartlegging, ikke som at arealet blir natur igjen: på Røros gikk transport og fritidsboliger ned fra 2017 til 2024, så
      bebygd samlet gikk ned, selv om boliger og næring økte. Det bebygde arealet går derfor aldri tilbake (fraBebygd er 0).
   2. Økningen tas først fra jordbruket (dyrket mark og grasmark), så langt hver av dem gikk ned. Jordbruksarealet er godt kartlagt,
      og når det går ned, er det for det meste fordi det bygges ned.
   3. Resten tas fra naturen, fordelt etter arealet hver naturklasse hadde ved start. Endringene i naturklassene hos SSB kommer mest
      av bedre kartlegging (i Trondheim gikk åpen myr ned og skog opp), så de brukes ikke.
   Er kommunegrensen flyttet i perioden (D.endret), regnes endringen likevel (flyttet), og forskjellen i samlet areal regnes som natur
   og vann. Regelen bruker bare endringen i bebygd og jordbruk, og naturens andeler, så det gir riktig størrelsesorden når det som er
   lagt til eller tatt fra kommunen, mest er natur. (Å skalere arealet i 2017 til samme samlede areal ga for Stavanger, der skogen
   og innsjøene økte, nesten ingen økning i bebygd.) Det går ikke når kommunen ikke har noe areal ved start.
   Gir radene, årene som er brukt, om grensen er flyttet, og det som ikke kunne fordeles (uforklart, km²), som bare er noe når
   kommunen ikke har natur hos SSB. */
export function byggEndring(D: Arealdetaljer, fra: string, til: string) {
  const i0 = aaret(D, fra),
    i1 = aaret(D, til),
    flyttet = D.endret && summen(D.klasser.map(k => k.km2[i0])) > 0,
    a0 = perHovedokosystem(D, i0),
    a1 = perHovedokosystem(D, i1),
    land = HOVEDOKOSYSTEMER.filter(h => h.gruppe === 'jor' || h.gruppe === 'nat'),
    endring = (kode: string) => (a1.get(kode) || 0) - (a0.get(kode) || 0),
    okning = summen(D.klasser.filter(k => k.klasse === 'beb').map(k => Math.max(0, k.km2[i1] - k.km2[i0]))),
    tilB = new Map<string, number>();
  let rest = okning;
  for (const h of land.filter(x => x.gruppe === 'jor')) {
    const v = Math.min(rest, Math.max(0, -endring(h.kode)));
    tilB.set(h.kode, v);
    rest -= v;
  }
  const natur = land.filter(h => h.gruppe === 'nat'),
    naturAreal = summen(natur.map(h => a0.get(h.kode) || 0));
  if (rest > 0 && naturAreal > 0) {
    natur.forEach(h => tilB.set(h.kode, (rest * (a0.get(h.kode) || 0)) / naturAreal));
    rest = 0;
  }
  return {
    fra: D.aar[i0],
    til: D.aar[i1],
    klasser: land.map((h): Endringsrad => ({
      ...h,
      tilBebygd: tiDekar(tilB.get(h.kode) || 0),
      fraBebygd: 0
    })),
    uforklart: tiDekar(rest),
    flyttet
  };
}

/* Tabellen gull.okosystemfordeling: arealet per hovedøkosystem i kommunen i 2024, som SSBs tabell */
export interface Okosystemfordeling {
  kommune: string;
  aar: string;
  syntetisk: boolean;
  kilde: string;
  klasser: Fordelingsrad[];
}
export async function okosystemfordeling(nr: string): Promise<Okosystemfordeling> {
  const [D, F] = await Promise.all([katalog.solv.arealdetaljer(nr), katalog.solv.kommuneareal()]);
  return { kommune: nr, aar: '2024', syntetisk: true, kilde: SYNTETISK, klasser: byggFordeling(D, '2024', F[nr] || 0) };
}
/* Tabellen gull.bebygdEndring: arealet mellom bebygd og hver av de andre landklassene i kommunen fra 2017 til 2024, som SSBs tabell.
   endret: kommunegrensen er flyttet, og årene kan ikke sammenlignes. flyttet: grensen er flyttet, men endringen er regnet likevel. */
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
  const D = await katalog.solv.arealdetaljer(nr),
    E = byggEndring(D, '2017', '2024');
  return { kommune: nr, syntetisk: true, kilde: SYNTETISK, endret: D.endret && !E.flyttet, ...E };
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
    kilde: SYNTETISK,
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
    kilde: SYNTETISK,
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
    kilde: SYNTETISK,
    endret: E.endret,
    rader: byggRegnskap(F.klasser, E.klasser)
  };
}

/* De to tabellene for alle kommunene i Norge, laget på samme måte som for én kommune, og summen for Norge. Summen av endringen tar
   bare med kommunene som kan sammenlignes (sammenlignbare): alle unntatt de som ikke hadde noe areal i 2017, fordi grensen er
   flyttet (se byggEndring). */
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
export function byggNorge(alle: Record<string, Arealdetaljer>, flater: Record<string, number>): OkosystemerNorge {
  const kommuner = Object.values(alle)
      .sort((a, b) => a.nr.localeCompare(b.nr))
      .map((D): KommuneISum => {
        const E = byggEndring(D, '2017', '2024');
        return {
          nr: D.nr,
          endret: D.endret && !E.flyttet,
          flyttet: E.flyttet,
          fordeling: byggFordeling(D, '2024', flater[D.nr] || 0),
          endring: E.klasser
        };
      }),
    med = kommuner.filter(k => !k.endret),
    E0 = byggEndring(Object.values(alle)[0], '2017', '2024');
  return {
    fra: E0.fra,
    til: E0.til,
    syntetisk: true,
    kilde: SYNTETISK,
    kommuner,
    sammenlignbare: med.length,
    norge: {
      fordeling: HOVEDOKOSYSTEMER.map((h, i) => ({
        ...h,
        km2: tiDekar(summen(kommuner.map(k => k.fordeling[i].km2)))
      })),
      endring: E0.klasser.map((h, i) => ({
        ...h,
        tilBebygd: tiDekar(summen(med.map(k => k.endring[i].tilBebygd))),
        fraBebygd: tiDekar(summen(med.map(k => k.endring[i].fraBebygd)))
      }))
    }
  };
}
/* Tabellen gull.okosystemerNorge: de syntetiske tabellene for alle kommunene, av ett kall til SSB og flaten til kommunene */
export async function okosystemerNorge(): Promise<OkosystemerNorge> {
  const [A, F] = await Promise.all([katalog.solv.arealdetaljerAlle(), katalog.solv.kommuneareal()]);
  return byggNorge(A, F);
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
    kilde: SYNTETISK,
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
