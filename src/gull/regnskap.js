/* Gull for utbredelsesregnskapet og land og vann: det siden viser om arealet i kommunen, regnet ut fra SSB-tallene i sølv. */
import { HAV_MIN_ANDEL, HAV_MIN_KM2 } from '../solv/felles.js';

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
