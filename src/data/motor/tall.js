/* Tallene fra SSB, tabell 09594: arealklasser, land og vann, og arealet fra 2017 til utbredelsesregnskapet. Hentes i bronse/ssb.js
   og tolkes i solv/ssb.js. Tilstanden ligger i app: arealtall, ssbSum, ferskvann og historie. */
import { hentArealtall, hentTidsserie } from '../bronse/ssb.js';
import { tolkAreal, tolkHistorie } from '../solv/ssb.ts';
import { app, endret, valgNr } from './tilstand.js';

export function nullstillTall(tilstand) {
  /* ingen tall å vise: de hentes, eller hentingen feilet */
  app.ssbSum = 0;
  app.ferskvann = null;
  app.arealtall = { tilstand };
  endret();
}

export async function hentTall(k, mitt) {
  try {
    const j = await hentArealtall(k);
    if (mitt !== valgNr) return;
    const T = tolkAreal(j);
    app.ferskvann = T.ferskvann;
    app.arealtall = { tilstand: 'ok', a: T.a, aar: T.aar };
    app.ssbSum = T.land;
    endret();
  } catch (e) {
    if (mitt === valgNr) nullstillTall('feil');
  }
}
/* Arealet i 2017 og i SSBs nyeste tall, til utbredelsesregnskapet. SSB advarer mot å lese forskjeller mellom årganger som
   endring, så siden sier at det er en forskjell og ikke målt endring. Er kommunens samlede flate en annen i 2017, er grensen
   flyttet, og da vises ingen sammenligning. */
export async function hentHistorie(k, mitt) {
  try {
    const j = await hentTidsserie(k);
    if (mitt !== valgNr) return;
    const H = tolkHistorie(j, k.nr);
    if (!H) return;
    app.historie = H;
    endret();
  } catch (e) {} /* uten historiske tall vises ikke blokken */
}
