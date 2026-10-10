/* Klipping mot kommunen: utenfor valgt kommune vises bare bakgrunnskartet. Lagene som tegnes i samme lerret, klippes samlet av det
   øverste laget, etter at alle er tegnet (klippSist). Kommunegrensen settes med settKlipp når den er hentet. */
import type { FrameState } from 'ol/Map.js';
import type { Coordinate } from 'ol/coordinate.js';
import type MultiPolygon from 'ol/geom/MultiPolygon.js';
import type BaseLayer from 'ol/layer/Base.js';
import type Layer from 'ol/layer/Layer.js';
import type RenderEvent from 'ol/render/Event.js';
import { ol } from './ol.ts';
import { tidSlutt } from '../../data/motor/tilstand.ts';

/* Kommunegrensen som geometri i OpenLayers, til klipping og til å se om et trykk er innenfor */
let klipp: MultiPolygon | null = null;
export const settKlipp = (g: MultiPolygon | null) => {
  klipp = g;
};
/* Om punktet c ligger utenfor valgt kommune. Uten grense regnes ingenting som utenfor. */
export const utenforKommunen = (c: Coordinate) => !!klipp && !klipp.intersectsCoordinate(c);

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
export const klippSist = (lag: Layer, over: BaseLayer[]) =>
  lag.on('postrender', e => {
    const res = e.frameState!.viewState.resolution;
    if (!over.some(l => tegnes(l, res))) klippTilKommunen(e);
  }); /* det øverste laget i lerretet klipper for alle */
