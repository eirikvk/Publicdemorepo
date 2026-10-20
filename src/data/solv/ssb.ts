/* Sølv for SSB, tabell 09594: tolkingen av arealstatistikken, som bare brukes til å lage de syntetiske tallene for naturregnskapet
   (solv/naturregnskap.ts). Ingen tall på sidene kommer fra den direkte. Svaret (JSON-stat 2.0) for alle kommunene gjøres om til
   arealet i km² for hver av SSBs arealklasser i hvert år, per kommune. */
import { summen } from '../generelt/tall.ts';
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
/* Tolker svaret med arealklassene for alle kommunene (bronse.arealAlle): én Arealdetaljer per kommune.
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
/* Svaret for alle kommunene som Arealdetaljer etter kommunenummer */
export const perKommune = (j: JsonStat): Record<string, Arealdetaljer> =>
  Object.fromEntries(tolkDetaljerAlle(j).map(D => [D.nr, D]));
