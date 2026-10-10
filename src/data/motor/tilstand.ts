/* Datamotoren, tilstanden som gjelder nå: valgene brukeren har gjort (valgt kommune og egne områder) og det tekniske (kall-loggen,
   om kartet flyttes). Alt som er hentet og regnet ut, ligger i cachen (data/cache.ts) og leses gjennom katalogen
   (data/katalog.ts) for valgt kommune (valgt.ts). Det som bare gjelder visningen, som valgt side og hva man har trykket på i kartet, ligger i ui/tilstand.ts.
   Her er også lageret: React-komponentene og kartet abonnerer med abonner, og tegnes på nytt når noe er endret. Regnefunksjonene i
   sølv og gull bruker ikke tilstanden: de får det de trenger som argumenter. Filen bruker verken React eller OpenLayers. */
import { henteStatus, nårHentingEndres, type Kall, type Runde } from '../bronse/henting.ts';
import { nårEndret, nårKjort } from '../cache.ts';
import type { Planfeil } from '../bronse/planfil.ts';
import type { Del } from '../solv/egne.ts';
import type { Utsnitt } from '../generelt/geometri.ts';
import type { Kommune } from '../solv/felles.ts';

/* Et eget område, tegnet i kartet eller lastet opp som fil, i kommunen nr. En opplastet plan har også antall flater som er
   utbygging (bygg) og ikke (annet), plan-id, om den mangler arealformål, og projeksjonen den var i. Hva som ligger i området, står i
   planrutenettet, se egetTall i motor/egne.ts. */
export interface EgetOmrade {
  id: number;
  nr: string;
  lopenr?: number;
  navn: string;
  kilde: 'tegnet' | 'fil';
  deler: Del[];
  ext: Utsnitt;
  km2: number;
  bygg?: number;
  annet?: number;
  planid?: string;
  utenFormal?: boolean;
  proj?: string;
}
/* Hvordan siste tegning eller opplasting gikk. Siden skriver meldingen, se Egne.tsx. */
export interface EgneStatus {
  hva: 'forLite' | 'forStor' | 'leser' | 'lest' | 'ikkeGeoJSON' | Planfeil;
  fil?: string | null;
  antall?: number;
  byttetTil?: string | null;
}

export interface Tilstand {
  valgt: Kommune | null;
  egne: EgetOmrade[];
  egneStatus: EgneStatus | null;
  kartFlyttes: boolean;
  laster: boolean;
  kall: Kall[];
  sisteKall: Runde | null;
}

export const app: Tilstand = {
  /* Valgene */
  valgt: null /* kommunen som er valgt: { nr, navn, boks } */,
  egne: [] /* egne områder, tegnet i kartet eller lastet opp. De finnes så lenge siden er åpen. */,
  egneStatus: null /* hvordan siste tegning eller opplasting gikk: { hva, fil, ... }, se lastOppPlan i egne.ts */,
  /* Det tekniske */
  kartFlyttes: false /* kartet flyttes nå. Da venter utregningene som kan vente, så kartet ikke hakker. */,
  laster: false /* om det hentes kartbilder nå, fra bronse */,
  kall: [] /* de siste kallene mot åpne kilder, nyeste først, fra bronse */,
  sisteKall: null /* siste runde med kartbilder fra én kilde, fra bronse */
};

/* Lageret: den som endrer noe i app (eller i ui/tilstand.ts) som vises, kaller endret(). Varslene samles og sendes én gang når
   nettleseren er ferdig med det den holder på med, så mange endringer etter hverandre gir én ny tegning. */
let utgave = 0,
  planlagt = false;
const lyttere = new Set<() => void>();
export const abonner = (f: () => void) => {
  lyttere.add(f);
  return () => lyttere.delete(f);
};
export const tilstandsutgave = () => utgave;
export function endret() {
  if (planlagt) return;
  planlagt = true;
  queueMicrotask(() => {
    planlagt = false;
    utgave++;
    lyttere.forEach(f => f());
  });
}

/* Hendelser som ikke er tilstand: for eksempel at det er lagt en ny flis inn i det sammensatte kartet, og hvor. Kartet lytter. */
/* Et sted i et lerret: [x, y, bredde, høyde] i piksler */
export type Sted = [x: number, y: number, b: number, h: number];
interface Hendelser {
  nyFlis: [
    lerret: HTMLCanvasElement,
    sted: Sted
  ] /* en flis er lagt inn i det sammensatte kartet, på stedet [x, y, b, h] */;
  samlingFjernet: [lerret: HTMLCanvasElement] /* et sammensatt kart er fjernet fra minnet */;
}
type Lytter = (...verdier: any[]) => void;
const hendelser = new Map<keyof Hendelser, Set<Lytter>>();
export const lytt = <N extends keyof Hendelser>(navn: N, f: (...verdier: Hendelser[N]) => void) => {
  if (!hendelser.has(navn)) hendelser.set(navn, new Set());
  hendelser.get(navn)!.add(f as Lytter);
};
export const varsle = <N extends keyof Hendelser>(navn: N, ...verdier: Hendelser[N]) =>
  (hendelser.get(navn) || []).forEach(f => f(...verdier));

/* Bronse sier fra når hentingen endrer seg. Det som vises, legges i app. */
nårHentingEndres(() => {
  app.kall = henteStatus.kall;
  app.sisteKall = henteStatus.siste;
  app.laster = henteStatus.laster;
  endret();
});

/* Tidtaking til feilsøking: hvor mye tid de tyngste delene bruker siden siste flytting startet. Vises under Tekniske valg. */
export let bruk: Record<string, { sum: number; n: number; maks: number }> = {};
export const nullstillBruk = () => {
  bruk = {};
};
const brukt = (navn: string, d: number) => {
  const b = bruk[navn] || (bruk[navn] = { sum: 0, n: 0, maks: 0 });
  b.sum += d;
  b.n++;
  if (d > b.maks) b.maks = d;
};
export const tidSlutt = (navn: string, t0: number) => brukt(navn, performance.now() - t0);

/* Cachen sier fra når noe er endret, og hvor lenge ETL-funksjonene i sølv og gull brukte */
nårEndret(endret);
nårKjort(brukt);
