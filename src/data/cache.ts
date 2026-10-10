/* Cachen: svarene fra ETL-funksjonene i katalogen (katalog.ts), lagret per tabell og nøkkel. Nøkkelen er som regel kommunenummeret.
   Hver rad har status (henter, feil eller ok), verdien, utgaven og når den ble laget. Katalogen sier hvilke funksjoner som finnes,
   cachen husker svarene. ETL-koden i bronse, sølv og gull vet ingenting om cachen: den kaller katalogen, og det er cachen som sier om
   svaret allerede finnes.

   Les-gjennom: kaller man en tabell, gis verdien hvis den finnes. Ellers kjøres ETL-funksjonen, som selv kaller katalogen etter det
   den bygger på, og så videre ned til kilden. Et kall som alt er underveis, deles. Det som feilet, står som feilet til noen kaller
   tabellen på nytt.

   Det meste kommer fra kildene og endres ikke mens siden er åpen. Gull bygger også på planrutenettet og det kartlagte for naturtyper,
   som kan bli nye: planrutenettet regnes ut på nytt når det kommer mer kart eller egne områder endres. Tabeller merket endrerGull sier
   fra når de får en ny verdi, og da er gull for den kommunen utdatert. Siden får det gamle svaret til det nye er regnet ut, så tallene
   ikke blinker. En ETL-funksjon som kaller gull, venter på det nye.

   Verdiene lagres som de er, uten å kopieres eller gjøres om til tekst. Det som ligger i cachen, endres derfor ikke etterpå: et nytt
   svar erstatter det gamle. Unntaket er tabeller merket voksende (det sammensatte kartet og planrutenettets blokker), som fylles på
   etter hvert. Ingenting lagres varig i nettleseren: cachen finnes så lenge siden er åpen. Filen importerer ingenting. */

export type Lag = 'bronse' | 'solv' | 'gull';
export type Status = 'henter' | 'feil' | 'ok';
/* Én rad: status, verdien (den siste som ble ferdig), utgaven (et løpenummer som er nytt hver gang en verdi legges inn, så det aldri
   brukes to ganger), når den ble laget, hvor lenge ETL-funksjonen brukte, om svaret gjelder bare en del av kommunen (delvis, fra
   svaret selv), og kallet som er underveis. gull er utgaven av gull for kommunen da raden ble regnet ut. */
export interface Rad<V> {
  status: Status;
  verdi: V | undefined;
  utgave: number;
  tid: number;
  ms: number;
  delvis: boolean;
  gull: number;
  underveis: Promise<V> | null;
  underveisGull: number;
}
/* En tabell: laget (bronse, sølv eller gull), navnet, hva den er, hvor mange nøkler som huskes, og ETL-funksjonen som lager verdien.
   N er det nøkkelen lages av, og V verdien. */
export interface Tabelldef<N, V> {
  lag: Lag;
  navn: string;
  om: string /* til oversikten under Tekniske valg */;
  husk: number /* hvor mange nøkler som huskes. Det som er brukt lengst siden, går ut først. */;
  nokkel?: (n: N) => string /* nøkkelen som tekst. Uten: n selv, eller tom tekst. */;
  etl?: (n: N) => Promise<V> /* lager verdien. Uten: motoren legger verdiene inn selv (legg). */;
  voksende?: boolean /* verdien fylles på etter at den er lagt inn */;
  endrerGull?: boolean /* en ny verdi gjør gull for kommunen (nøkkelen) utdatert */;
  glemt?: (v: V, nokkel: string) => void /* kalles når en verdi går ut av cachen */;
}
/* En tabell man kaller med nøkkelen: katalog.solv.inon('5001') gir sonene for Trondheim, fra cachen eller fra ETL-funksjonen.
   naa gir verdien som den er nå, eller null, og starter hentingen hvis den mangler. straks gir verdien med en gang, og lager den
   med lag hvis den mangler (til maskene, som lages midt i en utregning). */
export type Tabell<N, V> = Tabelldef<N, V> & {
  (n: N): Promise<V>;
  naa: (n: N) => V | null;
  straks: (n: N, lag: () => V) => V;
};

const ALLE: Tabell<any, any>[] = [];
const innholdet = new Map<Tabelldef<any, any>, Map<string, Rad<any>>>();
const lyttere = new Map<Tabelldef<any, any>, ((v: any, nokkel: string) => void)[]>(),
  glemtLyttere = new Map<Tabelldef<any, any>, ((v: any, nokkel: string) => void)[]>();
const gullUtgave = new Map<string, number>(); /* per kommune */
let lopenr = 0; /* siste utgave som er gitt */
const kroker = {
  endret: () => {},
  kjort: (_navn: string, _ms: number) => {},
  gullUtdatert: (_nr: string) => {}
};
/* Den som vil vite når noe er endret (datamotoren), gir en funksjon her */
export const nårEndret = (f: () => void) => {
  kroker.endret = f;
};
/* Hvor lenge hver ETL-funksjon i sølv og gull brukte, til tidtakingen under Tekniske valg */
export const nårKjort = (f: (navn: string, ms: number) => void) => {
  kroker.kjort = f;
};
/* Gull for kommunen nr er utdatert. Datamotoren kan da be om det sidene viser, så det er klart. */
export const nårGullUtdatert = (f: (nr: string) => void) => {
  kroker.gullUtdatert = f;
};

const rom = <N, V>(t: Tabelldef<N, V>) => innholdet.get(t) as Map<string, Rad<V>>;
const nokkelAv = <N, V>(t: Tabelldef<N, V>, n: N) => (t.nokkel ? t.nokkel(n) : n === undefined ? '' : String(n));
export const fulltNavn = (t: Tabelldef<any, any>) => `${t.lag}.${t.navn}`;
const gyldig = <V>(t: Tabelldef<any, V>, k: string, r: Rad<V>) =>
  r.status === 'ok' && (t.lag !== 'gull' || r.gull === (gullUtgave.get(k) || 0));

/* Lager en tabell og tar den med i cachen */
export function tabell<N, V>(d: Tabelldef<N, V>): Tabell<N, V> {
  const t = Object.assign((n: N) => hent(t, n), d, {
    naa: (n: N) => ferdig(t, n),
    straks: (n: N, lag: () => V) => hentStraks(t, n, lag)
  }) as Tabell<N, V>;
  ALLE.push(t);
  innholdet.set(t, new Map());
  return t;
}

/* Brukt nå: nøkkelen flyttes bakerst, så den går ut sist */
function brukt<V>(m: Map<string, Rad<V>>, k: string, r: Rad<V>) {
  m.delete(k);
  m.set(k, r);
}
/* Raden for nøkkelen k er tatt ut av tabellen */
function tattUt<V>(t: Tabelldef<any, V>, k: string, r: Rad<V>) {
  if (r.verdi === undefined) return;
  if (t.glemt) t.glemt(r.verdi, k);
  (glemtLyttere.get(t) || []).forEach(f => f(r.verdi, k));
}
/* Holder tabellen innenfor grensen: det som er brukt lengst siden, går ut først */
function rydd<N, V>(t: Tabelldef<N, V>, m: Map<string, Rad<V>>) {
  while (m.size > t.husk) {
    const [k, r] = m.entries().next().value as [string, Rad<V>];
    m.delete(k);
    tattUt(t, k, r);
  }
}
const ny = <V>(fra?: Rad<V>): Rad<V> => ({
  status: 'henter',
  verdi: fra ? fra.verdi : undefined,
  utgave: fra ? fra.utgave : 0,
  tid: Date.now(),
  ms: 0,
  delvis: false,
  gull: 0,
  underveis: null,
  underveisGull: 0
});
function settInn<N, V>(t: Tabelldef<N, V>, k: string, r: Rad<V>, v: V, gull: number) {
  const m = rom(t);
  r.status = 'ok';
  r.verdi = v;
  r.utgave = ++lopenr;
  r.tid = Date.now();
  r.gull = gull;
  r.delvis = !!v && typeof v === 'object' && (v as { delvis?: unknown }).delvis === true;
  r.underveis = null;
  brukt(m, k, r);
  rydd(t, m);
  (lyttere.get(t) || []).forEach(f => f(v, k));
  if (t.endrerGull) utdaterGull(k);
  kroker.endret();
}

/* Les-gjennom, asynkront: gir verdien for n. Mangler den, er den utdatert, eller feilet den sist, lages den med ETL-funksjonen. Det
   er dette som skjer når man kaller en tabell. */
export function hent<N, V>(t: Tabelldef<N, V>, n: N): Promise<V> {
  const m = rom(t),
    k = nokkelAv(t, n),
    har = m.get(k);
  if (har && gyldig(t, k, har)) {
    brukt(m, k, har);
    return Promise.resolve(har.verdi as V);
  }
  const gull = gullUtgave.get(k) || 0;
  /* Et kall som er underveis, deles, så sant gull ikke er blitt utdatert siden det startet */
  if (har && har.underveis && (t.lag !== 'gull' || har.underveisGull === gull)) return har.underveis;
  if (!t.etl)
    /* tabeller motoren fyller: verdien som den er, eller null */
    return Promise.resolve((har && har.status === 'ok' ? har.verdi : null) as V);
  const etl = t.etl,
    r = har && (har.status === 'ok' || har.underveis) ? har : ny(har) /* et utdatert svar vises til det nye er klart */,
    p: Promise<V> = Promise.resolve()
      .then(() => {
        const t0 = performance.now();
        return etl(n).then(v => {
          r.ms = performance.now() - t0;
          if (t.lag !== 'bronse') kroker.kjort(fulltNavn(t), r.ms);
          return v;
        });
      })
      .then(
        v => {
          if (m.get(k) === r && r.underveis === p) settInn(t, k, r, v, gull);
          return v;
        },
        feil => {
          if (m.get(k) === r && r.underveis === p) {
            r.status = 'feil';
            r.underveis = null;
            kroker.endret();
          }
          throw feil;
        }
      );
  r.underveis = p;
  r.underveisGull = gull;
  if (r !== har) {
    m.set(k, r);
    rydd(t, m);
  }
  kroker.endret();
  return p;
}

/* Les-gjennom, synkront, til visningen: gir raden for n slik den er nå. Mangler den, startes hentingen, og raden sier henter. Er
   den utdatert, gis den gamle verdien mens den nye regnes ut. Det som feilet, hentes ikke på nytt herfra. Gir null for tabeller
   motoren fyller, når de er tomme. */
export function les<N, V>(t: Tabelldef<N, V>, n: N): Rad<V> | null {
  const m = rom(t),
    k = nokkelAv(t, n),
    har = m.get(k);
  if (har && har.status !== 'ok') return har;
  if (har && gyldig(t, k, har)) {
    brukt(m, k, har);
    return har;
  }
  if (!t.etl) return har || null;
  hent(t, n).catch(() => {}); /* deler et kall som er underveis. Feilen står i raden. */
  return m.get(k) || null;
}
/* Verdien for n når den er ferdig, ellers null. Starter hentingen som les. */
export function ferdig<N, V>(t: Tabelldef<N, V>, n: N): V | null {
  const r = les(t, n);
  return r && r.status === 'ok' ? (r.verdi as V) : null;
}
/* Raden for n slik den er nå, uten å starte noe */
export const se = <N, V>(t: Tabelldef<N, V>, n: N): Rad<V> | null => rom(t).get(nokkelAv(t, n)) || null;

/* For tabeller motoren fyller: legger inn verdien v for n */
export function legg<N, V>(t: Tabelldef<N, V>, n: N, v: V) {
  const m = rom(t),
    k = nokkelAv(t, n);
  settInn(t, k, m.get(k) || ny<V>(), v, gullUtgave.get(k) || 0);
}
/* Motoren har begynt å lage verdien for n. Raden sier henter, men beholder verdien fra før, så den som vil, kan vise den til den nye
   er klar. Med beholdStatus står en ferdig rad som ferdig til den nye er lagt inn. */
export function begynt<N, V>(t: Tabelldef<N, V>, n: N, beholdStatus = false) {
  const m = rom(t),
    k = nokkelAv(t, n),
    har = m.get(k);
  if (har && har.status === 'ok' && beholdStatus) return;
  m.set(k, ny(har));
  rydd(t, m);
  kroker.endret();
}
/* Det motoren holdt på med for n, feilet */
export function feilet<N, V>(t: Tabelldef<N, V>, n: N) {
  const m = rom(t),
    k = nokkelAv(t, n),
    r = m.get(k) || ny<V>();
  r.status = 'feil';
  r.underveis = null;
  m.set(k, r);
  rydd(t, m);
  kroker.endret();
}
/* Synkron les-gjennom for verdier som lages med en gang: gir verdien for n, eller lager den med lag og legger den inn. Sier ikke fra
   om endringen, for den som spør, bruker verdien med en gang. */
export function hentStraks<N, V>(t: Tabelldef<N, V>, n: N, lag: () => V): V {
  const m = rom(t),
    k = nokkelAv(t, n),
    har = m.get(k);
  if (har && har.status === 'ok') return har.verdi as V;
  const r = ny<V>();
  r.status = 'ok';
  r.verdi = lag();
  r.utgave = ++lopenr;
  m.set(k, r);
  rydd(t, m);
  return r.verdi;
}
/* Utgaven av verdien for n: nytt nummer hver gang den legges inn, 0 før den finnes */
export const utgave = <N, V>(t: Tabelldef<N, V>, n: N) => {
  const r = se(t, n);
  return r ? r.utgave : 0;
};
/* Glemmer nøklene i tabellen der hvis(nøkkel) er sann */
export function glem<N, V>(t: Tabelldef<N, V>, hvis: (nokkel: string) => boolean) {
  const m = rom(t);
  for (const [k, r] of [...m])
    if (hvis(k)) {
      m.delete(k);
      tattUt(t, k, r);
    }
  kroker.endret();
}
/* Gull for kommunen nr er utdatert: planrutenettet eller det kartlagte er nytt */
export function utdaterGull(nr: string) {
  gullUtgave.set(nr, (gullUtgave.get(nr) || 0) + 1);
  kroker.gullUtdatert(nr);
}
/* Alle ferdige verdier i tabellen, som [nøkkel, verdi], eldst først */
export const alle = <N, V>(t: Tabelldef<N, V>): [string, V][] =>
  [...rom(t)].filter(([, r]) => r.status === 'ok').map(([k, r]) => [k, r.verdi as V]);
/* f kalles hver gang en ny verdi er lagt inn i tabellen */
export function vedNy<N, V>(t: Tabelldef<N, V>, f: (v: V, nokkel: string) => void) {
  if (!lyttere.has(t)) lyttere.set(t, []);
  lyttere.get(t)!.push(f);
}
/* f kalles når en verdi går ut av tabellen */
export function vedGlemt<N, V>(t: Tabelldef<N, V>, f: (v: V, nokkel: string) => void) {
  if (!glemtLyttere.has(t)) glemtLyttere.set(t, []);
  glemtLyttere.get(t)!.push(f);
}

/* Omtrent hvor mange byte en verdi tar: bilder, lerreter og tallrekker telles, flater anslås ut fra antall punkter, og det andre
   grovt. Det som er telt én gang, telles ikke igjen. */
function storrelse(v: unknown, sett: Set<unknown>, dybde = 0): number {
  if (v == null || typeof v !== 'object') return typeof v === 'string' ? v.length * 2 : 8;
  if (sett.has(v) || dybde > 8) return 0;
  sett.add(v);
  if (v instanceof ArrayBuffer) return v.byteLength;
  if (ArrayBuffer.isView(v)) return v.byteLength;
  if (typeof HTMLCanvasElement !== 'undefined' && v instanceof HTMLCanvasElement) return v.width * v.height * 4;
  if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return v.width * v.height * 4;
  if (typeof CanvasRenderingContext2D !== 'undefined' && v instanceof CanvasRenderingContext2D) return 0;
  if (Array.isArray(v) && v.length && Array.isArray(v[0]) && typeof v[0][0] === 'number')
    return v.length * 48; /* en ring av punkter */
  let sum = 0;
  if (v instanceof Map) for (const x of v.values()) sum += storrelse(x, sett, dybde + 1);
  else if (v instanceof Set) for (const x of v) sum += storrelse(x, sett, dybde + 1);
  else for (const x of Object.values(v)) sum += storrelse(x, sett, dybde + 1);
  return sum;
}
/* Det cachen inneholder nå, til oversikten under Tekniske valg: per tabell navnet, hva den er og grensen, og hver rad med status,
   om den er utdatert eller delvis, omtrentlig størrelse i byte, hvor lenge ETL-funksjonen brukte, og alder i sekunder. Tabellene
   står i den rekkefølgen katalogen har dem. */
export function innhold() {
  const sett = new Set<unknown>(),
    na = Date.now();
  return ALLE.map(t => ({
    navn: fulltNavn(t),
    lag: t.lag,
    om: t.om,
    husk: t.husk,
    voksende: !!t.voksende,
    rader: [...rom(t)].map(([k, r]) => ({
      nokkel: k,
      status: r.status,
      utdatert: r.status === 'ok' && !gyldig(t, k, r),
      delvis: r.delvis,
      byte: r.verdi === undefined ? 0 : storrelse(r.verdi, sett),
      ms: r.ms,
      sekunder: Math.round((na - r.tid) / 1000)
    }))
  }));
}
