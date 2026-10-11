/* Forklaringene bak tallene: hvert kort på sidene som viser tall, med spørsmålet det svarer på, en kort forklaring, tabellene i gull
   det viser, og regnestykket for valgt kommune. Infoknappen på kortet (komponenter/Tallforklaring.tsx) og kapitlene i METODE.md
   (verktoy/forklaringer.ts) lages av det samme: kortet her, og forklaringen, usikkerheten og kilden på tabellene i katalogen.
   Hvilke tabeller hver tabell bygger på, er lest ut av koden (data/avhengigheter.ts).
   Filen bruker verken React eller kartet, så verktøyet kan lese den i Node. Regnestykket lager ingen nye tall: det setter tallene
   fra gull inn i tekst. */
import { AVHENGIGHETER } from '../data/avhengigheter.ts';
import type { Tabell, Tabelldef } from '../data/cache.ts';
import { katalog } from '../data/katalog.ts';
import { dekar, medFortegn, nf } from './tekst.ts';

/* Henter verdien i en tabell i gull for valgt kommune, eller null når den ikke er klar */
export type Hent = <V>(t: Tabell<string, V>) => V | null;
/* Et kort: id (som id-en til overskriften), tittel, hvilket kapittel i METODE.md det står i (gruppe) og hvilken fil komponenten
   står i, spørsmålet, kort fortalt, tabellene i gull det viser, egne forbehold, og regnestykket for valgt kommune */
export interface Kort {
  id: string;
  tittel: string;
  gruppe: string;
  komponent: string;
  sporsmal: string;
  kortFortalt: string;
  tabeller: string[];
  usikkerhet?: string[];
  regnestykke: (hent: Hent) => string[] | null;
}

/* Tall i hele dekar, med fortegn for endringer */
const daa = (km2: number) => dekar(km2, 'dekar'),
  hele = (km2: number) => nf(Math.round(km2 * 1000), 0),
  pluss = (km2: number) => medFortegn(Math.round(km2 * 1000), v => nf(v, 0));

export const KORT: Kort[] = [
  {
    id: 'utbredelse',
    tittel: 'Utbredelsesregnskap',
    gruppe: 'ssb',
    komponent: 'src/ui/komponenter/Regnskap.tsx',
    sporsmal: 'Hvor mye natur, jordbruk og bebygd areal har kommunen, og er det mer eller mindre natur enn i 2017?',
    kortFortalt:
      'Tallene er SSBs arealstatistikk. Natur, jordbruk og bebygd areal er SSBs arealklasser slått sammen til tre, og andelen er regnet av landarealet. Forskjellen fra 2017 er forskjellen mellom to årganger av statistikken, ikke målt endring.',
    tabeller: ['gull.utbredelse', 'gull.endring', 'gull.oppstilling'],
    regnestykke: hent => {
      const U = hent(katalog.gull.utbredelse);
      if (!U) return null;
      const k = (id: string) => U.klasser.find(x => x.id === id)!,
        n = k('nat');
      const linjer = [
        `Landarealet i ${U.aar} er ${daa(U.land)}: bebygd ${hele(k('beb').km2)}, jordbruk ${hele(k('jor').km2)} og natur ${hele(n.km2)} dekar.`,
        `Natur er ${hele(n.km2)} av ${hele(U.land)} dekar, altså ${nf(n.andel)}\u00a0% av landarealet.`
      ];
      const O = hent(katalog.gull.oppstilling);
      if (O)
        linjer.push(
          `Natur var ${hele(O.inngaende[0])} dekar i ${O.fra} og ${hele(O.utgaende[0])} dekar i ${O.til}. Forskjellen er ${pluss(O.netto[0])} dekar.`
        );
      return linjer;
    }
  },
  {
    id: 'oppstilling',
    tittel: 'Regnskapsoppstilling',
    gruppe: 'ssb',
    komponent: 'src/ui/komponenter/Regnskap.tsx',
    sporsmal: 'Hvor mye areal hadde hver klasse i 2017 og nå, satt opp som et regnskap?',
    kortFortalt:
      'Regnskapet følger mønsteret fra FNs standard for naturregnskap (SEEA EA): areal ved start, netto endring og areal ved slutt. Tallene er SSBs arealstatistikk for 2017 og nyeste år.',
    tabeller: ['gull.oppstilling'],
    usikkerhet: [
      'Planlagt utbygging er ikke med i regnskapet, som viser arealet fram til i dag. Den omtales under regnskapet.'
    ],
    regnestykke: hent => {
      const O = hent(katalog.gull.oppstilling);
      if (!O) return null;
      const linjer = O.kolonner.map(
        (navn, j) =>
          `${navn}: ${hele(O.inngaende[j])} ${O.netto[j] < 0 ? '−' : '+'} ${hele(Math.abs(O.netto[j]))} = ${hele(O.utgaende[j])} dekar.`
      );
      if (O.avvik)
        linjer.push(
          `Landarealet er ${nf(Math.abs(O.avvik), 0)} dekar ${O.avvik > 0 ? 'større' : 'mindre'} i ${O.til}.`
        );
      return linjer;
    }
  },
  {
    id: 'landOgVann',
    tittel: 'Land og vann',
    gruppe: 'ssb',
    komponent: 'src/ui/komponenter/Regnskap.tsx',
    sporsmal: 'Hvordan fordeler kommunens flate seg på land, innsjø, elv og hav?',
    kortFortalt:
      'Land, innsjø og elv er SSBs tall. Hav er det som blir igjen når de trekkes fra kommunens flate, som er arealet innenfor kommunegrensen fra Kartverket.',
    tabeller: ['gull.landOgVann'],
    regnestykke: hent => {
      const V = hent(katalog.gull.landOgVann);
      if (!V) return null;
      const del = (id: string) => (V.deler.find(d => d[0] === id) || [0, 0, 0])[2];
      return [
        `Kommunens flate er ${daa(V.flate)}.`,
        `Land ${hele(del('land'))}, innsjø ${hele(del('inn'))} og elv ${hele(del('elv'))} dekar er SSBs tall.`,
        V.hav
          ? `Hav er det som blir igjen: ${daa(V.hav)}.`
          : `Det som blir igjen, ${daa(V.rest)}, er under grensen på 0,5 km² eller 0,5 % av flaten. Det regnes som avvik mellom grense og statistikk, og kommunen vises uten hav.`
      ];
    }
  }
];

/* Tabellen med det fulle navnet (som solv.arealtall) */
const LAG = ['bronse', 'solv', 'gull'] as const;
export function tabellen(navn: string): Tabelldef<unknown, unknown> {
  const [lag, t] = navn.split('.') as [(typeof LAG)[number], string];
  return (katalog[lag] as unknown as Record<string, Tabelldef<unknown, unknown>>)[t];
}
/* Stegene fra kilde til tall for kortet: tabellene i gull og alt de bygger på, kildene først, så sølv og gull. Innenfor hvert lag i
   den rekkefølgen de blir brukt. */
export function stegFor(k: Kort): string[] {
  const sett = new Set<string>(),
    besok = (n: string) => {
      if (sett.has(n)) return;
      for (const d of AVHENGIGHETER[n] || []) besok(d);
      sett.add(n);
    };
  k.tabeller.forEach(besok);
  const lag = (n: string) => LAG.indexOf(n.split('.')[0] as (typeof LAG)[number]);
  return [...sett].sort((a, b) => lag(a) - lag(b));
}
/* Forbeholdene for kortet: kortets egne og stegenes, hvert én gang */
export const usikkerhetFor = (k: Kort) => [
  ...new Set([...(k.usikkerhet || []), ...stegFor(k).flatMap(n => tabellen(n).usikkerhet || [])])
];
/* Kortet med id-en */
export const kortet = (id: string) => KORT.find(k => k.id === id)!;
/* Repoet på GitHub, der METODE.md og koden kan leses */
export const REPO = 'https://github.com/eirikvk/Publicdemorepo/blob/main/';
/* Ankeret GitHub gir en overskrift i METODE.md: små bokstaver, uten tegnsetting, og bindestrek for mellomrom */
export const anker = (overskrift: string) =>
  overskrift
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
