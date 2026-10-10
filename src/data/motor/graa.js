/* Datamotoren, grått areal: areal som alt er tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet. To bilder av hele
   kommunen hentes når kommunen velges (bronse/nibio-graa.js), gjøres om til trinn per rute (solv/graa.js), og arealet og
   kryssingen med planen regnes ut i gull/graa.js. Grått betyr ikke ledig: et boligområde i bruk er like grått som en nedlagt
   fabrikktomt. Kartlaget tegnes av trinnene per rute, se ui/kart/graa.js. */
import { hentGraaBilde } from '../bronse/nibio-graa.js';
import { husk } from '../bronse/henting.js';
import { BILDE_TEMA, m2PerKm2, rutenett } from '../solv/felles.js';
import { sti, tegneflate } from '../solv/raster.js';
import { tolkGraa } from '../solv/graa.js';
import { graaAreal, kryssGraa } from '../gull/graa.js';
import { utenPlan } from './egne.js';
import { app, endret, tidSlutt, valgNr } from './tilstand.js';

const graaMinne = new Map();
export async function sjekkGraa(k, grense, mitt) {
  const har = graaMinne.get(k.nr);
  if (har) {
    husk(graaMinne, k.nr, har, 3);
    app.graa = har;
    regnGraa();
    return;
  }
  app.graa = { nr: k.nr, tilstand: 'henter' };
  endret();
  try {
    const { res, w, h, u } = rutenett(grense.ext, ...BILDE_TEMA);
    const [b1, b2] = await Promise.all([hentGraaBilde(k, 0, u, w, h), hentGraaBilde(k, 1, u, w, h)]);
    if (mitt !== valgNr) return;
    const t0 = performance.now(),
      a = tegneflate(w, h),
      b = tegneflate(w, h);
    a.drawImage(await createImageBitmap(new Blob([b1])), 0, 0, w, h);
    const A = a.getImageData(0, 0, w, h);
    b.drawImage(await createImageBitmap(new Blob([b2])), 0, 0, w, h);
    const V = b.getImageData(0, 0, w, h).data;
    b.clearRect(0, 0, w, h);
    sti(b, grense.koord, u, 1 / res);
    b.fill('evenodd');
    const S = tolkGraa(A.data, V, b.getImageData(0, 0, w, h).data);
    app.graa = { nr: k.nr, tilstand: 'ok', kl: S.kl, ...graaAreal(S.n, res, m2PerKm2(grense.ext)), u, res, w, h };
    husk(graaMinne, k.nr, app.graa, 3);
    tidSlutt('grått areal, kommunebilde', t0);
  } catch (e) {
    if (mitt !== valgNr) return;
    app.graa = { nr: k.nr, tilstand: 'feil' };
  }
  regnGraa();
}
/* Krysser grått areal med planrutenettet når begge er klare */
export function regnGraa() {
  const R =
      app.planRaster && app.valgt && app.planRaster.nr === app.valgt.nr && app.planRaster.pl && !utenPlan()
        ? app.planRaster
        : null,
    D = app.graa && app.valgt && app.graa.nr === app.valgt.nr && app.graa.tilstand === 'ok' ? app.graa : null,
    t0 = performance.now();
  app.graaKryss = R && D ? kryssGraa(R, D, !!(app.ov && app.ov.dynamisk)) : null;
  if (app.graaKryss) tidSlutt('grått areal, kryssing', t0);
  endret();
}
