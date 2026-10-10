/* Gull for inngrepsfri natur: arealet per sone i kommunen. */
import { andel, bildeStatus } from './felles.js';

/* Arealet i km² per sone og samlet, fra antall ruter per sone (n) i rutenettet med ruter på res meter. skala er m2PerKm2 for
   kommunen. Avrundet til nærmeste 10 dekar, som SSBs tall. */
export function inonAreal(n, res, skala) {
  const soner = n.map(v => Math.round(((v * res * res) / skala) * 100) / 100);
  return { soner, sum: Math.round((soner[0] + soner[1] + soner[2]) * 100) / 100 };
}

/* Det temasiden og oversikten viser: tilstanden, arealet samlet og per sone, og andelen av landarealet. D er resultatet fra
   inonAreal for kommunen, og land landarealet i km². */
export const byggInon = (D, land) => ({
  tilstand: bildeStatus(D),
  sum: D ? D.sum : 0,
  soner: D ? D.soner : null,
  andelLand: D ? andel(D.sum, land) : null
});
