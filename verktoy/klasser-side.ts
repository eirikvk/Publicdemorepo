/* Delen av verktoy/klasser.ts som kjører i nettleseren. Den kaller katalogen, som siden selv gjør: blokkene kommunen har ruter i
   (solv.blokker), og dagens klasser i hver blokk (solv.klasser) eller detaljklassene (solv.detaljklasser), som lages av
   kartbildene fra NIBIO. Verktøyet gir siden tomme registre, så det lagrede svaret ikke brukes, og ETL-funksjonene kjøres. Her
   står bare at det prøves på nytt når et kall feiler. */
import { katalog } from '../src/data/katalog.ts';

/* Prøver på nytt med økende pause, inntil seks ganger */
async function medForsok<T>(f: () => Promise<T>, forsok = 6): Promise<T> {
  for (let i = 0; ; i++)
    try {
      return await f();
    } catch (e) {
      if (i + 1 >= forsok) throw e;
      await new Promise(ok => setTimeout(ok, (2 + 4 * i) * 1000));
    }
}

/* Blokkene på nivå z der kommunen nr har ruter, som [x, y] */
export async function blokkerFor(nr: string, z: number): Promise<number[][]> {
  return (await medForsok(() => katalog.solv.blokker([nr, z]))).map(([, x, y]) => [x, y]);
}
/* Dagens klasser i blokken [z, x, y], eller detaljklassene: klassen per rute (base64), og hvor lang tid det tok */
export async function lagBlokk(z: number, x: number, y: number, detalj = false) {
  const t0 = performance.now(),
    K = await medForsok(() => (detalj ? katalog.solv.detaljklasser : katalog.solv.klasser)([z, x, y]));
  let tekst = '';
  for (let i = 0; i < K.kl.length; i += 32768) tekst += String.fromCharCode(...K.kl.subarray(i, i + 32768));
  return { kl: btoa(tekst), ms: performance.now() - t0 };
}
