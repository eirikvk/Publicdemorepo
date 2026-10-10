/* Sølv for SSB, tabell 09594: svarene (JSON-stat 2.0) gjort om til arealet i km² per klasse (bebygd, jordbruk, natur), med innsjø og
   elv for seg, for nyeste år og for 2017. */
import { GRENSE_FLYTTET } from './felles.js';
import { KL } from './klasser.js';

/* Rekkefølgen på kategoriene i en dimensjon. SSB gir indeksen enten som liste eller som objekt med plass. */
const liste = x => (Array.isArray(x) ? x : Object.keys(x).sort((a, b) => x[a] - x[b]));

/* Arealet per klasse i nyeste år: SSBs arealklasser summert til bebygd, jordbruk og natur (se KL), og innsjø og elv for seg. */
export function tolkAreal(j) {
  const ix = j.dimension.ArealKlasse.category.index,
    tid = j.dimension.Tid.category.index;
  const pos = Array.isArray(ix) ? Object.fromEntries(ix.map((c, i) => [c, i])) : ix;
  return {
    a: KL.map(x => x[3].reduce((s, c) => s + (j.value[pos[c]] || 0), 0)),
    aar: Array.isArray(tid) ? tid[0] : Object.keys(tid)[0],
    ferskvann: { inn: j.value[pos['22.01']] || 0, elv: j.value[pos['22.02']] || 0 }
  };
}

/* Arealet per klasse i 2017 (a0) og i nyeste år (a1), til utbredelsesregnskapet. Gir ingenting hvis serien ikke rekker tilbake til
   2017. endret sier at kommunens samlede areal er så forskjellig at grensen trolig er flyttet, og da skal årgangene ikke
   sammenlignes. */
export function tolkHistorie(j, nr) {
  const kl = liste(j.dimension.ArealKlasse.category.index),
    aar = liste(j.dimension.Tid.category.index),
    nT = aar.length;
  const v = (c, t) => j.value[kl.indexOf(c) * nT + t] || 0,
    sum = t => KL.map(x => x[3].reduce((s, c) => s + v(c, t), 0)),
    alt = t => sum(t).reduce((s, x) => s + x, 0) + v('22.01', t) + v('22.02', t);
  const f = aar.indexOf('2017');
  if (f < 0 || nT - f < 2 || !alt(f) || !alt(nT - 1)) return null;
  return {
    nr,
    fra: aar[f],
    til: aar[nT - 1],
    a0: sum(f),
    a1: sum(nT - 1),
    endret: Math.abs(alt(nT - 1) - alt(f)) / alt(nT - 1) > GRENSE_FLYTTET
  };
}
