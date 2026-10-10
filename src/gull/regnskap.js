/* Gull for utbredelsesregnskapet og land og vann: det siden viser om arealet i kommunen, regnet ut fra SSB-tallene i sølv. Klassene
   står med natur først. Alle arealer er i km². */
import { HAV_MIN_ANDEL, HAV_MIN_KM2 } from '../solv/felles.js';
import { KL } from '../solv/klasser.js';

/* Klassene med natur først, med plassen i SSB-tallene (bebygd, jordbruk, natur) */
const KLASSER = KL.map(([id, navn], i) => [id, navn, i]).reverse();
const sum = a => a[0] + a[1] + a[2];

/* Utbredelsen i nyeste år: landarealet, og arealet og andelen av landarealet for hver klasse. T er SSB-tallene fra sølv. */
export function byggUtbredelse(T) {
  if (!T || T.tilstand !== 'ok') return null;
  const land = sum(T.a);
  return {
    aar: T.aar,
    land,
    klasser: KLASSER.map(([id, navn, i]) => ({ id, navn, km2: T.a[i], andel: (T.a[i] / land) * 100 }))
  };
}

/* Forskjellen fra 2017 til nyeste år for hver klasse. H er arealet i begge årene fra sølv. Er grensen flyttet, gis bare årene.
   maks er den største forskjellen, til stolpene. */
export function byggEndring(H) {
  if (!H) return null;
  if (H.endret) return { fra: H.fra, til: H.til, endret: true };
  const klasser = KLASSER.map(([id, navn, i]) => ({ id, navn, km2: H.a1[i] - H.a0[i] }));
  return { fra: H.fra, til: H.til, endret: false, klasser, maks: Math.max(...klasser.map(x => Math.abs(x.km2))) || 1 };
}

/* Regnskapsoppstillingen: én kolonne per klasse og en sum, og radene inngående areal, netto endring og utgående areal. avvik er
   hvor mye landarealet er endret mellom årgangene, i hele dekar. */
export function byggOppstilling(H) {
  if (!H || H.endret) return null;
  const kol = a => [...KLASSER.map(([, , i]) => a[i]), sum(a)],
    a0 = kol(H.a0),
    a1 = kol(H.a1);
  return {
    fra: H.fra,
    til: H.til,
    kolonner: [...KLASSER.map(k => k[1]), 'Sum'],
    inngaende: a0,
    netto: a1.map((v, j) => v - a0[j]),
    utgaende: a1,
    avvik: Math.round((sum(H.a1) - sum(H.a0)) * 1000)
  };
}

/* Delene av kommunens flate: land og ferskvann fra SSB, og hav som det som blir igjen av flaten (fra kommunegrensen). En liten rest
   er avvik mellom grense og statistikk, ikke hav. */
export function landOgVann(flate, land, ferskvann) {
  if (!land || !ferskvann || !flate) return null;
  let hav = flate - land - ferskvann.inn - ferskvann.elv;
  if (hav < Math.max(HAV_MIN_KM2, flate * HAV_MIN_ANDEL)) hav = 0;
  return {
    hav,
    deler: [
      ['land', 'Land', land],
      ['inn', 'Innsjø', ferskvann.inn],
      ['elv', 'Elv', ferskvann.elv],
      ['hav', 'Hav', hav]
    ].filter(d => d[2] > 0)
  };
}
