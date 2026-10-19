/* Funksjonsflagg i tvillingen: det som kan skrus av og på uten å endre sidene. Sett et flagg til false og bygg på nytt. */

/* Spørsmålstegnene ved tallkortene og figurene, med forklaringen bak tallene, som infoknappen på hovedsiden. sporsmalstegn skrur alle
   av og på på en gang, og hvert sted har sitt eget flagg. Navnet er siden og stedet på siden: kort er et tallkort, figur en figur.
   Kortet hvert spørsmålstegn viser, står ved stedet på siden. Kortene står i src/ui/forklaringer.ts. */
export const FLAGG = {
  /* Egne analyser på naturtapet: tegne et område eller laste opp en plan, og se tallene på siden sammenlignet med kommuneplanen
     (komponenter/Egne.tsx). Av: siden er som før, uten verktøyene, laget i kartet og områdene. */
  egneAnalyser: true,
  sporsmalstegn: true,
  steder: {
    'oversikt/nedbygd': true,
    'oversikt/sammenligning': true,
    'naturtapet/kort-natur': true,
    'naturtapet/kort-andel': true,
    'naturtapet/kort-jordbruk': true,
    'naturtapet/figur-verdifull-natur': true,
    'naturtapet/figur-okosystemtype': true,
    'naturtapet/figur-regnskap': true,
    'naturtapet/egne': true,
    'skog/kort-areal': true,
    'skog/kort-andel': true,
    'skog/kort-vernet': true,
    'skog/figur-treslag': true,
    'skog/figur-underlag': true,
    'vatmark/kort-areal': true,
    'vatmark/kort-andel': true,
    'vatmark/figur-underlag': true,
    'verneomrader/kort-areal': true,
    'verneomrader/kort-andel': true,
    'verneomrader/figur-verneform': true,
    'verneomrader/figur-natur': true,
    'verneomrader/figur-omradene': true,
    'verdsatte-naturtyper/kort-kartlagt': true,
    'verdsatte-naturtyper/kort-areal': true,
    'verdsatte-naturtyper/figur-verdiene': true,
    'verdsatte-naturtyper/figur-naturtyper': true,
    'inngrepsfri-natur/kort-areal': true,
    'inngrepsfri-natur/kort-andel': true,
    'inngrepsfri-natur/figur-soner': true,
    'inngrepsfri-natur/figur-utvikling': true,
    'inngrepsfri-natur/figur-endringer': true,
    'villrein/kort-areal': true,
    'villrein/kort-andel': true,
    'villrein/kort-inngrepsfri-og-graa': true,
    'villrein/figur-omradene': true,
    'villrein/figur-inngrepsfri': true,
    'bynatur/kort-areal': true,
    'bynatur/kort-andel': true,
    'bynatur/kort-planlagt': true,
    'bynatur/figur-vegetasjon': true,
    'bynatur/figur-gronne': true
  }
};
export type Sted = keyof typeof FLAGG.steder;
/* Om spørsmålstegnet på stedet vises */
export const vises = (sted: Sted) => FLAGG.sporsmalstegn && FLAGG.steder[sted];
