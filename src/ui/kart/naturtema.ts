/* Kartlagene for naturtemaene fra Miljødirektoratet: verneområder, villrein og verdsatt natur, sløret over det som ikke er kartlagt,
   og markeringen av ett område valgt fra en liste. Dataene hentes og regnes ut i data/motor/naturtema.ts. Hvert tema vises på sin
   egen side. */
import type Feature from 'ol/Feature.js';
import type { FeatureLike } from 'ol/Feature.js';
import type ImageTile from 'ol/ImageTile.js';
import type { Coordinate } from 'ol/coordinate.js';
import type MultiPolygon from 'ol/geom/MultiPolygon.js';
import type Point from 'ol/geom/Point.js';
import type Polygon from 'ol/geom/Polygon.js';
import type VectorLayer from 'ol/layer/Vector.js';
import type VectorSource from 'ol/source/Vector.js';
import { ol } from './ol.ts';
import { OPPLOSNINGER } from '../../data/solv/felles.ts';
import type { Kartlagt } from '../../data/solv/temaer.ts';
import { NATURTEMA, type Naturtema } from '../../data/motor/naturtema.ts';
import { abonner, app, endret, tidSlutt, gjelder } from '../../data/motor/tilstand.ts';
import { farge, rgb } from '../farger.ts';
import { ui } from '../tilstand.ts';
import { TOM, friskOpp, geomSti, nyttSiden, plannett, tegnetKilde, type Flislag } from './felles.ts';
import { rolig, tilKartet, view } from './kart.ts';

/* Hvordan hvert tema tegnes. Verdsatt natur er mange små lokaliteter, så de tegnes fylt og uten hvit kant, i fire toner av samme
   farge: mørkere jo høyere verdi. De andre tegnes som omriss. */
const FYLT: Record<string, boolean> = { verdi: true };

/* Ett lag per tema, med en kilde for flatene. Flatene lages én gang per hentet tema (pakke) og huskes. Fylte temaer tegnes som
   fliser (Flislag), de andre som omriss (VectorLayer). */
type Flate = Feature<MultiPolygon>;
interface Temalag {
  lag: Flislag | VectorLayer<VectorSource<Flate>>;
  kilde: VectorSource<Flate>;
}
const LAG = new Map<string, Temalag>();
const flaterFor = new WeakMap<object, Flate[]>();
const lagFor = (t: Naturtema) => LAG.get(t.id)!;
for (const t of NATURTEMA) {
  const kilde = new ol.source.Vector<Flate>();
  /* Bare omriss: en hvit kant og en farget strek. En fylling over hele området måtte tegnes på nytt i hvert bilde når kartet flyttes.
     Laget deler lerret med planlaget, så de klippes samlet. Den store bufferen gjør at alle omrissene i kommunen tegnes i ett, også de
     utenfor utsnittet, så de er på plass mens kartet flyttes. */
  /* Fylte flater tegnes om til kartfliser i nettleseren, slik planlaget gjør. Tusen små flater som vektor måtte tegnes på nytt i hvert
     bilde når kartet flyttes. Som fliser tegnes de én gang og flyttes som bilder. */
  /* Et område som er mindre enn noen få piksler i kartet, for eksempel et fredet tre, tegnes som en liten ring med fast størrelse.
     Som omriss ville det blinket når kartet flyttes: havner alle punktene i samme piksel, blir streken null lang og tegnes ikke. */
  const midt = (f: FeatureLike & { midt?: Point }) =>
    f.midt || (f.midt = new ol.geom.Point(ol.extent.getCenter(f.getGeometry()!.getExtent())));
  const strek = [
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,.92)', width: 6 }) }),
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: farge(t.id), width: 2.75 }) })
  ];
  const merke = [
    new ol.style.Style({
      geometry: midt,
      image: new ol.style.Circle({ radius: 7, fill: new ol.style.Fill({ color: 'rgba(255,255,255,.92)' }) })
    }),
    new ol.style.Style({
      geometry: midt,
      image: new ol.style.Circle({ radius: 4, stroke: new ol.style.Stroke({ color: farge(t.id), width: 2.75 }) })
    })
  ];
  const lag = FYLT[t.id]
    ? new ol.layer.Tile({
        className: 'plan',
        visible: false,
        source: tegnetKilde((tile: ImageTile) => tegnFlateflis(t, tile))
      })
    : new ol.layer.Vector({
        className: 'plan',
        source: kilde,
        visible: false,
        renderBuffer: 4000,
        style: (f, res) => {
          const u = f.getGeometry()!.getExtent();
          return Math.max(u[2] - u[0], u[3] - u[1]) < 8 * res ? merke : strek;
        }
      });
  LAG.set(t.id, { lag, kilde });
}
/* Flatene i kartet for et hentet tema: én per område, i samme rekkefølge */
const flater = (D: NonNullable<Naturtema['data']>) => {
  const p = D.pakke || D;
  let f = flaterFor.get(p);
  if (!f) {
    f = D.omrader.map(o => new ol.Feature({ geometry: new ol.geom.MultiPolygon(o.koord), navn: o.navn, v: o.v || 0 }));
    flaterFor.set(p, f);
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
      heltSlor = document.createElement('canvas');
      heltSlor.width = heltSlor.height = 512;
      const g = heltSlor.getContext('2d')!;
      g.fillStyle = slorFarge();
      g.fillRect(0, 0, 512, 512);
    }
    tile.setImage(heltSlor);
    return;
  }
  const t0 = performance.now(),
    c = document.createElement('canvas'),
    s = 512 / (u[2] - u[0]);
  c.width = c.height = 512;
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
export const dekLag = new ol.layer.Tile({ className: 'plan', visible: false, source: tegnetKilde(tegnSlorflis) });
const kartlagtFor = new WeakMap<Kartlagt, Feature<Polygon>[]>();
function settDekning(E: Kartlagt | null | undefined) {
  /* de kartlagte flatene for valgt kommune inn i sløret */
  dekKilde.clear();
  if (E && E.flate) {
    let f = kartlagtFor.get(E);
    if (!f) kartlagtFor.set(E, (f = E.flate.map(p => new ol.Feature(new ol.geom.Polygon(p)))));
    dekKilde.addFeatures(f);
  }
  friskOpp(dekLag);
}
/* Slør over det som ikke er kartlagt, på siden for verdsatt natur */
export function settSlor(paa: boolean) {
  ui.slorPaa = paa;
  endret();
}

/* Rekkefølge i kartet: fylte flater ligger under planlaget, så planlagt utbygging oppå verdifull natur synes. Omriss ligger øverst. */
export const flateLag = NATURTEMA.filter(t => FYLT[t.id]).map(t => lagFor(t).lag),
  omrissLag = NATURTEMA.filter(t => !FYLT[t.id]).map(t => lagFor(t).lag);
function tegnFlateflis(t: Naturtema, tile: ImageTile) {
  /* enkeltflatene som berører flisen, tegnet tett og så gjort litt gjennomsiktige samlet, så overlapp ikke blir mørkere */
  const t0 = performance.now(),
    u = plannett.getTileCoordExtent(tile.getTileCoord()),
    fl = lagFor(t).kilde.getFeaturesInExtent(u);
  if (!fl.length) {
    tile.setState(TOM);
    return;
  }
  const c = document.createElement('canvas'),
    s = 512 / (u[2] - u[0]);
  c.width = c.height = 512;
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
    const { lag } = lagFor(t);
    if (!lag.getVisible() || !t.data) return null;
    const F = flater(t.data),
      i = t.data.omrader.findIndex(
        (o, a) =>
          c[0] >= o.ext[0] &&
          c[0] <= o.ext[2] &&
          c[1] >= o.ext[1] &&
          c[1] <= o.ext[3] &&
          F[a].getGeometry()!.intersectsCoordinate(c)
      ),
      o = i < 0 ? null : t.data.omrader[i];
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
    o = t && t.data && t.data.omrader[nr];
  if (!o) return;
  markKilde.clear();
  markKilde.addFeature(new ol.Feature(flater(t!.data!)[nr].getGeometry()));
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
  const nyGrense = ny('grense', app.grense);
  for (const t of NATURTEMA) {
    const { lag, kilde } = lagFor(t),
      D = t.data,
      ok = gjelder(D),
      paa = ui.side === t.id;
    if (ny('data ' + t.id, D)) {
      kilde.clear();
      if (ok && !D.feil) kilde.addFeatures(flater(D));
      if (FYLT[t.id]) friskOpp(lag as Flislag);
    }
    lag.setVisible(paa && !!app.grense && ok && D.omrader.length > 0);
    if (t.dekning) {
      if (ny('kartlagt', ok ? D.ekstra || null : null)) settDekning(ok ? D.ekstra : null);
      if (nyGrense && app.grense) dekLag.setExtent(app.grense.ext);
      const kartlagt = ok && !!D.ekstra && D.ekstra.km2 > 0;
      dekLag.setVisible(paa && ui.slorPaa && !!app.grense && kartlagt);
    }
  }
});
