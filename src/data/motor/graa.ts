/* Datamotoren, grått areal: areal som alt er tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet. To bilder av hele
   kommunen hentes når kommunen velges (bronse/nibio-graa.ts), gjøres om til trinn per rute (solv/graa.ts), og kryssingen med
   planen regnes ut i gull/graa.ts. Flyten er den samme som for inngrepsfri natur, se kommunebilde.ts. Grått betyr ikke ledig: et
   boligområde i bruk er like grått som en nedlagt fabrikktomt. Kartlaget tegnes av trinnene per rute, se ui/kart/graa.ts. */
import { hentGraaBilde } from '../bronse/nibio-graa.ts';
import { tolkGraa, type Graatrinn } from '../solv/graa.ts';
import { kryssGraa } from '../gull/graa.ts';
import { utenPlan } from './egne.ts';
import { kommunebilde } from './kommunebilde.ts';
import { app, endret, gjelder, tidSlutt } from './tilstand.ts';

/* To bilder: alt grått areal, og flatene med oppgitt andel vegetasjon. Når de er hentet, krysses de med planen (regnGraa). */
export const sjekkGraa = kommunebilde({
  navn: 'grått areal',
  hent: (k, R) => Promise.all([hentGraaBilde(k, 0, R.u, R.w, R.h), hentGraaBilde(k, 1, R.u, R.w, R.h)]),
  tolk: ([P, V], M) => tolkGraa(P, V, M),
  resultat: (S, km2) => ({ kl: S.kl, trinn: km2 }),
  sett: D => {
    app.graa = D;
  },
  ferdig: regnGraa
});
/* Krysser grått areal med planrutenettet når begge er klare */
export function regnGraa() {
  const R = gjelder(app.planRaster) && app.planRaster.pl && !utenPlan() ? app.planRaster : null,
    D = gjelder(app.graa) && app.graa.tilstand === 'ok' ? app.graa : null,
    t0 = performance.now();
  app.graaKryss = R && D ? kryssGraa(R, D as Graatrinn, !!(app.ov && app.ov.dynamisk)) : null;
  if (app.graaKryss) tidSlutt('grått areal, kryssing', t0);
  endret();
}
