/* Sølv for SSB, tabell 09594: svarene (JSON-stat 2.0) gjort om til arealet i km² per klasse (bebygd, jordbruk, natur), med innsjø og
   elv for seg, for nyeste år og for 2017. */
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { GRENSE_FLYTTET } from './felles.ts';
import { KL } from './klasser.ts';

/* Svaret fra SSB i JSON-stat 2.0, så langt siden bruker det */
type Indeks = string[] | Record<string, number>;
export interface JsonStat {
  dimension: Record<string, { category: { index: Indeks } }>;
  value: number[];
}
/* Arealet i nyeste år: per klasse på land i km² (bebygd, jordbruk, natur), landarealet, året, og innsjø og elv */
export interface Arealtall {
  a: number[];
  land: number;
  aar: string;
  ferskvann: { inn: number; elv: number };
}
/* Arealet per klasse i 2017 (a0) og i nyeste år (a1), og om grensen er flyttet (endret) */
export interface Historie {
  nr: string;
  fra: string;
  til: string;
  a0: number[];
  a1: number[];
  endret: boolean;
}

/* Rekkefølgen på kategoriene i en dimensjon. SSB gir indeksen enten som liste eller som objekt med plass. */
const liste = (x: Indeks): string[] => (Array.isArray(x) ? x : Object.keys(x).sort((a, b) => x[a] - x[b]));

/* Arealet per klasse i nyeste år: SSBs arealklasser summert til bebygd, jordbruk og natur (se KL), landarealet (summen av de tre),
   og innsjø og elv for seg. */
export function tolkAreal(j: JsonStat): Arealtall {
  const ix = j.dimension.ArealKlasse.category.index,
    tid = j.dimension.Tid.category.index;
  const pos: Record<string, number> = Array.isArray(ix) ? Object.fromEntries(ix.map((c, i) => [c, i])) : ix,
    a = KL.map(x => summen(x[3].map(c => j.value[pos[c]] || 0)));
  return {
    a,
    land: summen(a),
    aar: Array.isArray(tid) ? tid[0] : Object.keys(tid)[0],
    ferskvann: { inn: j.value[pos['22.01']] || 0, elv: j.value[pos['22.02']] || 0 }
  };
}

/* Arealet per klasse i 2017 (a0) og i nyeste år (a1), til utbredelsesregnskapet. Gir ingenting hvis serien ikke rekker tilbake til
   2017. endret sier at kommunens samlede areal er så forskjellig at grensen trolig er flyttet, og da skal årgangene ikke
   sammenlignes. */
export function tolkHistorie(j: JsonStat, nr: string): Historie | null {
  const kl = liste(j.dimension.ArealKlasse.category.index),
    aar = liste(j.dimension.Tid.category.index),
    nT = aar.length;
  const v = (c: string, t: number) => j.value[kl.indexOf(c) * nT + t] || 0,
    klasser = (t: number) => KL.map(x => summen(x[3].map(c => v(c, t)))),
    alt = (t: number) => summen(klasser(t)) + v('22.01', t) + v('22.02', t);
  const f = aar.indexOf('2017');
  if (f < 0 || nT - f < 2 || !alt(f) || !alt(nT - 1)) return null;
  return {
    nr,
    fra: aar[f],
    til: aar[nT - 1],
    a0: klasser(f),
    a1: klasser(nT - 1),
    endret: Math.abs(alt(nT - 1) - alt(f)) / alt(nT - 1) > GRENSE_FLYTTET
  };
}

/* SSBs arealklasser hver for seg, slik tabell 09594 har dem: [kode, navn, klassen den regnes til (bebygd, jordbruk, natur eller vann)].
   Bebygd per formål, jordbruk som fulldyrka og ikke fulldyrka, skog per treslag og resten av naturen per klasse. Summert gir de det
   samme som KL og VANN. Navnene står som hos SSB. */
export const DETALJER: [kode: string, navn: string, klasse: 'beb' | 'jor' | 'nat' | 'vann'][] = [
  ['01', 'Boligbebyggelse', 'beb'],
  ['02', 'Fritidsbebyggelse', 'beb'],
  ['03', 'Bebygd område for landbruk og fiske', 'beb'],
  ['04', 'Næring, offentlig og privat tjenesteyting', 'beb'],
  ['05', 'Undervisning og barnehage', 'beb'],
  ['06', 'Helse- og sosialinstitusjoner', 'beb'],
  ['07', 'Kultur og religiøse aktiviteter', 'beb'],
  ['08-09', 'Transport, telekommunikasjon og teknisk infrastruktur', 'beb'],
  ['10-11', 'Beredskapstjenester og Forsvaret', 'beb'],
  ['12-13', 'Grønne områder, idretts- og sportsområder', 'beb'],
  ['14', 'Uklassifisert bebyggelse og anlegg', 'beb'],
  ['15', 'Fulldyrka jord', 'jor'],
  ['16', 'Ikke fulldyrka jord', 'jor'],
  ['17.01', 'Barskog', 'nat'],
  ['17.02', 'Blandingsskog', 'nat'],
  ['17.03', 'Lauvskog', 'nat'],
  ['17.04', 'Uklassifisert skog', 'nat'],
  ['18', 'Åpen fastmark', 'nat'],
  ['19', 'Åpen myr', 'nat'],
  ['20', 'Bart fjell, grus- og blokkmark', 'nat'],
  ['21', 'Varig snø, is og bre', 'nat'],
  ['24', 'Uklassifisert ubebygd område', 'nat'],
  ['22.01', 'Innsjø og tjern', 'vann'],
  ['22.02', 'Elv', 'vann']
];
/* Arealet i km² for hver arealklasse (DETALJER) i hvert år fra 2017 (aar), og om grensen trolig er flyttet i perioden (endret) */
/* Skog hos SSB: arealklassene 17.01–17.04 (barskog, blandingsskog, lauvskog og skog med ukjent treslag) */
export const erSkogSSB = (k: { kode: string }) => k.kode.startsWith('17.');
export interface Arealdetaljer {
  nr: string;
  aar: string[];
  klasser: { kode: string; navn: string; klasse: string; km2: number[] }[];
  endret: boolean;
}
/* Tolker svaret med arealklassene hver for seg. Årene før 2017 tas bort (det eldre API-et gir alle år). Mangler en klasse, er den 0. */
export function tolkDetaljer(j: JsonStat, nr: string): Arealdetaljer {
  const kl = liste(j.dimension.ArealKlasse.category.index),
    alle = liste(j.dimension.Tid.category.index),
    nT = alle.length,
    f = Math.max(0, alle.indexOf('2017')),
    aar = alle.slice(f);
  const klasser = DETALJER.map(([kode, navn, klasse]) => {
    const i = kl.indexOf(kode);
    return { kode, navn, klasse, km2: aar.map((_, t) => (i < 0 ? 0 : j.value[i * nT + f + t] || 0)) };
  });
  const alt = (t: number) => summen(klasser.map(k => k.km2[t])),
    n = aar.length;
  return {
    nr,
    aar,
    klasser,
    endret: n > 1 && alt(n - 1) > 0 && Math.abs(alt(n - 1) - alt(0)) / alt(n - 1) > GRENSE_FLYTTET
  };
}

/* Tabellen solv.arealtall: arealet per klasse fra SSB i nyeste år, med landareal, innsjø og elv */
export async function arealtall(nr: string): Promise<Arealtall> {
  return tolkAreal(await katalog.bronse.arealtall(nr));
}
/* Tabellen solv.historie: arealet per klasse i 2017 og i nyeste år, eller null når serien ikke rekker så langt */
export async function historie(nr: string): Promise<Historie | null> {
  return tolkHistorie(await katalog.bronse.arealtidsserie(nr), nr);
}
/* Tabellen solv.arealdetaljer: arealet per arealklasse hos SSB, hver for seg, i hvert år fra 2017 */
export async function arealdetaljer(nr: string): Promise<Arealdetaljer> {
  return tolkDetaljer(await katalog.bronse.arealdetaljer(nr), nr);
}
