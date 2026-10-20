/* Cachen: svarene fra ETL-funksjonene i katalogen (katalog.ts), lagret per tabell og nøkkel. Nøkkelen er som regel kommunenummeret.
   Hver rad har status (henter, feil eller ok), verdien, utgaven og når den ble laget. Katalogen og cachen er to ting: katalogen er
   det interne API-et, som sier hvilke tabeller som finnes, hvordan de kalles og hvor ETL-funksjonen står. Cachen husker svarene, så
   mange som tabellen sier (husk). En tabell med husk 0 går gjennom katalogen uten at noe lagres. En tabell kan også ha et ferdig svar
   som ligger lagret sammen med siden (lagret), og da kjøres ikke ETL-funksjonen for det. ETL-koden i bronse, sølv og gull vet ingenting om cachen: den kaller katalogen, og det er cachen som sier om
   svaret allerede finnes.

   Les-gjennom: kaller man en tabell, gis verdien hvis den finnes. Ellers kjøres ETL-funksjonen, som selv kaller katalogen etter det
   den bygger på, og så videre ned til kilden. Et kall som alt er underveis, deles. Det som feilet, står som feilet til noen kaller
   tabellen på nytt.

   Det meste kommer fra kildene og endres ikke mens siden er åpen. Noe bygger på det brukeren gjør: egne områder. Tabellene som gjør
   det, er merket brukerstyrt. Når datamotoren sier fra om at brukeren har endret noe i en kommune
   (brukerEndret), er de utdatert for den kommunen. Nøkkelen i en brukerstyrt tabell begynner med kommunenummeret: 5001, eller 5001/gammel
   for et utvalg av utbyggingen (gull/utbygging.ts). Siden får det gamle svaret til det nye er regnet ut, så tallene ikke blinker. En
   ETL-funksjon som kaller en brukerstyrt tabell, venter på det nye. I tabellene merket gammelFast er kommuneplanen alene i hele
   kommunen (5001/gammel) et unntak: den er den samme uansett egne områder, så den blir ikke utdatert og regnes ikke ut på nytt når
   de endres.

   Verdiene lagres som de er, uten å kopieres eller gjøres om til tekst. Det som ligger i cachen, endres derfor ikke etterpå: et nytt
   svar erstatter det gamle. Unntaket er tabeller merket voksende (utbyggingens blokker), som fylles på
   etter hvert. Siden lagrer ingenting varig i nettleseren: cachen finnes så lenge siden er åpen. (Nettleserens vanlige hurtigbuffer
   for svar fra tjenestene er noe annet, og styres av tjenestene.) Filen importerer ingenting. */

export type Lag = 'bronse' | 'solv' | 'gull';
/* Kilden til en tabell i bronse: hvem, hvilket datasett, adressen til en side om det, og lisensen */
export interface Kildeinfo {
  navn: string;
  datasett: string;
  adresse: string;
  lisens: string;
}
/* Et datasett i sølv: ett sett data fra virkeligheten, gjort om til vår standard. Navnet, én setning om hva det er, og hva hver
   støttedata er til for, som [navn, hva]. Tabellene i bronse og sølv som henter og lager det, hører til datasettet (datasett i
   Tabelldef): dataene, som er selve datasettet, og støttedataene. Står i katalogen (DATASETT). */
export interface Datasettinfo {
  navn: string;
  om: string;
  stotte?: [navn: string, hva: string][];
}
export type Status = 'henter' | 'feil' | 'ok';
/* Én rad: status, verdien (den siste som ble ferdig), utgaven (et løpenummer som er nytt hver gang en verdi legges inn, så det aldri
   brukes to ganger), når den ble laget, hvor lenge ETL-funksjonen brukte, og kallet som er underveis. bruker er hvor mange ganger brukeren hadde endret noe i kommunen da raden ble regnet ut. */
export interface Rad<V> {
  status: Status;
  verdi: V | undefined;
  utgave: number;
  tid: number;
  ms: number;
  bruker: number;
  underveis: Promise<V> | null;
  underveisBruker: number;
}
/* Hva én rad er i en tabell der verdien ikke er en liste: ruter (et rutenett med en verdi per rute), andeler (andelen per rute i
   biter, pakket som spenn), kommuner (én post per kommune), jsonstat (en tabell fra SSB i JSON-stat), eller { utvid, som } for en
   liste med en liste inni hvert element (fylkene med kommunene: utvid er feltet med den indre listen, og som er navnet på elementet
   over). Til eksempelradene i katalogvisningen (src/ui/eksempelrader.ts). */
export type Radform = 'ruter' | 'andeler' | 'kommuner' | 'jsonstat' | { utvid: string; som: string };
/* En tabell: laget (bronse, sølv eller gull), navnet, hva den er, hvor mange nøkler som huskes, og ETL-funksjonen som lager verdien.
   N er det nøkkelen lages av, og V verdien. */
export interface Tabelldef<N, V> {
  lag: Lag;
  navn: string /* det tekniske navnet, det samme som ETL-funksjonen */;
  tittel: string /* et kort, lesbart navn, til katalogen under Tekniske valg */;
  om: string /* hva tabellen er, til katalogen */;
  husk: number /* hvor mange nøkler som huskes. Det som er brukt lengst siden, går ut først. 0: ingenting lagres. */;
  nokkel?: (n: N) => string /* nøkkelen som tekst. Uten: n selv, eller tom tekst. */;
  etl?: (
    n: N
  ) => Promise<V> /* lager verdien. Uten: motoren legger verdiene inn selv (legg), eller en ETL-funksjon (straks). */;
  fil?: string /* filen under src/data som ETL-funksjonen står i (settes av katalogen), eller som fyller tabellen */;
  voksende?: boolean /* verdien fylles på etter at den er lagt inn */;
  brukerstyrt?: boolean /* bygger på det brukeren gjør, og er utdatert når brukeren har endret noe i kommunen (nøkkelen) */;
  gammelFast?: boolean /* brukerstyrt, men svaret for kommuneplanen alene i hele kommunen (nøkkelen 5001/gammel) er det samme uansett
     egne områder, så det blir ikke utdatert når de endres */;
  etterBehov?: boolean /* i gull: regnes først når en side leser den, ikke sammen med de andre når kommunen velges */;
  glemt?: (v: V, nokkel: string) => void /* kalles når en verdi går ut av cachen */;
  lagret?: (
    n: N
  ) => Promise<V | null> /* et ferdig svar som ligger lagret sammen med siden. Finnes det, brukes det, og ETL-funksjonen kjøres
                            ikke. null eller feil: ETL-funksjonen kjøres som vanlig. Slik kan cachen starte utfylt. */;
  forklaring?: string /* hva tabellen gjør, på klarspråk, til infoknappene og metodebeskrivelsen (verktoy/forklaringer.ts) */;
  usikkerhet?: string[] /* forbehold ved tallene som kommer fra dette steget */;
  kilde?: Kildeinfo /* i bronse: hvor dataene hentes fra */;
  datasett?: Datasettinfo /* i bronse og sølv: datasettet i sølv tabellen hører til */;
  stotte?: boolean /* tabellen er støttedata. I et datasett er tabellen uten dataene, altså selve datasettet. I gull er det sidene viser
    data, og mellomregninger og hurtigminne støttedata. */;
  innhold?: string /* hva dataene i tabellen er, på klarspråk: hva en rad, et bilde eller en verdi inneholder */;
  radform?: Radform /* hva én rad er, når verdien ikke er en liste eller et svar med en liste inni (Radform) */;
  endepunkt?: string /* i bronse: adressen som kalles, uten parametre ({…} er det som settes inn), eller filen sammen med siden */;
  teknisk?: boolean /* et steg som ikke endrer tallene: et oppslag, et lagret svar eller en hjelpetabell. Står ikke som eget steg i
     infoknappene, bare i en liste for seg i metodebeskrivelsen. */;
  eksempel?: (
    u: Utgangspunkt
  ) => N | null /* til tabeller som ikke lagres: nøkkelen katalogvisningen spør med. null når det tabellen bygger på, ikke finnes,
                   som egne områder som ikke er tegnet. Uten: valgt kommune, eller ingen nøkkel for tabeller uten. */;
}
/* Det katalogvisningen har å spørre ut fra: valgt kommune, og midten av kartet med flisnivået der */
export interface Utgangspunkt {
  nr: string | null;
  midt: number[] | null;
  z: number;
}
/* En tabell man kaller med nøkkelen: katalog.solv.grense('5001') gir grensen for Trondheim, fra cachen eller fra ETL-funksjonen.
   For tabeller uten ETL-funksjon gir kallet verdien som den er, eller null. naa gir verdien som den er nå, eller null, og starter hentingen hvis den mangler. straks gir verdien med en gang, og lager den
   med lag hvis den mangler (til maskene, som lages midt i en utregning). */
export type Tabell<N, V> = Tabelldef<N, V> & {
  (n: N): Promise<V>;
  naa: (n: N) => V | null;
  straks: (n: N, lag: () => V) => V;
};

const ALLE: Tabell<any, any>[] = [];
const innholdet = new Map<Tabelldef<any, any>, Map<string, Rad<any>>>();
const brukerUtgave = new Map<string, number>(); /* hvor mange ganger brukeren har endret noe, per kommune */
/* Hvor mange ganger brukeren har endret noe i kommunen nøkkelen k i tabellen t hører til: det som står før den første skråstreken.
   I tabellene merket gammelFast avhenger kommuneplanen alene i hele kommunen (5001/gammel) ikke av det brukeren gjør, og har alltid
   0. */
const brukerI = (t: Tabelldef<any, any>, k: string) => {
  const [nr, plan, omrade] = k.split('/');
  return t.gammelFast && plan === 'gammel' && omrade === undefined ? 0 : brukerUtgave.get(nr) || 0;
};
const gjennom = new Map<
  Tabelldef<any, any>,
  Map<string, Promise<any>>
>(); /* kall underveis i tabeller som ikke lagres */
let lopenr = 0; /* siste utgave som er gitt */
const kroker = {
  endret: () => {},
  kjort: (_navn: string, _ms: number) => {},
  brukerEndret: (_nr: string) => {}
};
/* Den som vil vite når noe er endret (datamotoren), gir en funksjon her */
export const nårEndret = (f: () => void) => {
  kroker.endret = f;
};
/* Hvor lenge hver ETL-funksjon i sølv og gull brukte, til tidtakingen under Tekniske valg */
export const nårKjort = (f: (navn: string, ms: number) => void) => {
  kroker.kjort = f;
};
/* Brukeren har endret noe i kommunen nr, og de brukerstyrte tabellene er utdatert. Datamotoren kan da be om det sidene viser, så
   det er klart. */
export const nårBrukerEndret = (f: (nr: string) => void) => {
  kroker.brukerEndret = f;
};

const rom = <N, V>(t: Tabelldef<N, V>) => innholdet.get(t) as Map<string, Rad<V>>;
const nokkelAv = <N, V>(t: Tabelldef<N, V>, n: N) => (t.nokkel ? t.nokkel(n) : n === undefined ? '' : String(n));
export const fulltNavn = (t: Tabelldef<any, any>) => `${t.lag}.${t.navn}`;
/* Svaret for n: det lagrede når tabellen har et, ellers fra ETL-funksjonen */
const lagSvar = <N, V>(t: Tabelldef<N, V>, n: N): Promise<V> =>
  t.lagret
    ? t
        .lagret(n)
        .catch(() => null)
        .then(v => (v === null ? t.etl!(n) : v))
    : t.etl!(n);
const gyldig = <V>(t: Tabelldef<any, V>, k: string, r: Rad<V>) =>
  r.status === 'ok' && (!t.brukerstyrt || r.bruker === brukerI(t, k));

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
  bruker: 0,
  underveis: null,
  underveisBruker: 0
});
function settInn<N, V>(t: Tabelldef<N, V>, k: string, r: Rad<V>, v: V, bruker: number) {
  const m = rom(t);
  r.status = 'ok';
  r.verdi = v;
  r.utgave = ++lopenr;
  r.tid = Date.now();
  r.bruker = bruker;
  r.underveis = null;
  brukt(m, k, r);
  rydd(t, m);
  kroker.endret();
}

/* Les-gjennom, asynkront: gir verdien for n. Mangler den, er den utdatert, eller feilet den sist, lages den med ETL-funksjonen, eller
   hentes fra det lagrede svaret når tabellen har et. Det er dette som skjer når man kaller en tabell. */
export function hent<N, V>(t: Tabelldef<N, V>, n: N): Promise<V> {
  if (!t.husk && t.etl) return gaaGjennom(t, n);
  const m = rom(t),
    k = nokkelAv(t, n),
    har = m.get(k);
  if (har && gyldig(t, k, har)) {
    brukt(m, k, har);
    return Promise.resolve(har.verdi as V);
  }
  const bruker = brukerI(t, k);
  /* Et kall som er underveis, deles, så sant brukeren ikke har endret noe siden det startet */
  if (har && har.underveis && (!t.brukerstyrt || har.underveisBruker === bruker)) return har.underveis;
  if (!t.etl)
    /* tabeller uten ETL-funksjon: verdien som den er, eller null */
    return Promise.resolve((har && har.status === 'ok' ? har.verdi : null) as V);
  const r =
      har && (har.status === 'ok' || har.underveis) ? har : ny(har) /* et utdatert svar vises til det nye er klart */,
    p: Promise<V> = Promise.resolve()
      .then(() => {
        const t0 = performance.now();
        return lagSvar(t, n).then(v => {
          r.ms = performance.now() - t0;
          if (t.lag !== 'bronse') kroker.kjort(fulltNavn(t), r.ms);
          return v;
        });
      })
      .then(
        v => {
          if (m.get(k) === r && r.underveis === p) settInn(t, k, r, v, bruker);
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
  r.underveisBruker = bruker;
  if (r !== har) {
    m.set(k, r);
    rydd(t, m);
  }
  kroker.endret();
  return p;
}

/* Tabeller som ikke lagres (husk 0): katalogen er bare veien til ETL-funksjonen. Et kall som alt er underveis, deles likevel, så to
   som spør samtidig, gir ett kall til kilden. */
function gaaGjennom<N, V>(t: Tabelldef<N, V>, n: N): Promise<V> {
  let u = gjennom.get(t);
  if (!u) gjennom.set(t, (u = new Map()));
  const k = nokkelAv(t, n),
    har = u.get(k);
  if (har) return har;
  const t0 = performance.now(),
    p = lagSvar(t, n)
      .then(v => {
        if (t.lag !== 'bronse') kroker.kjort(fulltNavn(t), performance.now() - t0);
        return v;
      })
      .finally(() => u!.delete(k));
  u.set(k, p);
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
  settInn(t, k, m.get(k) || ny<V>(), v, brukerI(t, k));
}
/* Verdien for n når den finnes og ikke er utdatert, ellers null. Starter ingenting. */
export function gjeldende<N, V>(t: Tabelldef<N, V>, n: N): V | null {
  const k = nokkelAv(t, n),
    r = rom(t).get(k);
  return r && gyldig(t, k, r) ? (r.verdi as V) : null;
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
/* Glemmer alle svar som feilet, i alle tabellene, så de hentes eller regnes ut på nytt neste gang noen spør, også fra visningen (les
   prøver ikke igjen det som feilet). Brukes når brukeren ber om et nytt forsøk. */
export function glemFeilede() {
  for (const t of ALLE) {
    const m = rom(t);
    for (const [k, r] of [...m])
      if (r.status === 'feil') {
        m.delete(k);
        tattUt(t, k, r);
      }
  }
  kroker.endret();
}
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
/* Brukeren har endret noe i kommunen nr: egne områder. De brukerstyrte tabellene er utdatert for
   kommunen, og regnes ut på nytt neste gang noen spør. Datamotoren kaller denne. */
export function brukerEndret(nr: string) {
  brukerUtgave.set(nr, (brukerUtgave.get(nr) || 0) + 1);
  kroker.brukerEndret(nr);
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
/* Det cachen inneholder nå, til oversikten under Tekniske valg: per tabell navnet, tittelen, hva den er og grensen, og hver rad med status,
   om den er utdatert, omtrentlig størrelse i byte, hvor lenge ETL-funksjonen brukte, og alder i sekunder. Tabellene
   står i den rekkefølgen katalogen har dem. */
export function innhold() {
  const sett = new Set<unknown>(),
    na = Date.now();
  return ALLE.map(t => ({
    navn: fulltNavn(t),
    tittel: t.tittel,
    lag: t.lag,
    fil: t.fil || '',
    om: t.om,
    husk: t.husk,
    etl: !!t.etl,
    voksende: !!t.voksende,
    brukerstyrt: !!t.brukerstyrt,
    lagret: !!t.lagret,
    forklaring: t.forklaring || '',
    datasett: t.datasett || null,
    stotte: !!t.stotte,
    innholdet: t.innhold || '',
    radform: t.radform || null,
    sporbar: !t.husk && !!t.etl,
    rader: [...rom(t)].map(([k, r]) => ({
      nokkel: k,
      status: r.status,
      utdatert: r.status === 'ok' && !gyldig(t, k, r),
      byte: r.verdi === undefined ? 0 : storrelse(r.verdi, sett),
      ms: r.ms,
      sekunder: Math.round((na - r.tid) / 1000)
    }))
  }));
}
/* Til «Spør» i katalogvisningen: nøkkelen tabellen med det fulle navnet kan spørres med ut fra u, som verdi (n) og tekst (nokkel).
   Bare tabeller som ikke lagres, spørres, for det som lagres, står i cachen. Spørringen kan hente fra kildene, men ikke spørre etter
   noe som ikke finnes. Da gir eksempel null, og her blir det null. */
export function eksempelI(navn: string, u: Utgangspunkt): { n: unknown; nokkel: string } | null {
  const t = ALLE.find(x => fulltNavn(x) === navn);
  if (!t || !t.etl || t.husk) return null;
  const n = t.eksempel ? t.eksempel(u) : t.etl.length ? u.nr : undefined;
  return n === null ? null : { n, nokkel: nokkelAv(t, n) };
}
/* Kaller tabellen med det fulle navnet med nøkkelen n, som enhver som bruker katalogen */
export function kallI(navn: string, n: unknown): Promise<unknown> {
  const t = ALLE.find(x => fulltNavn(x) === navn);
  return t ? hent(t, n) : Promise.reject(new Error('ukjent tabell'));
}
/* Verdien i raden med nøkkelen k i tabellen med det fulle navnet (som solv.grense), til oversikten under Tekniske valg. undefined når
   raden ikke finnes, eller ikke har noen verdi ennå. */
export function verdiI(navn: string, k: string): unknown {
  const t = ALLE.find(x => fulltNavn(x) === navn),
    r = t ? rom(t).get(k) : undefined;
  return r ? r.verdi : undefined;
}
