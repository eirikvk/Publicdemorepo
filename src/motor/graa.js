/* Grått areal fra Miljødirektoratets kart over grå arealer (NIBIO, testversjon): areal som alt er tatt i bruk eller sterkt påvirket
   av bygge- og anleggsaktivitet. Flatene har andel vegetasjon i fem trinn. Hentes som to bilder av hele kommunen når den velges,
   med egen stil uten kantstrek. Kartlaget zoomet ut lages av det i nettleseren. Zoomet inn hentes laget som fliser. Tallene og
   kryssingen med planen regnes ut i solv/graa.js (sølv) og gull/graa.js (gull). Grått betyr ikke ledig: et boligområde i bruk er like grått som en nedlagt
   fabrikktomt. */
import { ol } from './ol.js';
import { BILDE_TEMA, m2PerKm2, rutenett } from '../solv/felles.js';
import { graaAreal, kryssGraa } from '../gull/graa.js';
import { GRAATRINN, graaTrinn, tolkGraa } from '../solv/graa.js';
import { klasseAv } from '../solv/klasser.js';
import { tegneflate } from '../solv/raster.js';
import { utenPlan } from './egne.js';
import { FLISNIVA, UTM, app, endret, gjeldende, hent, husk, rgb, tidSlutt, valgNr } from './felles.js';
import { dagensKlasser, friskOppGamle } from './fliser.js';
import { TOM, friskOpp, jevn, kommuneSti, lagHenter, lerret, plannett, tegnUtsnitt, tegnetKilde } from './grunnlag.js';
const GRAA = 'https://wms.nibio.no/cgi-bin/graastruktur';
/* Egne stiler uten kantstrek. Alt grått areal tegnes i svart. Flatene med oppgitt andel vegetasjon får en rødfarge som sier hvilket
   trinn de er i. Kartflisene henter begge lagene i ett bilde. Til tallene hentes de hver for seg: i ett bilde blandes fargene
   langs kantene, og med ruter på 20 meter ga det for mye grått areal og for lite vegetasjon. */
const graaFyll = f =>
  `<PolygonSymbolizer><Fill><CssParameter name="fill">${f}</CssParameter></Fill></PolygonSymbolizer>`;
const graaLagStil = [
  `<NamedLayer><Name>graa_arealer</Name><UserStyle><FeatureTypeStyle><Rule>${graaFyll('#000000')}</Rule></FeatureTypeStyle></UserStyle></NamedLayer>`,
  `<NamedLayer><Name>andel_med_vegetasjon</Name><UserStyle><FeatureTypeStyle>${GRAATRINN.map(([, , fra, til], i) => `<Rule><ogc:Filter><ogc:And><ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>andelgron</ogc:PropertyName><ogc:Literal>${fra}</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyIsLessThan><ogc:PropertyName>andelgron</ogc:PropertyName><ogc:Literal>${til}</ogc:Literal></ogc:PropertyIsLessThan></ogc:And></ogc:Filter>${graaFyll('#' + (51 * (i + 1)).toString(16).padStart(2, '0') + '0000')}</Rule>`).join('')}</FeatureTypeStyle></UserStyle></NamedLayer>`
];
const graaBilde = (hva, u, w, h) =>
  GRAA +
  '?' +
  new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: ['graa_arealer', 'andel_med_vegetasjon'].filter((_, i) => hva.includes(i)).join(','),
    sld_body: `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">${graaLagStil.filter((_, i) => hva.includes(i)).join('')}</StyledLayerDescriptor>`,
    crs: UTM,
    bbox: u.map(v => v.toFixed(2)).join(','),
    width: w,
    height: h,
    format: 'image/png',
    transparent: 'true'
  });
const hentGraaFlis = lagHenter('NIBIO', 'Grått areal');
const graaMinne = new Map();
async function lastGraaFlis(tile) {
  try {
    const D = app.graa && app.valgt && app.graa.nr === app.valgt.nr && app.graa.tilstand === 'ok' ? app.graa : null,
      tc = tile.getTileCoord(),
      u = plannett.getTileCoordExtent(tc);
    if (!D || !ol.extent.intersects(u, D.u)) {
      tile.setState(TOM);
      return;
    }
    const c = lerret(),
      g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    if (tc[0] >= FLISNIVA) {
      /* zoomet inn: flisen hentes fra tjenesten, så små flater blir skarpe. Zoomet ut holder kommunebildet. */
      g.drawImage(
        await createImageBitmap(new Blob([await hentGraaFlis(graaBilde([0, 1], u, 512, 512))])),
        0,
        0,
        512,
        512
      );
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
          k = a >= 64 ? graaTrinn(o[i], 255) : 0,
          f = k ? F[k] : K && K[i + 3] >= 100 && klasseAv(K[i], K[i + 1], K[i + 2]) === 0 ? GR : null;
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
      D.c,
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
          inne = P[i + 3] >= 128 && x >= 0 && x < w && rad >= 0 && rad < h;
        let f = null;
        if (inne && P[i] >= 128) {
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
        else if (K && (!inne || P[i] < 64) && K[i + 3] >= 100 && klasseAv(K[i], K[i + 1], K[i + 2]) === 0) f = GR;
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
/* Det grå som maske til kartlaget: hvitt der det er grått, jevnet ut så kanten blir glatt når kartet er zoomet inn */
function graaMaske(kl, P, w, h) {
  for (let q = 0, i = 0; q < kl.length; q++, i += 4) {
    P[i] = P[i + 1] = P[i + 2] = kl[q] ? 255 : 0;
    P[i + 3] = 255;
  }
  jevn(P, w, h);
}
export async function sjekkGraa(k, geom, mitt) {
  const har = graaMinne.get(k.nr);
  if (har) {
    husk(graaMinne, k.nr, har, 3);
    app.graa = har;
    friskOpp(graaLag);
    visGraa();
    regnGraa();
    return;
  }
  app.graa = { nr: k.nr, tilstand: 'henter' };
  visGraa();
  try {
    const { res, w, h, u } = rutenett(geom.getExtent(), ...BILDE_TEMA);
    const [b1, b2] = await Promise.all([
      hent('NIBIO', `Grått areal i ${k.navn}`, graaBilde([0], u, w, h), false, true),
      hent('NIBIO', `Vegetasjon i grått areal i ${k.navn}`, graaBilde([1], u, w, h), false, true)
    ]);
    if (mitt !== valgNr) return;
    const t0 = performance.now(),
      a = tegneflate(w, h),
      b = tegneflate(w, h);
    a.drawImage(await createImageBitmap(new Blob([b1])), 0, 0, w, h);
    const A = a.getImageData(0, 0, w, h);
    b.drawImage(await createImageBitmap(new Blob([b2])), 0, 0, w, h);
    const V = b.getImageData(0, 0, w, h).data;
    b.clearRect(0, 0, w, h);
    kommuneSti(b, geom, u, 1 / res);
    b.fill('evenodd');
    const S = tolkGraa(A.data, V, b.getImageData(0, 0, w, h).data),
      tall = { kl: S.kl, ...graaAreal(S.n, res, m2PerKm2(geom.getExtent())) };
    graaMaske(tall.kl, A.data, w, h);
    a.putImageData(A, 0, 0);
    app.graa = { nr: k.nr, tilstand: 'ok', ...tall, c: a.canvas, u, res, w, h };
    husk(graaMinne, k.nr, app.graa, 3);
    tidSlutt('grått areal, kommunebilde', t0);
  } catch (e) {
    if (mitt !== valgNr) return;
    app.graa = { nr: k.nr, tilstand: 'feil' };
  }
  friskOpp(graaLag);
  visGraa();
  regnGraa();
}
export function regnGraa() {
  const R =
      app.planRaster && app.valgt && app.planRaster.nr === app.valgt.nr && app.planRaster.pl && !utenPlan()
        ? app.planRaster
        : null,
    D = app.graa && app.valgt && app.graa.nr === app.valgt.nr && app.graa.tilstand === 'ok' ? app.graa : null,
    t0 = performance.now();
  app.graaKryss = R && D ? kryssGraa(R, D, !!(app.ov && app.ov.dynamisk)) : null;
  if (app.graaKryss) tidSlutt('grått areal, kryssing', t0);
  visGraa();
}
/* Kartlaget følger tilstanden. Tekst og tall tegnes av siden, se visning/Graa.jsx. */
export function visGraa() {
  const D = gjeldende(app.graa);
  graaLag.setVisible(app.graaPaa && !!app.klipp && !!D && D.tilstand === 'ok' && D.sum > 0);
  friskOppGamle();
  endret();
}
