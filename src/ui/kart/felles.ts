/* Felles for kartlagene: flisnettene, hva kartet holder på med, og hjelpere for lag som tegnes i nettleseren. Filen importerer bare
   fra OpenLayers og datadelen, så den er alltid ferdig lastet før kartlagene som bruker den. Kartlagene kaller hverandre fram og
   tilbake, og det går bra så lenge ingen av dem bruker hverandre mens de lastes. */
import type ImageTile from 'ol/ImageTile.js';
import type { LoadFunction } from 'ol/Tile.js';
import type MultiPolygon from 'ol/geom/MultiPolygon.js';
import type Polygon from 'ol/geom/Polygon.js';
import type TileLayer from 'ol/layer/Tile.js';
import type XYZ from 'ol/source/XYZ.js';
import { ol } from './ol.ts';
import { FLISNIVA } from '../../data/bronse/nibio-grunnkart.ts';
import { OPPLOSNINGER, ORIGO, UTM, type Flerflate, type Utsnitt } from '../../data/solv/felles.ts';
import { sti } from '../../data/solv/raster.ts';

export const MAKSRES = 30; /* kartet må være zoomet inn til under 30 meter per punkt før flisene fra NIBIO brukes */
export const SVAKEST = 0.35; /* svakeste farge for en piksel med bare litt planlagt utbygging i seg, så den ikke forsvinner helt */
export const MAKSTETTHET = 2; /* telefoner har ofte tre piksler per punkt; to er nok og gir under halvparten så store bilder */

/* Grunnkartet: fliser fra NIBIO i Kartverkets flisnett. Nettleseren beholder flisene den har hentet, så panorering og zoom tilbake
   til samme sted gir ingen nye kall, og fliser fra nabonivåene vises mens nye lastes. Lagene som tegnes i nettleseren, bruker samme
   nett fra nivå 5. */
export const flisnett = new ol.tilegrid.TileGrid({
  origin: ORIGO,
  resolutions: OPPLOSNINGER,
  tileSize: 256,
  minZoom: FLISNIVA
});
export const plannett = new ol.tilegrid.TileGrid({
  origin: ORIGO,
  resolutions: OPPLOSNINGER,
  tileSize: 256,
  minZoom: 5
});
/* Hva kartet holder på med. Settes når kartet flyttes. */
export const kartflagg = {
  iBevegelse: false /* kartet flyttes nå */,
  startet: 0 /* antall kartbilder bronse hadde bedt om da kartet begynte å flytte seg */,
  feilet: 0 /* antall kartbilder som hadde feilet da */
};
/* En flate fra OpenLayers som sti i et lerret der u er utsnittet og s er piksler per meter */
export const geomSti = (g: CanvasRenderingContext2D, geom: MultiPolygon | Polygon, u: Utsnitt, s: number) =>
  sti(g, (geom.getType() === 'MultiPolygon' ? geom.getCoordinates() : [geom.getCoordinates()]) as Flerflate, u, s);
/* Myker opp en maske litt, på stedet. Brukes for kommunebildene til inngrepsfri natur og grått areal. */
export function jevn(P: Uint8ClampedArray, w: number, h: number) {
  /* myker opp maskene litt (vekter 1-2-1 begge veier), så sonegrensene ikke får trappetrinn fra rutene når kartet er zoomet langt inn */
  const n = 4 * w,
    over = new Uint8Array(n),
    denne = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    /* bortover, rad for rad */
    const o = y * n;
    denne.set(P.subarray(o, o + n));
    for (let x = 0; x < n; x += 4) {
      const a = x ? x - 4 : x,
        b = x < n - 4 ? x + 4 : x;
      P[o + x] = (denne[a] + 2 * denne[x] + denne[b] + 2) >> 2;
      P[o + x + 1] = (denne[a + 1] + 2 * denne[x + 1] + denne[b + 1] + 2) >> 2;
      P[o + x + 2] = (denne[a + 2] + 2 * denne[x + 2] + denne[b + 2] + 2) >> 2;
    }
  }
  over.set(P.subarray(0, n));
  for (let y = 0; y < h; y++) {
    /* nedover: raden over er tatt vare på før den ble skrevet over */
    const o = y * n,
      u = y < h - 1 ? o + n : o;
    denne.set(P.subarray(o, o + n));
    for (let x = 0; x < n; x += 4) {
      P[o + x] = (over[x] + 2 * denne[x] + P[u + x] + 2) >> 2;
      P[o + x + 1] = (over[x + 1] + 2 * denne[x + 1] + P[u + x + 1] + 2) >> 2;
      P[o + x + 2] = (over[x + 2] + 2 * denne[x + 2] + P[u + x + 2] + 2) >> 2;
    }
    over.set(denne);
  }
}
export const TOM = 4; /* OpenLayers' tilstand for en flis uten innhold */
/* Et kartlag som tegnes i nettleseren eller fargelegges her */
export type Flislag = TileLayer<XYZ>;
/* Tegner én flis: setter bildet eller tilstanden til tile. src er adressen, for lagene som har en. OpenLayers beskriver flisen bare
   som Tile, men i disse lagene er den alltid et ImageTile. */
export type Flistegner = (tile: ImageTile, src: string) => void | Promise<void>;
/* Kilde for et lag som tegnes i nettleseren. Flisene har ingen adresse, bare plass i rutenettet. */
export const tegnetKilde = (tegnFlis: Flistegner) =>
  new ol.source.XYZ({
    tileUrlFunction: tc => tc.join('/'),
    tileGrid: plannett,
    tilePixelRatio: 2,
    tileLoadFunction: tegnFlis as LoadFunction,
    transition: 0,
    projection: UTM
  });
/* Tegner flisene i et lag på nytt. De gamle står til de nye er klare. */
let friskNr = 0;
export const utdaterte =
  new Set<Flislag>(); /* lag som skal tegnes på nytt neste gang kartet står stille zoomet ut, se friskOppGamle i grunnkart.js */
/* OpenLayers merker setKey som intern, men det er den som gir nye fliser uten å kaste de gamle først */
type MedNokkel = { setKey(nokkel: string): void };
export const friskOpp = (lag: Flislag) => {
  utdaterte.delete(lag);
  (lag.getSource() as unknown as MedNokkel).setKey(String(++friskNr));
};
/* Kartlagene følger tilstanden. Hvert lag sjekker ved hver endring om det det tegnes av, er nytt: ny(nokkel, verdi) gir true første
   gang verdien er en annen enn sist. */
export const nyttSiden = () => {
  const sist = new Map<string, unknown>();
  return (nokkel: string, verdi: unknown) => {
    if (sist.has(nokkel) && sist.get(nokkel) === verdi) return false;
    sist.set(nokkel, verdi);
    return true;
  };
};
