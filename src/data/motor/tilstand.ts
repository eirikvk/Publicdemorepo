/* Datamotoren, tilstanden som gjelder nå: valgene brukeren har gjort (valgt kommune og egne områder) og det tekniske (kall-loggen). Alt som er hentet og regnet ut, ligger i cachen (data/cache.ts) og leses gjennom katalogen
   (data/katalog.ts) for valgt kommune (valgt.ts). Det som bare gjelder visningen, som valgt side og hva man har trykket på i kartet, ligger i ui/tilstand.ts.
   Her er også lageret: React-komponentene og kartet abonnerer med abonner, og tegnes på nytt når noe er endret. Regnefunksjonene i
   sølv og gull bruker ikke tilstanden: de får det de trenger som argumenter. Filen bruker verken React eller OpenLayers. */
import { henteStatus, nårHentingEndres, type Kall, type Runde } from '../bronse/henting.ts';
import { nårEndret, nårKjort } from '../cache.ts';
import type { Planfeil } from '../bronse/planfil.ts';
import type { Egetinn } from '../solv/egne.ts';
import type { Kommune } from '../solv/felles.ts';

/* Et eget område, tegnet i kartet eller lastet opp som fil, i kommunen nr: det brukeren laget (Egetinn, se solv/egne.ts), med navn,
   løpenummer for tegnede områder og areal. En opplastet plan har også plan-id og projeksjonen den var i. Hvilke flater som er
   utbygging, står i solv.egne, og hva som ligger i området, i utbyggingen (se egetTall i motor/egne.ts). */
export type EgetOmrade = Egetinn & {
  nr: string;
  lopenr?: number;
  navn: string;
  km2: number;
  planid?: string;
  proj?: string;
};
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
  laster: false /* om det hentes kartbilder nå, fra bronse */,
  kall: [] /* de siste kallene mot åpne kilder, nyeste først, fra bronse */,
  sisteKall: null /* siste runde med kartbilder fra én kilde, fra bronse */
};

/* Lageret: den som endrer noe i app (eller i ui/tilstand.ts) som vises, kaller endret(). Varslene samles og sendes høyst én gang per
   skjermbilde (requestAnimationFrame), så mange endringer etter hverandre gir én ny tegning. Før ble de sendt etter hver oppgave i
   nettleseren, og når hundrevis av filer kom inn én etter én, ble siden tegnet på nytt for hver av dem. Er fanen skjult, tegner
   nettleseren ingen skjermbilder, og da sendes de etter 100 ms i stedet. */
let utgave = 0,
  planlagt = false;
const lyttere = new Set<() => void>();
export const abonner = (f: () => void) => {
  lyttere.add(f);
  return () => lyttere.delete(f);
};
export const tilstandsutgave = () => utgave;
const send = () => {
  if (!planlagt) return;
  planlagt = false;
  utgave++;
  lyttere.forEach(f => f());
};
export function endret() {
  if (planlagt) return;
  planlagt = true;
  requestAnimationFrame(send);
  setTimeout(send, 100);
}

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
