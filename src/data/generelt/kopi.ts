/* Generelt: en egen kopi av et ferdig svar, som omvei rundt en feil i JavaScript-motoren. Filen importerer ingenting.

   Feilen: i Chromium kan et ferdig svar med desimaltall i et objekt få tallene fra et senere svar fra den samme funksjonen, uten at
   noen kode skriver til det. Tallene er riktige når svaret lages, og endres når funksjonen kalles neste gang, for et annet utvalg.
   Det skjer bare av og til, oftest når siden har mye å gjøre, og regnes svaret ut på nytt, blir det riktig. Det ligger trolig i
   motorens oversettelse av koden til maskinkode underveis (JIT): et desimaltall i et objekt ligger i en egen boks, og to objekter
   kan komme til å dele den samme. Sett 18. og 19. oktober 2026, se METODE.md.

   Regelen: et svar med tall som regnes for flere utvalg etter hverandre (den gamle og den nye planen, hele kommunen og hvert eget
   område), og der et eldre svar brukes videre, kopieres med egenKopi før det gis videre. Kopien tas i det samme synkrone steget som
   svaret ble regnet ut, uten await imellom, for feilen slår til når det neste svaret regnes ut. Nettleseren lager kopien selv
   (structuredClone), ikke JavaScript-kode som kan oversettes på samme måte, så kopien får sine egne bokser. Store ting som deles med
   vilje, som listen over områdene i et tema, kopieres ikke. Får et tall i et ferdig svar en annen verdi uten at koden skriver til
   det, er det denne feilen, og omveien er den samme. */

/* En egen kopi av svaret, med de samme tallene, listene og tallrekkene */
export const egenKopi = <T>(svar: T): T => structuredClone(svar);
