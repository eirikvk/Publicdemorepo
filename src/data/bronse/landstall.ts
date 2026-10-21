/* Bronse for landstabellen: tallene for alle kommunene, regnet ut på forhånd av verktoy/landstall.ts med gull.kommunetall, og lagt
   i bøtta eirikvk/naturdata på Hugging Face som Parquet. Filene er små (noen titalls kB), så hele filen hentes i ett kall, som den
   er. Sølv leser Parquet-filen (solv/landstall.ts). */
import { LANDSNATURTYPER, LANDSTALL } from './endepunkter.ts';
import { hent } from './henting.ts';

/* Tabellen bronse.landstall: filen med én rad per kommune og tallene fra gull.kommunetall (kommunetall.parquet) */
export const landstall = () => hent('Hugging Face', 'Tallene for alle kommunene', LANDSTALL, false, true);
/* Tabellen bronse.landsnaturtyper: filen med arealet av hver naturtype i verdsatt natur i hver kommune (naturtyper.parquet) */
export const landsnaturtyper = () => hent('Hugging Face', 'Naturtypene i alle kommunene', LANDSNATURTYPER, false, true);
