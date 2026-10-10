/* Datamotoren, inngrepsfri natur (INON) fra Miljødirektoratet: natur som ligger minst én kilometer fra tyngre tekniske inngrep, delt
   i tre soner etter avstand. Sonene hentes som ett bilde av hele kommunen når kommunen velges (bronse/mdir-inon.ts), gjøres om til
   sone per rute (solv/inon.ts) og areal per sone (gull/inon.ts). Resultatet huskes for de siste kommunene så lenge siden er åpen,
   så et nytt valg av samme kommune koster ingenting. Kartlaget tegnes av sonene per rute, se ui/kart/inon.ts. */
import { hentInonBilde } from '../bronse/mdir-inon.ts';
import { husk } from '../generelt/minne.ts';
import { BILDE_TEMA, m2PerKm2, rutenett } from '../solv/felles.ts';
import { bildePiksler, flatePiksler } from '../solv/raster.ts';
import { tolkInon } from '../solv/inon.ts';
import { arealFraRuter } from '../gull/felles.ts';
import type { Kommune } from '../solv/felles.ts';
import { app, endret, tidSlutt, valgNr, type Grense } from './tilstand.ts';

const inonMinne = new Map();
export async function sjekkInon(k: Kommune, grense: Grense, mitt: number) {
  const har = inonMinne.get(k.nr);
  if (har) {
    husk(inonMinne, k.nr, har, 3);
    app.inon = har;
    endret();
    return;
  }
  app.inon = { nr: k.nr, tilstand: 'henter' };
  endret();
  try {
    const R = rutenett(grense.ext, ...BILDE_TEMA),
      { res, w, h, u } = R;
    const buf = await hentInonBilde(k, u, w, h);
    if (mitt !== valgNr) return;
    const t0 = performance.now(),
      S = tolkInon(await bildePiksler(buf, w, h), flatePiksler(grense.koord, R)),
      A = arealFraRuter(S.n, res, m2PerKm2(grense.ext));
    app.inon = { nr: k.nr, tilstand: 'ok', soner: A.km2, sum: A.sum, sone: S.sone, u, res, w, h };
    husk(inonMinne, k.nr, app.inon, 3);
    tidSlutt('inngrepsfri natur, kommunebilde', t0);
  } catch (e) {
    if (mitt !== valgNr) return;
    app.inon = { nr: k.nr, tilstand: 'feil' };
  }
  endret();
}
