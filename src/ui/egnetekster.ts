/* Tekstene om egne områder, som hovedsiden (komponenter/Egne.tsx) og tvillingen fra Figma (srcFigma/komponenter/Egne.tsx) viser
   likt: meldingen om siste tegning eller opplasting, hva en opplastet plan inneholder, hva som ligger i et område i dag, og når et
   område er for smalt til å gi utslag, og hvorfor planlagt utbygging ikke kunne regnes ut. Tallene kommer ferdig regnet ut fra
   datamotoren og gull. */
import { katalog } from '../data/katalog.ts';
import type { EgneRader } from '../data/gull/egne.ts';
import { dibkFeilet } from '../data/motor/plan.ts';
import { verdi } from '../data/motor/valgt.ts';
import type { EgetOmrade, EgneStatus } from '../data/motor/tilstand.ts';
import { antallOrd, iTekst, nf, ramse } from './tekst.ts';

/* Meldingen om siste tegning eller opplasting, etter hva datamotoren melder (app.egneStatus): [tekst, type], der type er typen
   melding i designsystemet */
export type Melding = [tekst: string, type: 'info' | 'success' | 'warning' | 'error'];
const STATUS: Record<EgneStatus['hva'], (s: EgneStatus) => Melding> = {
  forLite: () => ['Området ble for lite til å regnes ut. Tegn et større område.', 'warning'],
  forStor: () => ['Filen er for stor til å leses i nettleseren (over 120 MB).', 'error'],
  leser: s => [`Leser ${s.fil} …`, 'info'],
  lest: s => [
    `${s.fil}: ${nf(s.antall!, 0)} flater lest${s.byttetTil ? `, og kommunen er byttet til ${s.byttetTil}` : ''}.`,
    'success'
  ],
  ingenFlater: () => [
    'Fant ingen flater i filen. Den må være GeoJSON med polygoner, som filen fra DiBKs nedlasting av plandata.',
    'error'
  ],
  ingenKommune: () => ['Velg en kommune først.', 'error'],
  ulesbareFlater: () => ['Flatene i filen kunne ikke leses.', 'error'],
  ikkeGeoJSON: () => ['Filen kunne ikke leses som GeoJSON.', 'error']
};
export const egneMelding = (s: EgneStatus): Melding => STATUS[s.hva](s);

/* Antall flater i tekst, med tall til og med tolv i ord */
export const flater = (n: number) => (n === 1 ? 'én flate' : `${antallOrd(n)} flater`);

/* Hvor mange av flatene i et eget område som regnes som utbygging, fra solv.egne. null til området er tolket. */
export function antallBygg(id: number) {
  const E = verdi(katalog.solv.egne),
    i = E ? E.ider.indexOf(id) : -1;
  return i < 0 ? null : E!.flater[i].deler.filter(d => d.type === 'bygg').length;
}

/* Hva en opplastet plan g inneholder: hvor mange flater, og hvor mange som regnes som utbygging */
export function omOpplastet(g: EgetOmrade) {
  if (g.kilde !== 'fil') return '';
  const bygg = antallBygg(g.id),
    n = g.deler.length;
  if (!g.harFormal)
    return `Opplastet fil med ${flater(n)}. Filen har ingen arealformål, så ${n === 1 ? 'flaten' : 'alle flatene'} regnes som utbygging.`;
  return (
    `Opplastet plan${g.planid ? ' ' + g.planid : ''} med ${flater(n)}` +
    (bygg === null
      ? '.'
      : `: ${bygg ? antallOrd(bygg) : 'ingen'} regnes som utbygging (framtidig bebyggelse, anlegg og samferdsel) og ${n - bygg ? antallOrd(n - bygg) : 'ingen'} som ikke utbygging.`) +
    ' Innenfor flatene erstatter filen kommuneplanen.'
  );
}

/* Hva som ligger i et eget område i dag (O, fra gull.egneRader): én eller to setninger. tall skriver arealet, som iTekst her eller
   tvillingens med hele dekar. */
export type Omradet = EgneRader['omrader'][number]['omrade'];
export function iDag(O: Omradet, tall = iTekst): string[] {
  if (!O.kjent) return ['Området ligger utenfor kommunen, eller grunnkartet har ingen klasse der.'];
  const deler = (
    [
      [O.natur, 'natur'],
      [O.jordbruk, 'jordbruk'],
      [O.bebygd, 'bebygd'],
      [O.vann, 'vann']
    ] satisfies [km2: number, hva: string][]
  ).map(([v, hva]) => (v ? tall(v) + ' ' + hva : ''));
  return [
    `I dag ligger det ${ramse(deler)} her.`,
    ...(O.ukjent ? [`Ca. ${tall(O.ukjent)} ligger utenfor kommunen, eller grunnkartet har ingen klasse der.`] : [])
  ];
}

/* Når et tegnet område for utbygging er så smalt at det faller for regelen om smale striper */
export const smalTekst = (g: EgetOmrade, O: Omradet | null) =>
  O && g.kilde === 'tegnet' && g.deler[0].type === 'bygg' && O.smal
    ? 'Området er smalere enn rundt 40 meter og regnes som en smal stripe, så det gir ikke utslag.'
    : '';

/* Hvorfor planlagt utbygging ikke kunne regnes ut (planTall er feil): kommuneplanen fra DiBK, eller et annet kart */
export const planFeil = () =>
  dibkFeilet()
    ? 'Kommuneplanen kunne ikke hentes fra Direktoratet for byggkvalitet (DiBK) akkurat nå. Prøv igjen om litt.'
    : 'Kartene planlagt utbygging regnes ut av, kunne ikke hentes akkurat nå. Prøv igjen om litt.';
