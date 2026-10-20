/* Sølv for SSB, tabell 09594: datasettet «Arealtall fra SSB». Svarene (JSON-stat 2.0) gjort om til arealet i km² for hver av SSBs
   arealklasser i hvert år fra 2017, per kommune (solv.arealtall), og for alle kommunene i 2017 og 2024 (solv.arealdetaljerAlle,
   støttedata). Summene per klasse (bebygd, jordbruk, natur) og sammenligningen med 2017 regnes i gull (gull/felles.ts). */
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { GRENSE_FLYTTET } from './felles.ts';

/* Svaret fra SSB i JSON-stat 2.0, så langt siden bruker det */
type Indeks = string[] | Record<string, number>;
export interface JsonStat {
  id?: string[];
  size?: number[];
  dimension: Record<string, { category: { index: Indeks } }>;
  value: number[];
}
/* Rekkefølgen på kategoriene i en dimensjon. SSB gir indeksen enten som liste eller som objekt med plass. */
const liste = (x: Indeks): string[] => (Array.isArray(x) ? x : Object.keys(x).sort((a, b) => x[a] - x[b]));

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
export interface Arealdetaljer {
  nr: string;
  aar: string[];
  klasser: { kode: string; navn: string; klasse: string; km2: number[] }[];
  endret: boolean;
}
/* SSBs egne summer for jordbruk (fulldyrka og ikke fulldyrka jord) og skog, som hentes med klassene. Summene per klasse regnes med
   dem (KL i klasser.ts), fordi summen av klassene kan avvike med 10 dekar fra SSBs egen sum. */
export const SAMLET = ['15-16', '17'];
/* Arealtall fra SSB for én kommune: arealklassene hver for seg i hvert år fra 2017 (som Arealdetaljer), og SSBs egne summer for
   jordbruk og skog (samlet, per kode og år) */
export interface Arealtall extends Arealdetaljer {
  samlet: Record<string, number[]>;
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

/* Tolker svaret for én kommune (bronse.arealtall): arealklassene hver for seg, og SSBs egne summer */
export function tolkArealtall(j: JsonStat, nr: string): Arealtall {
  const D = tolkDetaljer(j, nr),
    kl = liste(j.dimension.ArealKlasse.category.index),
    alle = liste(j.dimension.Tid.category.index),
    nT = alle.length,
    f = Math.max(0, alle.indexOf('2017')),
    samlet = Object.fromEntries(
      SAMLET.map(kode => {
        const i = kl.indexOf(kode);
        return [kode, D.aar.map((_, t) => (i < 0 ? 0 : j.value[i * nT + f + t] || 0))];
      })
    );
  return { ...D, samlet };
}

/* Tolker svaret med arealklassene for alle kommunene (bronse.arealAlle): én Arealdetaljer per kommune, som tolkDetaljer gir for én.
   Regionene som ikke er kommuner (resten, Svalbard og sokkelen), er ikke med. */
export function tolkDetaljerAlle(j: JsonStat): Arealdetaljer[] {
  const R = liste(j.dimension.Region.category.index),
    K = liste(j.dimension.ArealKlasse.category.index),
    T = liste(j.dimension.Tid.category.index),
    ider = j.id || ['Region', 'ArealKlasse', 'ContentsCode', 'Tid'],
    str = j.size || ider.map(d => liste(j.dimension[d].category.index).length),
    /* plassen i value for region r, klasse k og år t, med ContentsCode fast */
    plass = (r: number, k: number, t: number) => {
      const p: Record<string, number> = { Region: r, ArealKlasse: k, ContentsCode: 0, Tid: t };
      return ider.reduce((o, d, i) => o * str[i] + (p[d] || 0), 0);
    };
  return R.flatMap((kode, r) => {
    const nr = /^K-(\d{4})$/.exec(kode);
    if (!nr) return [];
    const klasser = DETALJER.map(([k, navn, klasse]) => {
      const i = K.indexOf(k);
      return { kode: k, navn, klasse, km2: T.map((_, t) => (i < 0 ? 0 : j.value[plass(r, i, t)] || 0)) };
    });
    const alt = (t: number) => summen(klasser.map(k => k.km2[t])),
      n = T.length;
    return [
      {
        nr: nr[1],
        aar: T,
        klasser,
        endret: n > 1 && (!alt(0) || Math.abs(alt(n - 1) - alt(0)) / alt(n - 1) > GRENSE_FLYTTET)
      }
    ];
  });
}

/* Tabellen solv.arealtall: arealtallene fra SSB for kommunen nr, hver arealklasse i hvert år fra 2017, med SSBs egne summer */
export async function arealtall(nr: string): Promise<Arealtall> {
  return tolkArealtall(await katalog.bronse.arealtall(nr), nr);
}
/* Tabellen solv.arealdetaljerAlle: arealklassene hos SSB hver for seg i 2017 og 2024 for alle kommunene, etter kommunenummer */
export async function arealdetaljerAlle(): Promise<Record<string, Arealdetaljer>> {
  return Object.fromEntries(tolkDetaljerAlle(await katalog.bronse.arealAlle()).map(D => [D.nr, D]));
}
