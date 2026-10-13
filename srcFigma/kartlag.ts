/* Kartlag som bare tvillingen har. Lag av detaljklassene i grunnkartet, som skogtyper og tresatt myr: flisene tegnes i nettleseren
   av de lagrede detaljklassene (solv.detaljklasser), i kartets flisnett. En flis på nivå 10 er én blokk, en flis zoomet ut er flere
   blokker forminsket, og en flis zoomet inn er en del av en blokk forstørret. Hver detaljklasse får fargen laget gir den, eller ingen.
   De finnes bare for kommunene med lagrede detaljklasser. På samme måte lag med én av dagens klasser (bebygd, jordbruk eller natur) for
   seg, til kortene på oversikten. Og lag fra Miljødirektoratets kart over naturskog, bare til visning. Alle
   flisene klippes mot kommunen. Kartet (Kart.tsx) legger lagene inn i det felles kartet når siden vises, og tar dem ut igjen
   etterpå. */
import type ImageTile from 'ol/ImageTile.js';
import type TileLayer from 'ol/layer/Tile.js';
import type XYZ from 'ol/source/XYZ.js';
import { katalog } from '../src/data/katalog.ts';
import { abonner } from '../src/data/motor/tilstand.ts';
import { valgtNr, verdi } from '../src/data/motor/valgt.ts';
import { FLISNIVA, type Flis } from '../src/data/solv/felles.ts';
import { ALLE, DETALJKLASSER, type Detaljklasse, type KlasseId } from '../src/data/solv/klasser.ts';
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

/* Et kartlag av klassene i blokkene på nivå niva (9 eller 10): blokker gir blokkene for kommunen, klasser klassene per rute i en blokk
   (plassen i tabellen pluss én, 0 for ingen), og farger fargen for hver plass som [r, g, b], eller null når den ikke vises. En flis
   på nivået er én blokk, en flis zoomet ut er flere blokker forminsket, og en flis zoomet inn er en del av en blokk forstørret. */
function blokklag(
  tittel: string,
  niva: number,
  blokker: (nr: string) => Promise<Flis[]>,
  klasser: (tc: Flis) => Promise<{ kl: ArrayLike<number> }>,
  farger: () => (number[] | null)[]
): TileLayer<XYZ> {
  /* Blokken som lerret i lagets farger. Klassene laget ikke viser, er gjennomsiktige. */
  async function blokk(bx: number, by: number, F: (number[] | null)[]) {
    const K = await klasser([niva, bx, by]),
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
      const har = new Set((await blokker(nr)).map(([, bx, by]) => `${bx}/${by}`)),
        F = farger(),
        c = flislerret(),
        g = c.getContext('2d')!;
      let tegnet = false;
      if (z <= niva) {
        /* zoomet ut: n x n blokker forminsket inn i flisen */
        const n = 1 << (niva - z),
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
        const n = 1 << (z - niva),
          bx = x >> (z - niva),
          by = y >> (z - niva),
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

/* Et kartlag av detaljklassene (solv.detaljklasser, nivå 10). farge gir fargen (en variabel i stilen) for hver detaljklasse som skal
   vises, eller null. De finnes bare for kommunene med lagrede detaljklasser (solv.detaljblokker). */
export const detaljlag = (tittel: string, farge: (k: Detaljklasse) => string | null) =>
  blokklag(
    tittel,
    FLISNIVA,
    nr => katalog.solv.detaljblokker(nr),
    tc => katalog.solv.detaljklasser(tc),
    () =>
      DETALJKLASSER.map(k => {
        const f = farge(k);
        return f ? cssFarge(f) : null;
      })
  );
/* Et kartlag med én av dagens klasser (bebygd, jordbruk eller natur) i klassens farge, av blokkene på nivå 9 (solv.blokker og
   solv.klasser, 21 meter). De er lagret for noen kommuner og lages ellers av kartbildene fra NIBIO, som for hovedsidens kart, så
   laget henter ikke noe mer enn kartet alt gjør. */
export const klasselag = (tittel: string, id: KlasseId) =>
  blokklag(
    tittel,
    FLISNIVA - 1,
    nr => katalog.solv.blokker([nr, FLISNIVA - 1]),
    tc => katalog.solv.klasser(tc),
    () => ALLE.map(([k]) => (k === id ? cssFarge(id) : null))
  );

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

/* Lagene på oversikten: hver av dagens klasser for seg, til kortene natur, jordbruk og bebygd */
export const KLASSELAG = {
  nat: klasselag('Natur', 'nat'),
  jor: klasselag('Jordbruk', 'jor'),
  beb: klasselag('Bebygd', 'beb')
};
