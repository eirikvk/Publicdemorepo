/* Kartlagene for temaene som hentes som ett bilde av kommunen: inngrepsfri natur og grått areal. Det som er likt for begge, står her:
   - Masken: kommunebildet som et lerret, fylt én gang per kommune og jevnet ut, så kantene blir glatte når kartet er zoomet inn.
   - Flisene: de tegnes i nettleseren, uten nye kall, og bare der kommunebildet dekker flisen.
   - Når laget vises: på temaets side, når temaet er hentet og kommunen har noe. Laget tegnes på nytt når dataene endres.
   Hvert lag gir hvordan masken fylles og flisene tegnes, se inon.ts og graa.ts. */
import type ImageTile from 'ol/ImageTile.js';
import { ol } from './ol.ts';
import type { Utsnitt } from '../../data/generelt/geometri.ts';
import type { Flis } from '../../data/solv/felles.ts';
import { flislerret, tegneflate, tegnUtsnitt } from '../../data/solv/raster.ts';
import { hentet, type HentetBilde as Hentet, type Kommunebilde } from '../../data/gull/felles.ts';
import { abonner, app, gjeldende } from '../../data/motor/tilstand.ts';
import { ui } from '../tilstand.ts';
import { TOM, friskOpp, jevn, nyttSiden, plannett, tegnetKilde, type Flislag } from './felles.ts';
import { friskOppGamle, tegnesOppaa } from './grunnkart.ts';

/* Det som er eget for hvert lag */
export interface Bildelag<E> {
  side: string /* siden laget vises på */;
  data: () => Kommunebilde<E> | null /* temaet i tilstanden */;
  fyll: (P: Uint8ClampedArray, D: Hentet<E>) => void /* fyller masken: rød, grønn, blå og dekning per rute */;
  jevninger: number /* hvor mange ganger masken jevnes ut */;
  /* Tegner flisen tc med utsnittet u i lerretet g. tegnMaske tegner masken over hele flisen. Gir false når flisen er tom. */
  tegn: (g: CanvasRenderingContext2D, D: Hentet<E>, tegnMaske: () => void, tc: Flis, u: Utsnitt) => Promise<boolean>;
  folgOgsaa?: () => unknown /* laget tegnes også på nytt når dette endres */;
}

export function bildelag<E>(o: Bildelag<E>): Flislag {
  const masker = new WeakMap<object, HTMLCanvasElement>();
  const maske = (D: Hentet<E>) => {
    let c = masker.get(D);
    if (c) return c;
    const g = tegneflate(D.w, D.h),
      bilde = g.createImageData(D.w, D.h);
    o.fyll(bilde.data, D);
    for (let n = 0; n < o.jevninger; n++) jevn(bilde.data, D.w, D.h);
    g.putImageData(bilde, 0, 0);
    c = g.canvas;
    masker.set(D, c);
    return c;
  };
  async function last(tile: ImageTile) {
    try {
      const D = hentet(gjeldende(o.data())),
        tc = tile.getTileCoord() as Flis,
        u = plannett.getTileCoordExtent(tc);
      if (!D || !ol.extent.intersects(u, D.u)) {
        tile.setState(TOM);
        return;
      }
      const c = flislerret(),
        g = c.getContext('2d', { willReadFrequently: true })!;
      g.imageSmoothingEnabled = true;
      const tegnMaske = () =>
        tegnUtsnitt(
          g,
          maske(D),
          (u[0] - D.u[0]) / D.res,
          (D.u[3] - u[3]) / D.res,
          (u[2] - u[0]) / D.res,
          (u[3] - u[1]) / D.res
        );
      if (await o.tegn(g, D, tegnMaske, tc, u)) tile.setImage(c);
      else tile.setState(TOM);
    } catch (e) {
      tile.setState(3);
    }
  }
  const lag = new ol.layer.Tile({ className: 'tema', visible: false, source: tegnetKilde(last) });
  tegnesOppaa(lag);

  const ny = nyttSiden();
  abonner(() => {
    if (ny('grense', app.grense) && app.grense) lag.setExtent(app.grense.ext);
    if (ny('data', o.data())) friskOpp(lag);
    const D = hentet(gjeldende(o.data())),
      synlig = ui.side === o.side && !!app.grense && !!D && D.sum > 0,
      ogsaa = !!o.folgOgsaa && ny('ogsaa', o.folgOgsaa());
    if (ny('synlig', synlig) || ogsaa) {
      lag.setVisible(synlig);
      friskOppGamle();
    }
  });
  return lag;
}
