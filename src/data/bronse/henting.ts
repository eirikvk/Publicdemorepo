/* Bronse, felles for alle kildene: hvordan det hentes. Svar huskes så lenge siden er åpen, hvert kall måles og føres i kall-loggen,
   og kartbilder hentes gjennom en kø per kilde med høyst fire kall om gangen. Alt nettverk går gjennom denne filen.
   Filen vet ingenting om resten av siden. Hva som skjer, står i henteStatus, og den som vil vite det, gir en funksjon til
   nårHentingEndres (datamotoren gjør det, se data/motor/tilstand.ts). */

import { husk } from '../generelt/minne.ts';

export const SAMTIDIG = 4; /* høyst fire kall om gangen mot hver kilde */

/* Ett kall i kall-loggen: kilden, hva som ble hentet, tiden i millisekunder, størrelsen i byte, og om det feilet */
export interface Kall {
  kilde: string;
  hva: string;
  ms: number;
  bytes: number;
  feilet: boolean;
}
/* Én runde med kartbilder fra én kilde: antall bilder, tiden, størrelsen, og antall som feilet */
export interface Runde {
  kilde: string;
  n: number;
  ms: number;
  bytes: number;
  feil: number;
}
/* Status for hentingen. kall er de siste kallene, nyeste først. siste er siste runde med kartbilder fra én kilde. laster sier om det
   hentes kartbilder nå. startet og feilet teller kartbilder som er bedt om og som har feilet, til kartet. */
export const henteStatus: { kall: Kall[]; siste: Runde | null; laster: boolean; startet: number; feilet: number } = {
  kall: [],
  siste: null,
  laster: false,
  startet: 0,
  feilet: 0
};
let melding = () => {};
export const nårHentingEndres = (f: () => void) => {
  melding = f;
};

/* Kall-logg: hvert kall mot en åpen kilde måles i nettleseren. */
function logg(kilde: string, hva: string, ms: number, bytes: number, feil?: boolean) {
  henteStatus.kall = [{ kilde, hva, ms, bytes, feilet: !!feil }, ...henteStatus.kall].slice(0, 8);
  melding();
}
/* Svarene huskes så lenge siden er åpen. Bytter man tilbake til en kommune, hentes verken grense, tall eller plansjekk på nytt.
   Ingenting lagres varig i nettleseren. */
const svar = new Map<string, unknown>();
/* Henter fra url. kilde og hva står i kall-loggen. stille: feil føres ikke i loggen. bytes: svaret er et bilde eller en annen fil
   (ArrayBuffer), ellers JSON. glem: svaret huskes ikke. kropp: spørringen sendes som POST med denne teksten. JSON-svaret er
   unknown: filen for hver kilde sier hvilken form det har. */
export function hent(
  kilde: string,
  hva: string,
  url: string,
  stille: boolean,
  bytes: true,
  glem?: boolean,
  kropp?: string
): Promise<ArrayBuffer>;
export function hent(
  kilde: string,
  hva: string,
  url: string,
  stille?: boolean,
  bytes?: false,
  glem?: boolean,
  kropp?: string
): Promise<unknown>;
export async function hent(
  kilde: string,
  hva: string,
  url: string,
  stille?: boolean,
  bytes?: boolean,
  glem?: boolean,
  kropp?: string
): Promise<unknown> {
  const nokkel = kropp ? url + ' ' + kropp : url;
  if (svar.has(nokkel)) return svar.get(nokkel);
  const t0 = performance.now();
  try {
    const r = await fetch(url, kropp ? { method: 'POST', body: kropp } : undefined);
    if (!r.ok) throw new Error(String(r.status));
    const b = await r.blob();
    logg(kilde, hva, performance.now() - t0, b.size);
    const verdi = bytes ? await b.arrayBuffer() : JSON.parse(await b.text());
    if (!glem) husk(svar, nokkel, verdi, 80);
    return verdi;
  } catch (e) {
    if (!stille) logg(kilde, hva, 0, 0, true);
    throw e;
  }
}
/* Én henter per kilde: egen kø med høyst fire kall om gangen, eget minne for rå flisbilder
   (så fargebytte og skjuling ikke krever nye kall), og én linje i kall-loggen per runde. */
const hentere: Henter[] = [];
export const opptatt = () => hentere.some(h => h.opptatt());
/* En henter for kartbilder fra én kilde: henter(adresse) gir bildet. opptatt sier om den holder på, og lager er de rå bildene. */
export interface Henter {
  (src: string): Promise<ArrayBuffer>;
  opptatt: () => boolean;
  lager: Map<string, ArrayBuffer>;
}
export function lagHenter(kilde: string, hva: string): Henter {
  const lager = new Map<string, ArrayBuffer>(),
    ko: (() => void)[] = [];
  let aktive = 0,
    timer: ReturnType<typeof setTimeout> | undefined,
    runde = { n: 0, bytes: 0, t0: 0, feil: 0 };
  const slipp = () => {
    while (aktive < SAMTIDIG && ko.length) {
      aktive++;
      ko.shift()!();
    }
  };
  function ferdig() {
    if (aktive || ko.length) return;
    const fliser = (n: number) => `${n} ${n === 1 ? 'flis' : 'fliser'}`,
      ms = performance.now() - runde.t0;
    if (runde.n) logg(kilde, `${hva}, ${fliser(runde.n)}`, ms, runde.bytes);
    if (runde.feil) logg(kilde, `${hva}, ${fliser(runde.feil)}`, 0, 0, true);
    if (runde.n || runde.feil) henteStatus.siste = { kilde, n: runde.n, ms, bytes: runde.bytes, feil: runde.feil };
    henteStatus.laster = opptatt();
    melding();
    runde = { n: 0, bytes: 0, t0: 0, feil: 0 };
  }
  /* Kartlaget og planlaget trenger samme flis fra NIBIO samtidig. Et kall som alt er underveis, deles i stedet for å sendes to ganger. */
  const underveis = new Map<string, Promise<ArrayBuffer>>();
  const hent = (src: string): Promise<ArrayBuffer> => {
    const har = lager.get(src);
    if (har) return Promise.resolve(har);
    let p = underveis.get(src);
    if (!p) {
      p = hentNy(src);
      underveis.set(src, p);
      p.then(
        () => underveis.delete(src),
        () => underveis.delete(src)
      );
    }
    return p;
  };
  const hentNy = async (src: string) => {
    await new Promise<void>(ok => {
      ko.push(ok);
      slipp();
    });
    clearTimeout(timer);
    if (!runde.t0) runde.t0 = performance.now();
    henteStatus.startet++;
    if (!henteStatus.laster) {
      henteStatus.laster = true;
      melding();
    }
    try {
      const r = await fetch(src);
      if (!r.ok) throw new Error(String(r.status));
      if (!(r.headers.get('content-type') || '').startsWith('image')) throw new Error('ikke bilde');
      const buf = await r.arrayBuffer();
      husk(lager, src, buf, 400);
      runde.n++;
      runde.bytes += buf.byteLength;
      return buf;
    } catch (e) {
      runde.feil++;
      henteStatus.feilet++;
      throw e;
    } finally {
      aktive--;
      slipp();
      if (!aktive && !ko.length) timer = setTimeout(ferdig, 200);
    }
  };
  hent.opptatt = () => aktive > 0 || ko.length > 0;
  hent.lager = lager;
  hentere.push(hent);
  return hent;
}
