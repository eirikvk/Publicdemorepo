/* Bronse, felles for alle kildene: hvordan det hentes. Svar huskes så lenge siden er åpen, hvert kall måles og vises i kall-loggen,
   og kartbilder hentes gjennom en kø per kilde med høyst fire kall om gangen. Alt nettverk går gjennom denne filen. Den melder fra
   til motoren om hva som skjer (kall-loggen i app.kall, og om kartet laster), men endrer ikke dataene. */
import { SAMTIDIG, app, endret, husk, kb, nf } from '../motor/felles.js';
import { kartflagg } from '../motor/grunnlag.js';

/* Kall-logg: hvert kall mot en åpen kilde måles i nettleseren. */
function logg(kilde, hva, ms, bytes, feil) {
  app.kall = [
    [
      kilde,
      hva,
      feil ? 'feilet' : ms >= 1000 ? nf(ms / 1000) + ' s' : Math.round(ms) + ' ms',
      feil ? '' : kb(bytes),
      !!feil
    ],
    ...app.kall
  ].slice(0, 8);
  endret();
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
    if (runde.n) {
      logg(kilde, `${hva}, ${fliser(runde.n)}`, ms, runde.bytes);
      app.siste = `Siste kall mot ${kilde}: ${fliser(runde.n)}, ${nf(ms / 1000)} s, ${kb(runde.bytes)}`;
    }
    if (runde.feil) {
      logg(kilde, `${hva}, ${fliser(runde.feil)}`, 0, 0, true);
      if (!runde.n) app.siste = `Kallet mot ${kilde} feilet.`;
    }
    app.laster = opptatt();
    endret();
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
    kartflagg.nyeKall = true;
    if (!app.laster) {
      app.laster = true;
      endret();
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
      kartflagg.feilIVisning = true;
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
