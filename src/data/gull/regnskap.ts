/* Gull for utbredelsesregnskapet og land og vann på hovedsiden: det siden viser om arealet i kommunen, regnet ut fra SSBs tabeller
   for naturregnskapet (gull.okosystemfordeling og gull.bebygdEndring, fra sølv), som er den eneste kilden til SSB-tall. Til SSB
   publiserer dem, er de syntetiske, og feltet syntetisk følger tallene. Klassene står med natur først. Alle arealer er i km². */
import { summen, tiDekar } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { HAV_MIN_ANDEL, HAV_MIN_KM2 } from '../solv/felles.ts';
import { KL, type KlasseId } from '../solv/klasser.ts';
import { byggHovedklasser, type BebygdEndring, type Okosystemfordeling } from './naturregnskap.ts';

/* SSB-tallene for ett år: arealet per klasse på land (a: bebygd, jordbruk, natur) i km², landarealet, året, og innsjø og elv */
export interface Klasseareal {
  a: number[];
  land: number;
  aar: string;
  ferskvann: { inn: number; elv: number };
}
/* Arealet per klasse ved start (a0) og slutt (a1) av perioden, og om årene ikke kan sammenlignes (endret) */
export interface Historie {
  nr: string;
  fra: string;
  til: string;
  a0: number[];
  a1: number[];
  endret: boolean;
}

/* Tallene fra SSB for valgt kommune, så langt de er hentet: arealet per klasse (bebygd, jordbruk, natur) i km² og året */
export interface SsbTall {
  tilstand: 'henter' | 'feil' | 'ok';
  a?: number[];
  aar?: string;
}

/* Klassene med natur først, med plassen i SSB-tallene (bebygd, jordbruk, natur) */
const KLASSER = KL.map(([id, navn], i): [KlasseId, string, number] => [id, navn, i]).reverse();

/* Utbredelsen i året for tallene: landarealet, og arealet og andelen av landarealet for hver klasse. T er SSB-tallene. */
export function byggUtbredelse(T: SsbTall | null) {
  if (!T || T.tilstand !== 'ok' || !T.a) return null;
  const a = T.a,
    land = summen(a);
  return {
    aar: T.aar,
    land,
    klasser: KLASSER.map(([id, navn, i]) => ({ id, navn, km2: a[i], andel: (a[i] / land) * 100 }))
  };
}

/* Forskjellen fra start til slutt av perioden for hver klasse. H er arealet i begge årene. Kan årene ikke sammenlignes, gis bare
   årene. maks er den største forskjellen, til stolpene. */
export function byggEndring(H: Historie | null) {
  if (!H) return null;
  if (H.endret) return { fra: H.fra, til: H.til, endret: true as const };
  const klasser = KLASSER.map(([id, navn, i]) => ({ id, navn, km2: H.a1[i] - H.a0[i] }));
  return {
    fra: H.fra,
    til: H.til,
    endret: false as const,
    klasser,
    maks: Math.max(...klasser.map(x => Math.abs(x.km2))) || 1
  };
}

/* Forskjellen fra 2017, slik byggEndring gir den: endret er true når tallene ikke kan sammenlignes. syntetisk sier at tallene er
   syntetiske, og flyttet at grensen er flyttet siden 2017, men at endringen er regnet likevel. */
export type Endring = NonNullable<ReturnType<typeof byggEndring>> & { syntetisk: boolean; flyttet: boolean };

/* Regnskapsoppstillingen: én kolonne per klasse og en sum, og radene inngående areal, netto endring og utgående areal. avvik er
   hvor mye landarealet er endret mellom årgangene, i hele dekar. */
export function byggOppstilling(H: Historie | null) {
  if (!H || H.endret) return null;
  const kol = (a: number[]) => [...KLASSER.map(([, , i]) => a[i]), summen(a)],
    a0 = kol(H.a0),
    a1 = kol(H.a1);
  return {
    fra: H.fra,
    til: H.til,
    kolonner: [...KLASSER.map(k => k[1]), 'Sum'],
    inngaende: a0,
    netto: a1.map((v, j) => v - a0[j]),
    utgaende: a1,
    avvik: Math.round((summen(H.a1) - summen(H.a0)) * 1000)
  };
}

/* Delene av kommunens flate: land og ferskvann fra SSB, og hav som det som blir igjen av flaten (fra kommunegrensen). En liten rest
   er avvik mellom grense og statistikk, ikke hav. flate og rest er med til forklaringen av tallene. */
export function byggLandOgVann(flate: number, land: number, ferskvann: { inn: number; elv: number } | null) {
  if (!land || !ferskvann || !flate) return null;
  const rest = flate - land - ferskvann.inn - ferskvann.elv,
    hav = rest < Math.max(HAV_MIN_KM2, flate * HAV_MIN_ANDEL) ? 0 : rest;
  return {
    flate,
    rest,
    hav,
    deler: (
      [
        ['land', 'Land', land],
        ['inn', 'Innsjø', ferskvann.inn],
        ['elv', 'Elv', ferskvann.elv],
        ['hav', 'Hav', hav]
      ] as [id: string, navn: string, km2: number][]
    ).filter(d => d[2] > 0)
  };
}

/* Arealet per økosystemtype (F) summert til klassene på land, i året for tabellen, med innsjø og elv */
export function klasseareal(F: Okosystemfordeling): Klasseareal {
  const a = KL.map(([id]) => tiDekar(summen(F.klasser.filter(r => r.gruppe === id).map(r => r.km2)))),
    km2 = (kode: string) => (F.klasser.find(r => r.kode === kode) || { km2: 0 }).km2;
  return {
    a,
    land: tiDekar(summen(a)),
    aar: F.aar,
    ferskvann: { inn: km2('innsjoerVannmagasiner'), elv: km2('elverBekkerKanaler') }
  };
}
/* Arealet per klasse ved start og slutt av perioden i SSBs tabell over endringen (E): ved slutt summert fra arealet per økosystemtype
   (F), og ved start det samme med det som gikk til og fra bebygd lagt tilbake (byggHovedklasser). Kan årene ikke sammenlignes, er
   endret true. */
export function historieAv(F: Okosystemfordeling, E: BebygdEndring): Historie {
  const K = byggHovedklasser(F.klasser, E.endret ? null : E.klasser),
    a1 = KL.map(([id]) => K.find(k => k.id === id)!.km2),
    a0 = KL.map(([id], i) => tiDekar(a1[i] - (K.find(k => k.id === id)!.endring || 0)));
  return { nr: F.kommune, fra: E.fra, til: E.til, a0, a1, endret: E.endret };
}

/* Tabellene gull.utbredelse, gull.endring, gull.oppstilling og gull.landOgVann for kommunen nr. syntetisk sier at tallene er
   syntetiske, og flyttet at grensen er flyttet siden 2017, men at endringen er regnet likevel. */
export type Utbredelse = NonNullable<ReturnType<typeof byggUtbredelse>> & { syntetisk: boolean };
export async function utbredelse(nr: string): Promise<Utbredelse> {
  const F = await katalog.gull.okosystemfordeling(nr),
    T = klasseareal(F);
  return { ...byggUtbredelse({ tilstand: 'ok', a: T.a, aar: T.aar })!, syntetisk: F.syntetisk };
}
export async function endring(nr: string): Promise<Endring | null> {
  const [F, E] = await Promise.all([katalog.gull.okosystemfordeling(nr), katalog.gull.bebygdEndring(nr)]),
    D = byggEndring(historieAv(F, E));
  return D && { ...D, syntetisk: F.syntetisk || E.syntetisk, flyttet: E.flyttet };
}
export type Oppstilling = NonNullable<ReturnType<typeof byggOppstilling>> & { syntetisk: boolean };
export async function oppstilling(nr: string): Promise<Oppstilling | null> {
  const [F, E] = await Promise.all([katalog.gull.okosystemfordeling(nr), katalog.gull.bebygdEndring(nr)]),
    O = byggOppstilling(historieAv(F, E));
  return O && { ...O, syntetisk: F.syntetisk || E.syntetisk };
}
export type LandOgVann = NonNullable<ReturnType<typeof byggLandOgVann>> & { syntetisk: boolean };
export async function landOgVann(nr: string): Promise<LandOgVann | null> {
  const [g, F] = await Promise.all([katalog.solv.grense(nr), katalog.gull.okosystemfordeling(nr)]),
    T = klasseareal(F),
    V = byggLandOgVann(g.km2, T.land, T.ferskvann);
  return V && { ...V, syntetisk: F.syntetisk };
}
