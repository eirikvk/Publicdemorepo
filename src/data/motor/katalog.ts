/* Katalogen: alt datapipelinen husker, samlet ett sted. Hvert datasett har et navn (som «solv.inon»), en nøkkel (som
   kommunenummeret), hvor mange nøkler som huskes, og som regel en oppskrift som lager verdien av bronse, sølv og gull. Selve
   datasettene står i datasett.ts. ETL-koden i bronse, sølv og gull husker ingenting selv: den får det den trenger og gir svaret
   tilbake, og det er katalogen som tar vare på det.

   Les-gjennom: den som trenger noe, spør katalogen. Ligger det der, brukes det. Ellers kjøres oppskriften, som selv spør katalogen
   etter det den bygger på, og så videre bakover til kilden. Et kall som alt er underveis, deles. Det som feilet, huskes som feilet
   til noen spør på nytt med hent.

   Verdiene lagres som de er, uten å kopieres eller gjøres om til tekst. Det som ligger i katalogen, endres derfor ikke etterpå: et
   nytt resultat erstatter det gamle. Unntaket er datasett merket voksende (det sammensatte kartet), som fylles på etter hvert.
   Ingenting lagres varig i nettleseren: katalogen finnes så lenge siden er åpen.

   Når noe i katalogen endres, sier katalogen fra med endret(), så siden og kartet tegnes på nytt. */
import { endret } from './tilstand.ts';

export type Status = 'henter' | 'feil' | 'ok';
/* Én nøkkel i et datasett: status, verdien (den siste som ble ferdig), utgaven (et løpenummer som er nytt hver gang en verdi legges
   inn, i hele katalogen, så det aldri brukes to ganger), når den sist ble
   laget, og kallet som er underveis */
export interface Oppforing<V> {
  status: Status;
  verdi: V | undefined;
  utgave: number;
  tid: number;
  underveis: Promise<V> | null;
}
/* Et datasett. N er det nøkkelen lages av, og V verdien. */
export interface Datasett<N, V> {
  navn: string /* lag og navn, som «solv.inon» */;
  om: string /* hva det er, til oversikten under Tekniske valg */;
  husk: number /* hvor mange nøkler som huskes. Det som er brukt lengst siden, går ut først. */;
  nokkel?: (n: N) => string /* nøkkelen som tekst. Uten: n selv. */;
  lag?: (n: N) => Promise<V> | V /* oppskriften. Uten: motoren legger verdiene inn selv (legg). */;
  voksende?: boolean /* verdien fylles på etter at den er lagt inn */;
  glemt?: (v: V, nokkel: string) => void /* kalles når en verdi går ut av katalogen */;
}

/* Alle datasettene, i den rekkefølgen de er laget, og innholdet i hvert */
const ALLE: Datasett<any, any>[] = [];
const innholdet = new Map<Datasett<any, any>, Map<string, Oppforing<any>>>();
const lyttere = new Map<Datasett<any, any>, ((v: any, nokkel: string) => void)[]>();
let lopenr = 0; /* siste utgave som er gitt */
const rom = <N, V>(d: Datasett<N, V>) => innholdet.get(d) as Map<string, Oppforing<V>>;
const nokkelAv = <N, V>(d: Datasett<N, V>, n: N) => (d.nokkel ? d.nokkel(n) : String(n));

/* Lager et datasett og tar det med i katalogen */
export function datasett<N, V>(d: Datasett<N, V>): Datasett<N, V> {
  ALLE.push(d);
  innholdet.set(d, new Map());
  return d;
}

/* Brukt nå: nøkkelen flyttes bakerst, så den går ut sist */
function brukt<V>(m: Map<string, Oppforing<V>>, k: string, e: Oppforing<V>) {
  m.delete(k);
  m.set(k, e);
}
/* Holder datasettet innenfor grensen: det som er brukt lengst siden, går ut først */
function rydd<N, V>(d: Datasett<N, V>, m: Map<string, Oppforing<V>>) {
  while (m.size > d.husk) {
    const [k, e] = m.entries().next().value as [string, Oppforing<V>];
    m.delete(k);
    if (e.verdi !== undefined && d.glemt) d.glemt(e.verdi, k);
  }
}
function settInn<N, V>(d: Datasett<N, V>, k: string, e: Oppforing<V>, v: V) {
  const m = rom(d);
  e.status = 'ok';
  e.verdi = v;
  e.utgave = ++lopenr;
  e.tid = Date.now();
  e.underveis = null;
  brukt(m, k, e);
  rydd(d, m);
  (lyttere.get(d) || []).forEach(f => f(v, k));
  endret();
}
const ny = <V>(utgave = 0): Oppforing<V> => ({
  status: 'henter',
  verdi: undefined,
  utgave,
  tid: Date.now(),
  underveis: null
});

/* Les-gjennom, asynkront: gir verdien for n. Mangler den, eller feilet den sist, lages den med oppskriften. */
export function hent<N, V>(d: Datasett<N, V>, n: N): Promise<V> {
  const m = rom(d),
    k = nokkelAv(d, n),
    har = m.get(k);
  if (har && har.status === 'ok') {
    brukt(m, k, har);
    return Promise.resolve(har.verdi as V);
  }
  if (har && har.underveis) return har.underveis;
  if (!d.lag) return Promise.reject(new Error(`${d.navn} har ingen oppskrift`));
  const lag = d.lag,
    e = ny<V>(har ? har.utgave : 0);
  e.verdi = har ? har.verdi : undefined;
  e.underveis = Promise.resolve()
    .then(() => lag(n))
    .then(
      v => {
        if (m.get(k) === e) settInn(d, k, e, v);
        return v;
      },
      feil => {
        if (m.get(k) === e) {
          e.status = 'feil';
          e.underveis = null;
          endret();
        }
        throw feil;
      }
    );
  m.set(k, e);
  rydd(d, m);
  endret();
  return e.underveis;
}

/* Les-gjennom, synkront, til visningen: gir oppføringen for n slik den er nå. Mangler den, startes hentingen, og oppføringen sier
   henter. Det som feilet, hentes ikke på nytt herfra. Gir null bare for datasett uten oppskrift. */
export function les<N, V>(d: Datasett<N, V>, n: N): Oppforing<V> | null {
  const m = rom(d),
    k = nokkelAv(d, n),
    har = m.get(k);
  if (har) {
    if (har.status === 'ok') brukt(m, k, har);
    return har;
  }
  if (!d.lag) return null;
  hent(d, n).catch(() => {}); /* feilen står i oppføringen */
  return m.get(k) || null;
}
/* Verdien for n når den er ferdig, ellers null. Starter hentingen som les. */
export function ferdig<N, V>(d: Datasett<N, V>, n: N): V | null {
  const e = les(d, n);
  return e && e.status === 'ok' ? (e.verdi as V) : null;
}
/* Oppføringen for n slik den er nå, uten å starte noe */
export const se = <N, V>(d: Datasett<N, V>, n: N): Oppforing<V> | null => rom(d).get(nokkelAv(d, n)) || null;

/* For datasett motoren lager selv: legger inn verdien v for n */
export function legg<N, V>(d: Datasett<N, V>, n: N, v: V) {
  const m = rom(d),
    k = nokkelAv(d, n);
  settInn(d, k, m.get(k) || ny<V>(), v);
}
/* Motoren har begynt å lage verdien for n. Oppføringen sier henter, men beholder verdien fra før, så den som vil, kan vise den til
   den nye er klar. Med beholdStatus står en ferdig oppføring som ferdig til den nye er lagt inn. */
export function begynt<N, V>(d: Datasett<N, V>, n: N, beholdStatus = false) {
  const m = rom(d),
    k = nokkelAv(d, n),
    har = m.get(k);
  if (har && har.status === 'ok' && beholdStatus) return;
  const e = ny<V>(har ? har.utgave : 0);
  e.verdi = har ? har.verdi : undefined;
  m.set(k, e);
  rydd(d, m);
  endret();
}
/* Det motoren holdt på med for n, feilet */
export function feilet<N, V>(d: Datasett<N, V>, n: N) {
  const m = rom(d),
    k = nokkelAv(d, n),
    e = m.get(k) || ny<V>();
  e.status = 'feil';
  e.underveis = null;
  m.set(k, e);
  rydd(d, m);
  endret();
}
/* Synkron les-gjennom for verdier som lages med en gang: gir verdien for n, eller lager den med lag og legger den inn. Sier ikke fra
   med endret(), for den som spør, bruker verdien med en gang. */
export function hentStraks<N, V>(d: Datasett<N, V>, n: N, lag: () => V): V {
  const m = rom(d),
    k = nokkelAv(d, n),
    har = m.get(k);
  if (har && har.status === 'ok') return har.verdi as V;
  const e = ny<V>();
  e.status = 'ok';
  e.verdi = lag();
  e.utgave = ++lopenr;
  m.set(k, e);
  rydd(d, m);
  return e.verdi;
}
/* Utgaven av verdien for n: nytt nummer hver gang den legges inn, 0 før den finnes. Det som bygger på verdien, har utgaven i
   nøkkelen sin. Lages verdien på nytt, får den en ny utgave, og det som bygger på den, regnes ut på nytt. */
export const utgave = <N, V>(d: Datasett<N, V>, n: N) => {
  const e = se(d, n);
  return e ? e.utgave : 0;
};
/* Glemmer nøklene i datasettet der hvis(nøkkel) er sann */
export function glem<N, V>(d: Datasett<N, V>, hvis: (nokkel: string) => boolean) {
  const m = rom(d);
  for (const [k, e] of [...m])
    if (hvis(k)) {
      m.delete(k);
      if (e.verdi !== undefined && d.glemt) d.glemt(e.verdi, k);
    }
  endret();
}
/* Alle ferdige verdier i datasettet, som [nøkkel, verdi], eldst først */
export const alle = <N, V>(d: Datasett<N, V>): [string, V][] =>
  [...rom(d)].filter(([, e]) => e.status === 'ok').map(([k, e]) => [k, e.verdi as V]);
/* f kalles hver gang en ny verdi er lagt inn i datasettet */
export function vedNy<N, V>(d: Datasett<N, V>, f: (v: V, nokkel: string) => void) {
  if (!lyttere.has(d)) lyttere.set(d, []);
  lyttere.get(d)!.push(f);
}

/* Omtrent hvor mange byte en verdi tar: bilder, lerreter og tallrekker telles, det andre anslås grovt. Det som er telt én gang,
   telles ikke igjen. */
function storrelse(v: unknown, sett: Set<unknown>, dybde = 0): number {
  if (v == null || typeof v !== 'object') return typeof v === 'string' ? v.length * 2 : 8;
  if (sett.has(v) || dybde > 6) return 0;
  sett.add(v);
  if (v instanceof ArrayBuffer) return v.byteLength;
  if (ArrayBuffer.isView(v)) return v.byteLength;
  if (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement) return v.width * v.height * 4;
  if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return v.width * v.height * 4;
  if (typeof CanvasRenderingContext2D !== 'undefined' && v instanceof CanvasRenderingContext2D) return 0;
  let sum = 0;
  if (v instanceof Map) for (const x of v.values()) sum += storrelse(x, sett, dybde + 1);
  else if (v instanceof Set) for (const x of v) sum += storrelse(x, sett, dybde + 1);
  else for (const x of Object.values(v)) sum += storrelse(x, sett, dybde + 1);
  return sum;
}
/* Det katalogen inneholder nå, til oversikten under Tekniske valg: per datasett navnet, hva det er, grensen, og hver nøkkel med
   status, utgave, omtrentlig størrelse i byte og alder i sekunder */
export function innhold() {
  const sett = new Set<unknown>(),
    na = Date.now();
  return ALLE.map(d => ({
    navn: d.navn,
    om: d.om,
    husk: d.husk,
    voksende: !!d.voksende,
    oppskrift: !!d.lag,
    noekler: [...rom(d)].map(([k, e]) => ({
      nokkel: k,
      status: e.status,
      utgave: e.utgave,
      byte: e.verdi === undefined ? 0 : storrelse(e.verdi, sett),
      sekunder: Math.round((na - e.tid) / 1000)
    }))
  }));
}
