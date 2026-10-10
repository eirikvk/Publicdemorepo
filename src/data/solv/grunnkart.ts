/* Sølv for grunnkartet fra NIBIO: det lagrede oversiktsbildet med utsnittet det dekker, og dagens klasser i én flis. Kartbildene fra
   NIBIO leses som de er (klassen leses av fargen, se klasser.ts), og det sammensatte kartet lager datamotoren av flisene som er
   hentet (data/motor/grunnkart.ts). */
import type { Flerflate, Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { flisUtsnitt, type Flis } from './felles.ts';
import { flislerret, lesBilde, sti, tegnUtsnitt } from './raster.ts';

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
