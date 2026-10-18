/* Kartlag som bare tvillingen har. Lag av detaljklassene i grunnkartet, som skogtyper og tresatt myr: flisene tegnes i nettleseren
   av detaljklassene i sølv (solv.detaljklasser), i kartets flisnett. En flis på nivå 10 er én blokk, og en flis zoomet ut er flere
   blokker forminsket. Zoomet inn er flisen detaljklassene på sitt eget nivå (11, 12 og videre), lest innenfor dagens klasser på det
   samme nivået, så laget stemmer piksel for piksel med dagens arealklasser og de andre kartlagene. Hver detaljklasse får fargen laget
   gir den, eller ingen. De er lagret for noen kommuner på nivå 10, og lages ellers av kartbildene fra NIBIO. På samme måte lag med én
   av dagens klasser (bebygd, jordbruk eller natur) for seg, til kortene på oversikten. Og lag fra Miljødirektoratets kart over
   naturskog, bare til visning. Alle flisene klippes mot kommunen. Kartet (Kart.tsx) legger lagene inn i det felles kartet når siden
   vises, og tar dem ut igjen etterpå. */
import type ImageTile from 'ol/ImageTile.js';
import type TileLayer from 'ol/layer/Tile.js';
import type XYZ from 'ol/source/XYZ.js';
import { katalog } from '../src/data/katalog.ts';
import { abonner } from '../src/data/motor/tilstand.ts';
import { valgtNr, verdi } from '../src/data/motor/valgt.ts';
import { FLISNIVA, bitRuter, type Flis } from '../src/data/solv/felles.ts';
import { ALLE, DETALJKLASSER, type Detaljklasse, type KlasseId } from '../src/data/solv/klasser.ts';
import type { VerdsattVurderes, VernetFlate } from '../src/data/gull/temaer.ts';
import { flislerret, lesBilde, sti, tegneflate } from '../src/data/solv/raster.ts';
import { kart } from '../src/ui/kart/kart.ts';
import {
  KILDER,
  TOM,
  fargPiksel,
  friskOpp,
  nyttSiden,
  plannett,
  tegnetKilde,
  type Flistegner
} from '../src/ui/kart/felles.ts';
import { ol } from '../src/ui/kart/ol.ts';

/* Flatene og utsnittene i tabellene, som i verneområdene */
type Flerflate = VernetFlate['koord'];
type Utsnitt = VernetFlate['ext'];

/* Fargen til en variabel i stilen (--skog-bar), som [r, g, b] */
function cssFarge(navn: string): number[] {
  const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--' + navn)
      .trim(),
    m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
  return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [128, 128, 128];
}

/* Et kartlag av klassene på nivået kartet viser, fra sølv: klasser gir klassene per piksel i flisen tc for kommunen nr (plassen i
   tabellen pluss én, 0 for ingen), blokker blokkene på nivå 10 for kommunen, og farger fargen for hver plass som [r, g, b], eller null
   når den ikke vises. Zoomet inn (fra nivå 10) tegnes bare fliser i kommunens blokker. Hver piksel får én farge, uten utjevning, så
   laget stemmer piksel for piksel med dagens arealklasser og de andre kartlagene. */
function blokklag(
  tittel: string,
  blokker: (nr: string) => Promise<Flis[]>,
  klasser: (nr: string, tc: Flis) => Promise<{ kl: ArrayLike<number> }>,
  farger: () => (number[] | null)[],
  maske?: () => Flerflate[] | null
): TileLayer<XYZ> {
  async function tegn(tile: ImageTile) {
    try {
      const nr = valgtNr(),
        G = verdi(katalog.solv.grense),
        [z, x, y] = tile.getTileCoord() as Flis,
        u = plannett.getTileCoordExtent([z, x, y]);
      if (!nr || !G || !ol.extent.intersects(u, G.ext)) return tile.setState(TOM);
      if (z >= FLISNIVA) {
        const har = new Set((await blokker(nr)).map(([, bx, by]) => `${bx}/${by}`));
        if (!har.has(`${x >> (z - FLISNIVA)}/${y >> (z - FLISNIVA)}`)) return tile.setState(TOM);
      }
      const K = await klasser(nr, [z, x, y]),
        F = farger(),
        c = flislerret(),
        g = c.getContext('2d')!,
        d = g.createImageData(512, 512),
        o = d.data;
      let tegnet = false;
      for (let q = 0; q < K.kl.length; q++) {
        const f = K.kl[q] ? F[K.kl[q] - 1] : null;
        if (!f) continue;
        fargPiksel(o, 4 * q, f);
        tegnet = true;
      }
      if (!tegnet) return tile.setState(TOM);
      g.putImageData(d, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      sti(g, G.koord, u, 512 / (u[2] - u[0]));
      g.fill('evenodd');
      if (maske && !klipp(g, maske(), u)) return tile.setState(TOM);
      tile.setImage(c);
    } catch (e) {
      tile.setState(3);
    }
  }
  const lag = new ol.layer.Tile({
    className: 'figma-lag',
    properties: { tittel },
    source: tegnetKilde(tegn as Flistegner, [KILDER.nibio], true)
  });
  /* Ny kommune: laget tegnes på nytt, og bare innenfor kommunen. Med maske også når flatene i masken er hentet, men bare når laget er
     i kartet, så flatene ikke hentes for sider som ikke viser laget. */
  const ny = nyttSiden();
  abonner(() => {
    const G = verdi(katalog.solv.grense),
      a = ny('grense', G),
      b = maske && iKartet(lag) ? ny('maske', maske()) : false;
    if (!a && !b) return;
    if (G) lag.setExtent(G.ext);
    friskOpp(lag);
  });
  return lag;
}
/* Om laget er i kartet nå (tvillingens egne lag legges inn bare mens siden som viser dem, er oppe) */
const iKartet = (lag: TileLayer<XYZ>) => !!kart && kart.getLayers().getArray().includes(lag);
/* Klipper det som er tegnet i flisen g (utsnitt u) til flatene F, slått sammen: det som ligger i minst én av dem, blir stående.
   false mens flatene ikke er hentet (null), eller når ingen av dem berører flisen. */
function klipp(g: CanvasRenderingContext2D, F: Flerflate[] | null, u: Utsnitt): boolean {
  if (!F || !F.length) return false;
  const m = tegneflate(512, 512),
    s = 512 / (u[2] - u[0]);
  for (const f of F) {
    sti(m, f, u, s);
    m.fill('evenodd');
  }
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(m.canvas, 0, 0);
  return true;
}

/* Detaljklassene i flisen tc for kommunen nr fra sølv: fra nivå 10 solv.detaljklasser, og zoomet ut solv.detaljklasserUt */
const detaljer = (nr: string, tc: Flis) =>
  tc[0] >= FLISNIVA ? katalog.solv.detaljklasser(tc) : katalog.solv.detaljklasserUt([nr, tc[0], tc[1], tc[2]]);
/* Et kartlag av detaljklassene. farge gir fargen (en variabel i stilen) for hver detaljklasse som skal vises, eller null. Blokkene er
   de samme som for dagens klasser (solv.detaljblokker). */
export const detaljlag = (tittel: string, farge: (k: Detaljklasse) => string | null) =>
  blokklag(
    tittel,
    nr => katalog.solv.detaljblokker(nr),
    detaljer,
    () =>
      DETALJKLASSER.map(k => {
        const f = farge(k);
        return f ? cssFarge(f) : null;
      })
  );
/* Som detaljlag, men bare innenfor flatene maske gir (som verneområdene) */
export const detaljlagI = (
  tittel: string,
  farge: (k: Detaljklasse) => string | null,
  maske: () => Flerflate[] | null
) =>
  blokklag(
    tittel,
    nr => katalog.solv.detaljblokker(nr),
    detaljer,
    () =>
      DETALJKLASSER.map(k => {
        const f = farge(k);
        return f ? cssFarge(f) : null;
      }),
    maske
  );
/* Et kartlag med én av dagens klasser (bebygd, jordbruk eller natur) i klassens farge, av de samme klassene som hovedsidens kart
   (solv.klasser fra nivå 10, og solv.klasserUt zoomet ut), så laget henter ikke noe mer enn kartet alt gjør. */
export const klasselag = (tittel: string, id: KlasseId) =>
  blokklag(
    tittel,
    nr => katalog.solv.blokker([nr, FLISNIVA]),
    (nr, tc) => (tc[0] >= FLISNIVA ? katalog.solv.klasser(tc) : katalog.solv.klasserUt([nr, tc[0], tc[1], tc[2]])),
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

/* Et kartlag av flater fra en tabell, som verneområdene per verneform: flatene gir flatene med utsnitt og farge (en variabel i
   stilen), eller null mens de hentes. Hver flate fylles halvt gjennomsiktig og får kant i fargen, klippet mot kommunen. Flatene leses
   bare når laget er i kartet. */
export function flatelag(
  tittel: string,
  flatene: () => { koord: Flerflate; ext: Utsnitt; farge: string }[] | null
): TileLayer<XYZ> {
  async function tegn(tile: ImageTile) {
    try {
      const G = verdi(katalog.solv.grense),
        F = flatene(),
        tc = tile.getTileCoord() as Flis,
        u = plannett.getTileCoordExtent(tc);
      if (!G || !F || !ol.extent.intersects(u, G.ext)) return tile.setState(TOM);
      const c = flislerret(),
        g = c.getContext('2d')!,
        s = 512 / (u[2] - u[0]);
      let noe = false;
      g.lineWidth = 2;
      for (const f of F) {
        if (!ol.extent.intersects(u, f.ext)) continue;
        const [r, gr, b] = cssFarge(f.farge);
        g.fillStyle = `rgba(${r}, ${gr}, ${b}, 0.55)`;
        g.strokeStyle = `rgb(${r}, ${gr}, ${b})`;
        sti(g, f.koord, u, s);
        g.fill('evenodd');
        g.stroke();
        noe = true;
      }
      if (!noe) return tile.setState(TOM);
      g.globalCompositeOperation = 'destination-in';
      sti(g, G.koord, u, s);
      g.fill('evenodd');
      tile.setImage(c);
    } catch (e) {
      tile.setState(3);
    }
  }
  const lag = new ol.layer.Tile({
    className: 'figma-lag',
    properties: { tittel },
    source: tegnetKilde(tegn as Flistegner, [KILDER.mdir])
  });
  const ny = nyttSiden();
  abonner(() => {
    const G = verdi(katalog.solv.grense),
      a = ny('grense', G),
      b = iKartet(lag) ? ny('flater', flatene()) : false;
    if (!a && !b) return;
    if (G) lag.setExtent(G.ext);
    friskOpp(lag);
  });
  return lag;
}

/* Et kartlag av et tema som hentes i biter (som grått areal): data gir temaet talt for kommunen med bitene kommunen har ruter i
   (solv.graa), bit verdien per rute i en bit (solv.graabit), og farge fargen (en variabel i stilen) for verdien, eller null for
   ingen. Zoomet inn forstørres rutene skarpt. Zoomet ut dekker hver piksel i flisen flere ruter, og pikselen får fargen når minst én
   av rutene har farge, så små flater som veier og hus ikke forsvinner. Klippet mot kommunen. Bitene leses bare når laget er i
   kartet. */
export function rutelag(
  tittel: string,
  data: () => { biter: Flis[] } | null,
  bit: (tc: Flis) => Promise<ArrayLike<number> | null>,
  farge: (v: number) => string | null
) {
  const F = new Map<number, number[] | null>(),
    fargen = (v: number) => {
      if (!F.has(v)) {
        const f = farge(v);
        F.set(v, f ? cssFarge(f) : null);
      }
      return F.get(v)!;
    };
  async function tegn(tile: ImageTile) {
    try {
      const G = verdi(katalog.solv.grense),
        D = data(),
        tc = tile.getTileCoord() as Flis,
        u = plannett.getTileCoordExtent(tc);
      if (!G || !D || !ol.extent.intersects(u, G.ext)) return tile.setState(TOM);
      const her = D.biter.filter(b => {
        const e = bitRuter(b).u;
        return e[0] < u[2] && e[2] > u[0] && e[1] < u[3] && e[3] > u[1];
      });
      if (!her.length) return tile.setState(TOM);
      const c = flislerret(),
        g = c.getContext('2d')!,
        d = g.createImageData(512, 512),
        o = d.data,
        m = (u[2] - u[0]) / 512;
      let noe = false;
      for (const b of her) {
        const R = bitRuter(b),
          B = await bit(b);
        if (!B) continue;
        const r = R.res,
          px0 = Math.max(0, Math.floor((R.u[0] - u[0]) / m)),
          px1 = Math.min(512, Math.ceil((R.u[2] - u[0]) / m)),
          py0 = Math.max(0, Math.floor((u[3] - R.u[3]) / m)),
          py1 = Math.min(512, Math.ceil((u[3] - R.u[1]) / m)),
          kol = (px: number) => Math.floor((u[0] + px * m - R.u[0]) / r + 1e-6),
          rad = (py: number) => Math.floor((R.u[3] - (u[3] - py * m)) / r + 1e-6);
        for (let py = py0; py < py1; py++) {
          const y0 = Math.max(0, rad(py)),
            y1 = Math.min(R.h, Math.max(rad(py) + 1, rad(py + 1)));
          for (let px = px0; px < px1; px++) {
            const x0 = Math.max(0, kol(px)),
              x1 = Math.min(R.w, Math.max(kol(px) + 1, kol(px + 1)));
            let f: number[] | null = null;
            for (let y = y0; y < y1 && !f; y++) for (let x = x0; x < x1 && !f; x++) f = fargen(B[y * R.w + x]);
            if (!f) continue;
            const i = 4 * (py * 512 + px);
            o[i] = f[0];
            o[i + 1] = f[1];
            o[i + 2] = f[2];
            o[i + 3] = 255;
            noe = true;
          }
        }
      }
      if (!noe) return tile.setState(TOM);
      g.putImageData(d, 0, 0);
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
    source: tegnetKilde(tegn as Flistegner, [KILDER.nibio])
  });
  const ny = nyttSiden();
  abonner(() => {
    const G = verdi(katalog.solv.grense),
      a = ny('grense', G),
      b = iKartet(lag) ? ny('ruter', data()) : false;
    if (!a && !b) return;
    if (G) lag.setExtent(G.ext);
    friskOpp(lag);
  });
  return lag;
}

/* Lagene på skogsiden: skogen samlet, skogen etter treslag, tresatt myr og tresatt innmarksbeite fra grunnkartet (hvert sitt lag, som i
   skissene), og to lag fra kartet over naturskog */
export const SKOGLAG = {
  skog: detaljlag('Økosystemtype skog', k => (k.treslag ? 'skog' : null)),
  skogtyper: detaljlag('Skogtyper', k => (k.treslag ? 'skog-' + k.treslag : null)),
  myr: detaljlag('Tresatt myr', k => (k.underlag === 'myr' ? 'myr-tresatt' : null)),
  beite: detaljlag('Tresatt innmarksbeite', k => (k.underlag === 'beite' ? 'beite-tresatt' : null)),
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

/* Fargen for hvert hovedøkosystem i kartet over naturen i verneområdene, som i figuren for naturen som er vernet */
export const OKOSYSTEMFARGE: Record<string, string> = {
  skog: 'oko-skog',
  vatmark: 'oko-vatmark',
  innsjoerVannmagasiner: 'oko-innsjo',
  heiBuskmark: 'oko-hei',
  grasmark: 'oko-gras',
  elverBekkerKanaler: 'oko-elv',
  liteVegetertMark: 'oko-lite',
  kyststrenderSvabergDyner: 'oko-kyst',
  dyrketmark: 'oko-dyrket',
  bebygdOpparbeidetAreal: 'oko-bebygd',
  hav: 'oko-hav',
  jordbrukUspesifisert: 'oko-annen',
  naturUspesifisert: 'oko-annen'
};
/* Fargen for hver gruppe av verneformer (VERNEFORMGRUPPER i solv/temaer.ts), som i figuren for verneformene */
export const VERNEFORMFARGE: Record<string, string> = {
  nasjonalpark: 'vf-nasjonalpark',
  naturreservat: 'vf-naturreservat',
  landskap: 'vf-landskap',
  marint: 'vf-marint',
  arts: 'vf-arts',
  annen: 'vf-annen'
};
/* f av verdien v, regnet ut på nytt bare når v er en annen enn sist. Lagene ser om flatene er nye ved å sammenligne dem med forrige
   gang, så de må være de samme så lenge tabellen er den samme. */
function husk<T, U>(f: (v: T) => U) {
  let sist: { v: T; u: U } | null = null;
  return (v: T | null) => (v === null ? null : sist && sist.v === v ? sist.u : (sist = { v, u: f(v) }).u);
}
const vernflater = husk((V: VernetFlate[]) => V.map(o => o.koord)),
  vernfarger = husk((V: VernetFlate[]) =>
    V.map(o => ({ koord: o.koord, ext: o.ext, farge: VERNEFORMFARGE[o.gruppe] }))
  ),
  vurderes = husk((V: VerdsattVurderes) =>
    V.omrader.map(o => ({ koord: o.koord, ext: o.ext, farge: o.v ? 'vurderes2' : 'vurderes1' }))
  );
/* Lagene på siden om verneområder: verneområdene etter verneform (gull.verneformer), og naturen i verneområdene, grunnkartets
   detaljklasser i fargen for hovedøkosystemet, bare innenfor verneområdene */
export const VERNLAG = {
  verneformer: flatelag('Verneområder per verneform', () => vernfarger(verdi(katalog.gull.verneformer))),
  natur: detaljlagI(
    'Naturen i verneområder',
    k => OKOSYSTEMFARGE[k.okosystem] || null,
    () => vernflater(verdi(katalog.gull.verneformer))
  )
};
/* Laget på siden om verdsatte naturtyper for lokalitetene som skal vurderes per lokalitet eller per naturtype (gull.verdsattVurderes) */
export const VERDILAG = {
  vurderes: flatelag('Verdsatt natur som vurderes', () => vurderes(verdi(katalog.gull.verdsattVurderes)))
};
/* Lag av kartet over grå arealer (solv.graa og solv.graabit): alt grått areal, til villreinsiden, og grønne arealer i bebyggelse (grått areal med minst
   halvparten vegetasjon, trinn 4 og 5), til bynaturen */
export const GRAALAG = {
  graa: rutelag(
    'Grått areal',
    () => verdi(katalog.solv.graa),
    tc => katalog.solv.graabit(tc).then(D => D.kl),
    v => (v > 0 ? 'graa0' : null)
  ),
  gronne: rutelag(
    'Grønne arealer i bebyggelse',
    () => verdi(katalog.solv.graa),
    tc => katalog.solv.graabit(tc).then(D => D.kl),
    v => (v === 4 || v === 5 ? 'gronne-arealer' : null)
  )
};
