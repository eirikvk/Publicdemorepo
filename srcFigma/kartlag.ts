/* Kartlag som bare tvillingen har. Lagene av grunnkartet og grått areal tegnes av den samme datamotoren og den samme tegnemotoren som
   hovedsidens kartlag (data/motor/kartverdier.ts og src/ui/kart/verdilag.ts), så hver piksel er det sølv sier på nivået kartet viser,
   og lagene stemmer piksel for piksel med dagens arealklasser og hverandre. Tvillingen bestemmer bare fargene: detaljklassene, som
   skogtyper og tresatt myr, én av dagens klasser for seg, til kortene på oversikten, og grått areal. Og lag fra Miljødirektoratets kart
   over naturskog og flater fra tabellene, bare til visning. Alle lagene klippes mot kommunen. Kartet (Kart.tsx) legger lagene inn i det
   felles kartet når siden vises, og tar dem ut igjen etterpå. */
import type ImageTile from 'ol/ImageTile.js';
import type TileLayer from 'ol/layer/Tile.js';
import type XYZ from 'ol/source/XYZ.js';
import { katalog } from '../src/data/katalog.ts';
import { detaljerIFlis, graaIFlis, klasserIFlis } from '../src/data/motor/kartverdier.ts';
import { abonner } from '../src/data/motor/tilstand.ts';
import { verdi } from '../src/data/motor/valgt.ts';
import type { Flis } from '../src/data/solv/felles.ts';
import { ALLE, DETALJKLASSER, type Detaljklasse, type KlasseId } from '../src/data/solv/klasser.ts';
import type { VerdsattVurderes, VernetFlate } from '../src/data/gull/temaer.ts';
import { flislerret, lesBilde, sti } from '../src/data/solv/raster.ts';
import { kart } from '../src/ui/kart/kart.ts';
import { KILDER, TOM, friskOpp, nyttSiden, plannett, tegnetKilde, type Flistegner } from '../src/ui/kart/felles.ts';
import { ol } from '../src/ui/kart/ol.ts';
import { verdilag } from '../src/ui/kart/verdilag.ts';

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

/* Et kartlag av verdiene per piksel fra datamotoren (data/motor/kartverdier.ts), med den felles tegnemotoren (verdilag.ts) som
   hovedsidens kartlag, klippet mot kommunen: farger gir fargen for hver verdi som [r, g, b], eller null når den ikke vises. Med maske
   bare innenfor flatene den gir, og tegnet på nytt når de er hentet, men bare når laget er i kartet, så flatene ikke hentes for sider
   som ikke viser laget. */
function pikselag(
  tittel: string,
  verdier: (tc: Flis) => Promise<ArrayLike<number> | null>,
  farger: () => (number[] | null)[],
  maske?: () => Flerflate[] | null,
  opacity?: number
): TileLayer<XYZ> {
  return verdilag({
    tittel,
    kilder: [KILDER.nibio],
    verdier,
    farger,
    klipp: 'alltid',
    klasse: 'figma-lag',
    maske,
    folg: maske ? lag => [iKartet(lag) ? maske() : null] : undefined,
    opacity
  });
}
/* Om laget er i kartet nå (tvillingens egne lag legges inn bare mens siden som viser dem, er oppe) */
const iKartet = (lag: TileLayer<XYZ>) => !!kart && kart.getLayers().getArray().includes(lag);

/* Fargene for detaljklassene: farge gir fargen (en variabel i stilen) for hver detaljklasse som skal vises, eller null */
const detaljfarger = (farge: (k: Detaljklasse) => string | null) => () => [
  null,
  ...DETALJKLASSER.map(k => {
    const f = farge(k);
    return f ? cssFarge(f) : null;
  })
];
/* Et kartlag av detaljklassene (detaljerIFlis), i fargene farge gir */
export const detaljlag = (tittel: string, farge: (k: Detaljklasse) => string | null) =>
  pikselag(tittel, detaljerIFlis, detaljfarger(farge));
/* Som detaljlag, men bare innenfor flatene maske gir (som verneområdene) */
export const detaljlagI = (
  tittel: string,
  farge: (k: Detaljklasse) => string | null,
  maske: () => Flerflate[] | null
) => pikselag(tittel, detaljerIFlis, detaljfarger(farge), maske);
/* Et kartlag med én av dagens klasser (bebygd, jordbruk eller natur) i klassens farge, av de samme klassene som hovedsidens kart
   (klasserIFlis), så laget henter ikke noe mer enn kartet alt gjør */
export const klasselag = (tittel: string, id: KlasseId) =>
  pikselag(tittel, klasserIFlis, () => [null, ...ALLE.map(([k]) => (k === id ? cssFarge(id) : null))]);

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
/* Gruppene av verneformer som er slått av i lagvelgeren, som fargene deres. Flatene som vises, er de samme så lenge tabellen og valget
   er de samme. */
let vernAv: string[] = [];
let vernVist: { F: ReturnType<typeof vernfarger>; av: string; ut: ReturnType<typeof vernfarger> } | null = null;
function verneformerVist() {
  const F = vernfarger(verdi(katalog.gull.verneformer)),
    av = vernAv.join();
  if (!F || !av) return F;
  if (!vernVist || vernVist.F !== F || vernVist.av !== av)
    vernVist = { F, av, ut: F.filter(f => !vernAv.includes(f.farge)) };
  return vernVist.ut;
}
/* Lagene på siden om verneområder: verneområdene etter verneform (gull.verneformer), der hver gruppe kan slås av og på
   (velgVerneformer), og naturen i verneområdene, grunnkartets detaljklasser i fargen for hovedøkosystemet, bare innenfor
   verneområdene */
export const VERNLAG = {
  verneformer: flatelag('Verneområder per verneform', verneformerVist),
  natur: detaljlagI(
    'Naturen i verneområder',
    k => OKOSYSTEMFARGE[k.okosystem] || null,
    () => vernflater(verdi(katalog.gull.verneformer))
  )
};
/* Slår av gruppene av verneformer med fargene av, og tegner laget på nytt */
export function velgVerneformer(av: string[]) {
  if (av.join() === vernAv.join()) return;
  vernAv = av;
  friskOpp(VERNLAG.verneformer);
}
/* Laget på siden om verdsatte naturtyper for lokalitetene som skal vurderes per lokalitet eller per naturtype (gull.verdsattVurderes) */
export const VERDILAG = {
  vurderes: flatelag('Verdsatt natur som vurderes', () => vurderes(verdi(katalog.gull.verdsattVurderes)))
};
/* Lag av grått areal (graaIFlis), som hovedsidens lag: alt grått areal (trinn 1–6), til villreinsiden, og grønne arealer i bebyggelse
   (grått areal med minst halvparten vegetasjon, trinn 4 og 5), til bynaturen */
const graafarger = (vis: (v: number) => string | null) => () =>
  Array.from({ length: 8 }, (_, v) => {
    const f = v ? vis(v) : null;
    return f ? cssFarge(f) : null;
  });
export const GRAALAG = {
  graa: pikselag(
    'Grått areal',
    graaIFlis,
    graafarger(v => (v <= 6 ? 'graa0' : null)),
    undefined,
    0.85
  ),
  gronne: pikselag(
    'Grønne arealer i bebyggelse',
    graaIFlis,
    graafarger(v => (v === 4 || v === 5 ? 'gronne-arealer' : null)),
    undefined,
    0.85
  )
};
