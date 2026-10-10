/* Datamotoren, inngrepsfri natur (INON) fra Miljødirektoratet: natur som ligger minst én kilometer fra tyngre tekniske inngrep, delt
   i tre soner etter avstand. Sonene hentes som ett bilde av hele kommunen når kommunen velges (bronse/mdir-inon.js), gjøres om til
   sone per rute (solv/inon.js) og areal per sone (gull/inon.js). Resultatet huskes for de siste kommunene så lenge siden er åpen,
   så et nytt valg av samme kommune koster ingenting. Kartlaget tegnes av sonene per rute, se ui/kart/inon.js. */
import { hentInonBilde } from '../bronse/mdir-inon.js';
import { husk } from '../bronse/henting.js';
import { BILDE_TEMA, m2PerKm2, rutenett } from '../solv/felles.js';
import { sti, tegneflate } from '../solv/raster.js';
import { tolkInon } from '../solv/inon.js';
import { inonAreal } from '../gull/inon.js';
import { app, endret, tidSlutt, valgNr } from './tilstand.js';

const inonMinne = new Map();
export async function sjekkInon(k, grense, mitt) {
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
    const { res, w, h, u } = rutenett(grense.ext, ...BILDE_TEMA);
    const buf = await hentInonBilde(k, u, w, h);
    if (mitt !== valgNr) return;
    const t0 = performance.now(),
      a = tegneflate(w, h),
      b = tegneflate(w, h);
    a.drawImage(await createImageBitmap(new Blob([buf])), 0, 0, w, h);
    sti(b, grense.koord, u, 1 / res);
    b.fill('evenodd');
    const S = tolkInon(a.getImageData(0, 0, w, h).data, b.getImageData(0, 0, w, h).data),
      A = inonAreal(S.n, res, m2PerKm2(grense.ext));
    app.inon = { nr: k.nr, tilstand: 'ok', soner: A.soner, sum: A.sum, sone: S.sone, u, res, w, h };
    husk(inonMinne, k.nr, app.inon, 3);
    tidSlutt('inngrepsfri natur, kommunebilde', t0);
  } catch (e) {
    if (mitt !== valgNr) return;
    app.inon = { nr: k.nr, tilstand: 'feil' };
  }
  endret();
}
