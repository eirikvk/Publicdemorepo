/* Selve kartet: bakgrunn, grense og status, og hvordan lagene settes sammen. Klippingen mot kommunen står i klipping.ts, målingen i
   maaling.ts, og trykk i kartet og bytte av kommune i trykk.ts. Kartet lages av lagKart når alle filene er lastet, og settes inn på
   siden av ui/komponenter/Kartpanel.tsx. Hvert kartlag ligger i sin egen fil her, og følger tilstanden i datamotoren på samme måte
   som React-komponentene: ved hver endring sjekker laget om det det tegnes av, er nytt. Kartet kaller datamotoren når brukeren gjør noe (velger en annen kommune), men datamotoren kaller aldri kartet. */
import type OlMap from 'ol/Map.js';
import type { TileCoord } from 'ol/tilecoord.js';
import { ol } from './ol.ts';
import { henteStatus, opptatt } from '../../data/bronse/henting.ts';
import { FLISNIVA } from '../../data/bronse/nibio-grunnkart.ts';
import { bakgrunnUrl } from '../../data/bronse/kartverket.ts';
import { OPPLOSNINGER, ORIGO, UTM } from '../../data/solv/felles.ts';
import { kartetFlyttes, lagretUtsnitt, oversikt } from '../../data/motor/grunnkart.ts';
import { grense as kommunegrensen, grenseFeil } from '../../data/motor/gulldata.ts';
import { abonner, app, endret } from '../../data/motor/tilstand.ts';
import { farge } from '../farger.ts';
import { kb, nf } from '../tekst.ts';
import { ui } from '../tilstand.ts';
import { egneLag, sluttTegning, tegner } from './egne.ts';
import { MAKSRES, MAKSTETTHET, flisnett, kartflagg, nyttSiden } from './felles.ts';
import { graaLag } from './graa.ts';
import {
  etterVenter,
  fargeleggAltSomVenter,
  friskOppGamle,
  klare,
  oversiktLag,
  oversiktSynlig,
  pauseEtterarbeid,
  planleggEtterarbeid,
  tema
} from './grunnkart.ts';
import { inonLag } from './inon.ts';
import { klippSist, settKlipp } from './klipping.ts';
import { maalKartet, startMaaling, stoppMaaling } from './maaling.ts';
import { dekLag, flateLag, markLag, omrissLag } from './naturtema.ts';
import { planLag } from './plan.ts';
import { beholdes, glemBehold, lagByttPrikk, lukkBytt, plasserBytt, trykkIKartet } from './trykk.ts';

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
/* Meter per piksel i kartet nå. Kartet har alltid en oppløsning, så den finnes. */
export const opplosning = () => view.getResolution()!;
/* Brukeren har bedt om mindre bevegelse: da flyttes ikke kart og side mykt. */
export const rolig = () => !!window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Ruller siden så kartet er synlig. Kartet ligger i elementet med klassen kartscene, se Kartpanel.tsx. */
export const tilKartet = (mykt?: boolean) => {
  const k = document.querySelector('.kartscene');
  if (k) k.scrollIntoView({ behavior: mykt && !rolig() ? 'smooth' : 'auto', block: 'nearest' });
};
/* Der en flis er ferdig lastet, fjernes oversiktsbildet under den før flisen tegnes. Ellers ville det grove
   bildet stikke fram som en uskarp kant rundt alt som er gjennomsiktig i flisen, for eksempel langs sjøen. */
const dekket = ([z, x, y]: TileCoord) => {
  for (let d = 0; z - d >= FLISNIVA; d++) if (klare.has(`${z - d}/${x >> d}/${y >> d}`)) return true;
  return false;
};
/* Oversiktsbildet ligger under flisene og vises mens nytt innhold lastes. Sammen med fliser nettleseren
   alt har fra andre zoomnivåer gjør det at kartet aldri står tomt. Når alle flisene i utsnittet er på plass, skjules det. */
export function kartStatus() {
  const varUte = ui.ute,
    varSiste = ui.siste;
  if (opplosning() < MAKSRES) ui.ute = false;
  else {
    const ov = oversikt(),
      o = (ov && ov.ext) || (app.valgt && lagretUtsnitt(app.valgt.nr)),
      treff = !!o && !!kart && ol.extent.intersects(view.calculateExtent(kart.getSize()), o);
    oversiktSynlig(true);
    ui.ute = !treff && !!app.valgt;
    ui.siste = !treff
      ? ''
      : ov && ov.dynamisk
        ? 'Viser kart nettleseren allerede har hentet'
        : 'Viser lagret oversiktsbilde';
  }
  if (ui.ute !== varUte || ui.siste !== varSiste) endret();
}
/* Kartet følger valgt kommune og grensen */
const ny = nyttSiden();
abonner(() => {
  if (ny('valgt', app.valgt) && app.valgt) {
    const k = app.valgt,
      behold = beholdes(k.nr);
    lukkBytt();
    ui.probe = null;
    ui.siste = '';
    grenseKilde.clear();
    settKlipp(null);
    tema.setVisible(false);
    tema.setExtent(undefined);
    if (k.boks && !behold)
      view.fit(ol.proj.transformExtent(k.boks, 'EPSG:4326', UTM), { padding: [16, 16, 16, 16], duration: 350 });
    kartStatus();
    endret();
  }
  const G = kommunegrensen();
  if (ny('grense', G) && G) {
    const k = app.valgt,
      ext = G.ext;
    const flate = new ol.geom.MultiPolygon(G.koord);
    settKlipp(flate);
    grenseKilde.clear();
    grenseKilde.addFeature(new ol.Feature(flate));
    tema.setExtent(ext);
    tema.setVisible(true);
    if (k && !k.boks && !beholdes(k.nr)) view.fit(ext, { padding: [16, 16, 16, 16], duration: 350 });
    glemBehold();
  }
  const feil = grenseFeil();
  if (ny('grenseFeil', feil) && feil) {
    ui.probe = { tekst: 'Kommunegrensen kunne ikke hentes.' };
    tema.setVisible(true);
    endret();
  }
  if (ny('oversikt', app.valgt && lagretUtsnitt(app.valgt.nr))) kartStatus();
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
    if (!oversikt() || !oversiktLag.getVisible() || res >= MAKSRES) return;
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
  maalKartet(kart);
  kart.on('movestart', () => {
    kartflagg.iBevegelse = true;
    kartflagg.startet = henteStatus.startet;
    kartflagg.feilet = henteStatus.feilet;
    kartetFlyttes(true);
    oversiktSynlig(true);
    pauseEtterarbeid();
    startMaaling();
  });
  kart.on('moveend', () => {
    kartflagg.iBevegelse = false;
    stoppMaaling();
    kartStatus();
    kart!.render();
    friskOppGamle();
    if (etterVenter) planleggEtterarbeid();
    kartetFlyttes(false);
  });
  view.on('change:resolution', () => {
    if (opplosning() >= MAKSRES) {
      oversiktSynlig(true);
      fargeleggAltSomVenter();
    }
  });
  kart.on('rendercomplete', () => {
    if (kartflagg.iBevegelse || opplosning() >= MAKSRES || !app.valgt || !tema.getVisible() || opptatt())
      return; /* aldri skjul oversikten midt i en bevegelse */
    if (henteStatus.feilet === kartflagg.feilet) oversiktSynlig(false);
    const ingen = 'Ingen nye kall. Flisene lå allerede i nettleseren.';
    if (henteStatus.startet === kartflagg.startet && ui.siste !== ingen) {
      ui.siste = ingen;
      endret();
    }
  });
  kart.addOverlay(lagByttPrikk());
  kart.on('postrender', plasserBytt);
  kart.on('singleclick', trykkIKartet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && tegner()) sluttTegning();
  });
  return kart;
}
