/* Måling til feilsøking: hvor jevnt kartet tegnes mens det flyttes, og hvor lang tid etterarbeidet tar. Vises under Tekniske valg.
   Kartet starter målingen når det begynner å flytte seg (startMaaling) og avslutter den når det står stille (stoppMaaling). */
import type OlMap from 'ol/Map.js';
import { bruk, endret, nullstillBruk, tidSlutt } from '../../data/motor/tilstand.ts';
import { ui } from '../tilstand.ts';
import { kartflagg } from './felles.ts';
import { maalEtterarbeid } from './grunnkart.ts';

let maalRaf = 0,
  maalSist = 0,
  maalT: number[] = [],
  tegnT0 = 0,
  maalTekst = '';
export const visMaaling = () => {
  const deler = Object.entries(bruk)
    .filter(([, b]) => b.sum >= 1)
    .sort((a, b) => b[1].sum - a[1].sum)
    .map(([navn, b]) => `${navn} ${Math.round(b.sum)} ms (${b.n} ganger, lengst ${Math.round(b.maks)} ms)`);
  const tekst =
    [maalTekst, maalEtterarbeid[0], deler.length ? `Tid brukt siden flyttingen startet: ${deler.join(', ')}.` : '']
      .filter(Boolean)
      .join(' ') || 'Flytt kartet for å måle hvor jevnt det går.';
  if (tekst === ui.maaling) return;
  ui.maaling = tekst;
  endret();
};
const maalBilde = (t: number) => {
  if (maalSist) maalT.push(t - maalSist);
  maalSist = t;
  maalRaf = requestAnimationFrame(maalBilde);
};
export function stoppMaaling() {
  cancelAnimationFrame(maalRaf);
  if (maalT.length < 5) return;
  const a = maalT.slice().sort((x, y) => x - y),
    median = a[a.length >> 1];
  maalTekst = `Siste flytting: ${Math.round(1000 / median)} bilder per sekund, lengste opphold ${Math.round(a[a.length - 1])} ms, ${a.filter(v => v > 100).length} opphold over 0,1 s (${a.length} bilder).`;
  visMaaling();
}
/* Starter målingen av en flytting */
export function startMaaling() {
  cancelAnimationFrame(maalRaf);
  maalT = [];
  maalSist = 0;
  nullstillBruk();
  maalRaf = requestAnimationFrame(maalBilde);
}
/* Måler tiden kartet bruker på å tegne, og viser målingen jevnlig når kartet står stille */
export function maalKartet(kart: OlMap) {
  kart.on('precompose', () => {
    tegnT0 = performance.now();
  });
  kart.on('postcompose', () => {
    if (tegnT0) tidSlutt('tegning', tegnT0);
  });
  setInterval(() => {
    if (!kartflagg.iBevegelse) visMaaling();
  }, 1500);
}
