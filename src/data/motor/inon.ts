/* Datamotoren, inngrepsfri natur (INON) fra Miljødirektoratet: natur som ligger minst én kilometer fra tyngre tekniske inngrep, delt
   i tre soner etter avstand. Sonene hentes som ett bilde av hele kommunen når kommunen velges (bronse/mdir-inon.ts) og gjøres om til
   sone per rute (solv/inon.ts). Flyten er den samme som for grått areal, se kommunebilde.ts. Kartlaget tegnes av sonene per rute,
   se ui/kart/inon.ts. */
import { hentInonBilde } from '../bronse/mdir-inon.ts';
import { tolkInon } from '../solv/inon.ts';
import { kommunebilde } from './kommunebilde.ts';
import { app, endret } from './tilstand.ts';

export const sjekkInon = kommunebilde({
  navn: 'inngrepsfri natur',
  hent: (k, R) => Promise.all([hentInonBilde(k, R.u, R.w, R.h)]),
  tolk: ([P], M) => tolkInon(P, M),
  resultat: (S, km2) => ({ soner: km2, sone: S.sone }),
  sett: D => {
    app.inon = D;
  },
  ferdig: endret
});
