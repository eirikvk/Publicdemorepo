/* Delen av verktoy/kommunegrenser.ts som kjører i nettleseren. Den kaller katalogen, som siden selv gjør: kommunegrensen
   (solv.grense) og kommunens andel per rute i bitene (solv.kommunebiter). Verktøyet gir siden et tomt register, så det lagrede
   svaret ikke brukes, og ETL-funksjonene kjøres. Andelen gjøres om til bytes og pakkes med gzip her, med de samme funksjonene som
   leser den. */
import { katalog } from '../src/data/katalog.ts';
import { gzip, kommunebiterTilBytes } from '../src/data/solv/kommune.ts';

/* Grensen og andelen for kommunen nr: grensen som den lagres (uten nummeret), andelen som gzip i base64, og antall biter */
export async function lagKommune(nr: string) {
  const G = await katalog.solv.grense(nr),
    KB = await katalog.solv.kommunebiter(nr),
    z = await gzip(kommunebiterTilBytes(KB));
  let tekst = '';
  for (let i = 0; i < z.length; i += 32768) tekst += String.fromCharCode(...z.subarray(i, i + 32768));
  return { grense: { koord: G.koord, ext: G.ext, km2: G.km2 }, andel: btoa(tekst), biter: KB.length };
}
