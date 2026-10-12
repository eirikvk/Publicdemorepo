/* Kartlag som bare tvillingen har: lag av detaljklassene i grunnkartet, som skogtyper og tresatt myr. Flisene tegnes i nettleseren
   av de lagrede detaljklassene (solv.detaljklasser), i kartets flisnett: en flis på nivå 10 er én blokk, en flis zoomet ut er flere
   blokker forminsket, og en flis zoomet inn er en del av en blokk forstørret. Hver detaljklasse får fargen laget gir den, eller ingen.
   Flisene klippes mot kommunen. Lagene finnes bare for kommunene med lagrede detaljklasser. Kartet (Kart.tsx) legger dem inn i det
   felles kartet når siden vises, og tar dem ut igjen etterpå. */
import type ImageTile from 'ol/ImageTile.js';
import type TileLayer from 'ol/layer/Tile.js';
import type XYZ from 'ol/source/XYZ.js';
import { katalog } from '../src/data/katalog.ts';
import { abonner } from '../src/data/motor/tilstand.ts';
import { valgtNr, verdi } from '../src/data/motor/valgt.ts';
import { FLISNIVA, type Flis } from '../src/data/solv/felles.ts';
import { DETALJKLASSER, type Detaljklasse } from '../src/data/solv/klasser.ts';
import { flislerret, sti, tegneflate } from '../src/data/solv/raster.ts';
import { KILDER, TOM, friskOpp, nyttSiden, plannett, tegnetKilde, type Flistegner } from '../src/ui/kart/felles.ts';
import { ol } from '../src/ui/kart/ol.ts';

/* Fargen til en variabel i stilen (--skog-bar), som [r, g, b] */
function cssFarge(navn: string): number[] {
  const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--' + navn)
      .trim(),
    m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
  return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [128, 128, 128];
}

/* Blokkene med lagrede detaljklasser for kommunen nr, som «x/y». Tom når kommunen ikke har noen. */
async function blokkene(nr: string): Promise<Set<string>> {
  const reg = await katalog.bronse.detaljregister(),
    L = (reg && reg.kommuner && reg.kommuner[nr] && reg.kommuner[nr][FLISNIVA]) || [];
  return new Set(L.map(([x, y]) => `${x}/${y}`));
}

/* Et kartlag av detaljklassene. farge gir fargen (en variabel i stilen) for hver detaljklasse som skal vises, eller null. */
export function detaljlag(tittel: string, farge: (k: Detaljklasse) => string | null): TileLayer<XYZ> {
  const tabell = () =>
    DETALJKLASSER.map(k => {
      const f = farge(k);
      return f ? cssFarge(f) : null;
    });
  /* Blokken som lerret i lagets farger. Klassene laget ikke viser, er gjennomsiktige. */
  async function blokk(bx: number, by: number, F: (number[] | null)[]) {
    const K = await katalog.solv.detaljklasser([FLISNIVA, bx, by]),
      g = tegneflate(512, 512),
      d = g.createImageData(512, 512),
      o = d.data;
    let noe = false;
    for (let q = 0; q < K.kl.length; q++) {
      const f = K.kl[q] ? F[K.kl[q] - 1] : null;
      if (!f) continue;
      o[4 * q] = f[0];
      o[4 * q + 1] = f[1];
      o[4 * q + 2] = f[2];
      o[4 * q + 3] = 255;
      noe = true;
    }
    if (!noe) return null;
    g.putImageData(d, 0, 0);
    return g.canvas;
  }
  async function tegn(tile: ImageTile) {
    try {
      const nr = valgtNr(),
        G = verdi(katalog.solv.grense),
        [z, x, y] = tile.getTileCoord() as Flis,
        u = plannett.getTileCoordExtent([z, x, y]);
      if (!nr || !G || !ol.extent.intersects(u, G.ext)) return tile.setState(TOM);
      const har = await blokkene(nr),
        F = tabell(),
        c = flislerret(),
        g = c.getContext('2d')!;
      let tegnet = false;
      if (z <= FLISNIVA) {
        /* zoomet ut: n x n blokker forminsket inn i flisen */
        const n = 1 << (FLISNIVA - z),
          s = 512 / n;
        g.imageSmoothingEnabled = true;
        for (let j = 0; j < n; j++)
          for (let i = 0; i < n; i++) {
            const bx = x * n + i,
              by = y * n + j;
            if (!har.has(`${bx}/${by}`)) continue;
            const b = await blokk(bx, by, F);
            if (!b) continue;
            g.drawImage(b, i * s, j * s, s, s);
            b.width = 0;
            tegnet = true;
          }
      } else {
        /* zoomet inn: en del av én blokk, forstørret med skarpe ruter */
        const n = 1 << (z - FLISNIVA),
          bx = x >> (z - FLISNIVA),
          by = y >> (z - FLISNIVA),
          s = 512 / n;
        if (har.has(`${bx}/${by}`)) {
          const b = await blokk(bx, by, F);
          if (b) {
            g.imageSmoothingEnabled = false;
            g.drawImage(b, (x - bx * n) * s, (y - by * n) * s, s, s, 0, 0, 512, 512);
            b.width = 0;
            tegnet = true;
          }
        }
      }
      if (!tegnet) return tile.setState(TOM);
      g.globalCompositeOperation = 'destination-in';
      sti(g, G.koord, u, 512 / (u[2] - u[0]));
      g.fill('evenodd');
      tile.setImage(c);
    } catch (e) {
      tile.setState(3);
    }
  }
  const lag = new ol.layer.Tile({
    className: 'figma-lag',
    properties: { tittel },
    source: tegnetKilde(tegn as Flistegner, [KILDER.nibio])
  });
  /* Ny kommune: laget tegnes på nytt, og bare innenfor kommunen */
  const ny = nyttSiden();
  abonner(() => {
    const G = verdi(katalog.solv.grense);
    if (!ny('grense', G)) return;
    if (G) lag.setExtent(G.ext);
    friskOpp(lag);
  });
  return lag;
}

/* Lagene på skogsiden. Skogen samlet, skogen etter treslag, og tresatt myr og innmarksbeite. */
export const SKOGLAG = {
  skog: detaljlag('Økosystemtype skog', k => (k.treslag ? 'skog' : null)),
  skogtyper: detaljlag('Skogtyper', k => (k.treslag ? 'skog-' + k.treslag : null)),
  tresatt: detaljlag('Tresatt myr og innmarksbeite', k =>
    k.underlag === 'myr' ? 'myr-tresatt' : k.underlag === 'beite' ? 'beite-tresatt' : null
  )
};
