/* Kartlaget for grått areal. Zoomet ut tegnes det av trinnene per rute i datamotoren (data/motor/graa.js). Zoomet inn hentes
   laget som fliser fra NIBIO, så små flater blir skarpe. I kartet er lysere grått mer vegetasjon, og blågrønt er grønt i bebygd
   område: areal som er bebygd i grunnkartet, men ikke grått. */
import { ol } from './ol.js';
import { FLISNIVA } from '../../data/bronse/nibio-grunnkart.ts';
import { graaFlisUrl, hentGraaFlis } from '../../data/bronse/nibio-graa.ts';
import { HALV, SYNLIG } from '../../data/solv/felles.ts';
import { GRAATRINN, graaTrinn } from '../../data/solv/graa.ts';
import { klasseAv } from '../../data/solv/klasser.ts';
import { flislerret, tegnUtsnitt } from '../../data/solv/raster.ts';
import { dagensKlasser } from '../../data/motor/grunnkart.ts';
import { abonner, app, gjeldende, tidSlutt } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.js';
import { ui } from '../tilstand.js';
import { TOM, friskOpp, jevn, nyttSiden, plannett, tegnetKilde } from './felles.js';
import { friskOppGamle, tegnesOppaa } from './grunnkart.js';

/* Kartets egne terskler for grått areal. Arealet regnes med halvregelen (HALV). I flisene fra NIBIO er en piksel grå fra en
   fjerdedel dekning, så kantene på små flater ikke forsvinner når kartet er zoomet langt inn. Langs kanten av den utjevnede masken
   tegnes grønt i bebygd område der masken er under en fjerdedel. Tersklene gjelder bare kartet, ikke tallene. */
const KART_GRAA = 64,
  KART_KANT = 64;

/* Det grå som maske: hvitt der det er grått, jevnet ut så kanten blir glatt når kartet er zoomet inn. Lages én gang per kommune. */
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
  for (let q = 0, i = 0; q < D.kl.length; q++, i += 4) {
    P[i] = P[i + 1] = P[i + 2] = D.kl[q] ? 255 : 0;
    P[i + 3] = 255;
  }
  jevn(P, D.w, D.h);
  g.putImageData(bilde, 0, 0);
  masker.set(D, c);
  return c;
}

async function lastGraaFlis(tile) {
  try {
    const D = app.graa && app.valgt && app.graa.nr === app.valgt.nr && app.graa.tilstand === 'ok' ? app.graa : null,
      tc = tile.getTileCoord(),
      u = plannett.getTileCoordExtent(tc);
    if (!D || !ol.extent.intersects(u, D.u)) {
      tile.setState(TOM);
      return;
    }
    const c = flislerret(),
      g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    if (tc[0] >= FLISNIVA) {
      /* zoomet inn: flisen hentes fra tjenesten, så små flater blir skarpe. Zoomet ut holder kommunebildet. */
      g.drawImage(await createImageBitmap(new Blob([await hentGraaFlis(graaFlisUrl(u))])), 0, 0, 512, 512);
      const K = await dagensKlasser(tc).catch(
        () => null
      ); /* dagens klasser: bebygd som ikke er grått, tegnes som grønt i bebygd område */
      const t1 = performance.now(),
        bilde = g.getImageData(0, 0, 512, 512),
        o = bilde.data,
        F = [null, ...GRAATRINN.map(x => rgb(x[0])), rgb('graa0')],
        GR = rgb('gront');
      let noe = false;
      for (let i = 0; i < o.length; i += 4) {
        const a = o[i + 3],
          k = a >= KART_GRAA ? graaTrinn(o[i], 255) : 0,
          f = k ? F[k] : K && K[i + 3] >= SYNLIG && klasseAv(K[i], K[i + 1], K[i + 2]) === 0 ? GR : null;
        if (!f) {
          o[i + 3] = 0;
          continue;
        }
        o[i] = f[0];
        o[i + 1] = f[1];
        o[i + 2] = f[2];
        o[i + 3] = 255;
        noe = true;
      }
      if (!noe) {
        tile.setState(TOM);
        return;
      }
      g.putImageData(bilde, 0, 0);
      tile.setImage(c);
      tidSlutt('grått areal, fliser', t1);
      return;
    }
    const K = await dagensKlasser(tc).catch(() => null),
      t0 = performance.now(),
      GR = rgb('gront');
    tegnUtsnitt(
      g,
      maske(D),
      (u[0] - D.u[0]) / D.res,
      (D.u[3] - u[3]) / D.res,
      (u[2] - u[0]) / D.res,
      (u[3] - u[1]) / D.res
    ); /* utjevnet maske: glatt kant rundt det grå */
    const P = g.getImageData(0, 0, 512, 512).data,
      ut = g.createImageData(512, 512),
      o = ut.data,
      F = [null, ...GRAATRINN.map(x => rgb(x[0])), rgb('graa0')],
      m = (u[2] - u[0]) / 512;
    let tegnet = false;
    const kol = new Int32Array(512),
      w = D.w,
      h = D.h;
    for (let px = 0; px < 512; px++) kol[px] = Math.floor((u[0] + (px + 0.5) * m - D.u[0]) / D.res);
    for (let py = 0, i = 0; py < 512; py++) {
      const rad = Math.floor((D.u[3] - (u[3] - (py + 0.5) * m)) / D.res);
      for (let px = 0; px < 512; px++, i += 4) {
        const x = kol[px],
          inne = P[i + 3] >= HALV && x >= 0 && x < w && rad >= 0 && rad < h;
        let f = null;
        if (inne && P[i] >= HALV) {
          const q = rad * w + x;
          f =
            F[
              D.kl[q] ||
                (x > 0 && D.kl[q - 1]) ||
                (x < w - 1 && D.kl[q + 1]) ||
                (rad > 0 && D.kl[q - w]) ||
                (rad < h - 1 && D.kl[q + w]) ||
                6
            ];
        } /* i kanten kan masken nå litt lenger enn rutene */
        else if (K && (!inne || P[i] < KART_KANT) && K[i + 3] >= SYNLIG && klasseAv(K[i], K[i + 1], K[i + 2]) === 0)
          f = GR;
        if (!f) continue;
        o[i] = f[0];
        o[i + 1] = f[1];
        o[i + 2] = f[2];
        o[i + 3] = 255;
        tegnet = true;
      }
    }
    if (!tegnet) {
      tile.setState(TOM);
      return;
    }
    g.putImageData(ut, 0, 0);
    tile.setImage(c);
    tidSlutt('grått areal, fliser', t0);
  } catch (e) {
    tile.setState(3);
  }
}
export const graaLag = new ol.layer.Tile({ className: 'tema', visible: false, source: tegnetKilde(lastGraaFlis) });
tegnesOppaa(graaLag);

/* Laget følger tilstanden: det vises på siden for grått areal når det er hentet og kommunen har noe. */
const ny = nyttSiden();
abonner(() => {
  if (ny('grense', app.grense) && app.grense) graaLag.setExtent(app.grense.ext);
  if (ny('data', app.graa)) friskOpp(graaLag);
  const D = gjeldende(app.graa),
    synlig = ui.side === 'graa' && !!app.grense && !!D && D.tilstand === 'ok' && D.sum > 0,
    nyKryssing = ny('kryssing', app.graaKryss);
  if (ny('synlig', synlig) || nyKryssing) {
    graaLag.setVisible(synlig);
    friskOppGamle();
  }
});
