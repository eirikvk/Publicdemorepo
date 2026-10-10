/* Sølv for grunnkartet: det lagrede oversiktsbildet med utsnittet det dekker. Kartbildene fra NIBIO leses som de er (klassen leses av
   fargen, se klasser.ts), og det sammensatte kartet lager datamotoren av flisene som er hentet (data/motor/grunnkart.ts). */
import type { Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { lesBilde } from './raster.ts';

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
