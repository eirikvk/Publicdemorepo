/* Datamotoren, tilstanden: alt siden vet om dataene, samlet i ett objekt (app), og lageret som sier fra når noe er endret.
   Datamotoren skriver hit. Brukergrensesnittet (ui/) leser herfra: React-komponentene og kartet abonnerer begge med abonner, og
   tegnes på nytt når noe er endret. Det som bare gjelder visningen, som valgt side og hva man har trykket på i kartet, ligger i
   ui/tilstand.js. Regnefunksjonene i sølv og gull bruker ikke tilstanden: de får det de trenger som argumenter.
   Filen bruker verken React eller OpenLayers. */
import { henteStatus, nårHentingEndres } from '../bronse/henting.js';

export const app = {
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
  egneStatus: null /* hvordan siste tegning eller opplasting gikk: { hva, fil, ... }, se lastOppPlan i egne.js */,
  inon: null /* inngrepsfri natur i kommunen: tilstand, areal per sone og sonen per rute */,
  graa: null /* grått areal i kommunen: tilstand, areal per trinn og trinnet per rute */,
  graaKryss: null /* planlagt utbygging krysset med grått areal */,
  kartFlyttes: false /* kartet flyttes nå. Da venter utregningene som kan vente, så kartet ikke hakker. */,
  /* Hentingen, fra bronse */
  laster: false /* om det hentes kartbilder nå */,
  kall: [] /* de siste kallene mot åpne kilder, nyeste først */,
  sisteKall: null /* siste runde med kartbilder fra én kilde */
};

/* Lageret: den som endrer noe i app (eller i ui/tilstand.js) som vises, kaller endret(). Varslene samles og sendes én gang når
   nettleseren er ferdig med det den holder på med, så mange endringer etter hverandre gir én ny tegning. */
let utgave = 0,
  planlagt = false;
const lyttere = new Set();
export const abonner = f => {
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
const hendelser = new Map();
export const lytt = (navn, f) => {
  if (!hendelser.has(navn)) hendelser.set(navn, new Set());
  hendelser.get(navn).add(f);
};
export const varsle = (navn, ...verdier) => (hendelser.get(navn) || []).forEach(f => f(...verdier));

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
export const gjeldende = x => (x && app.valgt && x.nr === app.valgt.nr ? x : null);

/* Tidtaking til feilsøking: hvor mye tid de tyngste delene bruker i nettleserens hovedtråd siden siste flytting startet. Vises under
   Tekniske valg. */
export let bruk = {};
export const nullstillBruk = () => {
  bruk = {};
};
export const tidSlutt = (navn, t0) => {
  const d = performance.now() - t0,
    b = bruk[navn] || (bruk[navn] = { sum: 0, n: 0, maks: 0 });
  b.sum += d;
  b.n++;
  if (d > b.maks) b.maks = d;
};
