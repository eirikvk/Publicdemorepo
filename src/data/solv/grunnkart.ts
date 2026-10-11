/* Sølv for grunnkartet fra NIBIO: det lagrede oversiktsbildet med utsnittet det dekker, det sammensatte kartet og dagens klasser i
   én flis. Kartbildene fra NIBIO leses som de er (klassen leses av fargen, se klasser.ts). Det sammensatte kartet tegnes her, men
   datamotoren bestemmer når en flis legges inn (data/motor/grunnkart.ts). */
import type { Flerflate, Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { flisUtsnitt, flisnavn, type Flis } from './felles.ts';
import { flislerret, lesBilde, sti, tegneflate, tegnUtsnitt } from './raster.ts';

/* Dagens klasser zoomet ut: det lagrede oversiktsbildet (buf, som PNG), eller det sammensatte kartet (lerret, dynamisk). ext er
   utsnittet bildet dekker, og res meter per piksel. */
export interface Oversikt {
  ext: Utsnitt;
  res: number;
  buf?: ArrayBuffer;
  lerret?: HTMLCanvasElement;
  dynamisk?: boolean;
}
/* Tabellen solv.oversikt: det lagrede oversiktsbildet med utsnittet det dekker og meter per piksel, for kommuner som har et */
export async function oversikt(nr: string): Promise<Oversikt> {
  const reg = await katalog.bronse.oversiktsregister(),
    ext = reg && reg.kommuner && reg.kommuner[nr];
  if (!ext) throw new Error('ingen lagret oversikt');
  const buf = await katalog.bronse.oversiktsbilde(nr);
  return { buf, ext, res: (ext[2] - ext[0]) / new DataView(buf).getUint32(16) /* bredden i PNG-hodet */ };
}
/* Tabellen solv.oversiktLest: det lagrede oversiktsbildet lest inn som bilde, til dagens klasser zoomet ut */
export async function oversiktLest(nr: string): Promise<ImageBitmap> {
  return lesBilde((await katalog.solv.oversikt(nr)).buf!);
}

/* Det sammensatte kartet: lerretet (c) med klassene i rene farger, meter per piksel, utsnittet det dekker, flisene som er lagt inn
   (som «nivå/x/y», se flisnavn), og det samme som Oversikt (ov), til kartet og utregningene */
export interface Samling {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  res: number;
  ext: [number, number, number, number];
  har: Set<string>;
  ov: Oversikt;
}
/* Et tomt sammensatt kart over utsnittet e: høyst 2048 piksler på den lengste siden, og ikke finere enn minRes meter per piksel */
export function nySamling(e: Utsnitt, minRes: number): Samling {
  const res = Math.max(minRes, Math.max(e[2] - e[0], e[3] - e[1]) / 2048),
    g = tegneflate(Math.ceil((e[2] - e[0]) / res), Math.ceil((e[3] - e[1]) / res)),
    c = g.canvas;
  const ext: [number, number, number, number] = [e[0], e[3] - c.height * res, e[0] + c.width * res, e[3]];
  return { c, g, res, ext, har: new Set<string>(), ov: { lerret: c, ext, res, dynamisk: true } };
}
/* Flisen tc, lest inn som bilde bm, inn i det sammensatte kartet s. Gir stedet i lerretet [x, y, b, h] der den ble lagt. Flisen legges
   på hele piksler. Ellers blir kantpikselen halvt gjennomsiktig fra begge naboflisene, og skjøten vises som en lys stripe. */
export function tegnISamling(s: Samling, tc: Flis, bm: ImageBitmap): [number, number, number, number] {
  s.har.add(flisnavn(tc));
  const u = flisUtsnitt(tc),
    px = (v: number) => Math.round((v - s.ext[0]) / s.res),
    py = (v: number) => Math.round((s.ext[3] - v) / s.res);
  const X = px(u[0]),
    Y = py(u[3]),
    W = px(u[2]) - X,
    H = py(u[1]) - Y;
  s.g.drawImage(bm, X, Y, W, H);
  return [X, Y, W, H];
}

/* Hvor dagens klasser i en flis tegnes fra: kartbildet fra NIBIO for flisen (flis), det lagrede oversiktsbildet (ov med buf, lest inn
   som lest), eller det sammensatte kartet (ov med lerret), som klippes mot kommunen (koord) */
export interface Dagenskilde {
  flis?: ArrayBuffer;
  ov?: Oversikt | null;
  lest?: ImageBitmap | null;
  koord?: Flerflate | null;
}
/* Dagens klasser i flisen tc på 512 x 512 piksler, i de rene fargene fra NIBIO. Fra det sammensatte kartet bare det som er hentet, og
   bare innenfor kommunen. null hvis kilden k ikke har noe. */
export async function dagensKlasserIFlis(tc: Flis, k: Dagenskilde): Promise<Uint8ClampedArray | null> {
  const c = flislerret(),
    g = c.getContext('2d', { willReadFrequently: true })!,
    ov = k.ov;
  if (k.flis) g.drawImage(await lesBilde(k.flis), 0, 0, 512, 512);
  else if (ov && ov.buf && k.lest) {
    const u = flisUtsnitt(tc),
      r = ov.res;
    tegnUtsnitt(g, k.lest, (u[0] - ov.ext[0]) / r, (ov.ext[3] - u[3]) / r, (u[2] - u[0]) / r, (u[3] - u[1]) / r);
  } else if (ov && ov.lerret && k.koord) {
    const u = flisUtsnitt(tc),
      r = (ov.ext[2] - ov.ext[0]) / ov.lerret.width,
      s = 512 / (u[2] - u[0]);
    tegnUtsnitt(g, ov.lerret, (u[0] - ov.ext[0]) / r, (ov.ext[3] - u[3]) / r, (u[2] - u[0]) / r, (u[3] - u[1]) / r);
    g.globalCompositeOperation = 'destination-in';
    sti(g, k.koord, u, s);
    g.fill('evenodd');
    g.globalCompositeOperation = 'source-over';
  } else return null;
  return g.getImageData(0, 0, 512, 512).data;
}
