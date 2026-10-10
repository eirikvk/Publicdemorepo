/* Gull for inngrepsfri natur: arealet per sone i kommunen. */

/* Arealet i km² per sone og samlet, fra antall ruter per sone (n) i rutenettet med ruter på res meter. skala er m2PerKm2 for
   kommunen. Avrundet til nærmeste 10 dekar, som SSBs tall. */
export function inonAreal(n, res, skala) {
  const soner = n.map(v => Math.round(((v * res * res) / skala) * 100) / 100);
  return { soner, sum: Math.round((soner[0] + soner[1] + soner[2]) * 100) / 100 };
}
