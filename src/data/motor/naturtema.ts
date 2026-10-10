/* Naturtemaene fra Miljødirektoratet: verneområder, villrein og verdsatt natur. Hvordan temaene hentes, står i
   bronse/mdir-naturtema.ts, hvordan flatene gjøres om, i solv/temaer.ts, og arealet og kryssingen regnes ut i gull/temaer.ts.
   Datasettene står i datasett.ts (solv.temaomrader, gull.temaareal, solv.kartlagt, gull.temainne og gull.temakryss), og det sidene
   viser, i gulldata.ts. Kartlagene ligger i ui/kart/naturtema.ts, og ordene sidene bruker om hvert tema, i
   ui/komponenter/Naturtema.tsx.
   Et nytt tema av samme slag legges til i bronse, i EGENSKAPER i solv/temaer.ts, som en ny linje i listen under, og med ord og
   kartlag i ui/. */

/* Et naturtema. samlet: mange små lokaliteter, der arealet per verdikategori regnes samlet og bare de som berøres av planlagt
   utbygging, listes. dekning: temaet har et kart over hvor det er kartlagt. klasser: verdikategoriene, [navn, farge], høyest verdi
   først. */
export interface Naturtema {
  id: string;
  navn: string;
  samlet?: boolean;
  dekning?: boolean;
  klasser?: [navn: string, farge: string][];
}

export const NATURTEMA: Naturtema[] = [
  { id: 'vern', navn: 'Verneområder' },
  { id: 'rein', navn: 'Villrein' },
  {
    id: 'verdi',
    navn: 'Verdsatt natur',
    samlet: true,
    dekning: true,
    klasser: [
      ['Svært stor verdi', 'verdi1'],
      ['Stor verdi', 'verdi2'],
      ['Middels verdi', 'verdi3'],
      ['Noe verdi', 'verdi4']
    ]
  }
];
