/* Selve kartet: bakgrunn, grense, klipping mot kommunen, status, måling, bytte av kommune og trykk i kartet. Kartet lages av lagKart
   når alle filene er lastet, og settes inn på siden av ui/komponenter/Kartpanel.tsx. Hvert kartlag ligger i sin egen fil her, og
   følger tilstanden i datamotoren på samme måte som React-komponentene: ved hver endring sjekker laget om det det tegnes av, er nytt.
   Kartet kaller datamotoren når brukeren gjør noe (velger en annen kommune), men datamotoren kaller aldri kartet. */
import type OlMap from 'ol/Map.js';
import type { FrameState } from 'ol/Map.js';
import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
import type Overlay from 'ol/Overlay.js';
import type { Coordinate } from 'ol/coordinate.js';
import type MultiPolygon from 'ol/geom/MultiPolygon.js';
import type BaseLayer from 'ol/layer/Base.js';
import type Layer from 'ol/layer/Layer.js';
import type RenderEvent from 'ol/render/Event.js';
import type { TileCoord } from 'ol/tilecoord.js';
import { ol } from './ol.ts';
import { henteStatus, opptatt } from '../../data/bronse/henting.ts';
import { FLISNIVA } from '../../data/bronse/nibio-grunnkart.ts';
import { bakgrunnUrl, hentKommuneIPunkt } from '../../data/bronse/kartverket.ts';
import { OPPLOSNINGER, ORIGO, UTM } from '../../data/solv/felles.ts';
import { naermesteFarge } from '../../data/generelt/farge.ts';
import { ALLE } from '../../data/solv/klasser.ts';
import { kartetFlyttes } from '../../data/motor/grunnkart.ts';
import { finn, velgKommune } from '../../data/motor/kommune.ts';
import { abonner, app, bruk, endret, nullstillBruk, tidSlutt } from '../../data/motor/tilstand.ts';
import { farge, rgb } from '../farger.ts';
import { kb, nf } from '../tekst.ts';
import { ui, type Probe } from '../tilstand.ts';
import { egneLag, sluttTegning, tegner } from './egne.ts';
import { MAKSRES, MAKSTETTHET, flisnett, kartflagg, nyttSiden } from './felles.ts';
import { graaLag } from './graa.ts';
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
} from './grunnkart.ts';
import { inonLag } from './inon.ts';
import { dekLag, flateLag, markLag, navnVed, omrissLag } from './naturtema.ts';
import { planLag } from './plan.ts';

const bakgrunn = new ol.layer.Tile({
  className: 'bakgrunn',
  source: new ol.source.XYZ({
    projection: UTM,
    crossOrigin: 'anonymous',
    attributions: '© Kartverket, NIBIO, DiBK',
    tileGrid: new ol.tilegrid.TileGrid({ origin: ORIGO, resolutions: OPPLOSNINGER, tileSize: 256 }),
    tileUrlFunction: bakgrunnUrl as (tc: TileCoord) => string
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
export let kart: OlMap | null = null;
/* Brukeren har bedt om mindre bevegelse: da flyttes ikke kart og side mykt. */
export const rolig = () => !!window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Ruller siden så kartet er synlig. Kartet ligger i elementet med klassen kartscene, se Kartpanel.tsx. */
export const tilKartet = (mykt?: boolean) => {
  const k = document.querySelector('.kartscene');
  if (k) k.scrollIntoView({ behavior: mykt && !rolig() ? 'smooth' : 'auto', block: 'nearest' });
};
/* Kommunegrensen som geometri i OpenLayers, til klipping og til å se om et trykk er innenfor */
let klipp: MultiPolygon | null = null;

/* Utenfor valgt kommune vises bare bakgrunnskartet: flisene klippes mot kommunens flate,
   hentes bare innenfor kommunens utstrekning, og slås først på når grensen er lastet. */
/* Der en flis er ferdig lastet, fjernes oversiktsbildet under den før flisen tegnes. Ellers ville det grove
   bildet stikke fram som en uskarp kant rundt alt som er gjennomsiktig i flisen, for eksempel langs sjøen. */
const dekket = ([z, x, y]: TileCoord) => {
  for (let d = 0; z - d >= FLISNIVA; d++) if (klare.has(`${z - d}/${x >> d}/${y >> d}`)) return true;
  return false;
};
const klippStil = new ol.style.Style({ fill: new ol.style.Fill({ color: '#000' }) });
/* Klippingen er det dyreste i hvert bilde når kartet flyttes, så den gjøres så sjelden som mulig:
   ikke i det hele tatt når kommunegrensen er utenfor utsnittet, og ellers én gang per lerret i stedet for én gang per lag. */
let klippBilde: FrameState | null = null,
  klippTrengs = true,
  klippRinger: Float64Array[] = [],
  klippFor: MultiPolygon | null = null;
function grenseISyne(fs: FrameState) {
  if (klippBilde === fs) return klippTrengs;
  klippBilde = fs;
  if (klippFor !== klipp) {
    klippFor = klipp;
    klippRinger = klipp!
      .getCoordinates()
      .flat()
      .map(r => Float64Array.from(r.flat()));
  }
  const m = 4 * fs.viewState.resolution,
    u = fs.extent!,
    x0 = u[0] - m,
    y0 = u[1] - m,
    x1 = u[2] + m,
    y1 = u[3] + m;
  for (const r of klippRinger)
    for (let i = 0; i + 3 < r.length; i += 2) {
      const ax = r[i],
        ay = r[i + 1],
        bx = r[i + 2],
        by = r[i + 3];
      if ((ax < x0 && bx < x0) || (ax > x1 && bx > x1) || (ay < y0 && by < y0) || (ay > y1 && by > y1)) continue;
      return (klippTrengs = true); /* en del av grensen kan ligge i utsnittet */
    }
  return (klippTrengs = !klipp!.intersectsCoordinate(
    fs.viewState.center
  )); /* helt innenfor: ingenting å klippe. Helt utenfor: alt skal bort. */
}
const klippTilKommunen = (e: RenderEvent) => {
  if (!klipp || !grenseISyne(e.frameState!)) return;
  const t0 = performance.now(),
    c = e.context as CanvasRenderingContext2D,
    vc = ol.render.getVectorContext(e);
  c.save();
  c.globalCompositeOperation = 'destination-in';
  vc.setStyle(klippStil);
  vc.drawGeometry(klipp);
  c.restore();
  tidSlutt('klipping', t0);
};
const tegnes = (lag: BaseLayer, res: number) =>
  lag.getVisible() && res < lag.getMaxResolution() && res >= lag.getMinResolution();
const klippSist = (lag: Layer, over: BaseLayer[]) =>
  lag.on('postrender', e => {
    const res = e.frameState!.viewState.resolution;
    if (!over.some(l => tegnes(l, res))) klippTilKommunen(e);
  }); /* det øverste laget i lerretet klipper for alle */
/* Oversiktsbildet ligger under flisene og vises mens nytt innhold lastes. Sammen med fliser nettleseren
   alt har fra andre zoomnivåer gjør det at kartet aldri står tomt. Når alle flisene i utsnittet er på plass, skjules det. */
export function kartStatus() {
  const varUte = ui.ute,
    varSiste = ui.siste;
  if (view.getResolution()! < MAKSRES) ui.ute = false;
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
  maalT: number[] = [],
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
const maalBilde = (t: number) => {
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
   (Kartpanel.tsx), som gir kartet elementet med settByttKnapp. */
let byttLag: Overlay | null = null,
  byttEl: HTMLElement | null = null,
  byttSok = 0,
  byttKoord: Coordinate | null = null,
  beholdFor: string | null = null; /* kommunen som ble valgt i kartet: kartet blir stående der det er */
export const settByttKnapp = (el: HTMLElement | null) => {
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
    [w, h] = kart.getSize()!,
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
const settProbe = (probe: Probe) => {
  ui.probe = probe;
  endret();
};
async function finnKommune(koord: Coordinate) {
  lukkBytt();
  const mitt = byttSok;
  settProbe({ tekst: 'Slår opp kommunen …' });
  try {
    const j = await hentKommuneIPunkt(koord);
    if (mitt !== byttSok) return;
    const t = finn(j.kommunenummer);
    if (!t || (app.valgt && t[1].nr === app.valgt.nr)) throw new Error('ingen annen kommune');
    byttKoord = koord;
    byttLag!.setPosition(koord);
    ui.bytt = { nr: t[1].nr, navn: t[1].navn };
    settProbe({ punkt: `${t[1].navn} kommune` }); /* knappen plasseres når siden har tegnet den, se Kartpanel.tsx */
  } catch (e) {
    if (mitt === byttSok) settProbe({ tekst: 'Fant ingen annen kommune her.' });
  }
}
/* Trykk på kartet: les fargen i punktet og finn klassen. */
function trykkIKartet(e: MapBrowserEvent) {
  if (tegner()) return; /* under tegning er trykk i kartet hjørner i området */
  if (klipp && !klipp.intersectsCoordinate(e.coordinate)) {
    finnKommune(e.coordinate);
    return;
  }
  lukkBytt();
  const iTema = navnVed(e.coordinate);
  const pl = (planLag.getVisible() ? planLag.getData(e.pixel) : null) as Uint8ClampedArray | null;
  if (pl && pl[3] > 40) {
    const jordbruk = naermesteFarge(pl[0], pl[1], pl[2], [rgb('pnat'), rgb('pjor')]) === 1;
    settProbe({ punkt: (jordbruk ? 'Jordbruk' : 'Natur') + ', satt av til framtidig utbygging' + iTema });
    return;
  }
  let d = (tema.getVisible() ? tema.getData(e.pixel) : null) as Uint8ClampedArray | null;
  if ((!d || d[3] < 40) && app.ov && oversiktLag.getVisible())
    d = oversiktLag.getData(e.pixel) as Uint8ClampedArray | null;
  if (!d || d[3] < 40) {
    settProbe({ tekst: 'Ingen synlig klasse her (skjult kartlag, eller kartet er ikke hentet).' });
    return;
  }
  const valg = [...ALLE, ['slor', null] as const],
    best =
      valg[
        naermesteFarge(
          d[0],
          d[1],
          d[2],
          valg.map(([id]) => rgb(id))
        )
      ][1];
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
      fliser = (n: number) => `${n} ${n === 1 ? 'flis' : 'fliser'}`;
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
      kart!.getViewport().style.touchAction = stor ? 'auto' : 'none';
      kart!.getInteractions().forEach(i => i.setActive(!stor));
      endret();
    };
    vv.addEventListener('resize', sjekk);
    vv.addEventListener('scroll', sjekk);
    sjekk();
  }
  tema.on('prerender', e => {
    const fs = e.frameState!,
      res = fs.viewState.resolution;
    if (!app.ov || !oversiktLag.getVisible() || res >= MAKSRES) return;
    const c = e.context as CanvasRenderingContext2D;
    flisnett.forEachTileCoord(fs.extent!, flisnett.getZForResolution(res), tc => {
      if (!dekket(tc)) return;
      const u = flisnett.getTileCoordExtent(tc);
      const a = ol.render.getRenderPixel(e, kart!.getPixelFromCoordinate([u[0], u[3]])),
        b = ol.render.getRenderPixel(e, kart!.getPixelFromCoordinate([u[2], u[1]]));
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
    kart!.render();
    friskOppGamle();
    if (etterVenter) planleggEtterarbeid();
    kartetFlyttes(false);
  });
  view.on('change:resolution', () => {
    if (view.getResolution()! >= MAKSRES) {
      oversiktSynlig(true);
      fargeleggAltSomVenter();
    }
  });
  kart.on('rendercomplete', () => {
    if (kartflagg.iBevegelse || view.getResolution()! >= MAKSRES || !app.valgt || !tema.getVisible() || opptatt())
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
