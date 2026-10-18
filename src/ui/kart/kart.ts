/* Selve kartet: bakgrunn, grense og status, og hvordan lagene settes sammen. Klippingen mot kommunen står i klipping.ts, målingen i
   maaling.ts, og trykk i kartet og bytte av kommune i trykk.ts. Kartet lages av lagKart når alle filene er lastet, og settes inn på
   siden av ui/komponenter/Kartpanel.tsx. Hvert kartlag ligger i sin egen fil her, og følger tilstanden i datamotoren på samme måte
   som React-komponentene: ved hver endring sjekker laget om det det tegnes av, er nytt. Kartet kaller datamotoren når brukeren gjør noe (velger en annen kommune), men datamotoren kaller aldri kartet. */
import type ImageTile from 'ol/ImageTile.js';
import type OlMap from 'ol/Map.js';
import type { LoadFunction } from 'ol/Tile.js';
import type { TileCoord } from 'ol/tilecoord.js';
import { ol } from './ol.ts';
import { henteStatus, opptatt } from '../../data/bronse/henting.ts';
import { bakgrunnUrl } from '../../data/bronse/kartverket.ts';
import { OPPLOSNINGER, ORIGO, UTM, type Flis } from '../../data/solv/felles.ts';
import { katalog } from '../../data/katalog.ts';
import { valgt, verdi } from '../../data/motor/valgt.ts';
import { abonner, app, endret } from '../../data/motor/tilstand.ts';
import { farge } from '../farger.ts';
import { kb, nf } from '../tekst.ts';
import { ui } from '../tilstand.ts';
import { egneLag, sluttTegning, tegner } from './egne.ts';
import { KILDER, MAKSTETTHET, kartflagg, nyttSiden, plannett, type Flistegner } from './felles.ts';
import { graaLag } from './graa.ts';
import { tema } from './grunnkart.ts';
import { inonLag } from './inon.ts';
import { klippSist, settKlipp } from './klipping.ts';
import { maalKartet, startMaaling, stoppMaaling } from './maaling.ts';
import { dekLag, flateLag, markLag, slorSynlig, synligeTemaer } from './naturtema.ts';
import { planLag } from './plan.ts';
import {
  glemPunkt,
  lagByttPrikk,
  lagPunktPrikk,
  lukkBytt,
  omrissLag,
  oppdaterOmriss,
  plasserBytt,
  trykkIKartet
} from './trykk.ts';

/* Bakgrunnskartet hentes gjennom katalogen (bronse.bakgrunnsflis), som ikke lagrer det. Kartet holder de ferdige flisene selv. */
function lastBakgrunn(tile: ImageTile) {
  katalog.bronse
    .bakgrunnsflis(tile.getTileCoord() as Flis)
    .then(buf => {
      const img = tile.getImage() as HTMLImageElement,
        url = URL.createObjectURL(new Blob([buf]));
      img.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
      img.addEventListener('error', () => URL.revokeObjectURL(url), { once: true });
      img.src = url;
    })
    .catch(() => tile.setState(3));
}
const bakgrunn = new ol.layer.Tile({
  className: 'bakgrunn',
  properties: { tittel: 'Bakgrunnskartet' },
  source: new ol.source.XYZ({
    projection: UTM,
    crossOrigin: 'anonymous',
    attributions: [KILDER.kartverket],
    tileGrid: new ol.tilegrid.TileGrid({ origin: ORIGO, resolutions: OPPLOSNINGER, tileSize: 256 }),
    tileUrlFunction: bakgrunnUrl as (tc: TileCoord) => string,
    tileLoadFunction: lastBakgrunn as Flistegner as LoadFunction
  })
});
const grenseKilde = new ol.source.Vector();
const grense = new ol.layer.Vector({
  className: 'grense',
  source: grenseKilde,
  style: () => new ol.style.Style({ stroke: new ol.style.Stroke({ color: farge('ink'), width: 1.5 }) })
});
/* Utsnittet: projeksjonen, nivåene og at kartet ikke kan roteres. lagView lager et nytt, til et kart nummer to (tvillingen fra Figma). */
export const lagView = () =>
  new ol.View({
    projection: UTM,
    center: ol.proj.fromLonLat([15, 65], UTM),
    resolutions: OPPLOSNINGER.slice(2),
    resolution: OPPLOSNINGER[4],
    enableRotation: false
  });
export const view = lagView();
/* Bakgrunnskartet og kommunegrensen til et kart nummer to, som kartet over naturen i verneområdene i tvillingen fra Figma. Et lag
   kan bare stå i ett kart, men kildene deles, så grensen følger valgt kommune og bakgrunnen hentes på samme måte. */
export const bakgrunnslag = () =>
  new ol.layer.Tile({
    className: 'bakgrunn',
    properties: { tittel: 'Bakgrunnskartet' },
    source: bakgrunn.getSource()!
  });
export const grenselag = () =>
  new ol.layer.Vector({ className: 'grense', source: grenseKilde, style: grense.getStyle() });
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
/* Hva kartet viser nå, til tegnforklaringen: dagens klasser, planlagt utbygging, temaet for siden, sløret over det som ikke er
   kartlagt, og egne områder */
export function synligeLag() {
  return {
    klasser: !!kart && tema.getVisible(),
    plan: planLag.getVisible(),
    inon: inonLag.getVisible(),
    graa: graaLag.getVisible(),
    temaer: synligeTemaer(),
    slor: slorSynlig(),
    egne: egneLag.getVisible() && egneLag.getSource()!.getFeatures().length > 0
  };
}

/* Kartets minne, til katalogen: hvert fliselag i OpenLayers holder på flisene det har tegnet ferdig, så kartet kan flyttes fram og
   tilbake uten å tegne dem på nytt. Gir per lag hvor mange fliser som holdes, hvor mange det er plass til, og omtrent hvor mye
   minne bildene tar (bredde × høyde × 4 byte). Lag som ikke er fliser (grensen, omrissene og egne områder), er ikke med. */
/* Midten av kartet og flisnivået der, til nøklene katalogvisningen spør med. null før kartet finnes. */
export function kartetsMidte() {
  const c = view.getCenter(),
    r = view.getResolution();
  return kart && c && r ? { midt: c, z: plannett.getZForResolution(r) } : null;
}

export function kartetsMinne() {
  if (!kart) return [];
  return kart.getAllLayers().flatMap(l => {
    if (!(l instanceof ol.layer.Tile)) return [];
    const C = l.getRenderer()?.getTileCache();
    if (!C) return [];
    let fliser = 0,
      byte = 0;
    C.forEach((t: { getState(): number; getImage?: () => unknown }) => {
      const b = t.getState() === 2 && t.getImage ? (t.getImage() as { width: number; height: number } | null) : null;
      if (!b || !b.width) return;
      const w = b instanceof HTMLImageElement ? b.naturalWidth : b.width,
        h = b instanceof HTMLImageElement ? b.naturalHeight : b.height;
      fliser++;
      byte += w * h * 4;
    });
    return [{ tittel: String(l.get('tittel') ?? l.getClassName()), fliser, plass: C.highWaterMark, byte }];
  });
}

/* Kartet følger valgt kommune og grensen */
const ny = nyttSiden();
abonner(() => {
  oppdaterOmriss();
  if (ny('valgt', app.valgt) && app.valgt) {
    const k = app.valgt;
    lukkBytt();
    glemPunkt();
    ui.probe = null;
    ui.siste = '';
    grenseKilde.clear();
    settKlipp(null);
    tema.setVisible(false);
    tema.setExtent(undefined);
    if (k.boks)
      view.fit(ol.proj.transformExtent(k.boks, 'EPSG:4326', UTM), { padding: [16, 16, 16, 16], duration: 350 });
    endret();
  }
  const G = verdi(katalog.solv.grense);
  if (ny('grense', G) && G) {
    const k = app.valgt,
      ext = G.ext;
    const flate = new ol.geom.MultiPolygon(G.koord);
    settKlipp(flate);
    grenseKilde.clear();
    grenseKilde.addFeature(new ol.Feature(flate));
    tema.setExtent(ext);
    tema.setVisible(true);
    if (k && !k.boks) view.fit(ext, { padding: [16, 16, 16, 16], duration: 350 });
  }
  const g = valgt(katalog.solv.grense),
    feil = !!g && g.status === 'feil';
  if (ny('grenseFeil', feil) && feil) {
    ui.probe = { tekst: 'Kommunegrensen kunne ikke hentes.' };
    tema.setVisible(true);
    endret();
  }
  if (ny('sisteKall', app.sisteKall) && app.sisteKall) {
    const s = app.sisteKall,
      fliser = (n: number) => `${n} ${n === 1 ? 'flis' : 'fliser'}`;
    ui.siste = s.n
      ? `Siste kall mot ${s.kilde}: ${fliser(s.n)}, ${nf(s.ms / 1000)} s, ${kb(s.bytes)}`
      : `Kallet mot ${s.kilde} feilet.`;
    endret();
  }
});

/* Når selve siden er forstørret, fyller kartet fort hele skjermen. Fanget kartet da alle bevegelser, kom man ikke ut igjen. Kartet k
   slipper derfor knip og dra igjennom til nettleseren så lenge siden er forstørret. Knappene for zoom og trykk i kartet virker
   fortsatt. Brukes for hvert kart på siden. */
export function slippVedSidezoom(k: OlMap) {
  if (!window.visualViewport) return;
  const vv = window.visualViewport;
  let sist = false;
  const sjekk = () => {
    const stor = vv.scale > 1.03;
    if (stor === sist) return;
    sist = stor;
    k.getViewport().style.touchAction = stor ? 'auto' : 'none';
    k.getInteractions().forEach(i => i.setActive(!stor));
    if (stor === ui.sidezoom) return;
    ui.sidezoom = stor;
    document.documentElement.classList.toggle('sidezoom', stor);
    endret();
  };
  vv.addEventListener('resize', sjekk);
  vv.addEventListener('scroll', sjekk);
  sjekk();
}

/* Lager kartet med alle lagene og kobler til hendelsene. Kalles én gang, når alle filene er lastet. */
export function lagKart() {
  if (kart) return kart;
  kart = new ol.Map({
    layers: [bakgrunn, tema, inonLag, graaLag, dekLag, ...flateLag, planLag, grense, egneLag, omrissLag, markLag],
    view,
    pixelRatio: Math.min(window.devicePixelRatio || 1, MAKSTETTHET),
    controls: [
      new ol.control.Zoom({ zoomInTipLabel: 'Zoom inn', zoomOutTipLabel: 'Zoom ut' }),
      new ol.control.ScaleLine(),
      new ol.control.Attribution({ collapsible: false })
    ]
  });
  slippVedSidezoom(kart);
  klippSist(tema, [inonLag, graaLag]);
  klippSist(inonLag, [graaLag]);
  klippSist(graaLag, []);
  [dekLag, ...flateLag].forEach((l, i, alle) => klippSist(l, alle.slice(i + 1))); /* disse deler lerret */
  maalKartet(kart);
  kart.on('movestart', () => {
    kartflagg.iBevegelse = true;
    kartflagg.startet = henteStatus.startet;
    startMaaling();
  });
  kart.on('moveend', () => {
    kartflagg.iBevegelse = false;
    stoppMaaling();
    kart!.render();
  });
  kart.on('rendercomplete', () => {
    if (kartflagg.iBevegelse || !app.valgt || !tema.getVisible() || opptatt()) return;
    const ingen = 'Ingen nye kall. Flisene lå allerede i nettleseren.';
    if (henteStatus.startet === kartflagg.startet && ui.siste !== ingen) {
      ui.siste = ingen;
      endret();
    }
  });
  kart.addOverlay(lagByttPrikk());
  kart.addOverlay(lagPunktPrikk());
  kart.on('postrender', plasserBytt);
  kart.on('singleclick', trykkIKartet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && tegner()) sluttTegning();
  });
  return kart;
}
