/* Egne områder i kartet: tegning av et område, og omrisset med nummer for hvert eget område. Fargen inni kommer fra planlaget, som
   viser hva som går med. Datamotoren tar imot det tegnede området og regner det ut, se data/motor/egne.ts. */
import type Feature from 'ol/Feature.js';
import type Polygon from 'ol/geom/Polygon.js';
import type Draw from 'ol/interaction/Draw.js';
import { ol } from './ol.ts';
import { OPPLOSNINGER, type Kommune } from '../../data/solv/felles.ts';
import { leggTilEget, mine } from '../../data/motor/egne.ts';
import { grense } from '../../data/motor/gulldata.ts';
import { abonner, app, endret, type EgetOmrade } from '../../data/motor/tilstand.ts';
import { farge } from '../farger.ts';
import { kart, tilKartet, view } from './kart.ts';
import { lukkBytt } from './trykk.ts';

const egneKilde = new ol.source.Vector();
export const egneLag = new ol.layer.Vector({
  className: 'merket',
  source: egneKilde,
  style: f => [
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#fff', width: 7 }) }),
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: farge('egne'),
        width: 3,
        lineDash: f.get('type') === 'fri' ? [10, 7] : undefined
      }),
      text: new ol.style.Text({
        text: String(f.get('lopenr')),
        font: '600 14px sans-serif',
        fill: new ol.style.Fill({ color: '#fff' }),
        backgroundFill: new ol.style.Fill({ color: farge('egne') }),
        padding: [3, 6, 2, 6],
        overflow: true
      })
    })
  ]
});

/* Tegning: ett område om gangen. Trykk i kartet blir hjørner, og området sendes til datamotoren når det er ferdig. */
let tegn: Draw | null = null;
export const tegner = () => !!tegn;
const tegnStil = [
  new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#fff', width: 6 }) }),
  new ol.style.Style({
    stroke: new ol.style.Stroke({ color: farge('egne'), width: 2.5 }),
    fill: new ol.style.Fill({ color: 'rgba(0,114,206,.12)' }),
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({ color: farge('egne') }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 2.5 })
    })
  })
];
export function sluttTegning() {
  if (tegn) kart!.removeInteraction(tegn);
  tegn = null;
  endret();
}
/* Knappene under tegning */
export const angrePunkt = () => {
  if (tegn) tegn.removeLastPoint();
};
export const ferdigTegning = () => {
  if (tegn) tegn.finishDrawing();
};
export function startTegning() {
  if (!app.valgt || !grense() || tegner()) return;
  lukkBytt();
  tegn = new ol.interaction.Draw({ type: 'Polygon', stopClick: true, minPoints: 3, style: tegnStil });
  tegn.on('drawend', e => {
    const koord = [(e.feature.getGeometry() as Polygon).getCoordinates()];
    setTimeout(() => {
      sluttTegning();
      leggTilEget(koord);
    }, 0);
  });
  kart!.addInteraction(tegn);
  endret();
  tilKartet();
}
export function visEgetIKartet(g: EgetOmrade) {
  const G = grense();
  view.fit(G ? ol.extent.getIntersection(g.ext, G.ext) : g.ext, {
    padding: [56, 56, 56, 56],
    minResolution: OPPLOSNINGER[13],
    duration: 300
  });
  tilKartet();
}

/* Omrissene følger egne områder for valgt kommune: ett omriss per tegnet område, med løpenummer og strek etter om det er utbygging.
   Opplastede planer har ikke omriss. Ved bytte av kommune avsluttes en tegning som er i gang. */
const flater = new Map<number, Feature>(); /* tegnet område (id) → flaten i kartet */
let sistValgt: Kommune | null | undefined,
  vist = '';
abonner(() => {
  if (app.valgt !== sistValgt) {
    sistValgt = app.valgt;
    if (tegn) sluttTegning();
  }
  const vis = mine().filter(g => g.kilde === 'tegnet');
  for (const g of vis) {
    let f = flater.get(g.id);
    if (!f) {
      f = new ol.Feature({
        geometry: new ol.geom.Polygon(g.deler[0].koord[0]),
        lopenr: g.lopenr,
        type: g.deler[0].type
      });
      flater.set(g.id, f);
    }
    if (f.get('type') !== g.deler[0].type) f.set('type', g.deler[0].type);
  }
  const ider = vis.map(g => g.id).join(',');
  if (ider !== vist) {
    vist = ider;
    egneKilde.clear();
    egneKilde.addFeatures(vis.map(g => flater.get(g.id)!));
  }
});
