/* Kartlagene for temaene som hentes i biter: inngrepsfri natur og grått areal. Det som er likt for begge, står her:
   - Masken: for hver kartflis lages en maske av rutene i bitene (10,6 meter). Zoomet ut er hver piksel i flisen snittet av rutene den
     dekker, så kantene blir glatte. Zoomet inn forstørres rutene med utjevning, så kantene ikke får trappetrinn.
   - Flisene: de tegnes i nettleseren av bitene i katalogen, bare der kommunen har ruter, og klippes mot kommunen.
   - Når laget vises: på temaets side, når temaet er talt for kommunen og kommunen har noe (fra gull). Laget tegnes på nytt når tallene
     endres.
   Hvert lag gir hvordan masken fylles og flisene tegnes, se inon.ts og graa.ts. */
import type ImageTile from 'ol/ImageTile.js';
import { ol } from './ol.ts';
import { overlapper, type Utsnitt } from '../../data/generelt/geometri.ts';
import { bitRuter, type Flis } from '../../data/solv/felles.ts';
import type { Bitruter } from '../../data/solv/kommune.ts';
import { flislerret, sti, tegneflate } from '../../data/solv/raster.ts';
import { katalog } from '../../data/katalog.ts';
import { verdi } from '../../data/motor/valgt.ts';
import { abonner } from '../../data/motor/tilstand.ts';
import { ui } from '../tilstand.ts';
import { TOM, friskOpp, jevn, nyttSiden, plannett, tegnetKilde, type Flislag } from './felles.ts';
import { friskOppGamle, tegnesOppaa } from './grunnkart.ts';

/* Masken for en kartflis på 512 x 512 piksler: rød, grønn, blå og dekning per piksel (P), og verdien i en av rutene under pikselen
   som ikke er tom (V, 0 når alle er tomme). Dekningen er 0 der ingen bit med ruter i kommunen dekker pikselen. */
export interface Flismaske {
  P: Uint8ClampedArray;
  V: Uint8Array;
}
/* Det som er eget for hvert lag */
export interface Bitlag {
  side: string /* siden laget vises på */;
  tittel: string /* navnet på laget, i kartets minne i katalogen */;
  kilder: string[] /* hvem dataene kommer fra, til krediteringen i kartet */;
  data: () => Bitruter | null /* temaet talt for valgt kommune, med bitene kommunen har ruter i, fra katalogen */;
  bit: (tc: Flis) => Promise<Uint8Array> /* verdien per rute i biten tc, fra katalogen */;
  noe: () => boolean /* kommunen har noe av temaet, fra gull */;
  tom: (v: number) => boolean /* ruta har ingenting av temaet */;
  fyll: (v: number) => number[] /* masken for verdien v: rød, grønn og blå */;
  jevninger: number /* hvor mange ganger masken jevnes ut når rutene er like store som pikslene eller større */;
  /* Tegner flisen tc med utsnittet u i lerretet g. maske gir masken for flisen. Gir false når flisen er tom. */
  tegn: (g: CanvasRenderingContext2D, maske: () => Promise<Flismaske>, tc: Flis, u: Utsnitt) => Promise<boolean>;
  folgOgsaa?: () => unknown /* laget tegnes også på nytt når dette endres */;
}

/* Masken for flisen med utsnittet u av bitene her */
async function flismaske(o: Bitlag, her: Flis[], u: Utsnitt): Promise<Flismaske> {
  const m = (u[2] - u[0]) / 512,
    P = new Uint8ClampedArray(512 * 512 * 4),
    V = new Uint8Array(512 * 512),
    farger = new Map<number, number[]>(),
    farge = (v: number) => {
      let f = farger.get(v);
      if (!f) farger.set(v, (f = o.fyll(v)));
      return f;
    };
  for (const b of her) {
    const R = bitRuter(b),
      B = await o.bit(b),
      r = R.res;
    if (m >= r * 0.999) {
      /* zoomet ut, eller én rute per piksel: snittet av rutene under hver piksel. Store vinduer tas med sprang. */
      const steg = Math.max(1, Math.floor(m / r / 4)),
        px0 = Math.max(0, Math.floor((R.u[0] - u[0]) / m)),
        px1 = Math.min(512, Math.ceil((R.u[2] - u[0]) / m)),
        py0 = Math.max(0, Math.floor((u[3] - R.u[3]) / m)),
        py1 = Math.min(512, Math.ceil((u[3] - R.u[1]) / m)),
        kol = (px: number) => Math.floor((u[0] + px * m - R.u[0]) / r + 1e-6),
        rad = (py: number) => Math.floor((R.u[3] - (u[3] - py * m)) / r + 1e-6);
      for (let py = py0; py < py1; py++) {
        const y0 = Math.max(0, rad(py)),
          y1 = Math.min(R.h, Math.max(rad(py) + 1, rad(py + 1)));
        if (y0 >= y1) continue;
        for (let px = px0; px < px1; px++) {
          const x0 = Math.max(0, kol(px)),
            x1 = Math.min(R.w, Math.max(kol(px) + 1, kol(px + 1)));
          if (x0 >= x1) continue;
          let n = 0,
            sr = 0,
            sg = 0,
            sb = 0,
            forste = 0;
          for (let y = y0; y < y1; y += steg)
            for (let x = x0; x < x1; x += steg) {
              const v = B[y * R.w + x],
                f = farge(v);
              n++;
              sr += f[0];
              sg += f[1];
              sb += f[2];
              if (!forste && !o.tom(v)) forste = v;
            }
          const q = py * 512 + px,
            i = 4 * q;
          P[i] = sr / n;
          P[i + 1] = sg / n;
          P[i + 2] = sb / n;
          P[i + 3] = 255;
          V[q] = forste;
        }
      }
      if (Math.abs(m - r) < r * 0.001) for (let k = 0; k < o.jevninger; k++) jevn(P, 512, 512);
    } else {
      /* zoomet inn: rutene rundt flisen jevnes ut og forstørres med utjevning */
      const cx0 = Math.max(0, Math.floor((u[0] - R.u[0]) / r) - 2),
        cx1 = Math.min(R.w, Math.ceil((u[2] - R.u[0]) / r) + 2),
        cy0 = Math.max(0, Math.floor((R.u[3] - u[3]) / r) - 2),
        cy1 = Math.min(R.h, Math.ceil((R.u[3] - u[1]) / r) + 2);
      if (cx0 >= cx1 || cy0 >= cy1) continue;
      const w = cx1 - cx0,
        h = cy1 - cy0,
        k = tegneflate(w, h),
        d = k.createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const f = farge(B[(cy0 + y) * R.w + cx0 + x]),
            i = 4 * (y * w + x);
          d.data[i] = f[0];
          d.data[i + 1] = f[1];
          d.data[i + 2] = f[2];
          d.data[i + 3] = 255;
        }
      for (let n = 0; n < o.jevninger; n++) jevn(d.data, w, h);
      k.putImageData(d, 0, 0);
      const c = flislerret(),
        g = c.getContext('2d', { willReadFrequently: true })!;
      g.imageSmoothingEnabled = true;
      g.drawImage(k.canvas, (R.u[0] + cx0 * r - u[0]) / m, (u[3] - (R.u[3] - cy0 * r)) / m, (w * r) / m, (h * r) / m);
      const T = g.getImageData(0, 0, 512, 512).data;
      for (let py = 0; py < 512; py++) {
        const y = Math.floor((R.u[3] - (u[3] - (py + 0.5) * m)) / r);
        if (y < 0 || y >= R.h) continue;
        for (let px = 0; px < 512; px++) {
          const x = Math.floor((u[0] + (px + 0.5) * m - R.u[0]) / r);
          if (x < 0 || x >= R.w) continue;
          const q = py * 512 + px,
            i = 4 * q,
            v = B[y * R.w + x];
          P[i] = T[i];
          P[i + 1] = T[i + 1];
          P[i + 2] = T[i + 2];
          P[i + 3] = 255;
          V[q] = o.tom(v) ? 0 : v;
        }
      }
    }
  }
  return { P, V };
}

export function bitlag(o: Bitlag): Flislag {
  async function last(tile: ImageTile) {
    try {
      const D = o.data(),
        G = verdi(katalog.solv.grense),
        tc = tile.getTileCoord() as Flis,
        u = plannett.getTileCoordExtent(tc);
      const her = D && G && ol.extent.intersects(u, G.ext) ? D.biter.filter(b => overlapper(bitRuter(b).u, u)) : [];
      if (!her.length) {
        tile.setState(TOM);
        return;
      }
      const c = flislerret(),
        g = c.getContext('2d', { willReadFrequently: true })!;
      if (!(await o.tegn(g, () => flismaske(o, her, u), tc, u))) {
        tile.setState(TOM);
        return;
      }
      /* bare det som er i kommunen */
      g.globalCompositeOperation = 'destination-in';
      sti(g, G!.koord, u, 512 / (u[2] - u[0]));
      g.fill('evenodd');
      tile.setImage(c);
    } catch (e) {
      tile.setState(3);
    }
  }
  const lag = new ol.layer.Tile({
    className: 'tema',
    properties: { tittel: o.tittel },
    visible: false,
    source: tegnetKilde(last, o.kilder)
  });
  tegnesOppaa(lag);

  const ny = nyttSiden();
  abonner(() => {
    const G = verdi(katalog.solv.grense);
    if (ny('grense', G) && G) lag.setExtent(G.ext);
    if (ny('data', o.data())) friskOpp(lag);
    const synlig = ui.side === o.side && !!G && !!o.data() && o.noe(),
      ogsaa = !!o.folgOgsaa && ny('ogsaa', o.folgOgsaa());
    if (ny('synlig', synlig) || ogsaa) {
      lag.setVisible(synlig);
      friskOppGamle();
    }
  });
  return lag;
}
