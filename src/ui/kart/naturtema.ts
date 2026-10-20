/* Kartlagene for naturtemaene fra Miljødirektoratet: verneområder, villrein og verdsatt natur, sløret over det som ikke er kartlagt,
   og markeringen av ett område valgt fra en liste. Områdene og det kartlagte leses fra katalogen (katalog.solv).
   Hvert tema vises på sin egen side. */
import type Feature from 'ol/Feature.js';
import type { FeatureLike } from 'ol/Feature.js';
import type ImageTile from 'ol/ImageTile.js';
import type { Coordinate } from 'ol/coordinate.js';
import type MultiPolygon from 'ol/geom/MultiPolygon.js';
import type Polygon from 'ol/geom/Polygon.js';
import type VectorSource from 'ol/source/Vector.js';
import { ol } from './ol.ts';
import { flislerret } from '../../data/solv/raster.ts';
import { OPPLOSNINGER } from '../../data/solv/felles.ts';
import type { Kartlagt } from '../../data/solv/temaer.ts';
import { TEMATABELLER, katalog } from '../../data/katalog.ts';
import { NATURTEMA, type Naturtema, type TemaOmrade } from '../../data/solv/temaer.ts';
import { verdi } from '../../data/motor/valgt.ts';
import { abonner, app, endret, tidSlutt } from '../../data/motor/tilstand.ts';
import { DEKNING, PRIKKET, farge, rgb } from '../farger.ts';
import { ui } from '../tilstand.ts';
import { KILDER, TOM, friskOpp, geomSti, nyttSiden, plannett, tegnetKilde, type Flislag } from './felles.ts';
import { rolig, tilKartet, view } from './kart.ts';

/* Hvordan hvert tema tegnes. Alle tegnes om til kartfliser i nettleseren, slik planlaget gjør: tusen flater som vektor måtte tegnes
   på nytt i hvert bilde når kartet flyttes, mens fliser tegnes én gang og flyttes som bilder.
   - Verneområder og villrein tegnes med skravur. Områdene er ofte store og dekker mye av kommunen, og som omriss falt streken
     sammen med kommunegrensen, og zoomet inn var det ingenting som viste at man var innenfor. Med skrå striper og en strek langs
     kanten synes det, og dagens klasser og planlagt utbygging kan leses under.
   - Verdsatt natur er mange små lokaliteter, så de tegnes fylt og uten hvit kant, i fire toner av samme farge: mørkere jo høyere
     verdi.
   - Temaer i PRIKKET (farger.ts) tegnes med prikker og en strek langs kanten i stedet. Hovedsiden har ingen; tvillingen fra Figma
     tegner villreinområdene slik, som skissene. */
const SKRAVERT: Record<string, boolean> = { vern: true, rein: true };

/* Ett lag per tema, med en kilde for flatene. Flatene lages én gang per hentet tema og huskes så lenge temaet ligger i katalogen. */
type Flate = Feature<MultiPolygon>;
interface Temalag {
  lag: Flislag;
  kilde: VectorSource<Flate>;
}
const LAG = new Map<string, Temalag>();
const flaterFor = new WeakMap<object, Flate[]>();
const lagFor = (t: Naturtema) => LAG.get(t.id)!;
/* Områdene i et tema for valgt kommune, fra sølv. Samme objekt så lenge temaet ikke hentes på nytt. */
const temaomrader = (t: Naturtema) => verdi(TEMATABELLER[t.id].omrader);
for (const t of NATURTEMA) {
  const kilde = new ol.source.Vector<Flate>();
  const lag = new ol.layer.Tile({
    className: 'plan',
    properties: { tittel: t.navn },
    visible: false,
    source: tegnetKilde(
      (tile: ImageTile) => (PRIKKET[t.id] ? tegnPrikkflis : SKRAVERT[t.id] ? tegnSkravurflis : tegnFlateflis)(t, tile),
      [KILDER.mdir]
    )
  });
  LAG.set(t.id, { lag, kilde });
}
/* Flatene i kartet for et hentet tema: én per område, i samme rekkefølge */
type Omradene = { omrader: TemaOmrade[] };
const flater = (O: Omradene) => {
  let f = flaterFor.get(O);
  if (!f) {
    f = O.omrader.map(o => new ol.Feature({ geometry: new ol.geom.MultiPolygon(o.koord), navn: o.navn, v: o.v || 0 }));
    flaterFor.set(O, f);
  }
  return f;
};

/* Slør over det som ikke er kartlagt: flisene fylles med en lys farge, og de kartlagte flatene stanses ut. Fliser uten noe kartlagt
   deler ett og samme bilde, så laget koster lite der hele flisen er ukjent. Laget ligger under naturflatene og planlaget. */
const dekKilde = new ol.source.Vector<Feature<Polygon>>();
let heltSlor: HTMLCanvasElement | null = null;
const slorFarge = () => `rgba(${rgb('slor').join(',')},.55)`;
function tegnSlorflis(tile: ImageTile) {
  const u = plannett.getTileCoordExtent(tile.getTileCoord()),
    fl = dekKilde.getFeaturesInExtent(u);
  if (!fl.length) {
    if (!heltSlor) {
      heltSlor = flislerret();
      const g = heltSlor.getContext('2d')!;
      g.fillStyle = slorFarge();
      g.fillRect(0, 0, 512, 512);
    }
    tile.setImage(heltSlor);
    return;
  }
  const t0 = performance.now(),
    c = flislerret(),
    s = 512 / (u[2] - u[0]);
  const g = c.getContext('2d')!;
  g.fillStyle = slorFarge();
  g.fillRect(0, 0, 512, 512);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (const f of fl) {
    geomSti(g, f.getGeometry()!, u, s);
    g.fill('evenodd');
  }
  tile.setImage(c);
  tidSlutt('slør, fliser', t0);
}
/* Dekningskartet som prikker over det som er kartlagt, i fargen «dekning», i stedet for slør over det som ikke er (DEKNING i
   farger.ts). Hovedsiden har sløret; tvillingen fra Figma har prikkene, som skissene. */
function tegnDekningsprikker(tile: ImageTile) {
  const u = plannett.getTileCoordExtent(tile.getTileCoord()),
    fl = dekKilde.getFeaturesInExtent(u);
  if (!fl.length) {
    tile.setState(TOM);
    return;
  }
  const s = 512 / (u[2] - u[0]),
    maske = flislerret(),
    mg = maske.getContext('2d')!;
  for (const f of fl) {
    geomSti(mg, f.getGeometry()!, u, s);
    mg.fill('evenodd');
  }
  const c = flislerret(),
    g = c.getContext('2d')!;
  prikker(g, farge('dekning'));
  g.globalCompositeOperation = 'destination-in'; /* prikkene bare innenfor det kartlagte, alle flatene slått sammen */
  g.drawImage(maske, 0, 0);
  tile.setImage(c);
}
export const dekLag = new ol.layer.Tile({
  className: 'plan',
  properties: { tittel: 'Slør over det som ikke er kartlagt' },
  visible: false,
  source: tegnetKilde(tile => (DEKNING.prikker ? tegnDekningsprikker : tegnSlorflis)(tile as ImageTile), [KILDER.mdir])
});
const kartlagteFlater = new WeakMap<Kartlagt, Feature<Polygon>[]>();
function settDekning(E: Kartlagt | null | undefined) {
  /* de kartlagte flatene for valgt kommune inn i sløret */
  dekKilde.clear();
  if (E && E.flate) {
    let f = kartlagteFlater.get(E);
    if (!f) kartlagteFlater.set(E, (f = E.flate.map(p => new ol.Feature(new ol.geom.Polygon(p)))));
    dekKilde.addFeatures(f);
  }
  friskOpp(dekLag);
}
/* Slør over det som ikke er kartlagt, på siden for verdsatt natur */
export function settSlor(paa: boolean) {
  ui.slorPaa = paa;
  endret();
}

/* Rekkefølge i kartet: temaene ligger under planlaget, så planlagt utbygging oppå dem synes. */
/* Temaene som vises i kartet nå, og om sløret over det som ikke er kartlagt vises, til tegnforklaringen */
export const synligeTemaer = () => NATURTEMA.filter(t => lagFor(t).lag.getVisible());
export const slorSynlig = () => dekLag.getVisible();
export const flateLag = NATURTEMA.map(t => lagFor(t).lag);
/* Temaene som tegnes med skravur, til tegnforklaringen */
export const skravert = (t: Naturtema) => !!SKRAVERT[t.id];

/* Skravur: skrå striper i temaets farge over hele området, og en strek langs kanten. Stripene ligger fast i kartet (der x + y i
   flispiksler fra origo går opp i SKRAVUR), så de går rett over fra flis til flis. Et område som er mindre enn noen få piksler i
   kartet, for eksempel et fredet tre, tegnes som en liten ring med hvit bunn, ellers ville det ikke synes. Ringen kan stikke inn i
   naboflisen, så flisen tar med områdene rett utenfor også. Mål i flispiksler, som er halve skjermpiksler. */
const SKRAVUR = 20,
  STRIPE = 3,
  KANT = 4,
  LITE = 16 /* områder mindre enn dette tegnes som ring */,
  RING = 8,
  BUNN = 14;
function tegnSkravurflis(t: Naturtema, tile: ImageTile) {
  const t0 = performance.now(),
    tc = tile.getTileCoord(),
    u = plannett.getTileCoordExtent(tc),
    s = 512 / (u[2] - u[0]),
    alle = lagFor(t).kilde.getFeaturesInExtent(ol.extent.buffer(u, BUNN / s)),
    lite = (f: Flate) => {
      const e = f.getGeometry()!.getExtent();
      return Math.max(e[2] - e[0], e[3] - e[1]) * s < LITE;
    },
    sma = alle.filter(lite),
    fl = alle.filter(f => !lite(f) && ol.extent.intersects(f.getGeometry()!.getExtent(), u));
  if (!fl.length && !sma.length) {
    tile.setState(TOM);
    return;
  }
  const maske = flislerret(),
    mg = maske.getContext('2d')!;
  for (const f of fl) {
    geomSti(mg, f.getGeometry()!, u, s);
    mg.fill('evenodd');
  }
  const c = flislerret(),
    g = c.getContext('2d')!;
  g.strokeStyle = `rgba(${rgb(t.id).join(',')},.8)`;
  g.lineWidth = STRIPE;
  g.beginPath();
  for (let d = (((-(tc[1] + tc[2]) * 512) % SKRAVUR) + SKRAVUR) % SKRAVUR; d < 1024 + SKRAVUR; d += SKRAVUR) {
    g.moveTo(d, 0);
    g.lineTo(d - 512, 512);
  }
  g.stroke();
  g.globalCompositeOperation = 'destination-in'; /* stripene bare innenfor områdene */
  g.drawImage(maske, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = farge(t.id);
  g.lineWidth = KANT;
  g.lineJoin = 'round';
  for (const f of fl) {
    geomSti(g, f.getGeometry()!, u, s);
    g.stroke();
  }
  for (const f of sma) {
    const m = ol.extent.getCenter(f.getGeometry()!.getExtent()),
      x = (m[0] - u[0]) * s,
      y = (u[3] - m[1]) * s;
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.beginPath();
    g.arc(x, y, BUNN, 0, 2 * Math.PI);
    g.fill();
    g.lineWidth = 5.5;
    g.beginPath();
    g.arc(x, y, RING, 0, 2 * Math.PI);
    g.stroke();
  }
  tile.setImage(c);
  tidSlutt(t.navn.toLowerCase() + ', fliser', t0);
}
/* Prikker: runde prikker i fargen «<tema>-prikk» over hele området, i et fast rutenett i kartet (PRIKK flispiksler mellom, hver
   andre rad forskjøvet en halv), så de går rett over fra flis til flis, og en strek i temaets farge langs kanten */
const PRIKK = 16,
  PRIKKRADIUS = 2.6,
  PRIKKANT = 3;
/* Prikker over hele flisen i lerretet g, i fargen f */
function prikker(g: CanvasRenderingContext2D, f: string) {
  g.fillStyle = f;
  g.beginPath();
  for (let y = 0, r = 0; y < 512 + PRIKK; y += PRIKK / 2, r++)
    for (let x = r % 2 ? PRIKK / 2 : 0; x < 512 + PRIKK; x += PRIKK) {
      g.moveTo(x + PRIKKRADIUS, y);
      g.arc(x, y, PRIKKRADIUS, 0, 2 * Math.PI);
    }
  g.fill();
}
function tegnPrikkflis(t: Naturtema, tile: ImageTile) {
  const t0 = performance.now(),
    u = plannett.getTileCoordExtent(tile.getTileCoord()),
    s = 512 / (u[2] - u[0]),
    fl = lagFor(t).kilde.getFeaturesInExtent(u);
  if (!fl.length) {
    tile.setState(TOM);
    return;
  }
  const maske = flislerret(),
    mg = maske.getContext('2d')!;
  for (const f of fl) {
    geomSti(mg, f.getGeometry()!, u, s);
    mg.fill('evenodd');
  }
  const c = flislerret(),
    g = c.getContext('2d')!;
  prikker(g, farge(t.id + '-prikk') || farge(t.id));
  g.globalCompositeOperation = 'destination-in'; /* prikkene bare innenfor områdene */
  g.drawImage(maske, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = farge(t.id);
  g.lineWidth = PRIKKANT;
  g.lineJoin = 'round';
  for (const f of fl) {
    geomSti(g, f.getGeometry()!, u, s);
    g.stroke();
  }
  tile.setImage(c);
  tidSlutt(t.navn.toLowerCase() + ', fliser', t0);
}
function tegnFlateflis(t: Naturtema, tile: ImageTile) {
  /* enkeltflatene som berører flisen, tegnet tett og så gjort litt gjennomsiktige samlet, så overlapp ikke blir mørkere */
  const t0 = performance.now(),
    u = plannett.getTileCoordExtent(tile.getTileCoord()),
    fl = lagFor(t).kilde.getFeaturesInExtent(u);
  if (!fl.length) {
    tile.setState(TOM);
    return;
  }
  const c = flislerret(),
    s = 512 / (u[2] - u[0]);
  const g = c.getContext('2d')!;
  g.fillStyle = g.strokeStyle = farge(t.id);
  g.lineWidth = 1;
  g.lineJoin = 'round';
  if (t.klasser)
    fl.sort(
      (a, b) => b.get('v') - a.get('v')
    ); /* lavest verdi først, så den høyeste ligger øverst der lokaliteter overlapper */
  for (const f of fl) {
    if (t.klasser) {
      const v = f.get('v');
      g.fillStyle = farge(t.klasser[v][1]);
      g.strokeStyle = farge(t.klasser[Math.max(0, v - 1)][1]);
    }
    geomSti(g, f.getGeometry()!, u, s);
    g.fill('evenodd');
    g.stroke();
  }
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = 'rgba(0,0,0,.82)';
  g.fillRect(0, 0, 512, 512);
  tile.setImage(c);
  tidSlutt(t.navn.toLowerCase() + ', fliser', t0);
}

/* Navnet på områdene i punktet c, i temaene som vises, til trykk i kartet */
export function navnVed(c: Coordinate) {
  return NATURTEMA.map(t => {
    const { lag } = lagFor(t),
      O = temaomrader(t);
    if (!lag.getVisible() || !O) return null;
    const F = flater(O),
      i = O.omrader.findIndex(
        (o, a) =>
          c[0] >= o.ext[0] &&
          c[0] <= o.ext[2] &&
          c[1] >= o.ext[1] &&
          c[1] <= o.ext[3] &&
          F[a].getGeometry()!.intersectsCoordinate(c)
      ),
      o = i < 0 ? null : O.omrader[i];
    return o ? ` · ${o.navn}${t.samlet && o.under ? ` (${o.under.toLowerCase()})` : ''}` : null;
  })
    .filter(Boolean)
    .join('');
}

/* Ett område valgt fra en liste: kartet flyttes dit, området får en tydelig ramme, og en liten merkelapp i kartet sier hva som vises
   og gir veien tilbake til listen. Markeringen står til et annet område velges, temaet slås av eller kommunen byttes. */
const markKilde = new ol.source.Vector();
const markStrek = [
  new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#fff', width: 8 }) }),
  new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#171C1A', width: 3.5 }) })
];
const markMidt = (f: FeatureLike) => new ol.geom.Point(ol.extent.getCenter(f.getGeometry()!.getExtent()));
const markRing = [
  new ol.style.Style({
    geometry: markMidt,
    image: new ol.style.Circle({ radius: 13, stroke: new ol.style.Stroke({ color: '#fff', width: 8 }) })
  }),
  new ol.style.Style({
    geometry: markMidt,
    image: new ol.style.Circle({ radius: 13, stroke: new ol.style.Stroke({ color: '#171C1A', width: 3.5 }) })
  })
];
export const markLag = new ol.layer.Vector({
  className: 'merket',
  source: markKilde,
  style: (f, res) => {
    const u = f.getGeometry()!.getExtent();
    return Math.max(u[2] - u[0], u[3] - u[1]) < 16 * res ? markRing : markStrek;
  }
});
export function fjernMerket() {
  markKilde.clear();
  if (ui.vist) {
    ui.vist = null;
    endret();
  }
}
/* id er temaet, nr plassen til området i temaets liste over områder, og liId id-en til området i listen på siden, så man kan
   finne veien tilbake dit. */
export function visIKartet(id: string, nr: number, liId: string) {
  const t = NATURTEMA.find(x => x.id === id),
    O = t && temaomrader(t),
    o = O && O.omrader[nr];
  if (!o) return;
  markKilde.clear();
  markKilde.addFeature(new ol.Feature(flater(O!)[nr].getGeometry()));
  ui.vist = { id: t!.id, navn: o.navn, liId };
  endret();
  view.fit(o.ext, { padding: [56, 56, 96, 56], minResolution: OPPLOSNINGER[13], duration: rolig() ? 0 : 400 });
  tilKartet(true);
}

/* Lagene følger tilstanden: hvert tema vises på sin egen side når det er hentet for valgt kommune og har noe å vise. Sløret vises
   på siden for verdsatt natur når det er slått på og kommunen er kartlagt. Markeringen fjernes når man forlater temaet eller bytter
   kommune. */
const ny = nyttSiden();
abonner(() => {
  if (ny('valgt', app.valgt)) fjernMerket();
  if (ui.vist && ui.side !== ui.vist.id) fjernMerket();
  const G = verdi(katalog.solv.grense),
    nyGrense = ny('grense', G);
  for (const t of NATURTEMA) {
    const { lag, kilde } = lagFor(t),
      O = temaomrader(t),
      paa = ui.side === t.id;
    if (ny('data ' + t.id, O)) {
      kilde.clear();
      if (O) kilde.addFeatures(flater(O));
      friskOpp(lag);
    }
    lag.setVisible(paa && !!G && !!O && O.omrader.length > 0);
    if (t.dekning) {
      const E = O ? verdi(katalog.solv.kartlagt) : null;
      if (ny('kartlagt', E)) settDekning(E);
      if (nyGrense && G) dekLag.setExtent(G.ext);
      dekLag.setVisible(paa && ui.slorPaa && !!G && !!E && !!E.flate && E.flate.length > 0);
    }
  }
});
