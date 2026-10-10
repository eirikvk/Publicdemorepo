/* Bronse, felles for alle kildene: hvordan det hentes. Hvert kall måles og føres i kall-loggen, og kartbilder hentes gjennom en kø
   per kilde med høyst fire kall om gangen. Alt nettverk går gjennom denne filen. Bronse husker ingenting: det som skal huskes, legger
   datamotoren i katalogen (data/motor/katalog.ts), og den deler også kall som alt er underveis.
   Filen vet ingenting om resten av siden. Hva som skjer, står i henteStatus, og den som vil vite det, gir en funksjon til
   nårHentingEndres (datamotoren gjør det, se data/motor/tilstand.ts). */

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
/* Henter fra url. kilde og hva står i kall-loggen. stille: feil føres ikke i loggen. bytes: svaret er et bilde eller en annen fil
   (ArrayBuffer), ellers JSON. kropp: spørringen sendes som POST med denne teksten. JSON-svaret er unknown: filen for hver kilde sier
   hvilken form det har. */
export function hent(
  kilde: string,
  hva: string,
  url: string,
  stille: boolean,
  bytes: true,
  kropp?: string
): Promise<ArrayBuffer>;
export function hent(
  kilde: string,
  hva: string,
  url: string,
  stille?: boolean,
  bytes?: false,
  kropp?: string
): Promise<unknown>;
export async function hent(
  kilde: string,
  hva: string,
  url: string,
  stille?: boolean,
  bytes?: boolean,
  kropp?: string
): Promise<unknown> {
  const t0 = performance.now();
  try {
    const r = await fetch(url, kropp ? { method: 'POST', body: kropp } : undefined);
    if (!r.ok) throw new Error(String(r.status));
    const b = await r.blob();
    logg(kilde, hva, performance.now() - t0, b.size);
    return bytes ? await b.arrayBuffer() : JSON.parse(await b.text());
  } catch (e) {
    if (!stille) logg(kilde, hva, 0, 0, true);
    throw e;
  }
}
/* Én henter per kilde for kartbilder: egen kø med høyst fire kall om gangen, og én linje i kall-loggen per runde. */
const hentere: Henter[] = [];
export const opptatt = () => hentere.some(h => h.opptatt());
/* En henter for kartbilder fra én kilde: henter(adresse) gir bildet, og opptatt sier om den holder på */
export interface Henter {
  (src: string): Promise<ArrayBuffer>;
  opptatt: () => boolean;
}
export function lagHenter(kilde: string, hva: string): Henter {
  const ko: (() => void)[] = [];
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
  const hent = async (src: string) => {
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
  hentere.push(hent);
  return hent;
}
