/* Felles for kartlagene: flisnettet, hva kartet holder på med, og hjelpere for lag som tegnes i nettleseren. Filen importerer bare
   fra OpenLayers og datadelen, så den er alltid ferdig lastet før kartlagene som bruker den. Kartlagene kaller hverandre fram og
   tilbake, og det går bra så lenge ingen av dem bruker hverandre mens de lastes. */
import type ImageTile from 'ol/ImageTile.js';
import type { LoadFunction } from 'ol/Tile.js';
import type MultiPolygon from 'ol/geom/MultiPolygon.js';
import type Polygon from 'ol/geom/Polygon.js';
import type TileLayer from 'ol/layer/Tile.js';
import type XYZ from 'ol/source/XYZ.js';
import { ol } from './ol.ts';
import type { Flerflate, Utsnitt } from '../../data/generelt/geometri.ts';
import { OPPLOSNINGER, ORIGO, UTM } from '../../data/solv/felles.ts';
import { sti } from '../../data/solv/raster.ts';

export const MAKSTETTHET = 2; /* telefoner har ofte tre piksler per punkt; to er nok og gir under halvparten så store bilder */

/* Kartverkets flisnett fra nivå 5, som alle lagene som tegnes i nettleseren, bruker. Kartet beholder flisene det har tegnet, så
   panorering og zoom tilbake til samme sted gir ingen nye kall, og fliser fra nabonivåene vises mens nye lastes. */
export const plannett = new ol.tilegrid.TileGrid({
  origin: ORIGO,
  resolutions: OPPLOSNINGER,
  tileSize: 256,
  minZoom: 5
});
/* Hva kartet holder på med. Settes når kartet flyttes. */
export const kartflagg = {
  iBevegelse: false /* kartet flyttes nå */,
  startet: 0 /* antall kartbilder bronse hadde bedt om da kartet begynte å flytte seg */
};
/* En flate fra OpenLayers som sti i et lerret der u er utsnittet og s er piksler per meter */
export const geomSti = (g: CanvasRenderingContext2D, geom: MultiPolygon | Polygon, u: Utsnitt, s: number) =>
  sti(g, (geom.getType() === 'MultiPolygon' ? geom.getCoordinates() : [geom.getCoordinates()]) as Flerflate, u, s);
export const TOM = 4; /* OpenLayers' tilstand for en flis uten innhold */
/* Venter til nettleseren har fått gjort annet arbeid, som å svare på trykk. Tungt arbeid som deles opp med denne, blir flere korte
   oppgaver i stedet for én lang. */
export const slippTil = () => new Promise<void>(r => setTimeout(r, 0));
/* Et kartlag som tegnes i nettleseren eller fargelegges her */
export type Flislag = TileLayer<XYZ>;
/* Tegner én flis: setter bildet eller tilstanden til tile. src er adressen, for lagene som har en. OpenLayers beskriver flisen bare
   som Tile, men i disse lagene er den alltid et ImageTile. */
export type Flistegner = (tile: ImageTile, src: string) => void | Promise<void>;
/* Krediteringen nederst i kartet: hvert lag oppgir hvem dataene kommer fra, og OpenLayers viser bare kildene til lagene som er
   synlige, én gang hver og i rekkefølgen lagene ligger i */
export const KILDER = {
  kartverket: 'Kartverket',
  nibio: 'NIBIO',
  dibk: 'DiBK',
  mdir: 'Miljødirektoratet',
  ssb: 'SSB'
};
/* Kilde for et lag som tegnes i nettleseren. Flisene har ingen adresse, bare plass i rutenettet. kilder er hvem dataene kommer fra,
   til krediteringen nederst i kartet (se KILDER). skarp: pikslene forstørres og forminskes uten utjevning, så hver piksel i kartet er
   én rute, som i lagene av dagens klasser og detaljklassene (de samme rutene i alle lagene, se grunnkart.ts). */
export const tegnetKilde = (tegnFlis: Flistegner, kilder: string[], skarp = false) =>
  new ol.source.XYZ({
    attributions: kilder,
    tileUrlFunction: tc => tc.join('/'),
    tileGrid: plannett,
    tilePixelRatio: 2,
    tileLoadFunction: tegnFlis as LoadFunction,
    transition: 0,
    projection: UTM,
    interpolate: !skarp
  });
/* Tegner flisene i et lag på nytt. De gamle står til de nye er klare. */
let friskNr = 0;
/* OpenLayers merker setKey som intern, men det er den som gir nye fliser uten å kaste de gamle først */
type MedNokkel = { setKey(nokkel: string): void };
export const friskOpp = (lag: Flislag) => {
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
/* Setter fargen f i pikselen som begynner på plass i i o, helt dekket */
export const fargPiksel = (o: Uint8ClampedArray, i: number, f: ArrayLike<number>) => {
  o[i] = f[0];
  o[i + 1] = f[1];
  o[i + 2] = f[2];
  o[i + 3] = 255;
};
