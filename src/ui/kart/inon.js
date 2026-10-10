/* Kartlaget for inngrepsfri natur. Kartflisene lages i nettleseren av sonene per rute i datamotoren (data/motor/inon.js), så laget
   gir ingen flere kall når kartet flyttes eller zoomes. Nettleseren legger sonene oppå dagens klasser og fargelegger bare det som er
   natur, i tre mørkere grønntoner. Natur utenfor sonene beholder den vanlige grønnfargen. Laget deler lerret med klassene, så det får
   samme gjennomsiktighet og ser ut som en del av naturfargen. */
import { ol } from './ol.js';
import { HALV, SYNLIG } from '../../data/solv/felles.ts';
import { UTENFOR } from '../../data/solv/inon.ts';
import { NAT, klasseAv } from '../../data/solv/klasser.ts';
import { flislerret, tegnUtsnitt } from '../../data/solv/raster.ts';
import { dagensKlasser } from '../../data/motor/grunnkart.js';
import { abonner, app, gjeldende, tidSlutt } from '../../data/motor/tilstand.js';
import { rgb } from '../farger.js';
import { ui } from '../tilstand.js';
import { TOM, friskOpp, jevn, nyttSiden, plannett, tegnetKilde } from './felles.js';
import { friskOppGamle, tegnesOppaa } from './grunnkart.js';

/* Sonene som tre masker i hver sin fargekanal: rød er minst 1 km, grønn minst 3 km og blå minst 5 km fra inngrep. Når en flis
   forstørres fra masken, jevner nettleseren ut hver maske for seg, og grensen settes der masken er halvveis. Maskene jevnes også ut
   to ganger på forhånd. Sonegrensene blir dermed glatte kurver også når kartet er zoomet langt inn, selv om rutene er på 20 meter
   eller mer. Masken lages én gang per kommune. */
const masker = new WeakMap();
function maske(D) {
  let c = masker.get(D);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = D.w;
  c.height = D.h;
  const g = c.getContext('2d'),
    bilde = g.createImageData(D.w, D.h),
    P = bilde.data;
  for (let q = 0, i = 0; q < D.sone.length; q++, i += 4) {
    const s = D.sone[q];
    P[i] = s === UTENFOR ? 0 : 255;
    P[i + 1] = s <= 1 ? 255 : 0;
    P[i + 2] = s === 0 ? 255 : 0;
    P[i + 3] = 255;
  }
  jevn(P, D.w, D.h);
  jevn(P, D.w, D.h);
  g.putImageData(bilde, 0, 0);
  masker.set(D, c);
  return c;
}

async function lastInonFlis(tile) {
  try {
    const D =
        app.inon && app.valgt && app.inon.nr === app.valgt.nr && app.inon.tilstand === 'ok' && app.inon.sone
          ? app.inon
          : null,
      tc = tile.getTileCoord(),
      u = plannett.getTileCoordExtent(tc);
    if (!D || !ol.extent.intersects(u, D.u)) {
      tile.setState(TOM);
      return;
    }
    const c = flislerret(),
      g = c.getContext('2d', { willReadFrequently: true }),
      t0 = performance.now();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    tegnUtsnitt(
      g,
      maske(D),
      (u[0] - D.u[0]) / D.res,
      (D.u[3] - u[3]) / D.res,
      (u[2] - u[0]) / D.res,
      (u[3] - u[1]) / D.res
    );
    const P = g.getImageData(0, 0, 512, 512).data;
    let noe = false;
    for (let i = 0; i < P.length; i += 4)
      if (P[i] >= HALV && P[i + 3] >= HALV) {
        noe = true;
        break;
      }
    if (!noe) {
      tile.setState(TOM);
      return;
    } /* ingen inngrepsfri natur her: dagens klasser trengs ikke */
    const K = await dagensKlasser(tc);
    if (!K) {
      tile.setState(TOM);
      return;
    } /* klassene er ikke hentet ennå. Laget friskes opp når de er det. */
    const ut = g.createImageData(512, 512),
      o = ut.data,
      F = [rgb('inon2'), rgb('inon1'), rgb('inonv')];
    let tegnet = false;
    for (let i = 0; i < P.length; i += 4) {
      if (P[i] < HALV || P[i + 3] < HALV || K[i + 3] < SYNLIG || klasseAv(K[i], K[i + 1], K[i + 2]) !== NAT) continue;
      const f = F[P[i + 2] >= HALV ? 2 : P[i + 1] >= HALV ? 1 : 0];
      o[i] = f[0];
      o[i + 1] = f[1];
      o[i + 2] = f[2];
      o[i + 3] = 255;
      tegnet = true;
    }
    if (!tegnet) {
      tile.setState(TOM);
      return;
    }
    g.putImageData(ut, 0, 0);
    tile.setImage(c);
    tidSlutt('inngrepsfri natur, fliser', t0);
  } catch (e) {
    tile.setState(3);
  }
}
export const inonLag = new ol.layer.Tile({ className: 'tema', visible: false, source: tegnetKilde(lastInonFlis) });
tegnesOppaa(inonLag);

/* Laget følger tilstanden: det vises på siden for inngrepsfri natur når sonene er hentet og kommunen har noen. */
const ny = nyttSiden();
abonner(() => {
  if (ny('grense', app.grense) && app.grense) inonLag.setExtent(app.grense.ext);
  if (ny('data', app.inon)) friskOpp(inonLag);
  const D = gjeldende(app.inon),
    synlig = ui.side === 'inon' && !!app.grense && !!D && D.tilstand === 'ok' && D.sum > 0;
  if (ny('synlig', synlig)) {
    inonLag.setVisible(synlig);
    friskOppGamle();
  }
});
