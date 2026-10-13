/* Kartlag som bare tvillingen har. Lag av detaljklassene i grunnkartet, som skogtyper og tresatt myr: flisene tegnes i nettleseren
   av de lagrede detaljklassene (solv.detaljklasser), i kartets flisnett. En flis på nivå 10 er én blokk, en flis zoomet ut er flere
   blokker forminsket, og en flis zoomet inn er en del av en blokk forstørret. Hver detaljklasse får fargen laget gir den, eller ingen.
   De finnes bare for kommunene med lagrede detaljklasser. Og lag fra Miljødirektoratets kart over naturskog, bare til visning. Alle
   flisene klippes mot kommunen. Kartet (Kart.tsx) legger lagene inn i det felles kartet når siden vises, og tar dem ut igjen
   etterpå. */
import type ImageTile from 'ol/ImageTile.js';
import type TileLayer from 'ol/layer/Tile.js';
import type XYZ from 'ol/source/XYZ.js';
import { katalog } from '../src/data/katalog.ts';
import { abonner } from '../src/data/motor/tilstand.ts';
import { valgtNr, verdi } from '../src/data/motor/valgt.ts';
import { FLISNIVA, type Flis } from '../src/data/solv/felles.ts';
import { DETALJKLASSER, type Detaljklasse } from '../src/data/solv/klasser.ts';
import { flislerret, lesBilde, sti, tegneflate } from '../src/data/solv/raster.ts';
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

/* Et kartlag fra Miljødirektoratets kart over naturskog (bronse.naturskogflis), klippet mot kommunen. Bare til visning. */
type Naturskoglag = Parameters<typeof katalog.bronse.naturskogflis>[0][0];
export function naturskoglag(tittel: string, navn: Naturskoglag): TileLayer<XYZ> {
  async function tegn(tile: ImageTile) {
    try {
      const G = verdi(katalog.solv.grense),
        tc = tile.getTileCoord() as Flis,
        u = plannett.getTileCoordExtent(tc);
      if (!G || !ol.extent.intersects(u, G.ext)) return tile.setState(TOM);
      const bm = await lesBilde(await katalog.bronse.naturskogflis([navn, tc])),
        c = flislerret(),
        g = c.getContext('2d')!;
      g.drawImage(bm, 0, 0, 512, 512);
      if (bm.close) bm.close();
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
    opacity: 0.85,
    properties: { tittel },
    source: tegnetKilde(tegn as Flistegner, [KILDER.mdir])
  });
  const ny = nyttSiden();
  abonner(() => {
    const G = verdi(katalog.solv.grense);
    if (!ny('grense', G)) return;
    if (G) lag.setExtent(G.ext);
    friskOpp(lag);
  });
  return lag;
}

/* Lagene på skogsiden: skogen samlet, skogen etter treslag, og tresatt myr og innmarksbeite fra grunnkartet, og to lag fra kartet
   over naturskog */
export const SKOGLAG = {
  skog: detaljlag('Økosystemtype skog', k => (k.treslag ? 'skog' : null)),
  skogtyper: detaljlag('Skogtyper', k => (k.treslag ? 'skog-' + k.treslag : null)),
  tresatt: detaljlag('Tresatt myr og innmarksbeite', k =>
    k.underlag === 'myr' ? 'myr-tresatt' : k.underlag === 'beite' ? 'beite-tresatt' : null
  ),
  naerhet: naturskoglag('Naturskogsnærhet', 'naturskogsnaerhet'),
  for1940: naturskoglag('Skog etablert før 1940, ikke flatehogd', 'skog_etablert_foer_1940_ikke_flatehogd')
};

/* Lagene på våtmarkssiden: økosystemtypen våtmark (åpen myr og annen åpen våtmark) og tresatt myr fra grunnkartet */
export const VATMARKLAG = {
  apen: detaljlag('Økosystemtype våtmark', k => (k.id === 'vat' ? 'myr-apen' : null)),
  tresatt: detaljlag('Tresatt myr', k => (k.underlag === 'myr' ? 'myr-tresatt' : null))
};
