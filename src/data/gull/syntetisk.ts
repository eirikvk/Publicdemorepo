/* Gull, syntetiske tabeller: to tabeller som står i stedet for SSBs tabeller for naturregnskapet til de publiseres (25. november
   2026), i samme form som dem: kommune, hovedøkosystem og år (eller periode), med areal i km². De lages av det siden alt henter, med
   faste tommelfingerregler, uten nye kall. Når SSBs tabeller kommer, hentes de i bronse og tolkes i sølv, og disse tabellene leser
   dem i stedet. Det som bygger på dem, endres ikke. Feltet syntetisk sier hvilke tall som er syntetiske, så sidene kan si det.

   1. Arealet per hovedøkosystem i 2024 (gull.okosystemfordeling). Bebygd, jordbruk, natur og vannet er grunnkartets areal
      (gull.grunnkartAreal). Jordbruket deles i dyrket mark og grasmark, og naturen i skog, hei og buskmark, lite vegetert mark og
      våtmark, etter andelene i SSBs arealklasser for 2024 med den faste nøkkelen (ssbTilHovedokosystem i solv/klasser.ts).
   2. Arealet mellom bebygd og hver av de andre landklassene fra 2017 til 2024 (gull.bebygdEndring), av SSBs arealklasser for de to
      årene med den samme nøkkelen og en grådig tommelfingerregel (byggEndring): økningen i bebygd tas først fra jordbruket, så langt
      det gikk ned, og resten fra naturen etter arealet. Arealet er tall for to år, ikke målte overganger, og SSB skriver at
      forskjellen mellom årgangene også kommer av bedre kartlegging. Det er et grovt anslag. */
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { ALLE, HOVEDOKOSYSTEMER, KL, ssbTilHovedokosystem, type KlasseId } from '../solv/klasser.ts';
import type { Arealdetaljer } from '../solv/ssb.ts';
import { andel, tiDekar } from './felles.ts';

/* Kilden til de syntetiske tallene, slik sidene skal oppgi den */
export const SYNTETISK =
  'Syntetiske tall laget av grunnkartet og SSBs arealstatistikk, til SSBs tabeller for naturregnskapet kommer 25. november 2026.';

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
/* Fordelingen: grunnkart er arealet i km² per klasse i ALLE (bebygd, jordbruk, natur, hav, innsjø, elv), D SSBs arealklasser og aar
   året andelene hentes fra. Har SSB ikke noe av en klasse, går hele arealet til den første typen i klassen (dyrket mark, skog). */
export function byggFordeling(grunnkart: number[], D: Arealdetaljer, aar: string): Fordelingsrad[] {
  const ssb = perHovedokosystem(D, aaret(D, aar));
  return HOVEDOKOSYSTEMER.map(h => {
    const g = grunnkart[ALLE.findIndex(([id]) => id === h.gruppe)] || 0;
    if (h.gruppe !== 'jor' && h.gruppe !== 'nat') return { ...h, km2: tiDekar(g) };
    const sosken = HOVEDOKOSYSTEMER.filter(x => x.gruppe === h.gruppe),
      sum = summen(sosken.map(x => ssb.get(x.kode) || 0));
    return { ...h, km2: tiDekar(sum > 0 ? (g * (ssb.get(h.kode) || 0)) / sum : h === sosken[0] ? g : 0) };
  });
}

/* Arealet mellom bebygd og én landklasse i perioden: fra klassen til bebygd, og fra bebygd til klassen */
export interface Endringsrad extends Hovedokosystem {
  tilBebygd: number;
  fraBebygd: number;
}
/* Endringen mellom bebygd og de andre landklassene fra året fra til året til, av SSBs arealklasser D, med en grådig
   tommelfingerregel:
   1. Økningen i bebygd tas først fra jordbruket (dyrket mark og grasmark), så langt hver av dem gikk ned. Jordbruksarealet er godt
      kartlagt, og når det går ned, er det for det meste fordi det bygges ned.
   2. Resten tas fra naturen, fordelt etter arealet hver naturklasse hadde ved start. Endringene i naturklassene hos SSB kommer mest
      av bedre kartlegging (i Trondheim gikk åpen myr ned og skog opp), så de brukes ikke.
   Gikk bebygd ned, føres nedgangen tilbake til naturen etter arealet. Gir radene, årene som er brukt, og det som ikke kunne fordeles
   (uforklart, km²), som bare er noe når kommunen ikke har natur hos SSB. */
export function byggEndring(D: Arealdetaljer, fra: string, til: string) {
  const i0 = aaret(D, fra),
    i1 = aaret(D, til),
    a0 = perHovedokosystem(D, i0),
    a1 = perHovedokosystem(D, i1),
    land = HOVEDOKOSYSTEMER.filter(h => h.gruppe === 'jor' || h.gruppe === 'nat'),
    endring = (kode: string) => (a1.get(kode) || 0) - (a0.get(kode) || 0),
    dB = endring('bebygdOpparbeidetAreal'),
    tilB = new Map<string, number>(),
    fraB = new Map<string, number>();
  let rest = Math.abs(dB);
  if (dB > 0)
    for (const h of land.filter(x => x.gruppe === 'jor')) {
      const v = Math.min(rest, Math.max(0, -endring(h.kode)));
      tilB.set(h.kode, v);
      rest -= v;
    }
  const natur = land.filter(h => h.gruppe === 'nat'),
    naturAreal = summen(natur.map(h => a0.get(h.kode) || 0));
  if (rest > 0 && naturAreal > 0) {
    natur.forEach(h => (dB > 0 ? tilB : fraB).set(h.kode, (rest * (a0.get(h.kode) || 0)) / naturAreal));
    rest = 0;
  }
  return {
    fra: D.aar[i0],
    til: D.aar[i1],
    klasser: land.map((h): Endringsrad => ({
      ...h,
      tilBebygd: tiDekar(tilB.get(h.kode) || 0),
      fraBebygd: tiDekar(fraB.get(h.kode) || 0)
    })),
    uforklart: tiDekar(rest)
  };
}

/* Tabellen gull.okosystemfordeling: arealet per hovedøkosystem i kommunen i 2024, som SSBs tabell. delvis: bare den delen av
   kommunen som er hentet, er med. */
export interface Okosystemfordeling {
  kommune: string;
  aar: string;
  syntetisk: boolean;
  kilde: string;
  delvis: boolean;
  klasser: Fordelingsrad[];
}
export async function okosystemfordeling(nr: string): Promise<Okosystemfordeling | null> {
  const [G, D] = await Promise.all([katalog.gull.grunnkartAreal(nr), katalog.solv.arealdetaljer(nr)]);
  if (!G) return null;
  return {
    kommune: nr,
    aar: '2024',
    syntetisk: true,
    kilde: SYNTETISK,
    delvis: G.delvis,
    klasser: byggFordeling(G.km2, D, '2024')
  };
}
/* Tabellen gull.bebygdEndring: arealet mellom bebygd og hver av de andre landklassene i kommunen fra 2017 til 2024, som SSBs tabell.
   endret: kommunegrensen er flyttet, så årene kan ikke sammenlignes. */
export interface BebygdEndring {
  fra: string;
  til: string;
  klasser: Endringsrad[];
  uforklart: number;
  kommune: string;
  syntetisk: boolean;
  kilde: string;
  endret: boolean;
}
export async function bebygdEndring(nr: string): Promise<BebygdEndring> {
  const D = await katalog.solv.arealdetaljer(nr);
  return { kommune: nr, syntetisk: true, kilde: SYNTETISK, endret: D.endret, ...byggEndring(D, '2017', '2024') };
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
  delvis: boolean;
  klasser: (Hovedklasse & { navn: string })[];
}
export async function oversiktKort(nr: string): Promise<OversiktKort | null> {
  const [F, E] = await Promise.all([katalog.gull.okosystemfordeling(nr), katalog.gull.bebygdEndring(nr)]);
  if (!F) return null;
  const sammenlign = !E.endret,
    K = byggHovedklasser(F.klasser, sammenlign ? E.klasser : null),
    navn = (id: KlasseId) => KL.find(k => k[0] === id)![1];
  return {
    fra: sammenlign ? E.fra : null,
    til: sammenlign ? E.til : null,
    syntetisk: F.syntetisk || E.syntetisk,
    kilde: SYNTETISK,
    delvis: F.delvis,
    klasser: (['nat', 'jor', 'beb'] as KlasseId[]).map(id => ({ ...K.find(k => k.id === id)!, navn: navn(id) }))
  };
}

/* Tabellen gull.nedbygging: hvor mye av hver landklasse som ble bygget ned fra 2017 til 2024, med arealet i 2024 og andelen av
   arealet i 2017, og summen for natur og jordbruk. Arealet i 2017 er arealet i 2024 med det som gikk til og fra bebygd lagt tilbake. */
export interface Nedbygging {
  fra: string;
  til: string;
  syntetisk: boolean;
  kilde: string;
  endret: boolean;
  delvis: boolean;
  rader: { kode: string; navn: string; gruppe: KlasseId; km2: number; nedbygd: number; andel: number | null }[];
  natur: { nedbygd: number; andel: number | null };
  jordbruk: { nedbygd: number; andel: number | null };
  uforklart: number;
}
export async function nedbygging(nr: string): Promise<Nedbygging | null> {
  const [F, E] = await Promise.all([katalog.gull.okosystemfordeling(nr), katalog.gull.bebygdEndring(nr)]);
  if (!F) return null;
  const rader = E.klasser.map(r => {
      const km2 = (F.klasser.find(x => x.kode === r.kode) || { km2: 0 }).km2;
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
        ned = summen(R.map(r => r.nedbygd));
      return { nedbygd: ned, andel: andel(ned, summen(R.map(r => r.km2)) + ned) };
    };
  return {
    fra: E.fra,
    til: E.til,
    syntetisk: F.syntetisk || E.syntetisk,
    kilde: SYNTETISK,
    endret: E.endret,
    delvis: F.delvis,
    rader,
    natur: sum('nat'),
    jordbruk: sum('jor'),
    uforklart: E.uforklart
  };
}
