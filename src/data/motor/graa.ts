/* Datamotoren, grått areal: areal som alt er tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet. To bilder av hele
   kommunen hentes når kommunen velges (bronse/nibio-graa.ts), gjøres om til trinn per rute (solv/graa.ts), og arealet og
   kryssingen med planen regnes ut i gull/graa.ts. Grått betyr ikke ledig: et boligområde i bruk er like grått som en nedlagt
   fabrikktomt. Kartlaget tegnes av trinnene per rute, se ui/kart/graa.ts. */
import { hentGraaBilde } from '../bronse/nibio-graa.ts';
import { husk } from '../generelt/minne.ts';
import { BILDE_TEMA, m2PerKm2, rutenett } from '../solv/felles.ts';
import { bildePiksler, flatePiksler } from '../solv/raster.ts';
import { tolkGraa } from '../solv/graa.ts';
import { arealFraRuter } from '../gull/felles.ts';
import { kryssGraa } from '../gull/graa.ts';
import { utenPlan } from './egne.ts';
import type { Kommune } from '../solv/felles.ts';
import type { Graatrinn } from '../solv/graa.ts';
import { app, endret, tidSlutt, valgNr, type Grense, gjelder } from './tilstand.ts';

const graaMinne = new Map();
export async function sjekkGraa(k: Kommune, grense: Grense, mitt: number) {
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
    const R = rutenett(grense.ext, ...BILDE_TEMA),
      { res, w, h, u } = R;
    const [b1, b2] = await Promise.all([hentGraaBilde(k, 0, u, w, h), hentGraaBilde(k, 1, u, w, h)]);
    if (mitt !== valgNr) return;
    const t0 = performance.now(),
      S = tolkGraa(await bildePiksler(b1, w, h), await bildePiksler(b2, w, h), flatePiksler(grense.koord, R)),
      A = arealFraRuter(S.n, res, m2PerKm2(grense.ext));
    app.graa = { nr: k.nr, tilstand: 'ok', kl: S.kl, trinn: A.km2, sum: A.sum, u, res, w, h };
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
  const R = gjelder(app.planRaster) && app.planRaster.pl && !utenPlan() ? app.planRaster : null,
    D = gjelder(app.graa) && app.graa.tilstand === 'ok' ? app.graa : null,
    t0 = performance.now();
  app.graaKryss = R && D ? kryssGraa(R, D as Graatrinn, !!(app.ov && app.ov.dynamisk)) : null;
  if (app.graaKryss) tidSlutt('grått areal, kryssing', t0);
  endret();
}
