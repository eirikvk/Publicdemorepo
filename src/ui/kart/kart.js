/* Selve kartet: bakgrunn, grense, klipping mot kommunen, status, måling, bytte av kommune og trykk i kartet. Kartet lages av lagKart
   når alle filene er lastet, og settes inn på siden av ui/komponenter/Kartpanel.jsx. Hvert kartlag ligger i sin egen fil her, og
   følger tilstanden i datamotoren på samme måte som React-komponentene: ved hver endring sjekker laget om det det tegnes av, er nytt.
   Kartet kaller datamotoren når brukeren gjør noe (velger en annen kommune), men datamotoren kaller aldri kartet. */
import { ol } from './ol.js';
import { henteStatus, opptatt } from '../../data/bronse/henting.js';
import { FLISNIVA } from '../../data/bronse/nibio-grunnkart.js';
import { bakgrunnUrl, hentKommuneIPunkt } from '../../data/bronse/kartverket.js';
import { OPPLOSNINGER, ORIGO, UTM } from '../../data/solv/felles.js';
import { ALLE } from '../../data/solv/klasser.js';
import { kartetFlyttes } from '../../data/motor/grunnkart.js';
import { finn, velgKommune } from '../../data/motor/kommune.js';
import { abonner, app, bruk, endret, nullstillBruk, tidSlutt } from '../../data/motor/tilstand.js';
import { farge, rgb } from '../farger.js';
import { kb, nf } from '../tekst.js';
import { ui } from '../tilstand.js';
import { egneLag, sluttTegning, tegner } from './egne.js';
import { MAKSRES, MAKSTETTHET, flisnett, kartflagg, nyttSiden } from './felles.js';
import { graaLag } from './graa.js';
import {
  etterVenter,
  fargeleggAltSomVenter,
  friskOppGamle,
  klare,
  maalEtterarbeid,
  oversiktLag,
  oversiktSynlig,
  pauseEtterarbeid,
  planleggEtterarbeid,
  tema
} from './grunnkart.js';
import { inonLag } from './inon.js';
import { dekLag, flateLag, markLag, navnVed, omrissLag } from './naturtema.js';
import { planLag } from './plan.js';

const bakgrunn = new ol.layer.Tile({
  className: 'bakgrunn',
  source: new ol.source.XYZ({
    projection: UTM,
    crossOrigin: 'anonymous',
    attributions: '© Kartverket, NIBIO, DiBK',
    tileGrid: new ol.tilegrid.TileGrid({ origin: ORIGO, resolutions: OPPLOSNINGER, tileSize: 256 }),
    tileUrlFunction: bakgrunnUrl
  })
});
const grenseKilde = new ol.source.Vector();
const grense = new ol.layer.Vector({
  className: 'grense',
  source: grenseKilde,
  style: () => new ol.style.Style({ stroke: new ol.style.Stroke({ color: farge('ink'), width: 1.5 }) })
});
export const view = new ol.View({
  projection: UTM,
  center: ol.proj.fromLonLat([15, 65], UTM),
  resolutions: OPPLOSNINGER.slice(2),
  resolution: OPPLOSNINGER[4],
  enableRotation: false
});
export let kart = null;
/* Brukeren har bedt om mindre bevegelse: da flyttes ikke kart og side mykt. */
export const rolig = () => !!window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Ruller siden så kartet er synlig. Kartet ligger i elementet med klassen kartscene, se Kartpanel.jsx. */
export const tilKartet = mykt => {
  const k = document.querySelector('.kartscene');
  if (k) k.scrollIntoView({ behavior: mykt && !rolig() ? 'smooth' : 'auto', block: 'nearest' });
};
/* Kommunegrensen som geometri i OpenLayers, til klipping og til å se om et trykk er innenfor */
let klipp = null;

/* Utenfor valgt kommune vises bare bakgrunnskartet: flisene klippes mot kommunens flate,
   hentes bare innenfor kommunens utstrekning, og slås først på når grensen er lastet. */
/* Der en flis er ferdig lastet, fjernes oversiktsbildet under den før flisen tegnes. Ellers ville det grove
   bildet stikke fram som en uskarp kant rundt alt som er gjennomsiktig i flisen, for eksempel langs sjøen. */
const dekket = ([z, x, y]) => {
  for (let d = 0; z - d >= FLISNIVA; d++) if (klare.has(`${z - d}/${x >> d}/${y >> d}`)) return true;
  return false;
};
const klippStil = new ol.style.Style({ fill: new ol.style.Fill({ color: '#000' }) });
/* Klippingen er det dyreste i hvert bilde når kartet flyttes, så den gjøres så sjelden som mulig:
   ikke i det hele tatt når kommunegrensen er utenfor utsnittet, og ellers én gang per lerret i stedet for én gang per lag. */
let klippBilde = null,
  klippTrengs = true,
  klippRinger = null,
  klippFor = null;
function grenseISyne(fs) {
  if (klippBilde === fs) return klippTrengs;
  klippBilde = fs;
  if (klippFor !== klipp) {
    klippFor = klipp;
    klippRinger = klipp
      .getCoordinates()
      .flat()
      .map(r => Float64Array.from(r.flat()));
  }
  const m = 4 * fs.viewState.resolution,
    x0 = fs.extent[0] - m,
    y0 = fs.extent[1] - m,
    x1 = fs.extent[2] + m,
    y1 = fs.extent[3] + m;
  for (const r of klippRinger)
    for (let i = 0; i + 3 < r.length; i += 2) {
      const ax = r[i],
        ay = r[i + 1],
        bx = r[i + 2],
        by = r[i + 3];
      if ((ax < x0 && bx < x0) || (ax > x1 && bx > x1) || (ay < y0 && by < y0) || (ay > y1 && by > y1)) continue;
      return (klippTrengs = true); /* en del av grensen kan ligge i utsnittet */
    }
  return (klippTrengs = !klipp.intersectsCoordinate(
    fs.viewState.center
  )); /* helt innenfor: ingenting å klippe. Helt utenfor: alt skal bort. */
}
const klippTilKommunen = e => {
  if (!klipp || !grenseISyne(e.frameState)) return;
  const t0 = performance.now(),
    c = e.context,
    vc = ol.render.getVectorContext(e);
  c.save();
  c.globalCompositeOperation = 'destination-in';
  vc.setStyle(klippStil);
  vc.drawGeometry(klipp);
  c.restore();
  tidSlutt('klipping', t0);
};
const tegnes = (lag, res) => lag.getVisible() && res < lag.getMaxResolution() && res >= lag.getMinResolution();
const klippSist = (lag, over) =>
  lag.on('postrender', e => {
    const res = e.frameState.viewState.resolution;
    if (!over.some(l => tegnes(l, res))) klippTilKommunen(e);
  }); /* det øverste laget i lerretet klipper for alle */
/* Oversiktsbildet ligger under flisene og vises mens nytt innhold lastes. Sammen med fliser nettleseren
   alt har fra andre zoomnivåer gjør det at kartet aldri står tomt. Når alle flisene i utsnittet er på plass, skjules det. */
export function kartStatus() {
  const varUte = ui.ute,
    varSiste = ui.siste;
  if (view.getResolution() < MAKSRES) ui.ute = false;
  else {
    const o = (app.ov && app.ov.ext) || (app.valgt && app.oversikter[app.valgt.nr]),
      treff = !!o && !!kart && ol.extent.intersects(view.calculateExtent(kart.getSize()), o);
    oversiktSynlig(true);
    ui.ute = !treff && !!app.valgt;
    ui.siste = !treff
      ? ''
      : app.ov && app.ov.dynamisk
        ? 'Viser kart nettleseren allerede har hentet'
        : 'Viser lagret oversiktsbilde';
  }
  if (ui.ute !== varUte || ui.siste !== varSiste) endret();
}
/* Måling til feilsøking: hvor jevnt kartet tegnes mens det flyttes, og hvor lang tid etterarbeidet tar. Vises under Tekniske valg. */
let maalRaf = 0,
  maalSist = 0,
  maalT = [],
  tegnT0 = 0,
  maalTekst = '';
export const visMaaling = () => {
  const deler = Object.entries(bruk)
    .filter(([, b]) => b.sum >= 1)
    .sort((a, b) => b[1].sum - a[1].sum)
    .map(([navn, b]) => `${navn} ${Math.round(b.sum)} ms (${b.n} ganger, lengst ${Math.round(b.maks)} ms)`);
  const tekst =
    [maalTekst, maalEtterarbeid[0], deler.length ? `Tid brukt siden flyttingen startet: ${deler.join(', ')}.` : '']
      .filter(Boolean)
      .join(' ') || 'Flytt kartet for å måle hvor jevnt det går.';
  if (tekst === ui.maaling) return;
  ui.maaling = tekst;
  endret();
};
const maalBilde = t => {
  if (maalSist) maalT.push(t - maalSist);
  maalSist = t;
  maalRaf = requestAnimationFrame(maalBilde);
};
function maalFerdig() {
  cancelAnimationFrame(maalRaf);
  if (maalT.length < 5) return;
  const a = maalT.slice().sort((x, y) => x - y),
    median = a[a.length >> 1];
  maalTekst = `Siste flytting: ${Math.round(1000 / median)} bilder per sekund, lengste opphold ${Math.round(a[a.length - 1])} ms, ${a.filter(v => v > 100).length} opphold over 0,1 s (${a.length} bilder).`;
  visMaaling();
}
/* Kartet som kommunevelger: et trykk utenfor valgt kommune slår opp kommunen i punktet hos Kartverket og viser en knapp
   rett over punktet, med en prikk der man trykket. Byttet skjer først når man trykker på knappen, så et bomtrykk ved grensen ikke bytter kommune.
   Knappen holdes innenfor kartflaten og unna zoomknappene, og følger punktet når kartet flyttes. Knappen er en del av siden
   (Kartpanel.jsx), som gir kartet elementet med settByttKnapp. */
let byttLag = null,
  byttEl = null,
  byttSok = 0,
  byttKoord = null,
  beholdFor = null; /* kommunen som ble valgt i kartet: kartet blir stående der det er */
export const settByttKnapp = el => {
  byttEl = el;
};
export const lukkBytt = () => {
  byttSok++;
  byttKoord = null;
  if (byttLag) byttLag.setPosition(undefined);
  if (ui.bytt) {
    ui.bytt = null;
    endret();
  }
};
export function plasserBytt() {
  if (!ui.bytt || !byttKoord || !byttEl || !kart) return;
  const px = kart.getPixelFromCoordinate(byttKoord),
    [w, h] = kart.getSize(),
    bw = byttEl.offsetWidth,
    bh = byttEl.offsetHeight;
  if (!px || px[0] < -20 || px[1] < -20 || px[0] > w + 20 || px[1] > h + 20) {
    lukkBytt();
    return;
  } /* punktet er flyttet ut av kartet */
  const x = Math.max(8, Math.min(w - bw - 8, px[0] - bw / 2));
  let y = px[1] - bh - 16;
  if (y < 8 || (y < 116 && x + bw > w - 62))
    y = px[1] + 16; /* under punktet hvis det ikke er plass over, eller zoomknappene er i veien */
  byttEl.style.left = x + 'px';
  byttEl.style.top = Math.max(8, Math.min(h - bh - 8, y)) + 'px';
}
export function byttTilValgt() {
  const nr = ui.bytt && ui.bytt.nr;
  lukkBytt();
  if (nr) {
    beholdFor = nr;
    velgKommune(nr);
  }
}
const settProbe = probe => {
  ui.probe = probe;
  endret();
};
async function finnKommune(koord) {
  lukkBytt();
  const mitt = byttSok;
  settProbe({ tekst: 'Slår opp kommunen …' });
  try {
    const j = await hentKommuneIPunkt(koord);
    if (mitt !== byttSok) return;
    const t = finn(j.kommunenummer);
    if (!t || (app.valgt && t[1].nr === app.valgt.nr)) throw new Error('ingen annen kommune');
    byttKoord = koord;
    byttLag.setPosition(koord);
    ui.bytt = { nr: t[1].nr, navn: t[1].navn };
    settProbe({ punkt: `${t[1].navn} kommune` }); /* knappen plasseres når siden har tegnet den, se Kartpanel.jsx */
  } catch (e) {
    if (mitt === byttSok) settProbe({ tekst: 'Fant ingen annen kommune her.' });
  }
}
/* Trykk på kartet: les fargen i punktet og finn klassen. */
function trykkIKartet(e) {
  if (tegner()) return; /* under tegning er trykk i kartet hjørner i området */
  if (klipp && !klipp.intersectsCoordinate(e.coordinate)) {
    finnKommune(e.coordinate);
    return;
  }
  lukkBytt();
  const iTema = navnVed(e.coordinate);
  const pl = planLag.getVisible() ? planLag.getData(e.pixel) : null;
  if (pl && pl[3] > 40) {
    const av = c => (pl[0] - c[0]) ** 2 + (pl[1] - c[1]) ** 2 + (pl[2] - c[2]) ** 2;
    settProbe({
      punkt: (av(rgb('pjor')) < av(rgb('pnat')) ? 'Jordbruk' : 'Natur') + ', satt av til framtidig utbygging' + iTema
    });
    return;
  }
  let d = tema.getVisible() ? tema.getData(e.pixel) : null;
  if ((!d || d[3] < 40) && app.ov && oversiktLag.getVisible()) d = oversiktLag.getData(e.pixel);
  if (!d || d[3] < 40) {
    settProbe({ tekst: 'Ingen synlig klasse her (skjult kartlag, eller kartet er ikke hentet).' });
    return;
  }
  let best = null,
    min = 1e9;
  [...ALLE, ['slor', null]].forEach(([id, navn]) => {
    const c = rgb(id),
      a = (d[0] - c[0]) ** 2 + (d[1] - c[1]) ** 2 + (d[2] - c[2]) ** 2;
    if (a < min) {
      min = a;
      best = navn;
    }
  });
  if (!best) {
    settProbe({ tekst: 'Kartlaget for dette punktet er skjult.' });
    return;
  }
  settProbe({ punkt: best + iTema });
}

/* Kartet følger valgt kommune og grensen */
const ny = nyttSiden();
abonner(() => {
  if (ny('valgt', app.valgt) && app.valgt) {
    const k = app.valgt,
      behold = beholdFor === k.nr;
    lukkBytt();
    ui.probe = null;
    ui.siste = '';
    grenseKilde.clear();
    klipp = null;
    tema.setVisible(false);
    tema.setExtent(undefined);
    if (k.boks && !behold)
      view.fit(ol.proj.transformExtent(k.boks, 'EPSG:4326', UTM), { padding: [16, 16, 16, 16], duration: 350 });
    kartStatus();
    endret();
  }
  if (ny('grense', app.grense) && app.grense) {
    const k = app.valgt,
      ext = app.grense.ext;
    klipp = new ol.geom.MultiPolygon(app.grense.koord);
    grenseKilde.clear();
    grenseKilde.addFeature(new ol.Feature(klipp));
    tema.setExtent(ext);
    tema.setVisible(true);
    if (k && !k.boks && beholdFor !== k.nr) view.fit(ext, { padding: [16, 16, 16, 16], duration: 350 });
    beholdFor = null;
  }
  if (ny('grenseFeil', app.grenseFeil) && app.grenseFeil) {
    ui.probe = { tekst: 'Kommunegrensen kunne ikke hentes.' };
    tema.setVisible(true);
    endret();
  }
  if (ny('oversikt', app.valgt && app.oversikter[app.valgt.nr])) kartStatus();
  if (ny('sisteKall', app.sisteKall) && app.sisteKall) {
    const s = app.sisteKall,
      fliser = n => `${n} ${n === 1 ? 'flis' : 'fliser'}`;
    ui.siste = s.n
      ? `Siste kall mot ${s.kilde}: ${fliser(s.n)}, ${nf(s.ms / 1000)} s, ${kb(s.bytes)}`
      : `Kallet mot ${s.kilde} feilet.`;
    endret();
  }
});

/* Lager kartet med alle lagene og kobler til hendelsene. Kalles én gang, når alle filene er lastet. */
export function lagKart() {
  if (kart) return kart;
  kart = new ol.Map({
    layers: [
      bakgrunn,
      oversiktLag,
      tema,
      inonLag,
      graaLag,
      dekLag,
      ...flateLag,
      planLag,
      ...omrissLag,
      grense,
      egneLag,
      markLag
    ],
    view,
    pixelRatio: Math.min(window.devicePixelRatio || 1, MAKSTETTHET),
    controls: [
      new ol.control.Zoom({ zoomInTipLabel: 'Zoom inn', zoomOutTipLabel: 'Zoom ut' }),
      new ol.control.ScaleLine(),
      new ol.control.Attribution({ collapsible: false })
    ]
  });
  /* Når selve siden er forstørret, fyller kartet fort hele skjermen. Fanget kartet da alle bevegelser, kom man ikke ut igjen.
     Kartet slipper derfor knip og dra igjennom til nettleseren så lenge siden er forstørret. Knappene for zoom og trykk i kartet
     virker fortsatt. */
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const sjekk = () => {
      const stor = vv.scale > 1.03;
      if (stor === ui.sidezoom) return;
      ui.sidezoom = stor;
      document.documentElement.classList.toggle('sidezoom', stor);
      kart.getViewport().style.touchAction = stor ? 'auto' : 'none';
      kart.getInteractions().forEach(i => i.setActive(!stor));
      endret();
    };
    vv.addEventListener('resize', sjekk);
    vv.addEventListener('scroll', sjekk);
    sjekk();
  }
  tema.on('prerender', e => {
    const fs = e.frameState,
      res = fs.viewState.resolution;
    if (!app.ov || !oversiktLag.getVisible() || res >= MAKSRES) return;
    const c = e.context;
    flisnett.forEachTileCoord(fs.extent, flisnett.getZForResolution(res), tc => {
      if (!dekket(tc)) return;
      const u = flisnett.getTileCoordExtent(tc);
      const a = ol.render.getRenderPixel(e, kart.getPixelFromCoordinate([u[0], u[3]])),
        b = ol.render.getRenderPixel(e, kart.getPixelFromCoordinate([u[2], u[1]]));
      const x0 = Math.floor(a[0]),
        y0 = Math.floor(a[1]);
      c.clearRect(x0, y0, Math.ceil(b[0]) - x0, Math.ceil(b[1]) - y0);
    });
  });
  klippSist(oversiktLag, [tema, inonLag, graaLag]);
  klippSist(tema, [inonLag, graaLag]);
  klippSist(inonLag, [graaLag]);
  klippSist(graaLag, []);
  [dekLag, ...flateLag, planLag, ...omrissLag].forEach((l, i, alle) =>
    klippSist(l, alle.slice(i + 1))
  ); /* disse deler lerret */
  kart.on('precompose', () => {
    tegnT0 = performance.now();
  });
  kart.on('postcompose', () => {
    if (tegnT0) tidSlutt('tegning', tegnT0);
  });
  setInterval(() => {
    if (!kartflagg.iBevegelse) visMaaling();
  }, 1500);
  kart.on('movestart', () => {
    kartflagg.iBevegelse = true;
    kartflagg.startet = henteStatus.startet;
    kartflagg.feilet = henteStatus.feilet;
    kartetFlyttes(true);
    oversiktSynlig(true);
    pauseEtterarbeid();
    cancelAnimationFrame(maalRaf);
    maalT = [];
    maalSist = 0;
    nullstillBruk();
    maalRaf = requestAnimationFrame(maalBilde);
  });
  kart.on('moveend', () => {
    kartflagg.iBevegelse = false;
    maalFerdig();
    kartStatus();
    kart.render();
    friskOppGamle();
    if (etterVenter) planleggEtterarbeid();
    kartetFlyttes(false);
  });
  view.on('change:resolution', () => {
    if (view.getResolution() >= MAKSRES) {
      oversiktSynlig(true);
      fargeleggAltSomVenter();
    }
  });
  kart.on('rendercomplete', () => {
    if (kartflagg.iBevegelse || view.getResolution() >= MAKSRES || !app.valgt || !tema.getVisible() || opptatt())
      return; /* aldri skjul oversikten midt i en bevegelse */
    if (henteStatus.feilet === kartflagg.feilet) oversiktSynlig(false);
    const ingen = 'Ingen nye kall. Flisene lå allerede i nettleseren.';
    if (henteStatus.startet === kartflagg.startet && ui.siste !== ingen) {
      ui.siste = ingen;
      endret();
    }
  });
  const prikk = document.createElement('div');
  prikk.className = 'punkt';
  byttLag = new ol.Overlay({ element: prikk, positioning: 'center-center', stopEvent: false });
  kart.addOverlay(byttLag);
  kart.on('postrender', plasserBytt);
  kart.on('singleclick', trykkIKartet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && tegner()) sluttTegning();
  });
  return kart;
}
