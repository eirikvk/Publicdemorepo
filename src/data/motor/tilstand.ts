/* Datamotoren, tilstanden: alt siden vet om dataene, samlet i ett objekt (app), og lageret som sier fra når noe er endret.
   Datamotoren skriver hit. Brukergrensesnittet (ui/) leser herfra: React-komponentene og kartet abonnerer begge med abonner, og
   tegnes på nytt når noe er endret. Det som bare gjelder visningen, som valgt side og hva man har trykket på i kartet, ligger i
   ui/tilstand.ts. Regnefunksjonene i sølv og gull bruker ikke tilstanden: de får det de trenger som argumenter.
   Filen bruker verken React eller OpenLayers. */
import type { Planopplysninger } from '../bronse/dibk-kommuneplan.ts';
import { henteStatus, nårHentingEndres, type Kall, type Runde } from '../bronse/henting.ts';
import type { Planfeil } from '../bronse/planfil.ts';
import type { Del } from '../solv/egne.ts';
import type { Flerflate, Fylke, Kommune, Utsnitt } from '../solv/felles.ts';
import type { Blokk, EgetTall, Planrutenett } from '../solv/planrutenett.ts';
import type { Historie } from '../solv/ssb.ts';
import type { Graa, Graakryss } from '../gull/graa.ts';
import type { Inon } from '../gull/inon.ts';
import type { PlanSum } from '../gull/planlagt.ts';
import type { SsbTall } from '../gull/regnskap.ts';

/* Kommunegrensen: flerflaten i UTM33 og utsnittet */
export interface Grense {
  nr: string;
  koord: Flerflate;
  ext: Utsnitt;
}
/* Dagens klasser zoomet ut for valgt kommune: det lagrede oversiktsbildet (buf, som PNG), eller det sammensatte kartet (lerret,
   dynamisk). ext er utsnittet bildet dekker, og res meter per piksel. blokker er planrutenettet per flis, se plan.ts. */
export interface Oversikt {
  ext: Utsnitt;
  res: number;
  buf?: ArrayBuffer;
  lerret?: HTMLCanvasElement;
  dynamisk?: boolean;
  blokker?: Map<string, Blokk>;
}
/* Om DiBK har kommuneplanen: hvor stor del av kommunen planlaget dekker, og hvilken plan det er */
export interface Planinfo {
  nr: string;
  tilstand: 'sjekker' | 'feil' | 'ok' | 'ingen';
  dekning?: number;
  plan?: Planopplysninger | null;
}
/* Et eget område, tegnet i kartet eller lastet opp som fil. tall er hva som ligger i det, fra planrutenettet. En opplastet plan har
   også antall flater som er utbygging (bygg) og ikke (annet), plan-id, om den mangler arealformål, og projeksjonen den var i. */
export interface EgetOmrade {
  id: number;
  nr: string;
  lopenr?: number;
  navn: string;
  kilde: 'tegnet' | 'fil';
  deler: Del[];
  ext: Utsnitt;
  km2: number;
  tall: EgetTall | null;
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
  fylker: Fylke[];
  listeFeil: boolean;
  valgt: Kommune | null;
  grense: Grense | null;
  grenseFeil: boolean;
  flate: number;
  oversikter: Record<string, Utsnitt>;
  oversiktInfo: { versjon?: string; hentet?: string } | null;
  ov: Oversikt | null;
  arealtall: SsbTall | null;
  ssbSum: number;
  ferskvann: { inn: number; elv: number } | null;
  historie: Historie | null;
  planInfo: Planinfo | null;
  planRaster: Planrutenett | null;
  planSum: PlanSum | null;
  planTall: { tilstand: 'tom' | 'zoom' | 'regner' | 'feil' | 'ok' } | null;
  egne: EgetOmrade[];
  egneStatus: EgneStatus | null;
  inon: Inon | null;
  graa: Graa | null;
  graaKryss: Graakryss | null;
  kartFlyttes: boolean;
  laster: boolean;
  kall: Kall[];
  sisteKall: Runde | null;
}

export const app: Tilstand = {
  fylker: [] /* fylkene med kommunene sine, fra Kartverket */,
  listeFeil: false /* kommunelisten kunne ikke hentes */,
  valgt: null /* kommunen som er valgt: { nr, navn, boks } */,
  grense: null /* kommunegrensen når den er hentet: { nr, koord, ext }, koord som flerflate i UTM33 */,
  grenseFeil: false /* kommunegrensen kunne ikke hentes */,
  flate: 0 /* kommunens flate i km², land og vann */,
  oversikter: {} /* kommunene som har lagret oversiktsbilde, med utsnittet bildet dekker */,
  oversiktInfo: null /* årsversjon og dato for de lagrede oversiktsbildene, fra registeret */,
  ov: null /* dagens klasser zoomet ut for valgt kommune: det lagrede oversiktsbildet, eller det sammensatte (dynamisk) */,
  arealtall:
    null /* tallene fra SSB: { tilstand: 'henter' | 'feil' | 'ok', a: [bebygd, jordbruk, natur] i km², aar } */,
  ssbSum: 0 /* landarealet i km², summen av de tre klassene. 0 til tallene er hentet. */,
  ferskvann: null /* { inn, elv } i km², fra SSB */,
  historie: null /* arealet per klasse i 2017 og i siste år */,
  planInfo: null /* om DiBK har en kommuneplan for kommunen, og hvilken */,
  planRaster: null /* planrutenettet for hele kommunen, med tallene som er regnet ut fra det */,
  planSum: null /* planlagt utbygging på natur og jordbruk i km², til oversikten og regnskapet */,
  planTall: null /* hvor langt utregningen av planlagt utbygging er kommet: tom, zoom, regner, feil eller ok */,
  egne: [] /* egne områder, tegnet i kartet eller lastet opp. De finnes så lenge siden er åpen. */,
  egneStatus: null /* hvordan siste tegning eller opplasting gikk: { hva, fil, ... }, se lastOppPlan i egne.ts */,
  inon: null /* inngrepsfri natur i kommunen: tilstand, areal per sone og sonen per rute */,
  graa: null /* grått areal i kommunen: tilstand, areal per trinn og trinnet per rute */,
  graaKryss: null /* planlagt utbygging krysset med grått areal */,
  kartFlyttes: false /* kartet flyttes nå. Da venter utregningene som kan vente, så kartet ikke hakker. */,
  /* Hentingen, fra bronse */
  laster: false /* om det hentes kartbilder nå */,
  kall: [] /* de siste kallene mot åpne kilder, nyeste først */,
  sisteKall: null /* siste runde med kartbilder fra én kilde */
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

/* Hvert valg av kommune får et nytt nummer. Svar som kommer tilbake etter at en annen kommune er valgt, kastes. */
export let valgNr = 0;
export const nyttValg = () => ++valgNr;
/* Resultater merkes med kommunenummeret de gjelder. Dette gir resultatet hvis det gjelder kommunen som er valgt nå, ellers ingenting. */
export const gjeldende = <T extends { nr: string }>(x: T | null | undefined): T | null =>
  x && app.valgt && x.nr === app.valgt.nr ? x : null;

/* Tidtaking til feilsøking: hvor mye tid de tyngste delene bruker i nettleserens hovedtråd siden siste flytting startet. Vises under
   Tekniske valg. */
export let bruk: Record<string, { sum: number; n: number; maks: number }> = {};
export const nullstillBruk = () => {
  bruk = {};
};
export const tidSlutt = (navn: string, t0: number) => {
  const d = performance.now() - t0,
    b = bruk[navn] || (bruk[navn] = { sum: 0, n: 0, maks: 0 });
  b.sum += d;
  b.n++;
  if (d > b.maks) b.maks = d;
};
