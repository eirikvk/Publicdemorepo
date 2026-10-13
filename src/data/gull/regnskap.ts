/* Gull for utbredelsesregnskapet og land og vann: det siden viser om arealet i kommunen, regnet ut fra SSB-tallene i sølv. Klassene
   står med natur først. Alle arealer er i km². */
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { HAV_MIN_ANDEL, HAV_MIN_KM2 } from '../solv/felles.ts';
import { KL, type KlasseId } from '../solv/klasser.ts';
import { erSkogSSB, type Arealdetaljer, type Historie } from '../solv/ssb.ts';
import { andel } from './felles.ts';

/* Tallene fra SSB for valgt kommune, så langt de er hentet: arealet per klasse (bebygd, jordbruk, natur) i km² og året */
export interface SsbTall {
  tilstand: 'henter' | 'feil' | 'ok';
  a?: number[];
  aar?: string;
}

/* Klassene med natur først, med plassen i SSB-tallene (bebygd, jordbruk, natur) */
const KLASSER = KL.map(([id, navn], i): [KlasseId, string, number] => [id, navn, i]).reverse();

/* Utbredelsen i nyeste år: landarealet, og arealet og andelen av landarealet for hver klasse. T er SSB-tallene fra sølv. */
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

/* Forskjellen fra 2017 til nyeste år for hver klasse. H er arealet i begge årene fra sølv. Er grensen flyttet, gis bare årene.
   maks er den største forskjellen, til stolpene. */
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

/* Forskjellen fra 2017, slik byggEndring gir den: endret er true når tallene ikke kan sammenlignes */
export type Endring = NonNullable<ReturnType<typeof byggEndring>>;

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

/* Tabellene gull.utbredelse, gull.endring, gull.oppstilling og gull.landOgVann for kommunen nr */
export type Utbredelse = NonNullable<ReturnType<typeof byggUtbredelse>>;
export async function utbredelse(nr: string): Promise<Utbredelse> {
  const T = await katalog.solv.arealtall(nr);
  return byggUtbredelse({ tilstand: 'ok', a: T.a, aar: T.aar })!;
}
export async function endring(nr: string): Promise<Endring | null> {
  return byggEndring(await katalog.solv.historie(nr));
}
export async function oppstilling(nr: string): Promise<ReturnType<typeof byggOppstilling>> {
  return byggOppstilling(await katalog.solv.historie(nr));
}
export async function landOgVann(nr: string): Promise<ReturnType<typeof byggLandOgVann>> {
  const [g, T] = await Promise.all([katalog.solv.grense(nr), katalog.solv.arealtall(nr)]);
  return byggLandOgVann(g.km2, T.land, T.ferskvann);
}

/* Kortene på oversikten i tvillingen: hver klasse (natur, jordbruk, bebygd) med arealet og andelen i nyeste år, og forskjellen fra
   2017 i km² og i prosent av arealet i 2017. Forskjellen er null når tallene ikke kan sammenlignes. */
export interface Klassekort {
  id: KlasseId;
  navn: string;
  km2: number;
  andel: number;
  endring: number | null;
  pst: number | null;
}
/* Tabellen gull.oversiktKort: kortene for kommunen nr, av gull.utbredelse og gull.endring */
export async function oversiktKort(
  nr: string
): Promise<{ fra: string | null; til: string | null; klasser: Klassekort[] }> {
  const [U, E] = await Promise.all([katalog.gull.utbredelse(nr), katalog.gull.endring(nr).catch(() => null)]),
    e = E && !E.endret ? E : null;
  return {
    fra: e ? e.fra : null,
    til: e ? e.til : null,
    klasser: U.klasser.map(k => {
      const d = e ? e.klasser.find(x => x.id === k.id) : null;
      return { ...k, endring: d ? d.km2 : null, pst: d ? andel(d.km2, k.km2 - d.km2) : null };
    })
  };
}

/* En arealklasse hos SSB i nyeste år og i 2017: arealet, arealet i 2017 (fra), forskjellen, og forskjellen i prosent av 2017 */
export interface Klasserad {
  navn: string;
  km2: number;
  fra: number;
  endring: number;
  pst: number | null;
}
const arealI = (D: Arealdetaljer, passer: (k: Arealdetaljer['klasser'][number]) => boolean, i: number) =>
  summen(D.klasser.filter(passer).map(k => k.km2[i]));
/* Tabellen gull.arealPerKlasse: arealet på land per arealklasse hos SSB for kommunen nr (solv.arealdetaljer), i nyeste år og i
   2017. Bebygd og skog er slått sammen, de andre klassene står hver for seg. Klasser uten areal i noen av årene er ikke med. Størst
   først. SSB skriver at forskjellen mellom årgangene ikke er målt endring. */
export async function arealPerKlasse(nr: string): Promise<{ fra: string; til: string; rader: Klasserad[] }> {
  const D = await katalog.solv.arealdetaljer(nr),
    n = D.aar.length - 1,
    grupper: [string, (k: Arealdetaljer['klasser'][number]) => boolean][] = [
      ['Bebygd og opparbeidet areal', k => k.klasse === 'beb'],
      ...D.klasser
        .filter(k => k.klasse !== 'beb' && k.klasse !== 'vann' && !erSkogSSB(k))
        .map((k): [string, (x: Arealdetaljer['klasser'][number]) => boolean] => [k.navn, x => x.kode === k.kode]),
      ['Skog', erSkogSSB]
    ];
  const rader = grupper
    .map(([navn, f]) => {
      const km2 = arealI(D, f, n),
        fra = arealI(D, f, 0);
      return { navn, km2, fra, endring: km2 - fra, pst: andel(km2 - fra, fra) };
    })
    .filter(r => r.km2 > 0 || r.fra > 0)
    .sort((a, b) => b.km2 - a.km2);
  return { fra: D.aar[0], til: D.aar[n], rader };
}
/* Tabellen gull.bebygdOkning: de tre bebygde arealklassene hos SSB som økte mest fra 2017 til nyeste år, uten uklassifisert
   bebyggelse, med økningen i km². Tom når ingen økte. */
export async function bebygdOkning(
  nr: string
): Promise<{ fra: string; til: string; klasser: { navn: string; km2: number }[] }> {
  const D = await katalog.solv.arealdetaljer(nr),
    n = D.aar.length - 1;
  return {
    fra: D.aar[0],
    til: D.aar[n],
    klasser: D.klasser
      .filter(k => k.klasse === 'beb' && k.kode !== '14')
      .map(k => ({ navn: k.navn, km2: k.km2[n] - k.km2[0] }))
      .filter(k => k.km2 > 0.0005)
      .sort((a, b) => b.km2 - a.km2)
      .slice(0, 3)
  };
}
