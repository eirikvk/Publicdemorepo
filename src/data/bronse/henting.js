/* Bronse, felles for alle kildene: hvordan det hentes. Svar huskes så lenge siden er åpen, hvert kall måles og føres i kall-loggen,
   og kartbilder hentes gjennom en kø per kilde med høyst fire kall om gangen. Alt nettverk går gjennom denne filen.
   Filen vet ingenting om resten av siden. Hva som skjer, står i henteStatus, og den som vil vite det, gir en funksjon til
   nårHentingEndres (datamotoren gjør det, se data/motor/tilstand.js). */

export const SAMTIDIG = 4; /* høyst fire kall om gangen mot hver kilde */

/* Minne med fast plass: det eldste går ut når det blir fullt, og det som legges inn på nytt, regnes som nytt. */
export const husk = (minne, nokkel, verdi, plass) => {
  minne.delete(nokkel);
  minne.set(nokkel, verdi);
  if (minne.size > plass) minne.delete(minne.keys().next().value);
};

/* Status for hentingen. kall er de siste kallene, nyeste først: { kilde, hva, ms, bytes, feilet }. siste er siste runde med
   kartbilder fra én kilde: { kilde, n, ms, bytes, feil }. laster sier om det hentes kartbilder nå. startet og feilet teller
   kartbilder som er bedt om og som har feilet, til kartet. */
export const henteStatus = { kall: [], siste: null, laster: false, startet: 0, feilet: 0 };
let melding = () => {};
export const nårHentingEndres = f => {
  melding = f;
};

/* Kall-logg: hvert kall mot en åpen kilde måles i nettleseren. */
function logg(kilde, hva, ms, bytes, feil) {
  henteStatus.kall = [{ kilde, hva, ms, bytes, feilet: !!feil }, ...henteStatus.kall].slice(0, 8);
  melding();
}
/* Svarene huskes så lenge siden er åpen. Bytter man tilbake til en kommune, hentes verken grense, tall eller plansjekk på nytt.
   Ingenting lagres varig i nettleseren. */
const svar = new Map();
export async function hent(kilde, hva, url, stille, bytes, glem, kropp) {
  const nokkel = kropp ? url + ' ' + kropp : url;
  if (svar.has(nokkel)) return svar.get(nokkel);
  const t0 = performance.now();
  try {
    const r = await fetch(url, kropp ? { method: 'POST', body: kropp } : undefined);
    if (!r.ok) throw new Error(r.status);
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
const hentere = [];
export const opptatt = () => hentere.some(h => h.opptatt());
export function lagHenter(kilde, hva) {
  const lager = new Map(),
    ko = [];
  let aktive = 0,
    timer = null,
    runde = { n: 0, bytes: 0, t0: 0, feil: 0 };
  const slipp = () => {
    while (aktive < SAMTIDIG && ko.length) {
      aktive++;
      ko.shift()();
    }
  };
  function ferdig() {
    if (aktive || ko.length) return;
    const fliser = n => `${n} ${n === 1 ? 'flis' : 'fliser'}`,
      ms = performance.now() - runde.t0;
    if (runde.n) logg(kilde, `${hva}, ${fliser(runde.n)}`, ms, runde.bytes);
    if (runde.feil) logg(kilde, `${hva}, ${fliser(runde.feil)}`, 0, 0, true);
    if (runde.n || runde.feil) henteStatus.siste = { kilde, n: runde.n, ms, bytes: runde.bytes, feil: runde.feil };
    henteStatus.laster = opptatt();
    melding();
    runde = { n: 0, bytes: 0, t0: 0, feil: 0 };
  }
  /* Kartlaget og planlaget trenger samme flis fra NIBIO samtidig. Et kall som alt er underveis, deles i stedet for å sendes to ganger. */
  const underveis = new Map();
  const hent = src => {
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
  const hentNy = async src => {
    await new Promise(ok => {
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
      if (!r.ok) throw new Error(r.status);
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
