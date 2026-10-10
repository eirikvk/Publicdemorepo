/* Inngrepsfri natur (INON) fra Miljødirektoratet: natur som ligger minst én kilometer fra tyngre tekniske inngrep, delt i tre soner
   etter avstand. Sonene hentes som ett bilde av hele kommunen når kommunen velges, og huskes så lenge siden er åpen. Kartflisene
   lages av det bildet i nettleseren, så laget gir ingen flere kall når kartet flyttes eller zoomes. Nettleseren legger sonene oppå
   dagens klasser og fargelegger bare det som er natur, i tre mørkere grønntoner. Natur utenfor sonene beholder den vanlige grønnfargen.
   Laget deler lerret med klassene, så det får samme gjennomsiktighet og ser ut som en del av naturfargen. Arealet per sone regnes ut
   i solv/inon.js (sølv) og gull/inon.js (gull). */
import { ol } from './ol.js';
import { hentInonBilde } from '../bronse/mdir-inon.js';
import { BILDE_TEMA, m2PerKm2, rutenett } from '../solv/felles.js';
import { inonAreal } from '../gull/inon.js';
import { UTENFOR, tolkInon } from '../solv/inon.js';
import { NAT, klasseAv } from '../solv/klasser.js';
import { tegneflate } from '../solv/raster.js';
import { app, endret, gjeldende, husk, rgb, tidSlutt, valgNr } from './felles.js';
import { dagensKlasser, friskOppGamle } from './fliser.js';
import { TOM, friskOpp, jevn, kommuneSti, lerret, plannett, tegnUtsnitt, tegnetKilde } from './grunnlag.js';
/* Kommunebildet er gjort om til tre masker i hver sin fargekanal: minst 1 km, minst 3 km og minst 5 km fra inngrep. Når en flis
   forstørres fra bildet, jevner nettleseren ut hver maske for seg, og grensen settes der masken er halvveis. Sonegrensene blir
   dermed glatte kurver også når kartet er zoomet langt inn, selv om bildet har ruter på 20 meter eller mer. */
async function lastInonFlis(tile) {
  try {
    const D =
        app.inon && app.valgt && app.inon.nr === app.valgt.nr && app.inon.tilstand === 'ok' && app.inon.c
          ? app.inon
          : null,
      tc = tile.getTileCoord(),
      u = plannett.getTileCoordExtent(tc);
    if (!D || !ol.extent.intersects(u, D.u)) {
      tile.setState(TOM);
      return;
    }
    const c = lerret(),
      g = c.getContext('2d', { willReadFrequently: true }),
      t0 = performance.now();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    tegnUtsnitt(g, D.c, (u[0] - D.u[0]) / D.res, (D.u[3] - u[3]) / D.res, (u[2] - u[0]) / D.res, (u[3] - u[1]) / D.res);
    const P = g.getImageData(0, 0, 512, 512).data;
    let noe = false;
    for (let i = 0; i < P.length; i += 4)
      if (P[i] >= 128 && P[i + 3] >= 128) {
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
      if (P[i] < 128 || P[i + 3] < 128 || K[i + 3] < 100 || klasseAv(K[i], K[i + 1], K[i + 2]) !== NAT) continue;
      const f = F[P[i + 2] >= 128 ? 2 : P[i + 1] >= 128 ? 1 : 0];
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
/* Ett bilde av hele kommunen, med ruter på 20 meter eller opptil 2048 ruter på lengste side. Det gir både kartlaget og arealet per
   sone. Det ferdige resultatet huskes for de siste kommunene så lenge siden er åpen, så et nytt valg av samme kommune koster ingenting. */
const inonMinne = new Map();

/* Sonene som tre masker i hver sin fargekanal, til kartlaget: rød er minst 1 km, grønn minst 3 km og blå minst 5 km fra inngrep.
   Maskene jevnes ut to ganger, så sonegrensene blir glatte når kartet er zoomet langt inn. */
function soneMaske(sone, P, w, h) {
  for (let q = 0, i = 0; q < sone.length; q++, i += 4) {
    const s = sone[q];
    P[i] = s === UTENFOR ? 0 : 255;
    P[i + 1] = s <= 1 ? 255 : 0;
    P[i + 2] = s === 0 ? 255 : 0;
    P[i + 3] = 255;
  }
  jevn(P, w, h);
  jevn(P, w, h);
}
export async function sjekkInon(k, geom, mitt) {
  const har = inonMinne.get(k.nr);
  if (har) {
    husk(inonMinne, k.nr, har, 3);
    app.inon = har;
    friskOpp(inonLag);
    visInon();
    return;
  }
  app.inon = { nr: k.nr, tilstand: 'henter' };
  visInon();
  try {
    const { res, w, h, u } = rutenett(geom.getExtent(), ...BILDE_TEMA);
    const buf = await hentInonBilde(k, u, w, h);
    if (mitt !== valgNr) return;
    const t0 = performance.now(),
      a = tegneflate(w, h),
      b = tegneflate(w, h);
    a.drawImage(await createImageBitmap(new Blob([buf])), 0, 0, w, h);
    kommuneSti(b, geom, u, 1 / res);
    b.fill('evenodd');
    const S = tolkInon(a.getImageData(0, 0, w, h).data, b.getImageData(0, 0, w, h).data),
      A = inonAreal(S.n, res, m2PerKm2(geom.getExtent())),
      bilde = a.createImageData(w, h);
    soneMaske(S.sone, bilde.data, w, h);
    a.putImageData(bilde, 0, 0);
    app.inon = { nr: k.nr, tilstand: 'ok', soner: A.soner, sum: A.sum, c: a.canvas, u, res };
    husk(inonMinne, k.nr, app.inon, 3);
    tidSlutt('inngrepsfri natur, kommunebilde', t0);
  } catch (e) {
    if (mitt !== valgNr) return;
    app.inon = { nr: k.nr, tilstand: 'feil' };
  }
  friskOpp(inonLag);
  visInon();
}
/* Kartlaget følger tilstanden. Tekst og tall tegnes av siden, se visning/Inon.jsx. Laget følger klassen natur, så det vises bare når
   natur vises. */
export function visInon() {
  const D = gjeldende(app.inon);
  inonLag.setVisible(app.inonPaa && app.vis.nat && !!app.klipp && !!D && D.tilstand === 'ok' && D.sum > 0);
  friskOppGamle();
  endret();
}
