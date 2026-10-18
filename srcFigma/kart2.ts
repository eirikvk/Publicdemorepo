/* Kart nummer to i tvillingen: kartet over naturen i verneområdene, som skissene har som eget kart lenger ned på siden om
   verneområder. Det har bakgrunnskartet og kommunegrensen fra hovedkartet (de samme kildene), sitt eget utsnitt, og lagene siden
   legger inn (Kart.tsx). Dataene lagene tegnes av, er de samme som i hovedkartet og hentes ikke på nytt. Kartet lages første gang
   siden ber om det, og Kart.tsx setter det inn på siden først når det er rullet fram, så det tegnes ikke for dem som ikke kommer så
   langt. */
import type OlMap from 'ol/Map.js';
import { MAKSTETTHET } from '../src/ui/kart/felles.ts';
import { bakgrunnslag, grenselag, lagView, slippVedSidezoom } from '../src/ui/kart/kart.ts';
import { ol } from '../src/ui/kart/ol.ts';

let K: OlMap | null = null;
export function naturkart(): OlMap {
  if (K) return K;
  K = new ol.Map({
    layers: [bakgrunnslag(), grenselag()],
    view: lagView(),
    pixelRatio: Math.min(window.devicePixelRatio || 1, MAKSTETTHET),
    controls: [
      new ol.control.Zoom({ zoomInTipLabel: 'Zoom inn', zoomOutTipLabel: 'Zoom ut' }),
      new ol.control.ScaleLine(),
      new ol.control.Attribution({ collapsible: false })
    ]
  });
  slippVedSidezoom(K);
  return K;
}
