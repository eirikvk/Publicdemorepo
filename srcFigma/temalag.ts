/* Kartlagene for hvert tema, som de står i lagvelgeren på temasiden. Temasidene og «Utforsk i kart» bruker de samme listene, så et tema
   ser likt ut i kartet begge steder. Lagene selv står i kartlag.ts og i kartet fra hovedsiden (lagene med id tema, som følger
   ui.side). Og fargene for hovedøkosystemene, som figurene og kartet over naturen i verneområdene bruker. */
import { KILDE } from '../src/data/katalog.ts';
import { GRAATRINN } from '../src/data/solv/graa.ts';
import { INONSONER } from '../src/data/solv/inon.ts';
import { NATURTEMA, VERNEFORMGRUPPER } from '../src/data/solv/temaer.ts';
import { KLASSER, PLAN, type Kartlag } from './komponenter/Kart.tsx';
import { GRAALAG, SKOGLAG, VATMARKLAG, VERDILAG, VERNEFORMFARGE, VERNLAG, velgVerneformer } from './kartlag.ts';

/* Kilden til lagene fra grunnkartet, i lagvelgeren */
export const GK = 'Grunnkart for arealanalyse';

const SKOG: Kartlag[] = [
  { id: 'skog', navn: 'Økosystemtype skog', kilde: GK, farger: [['Skog', 'skog']], ol: SKOGLAG.skog },
  {
    id: 'skogtyper',
    navn: 'Skogtyper',
    kilde: GK,
    farger: [
      ['Blandingsskog', 'skog-bland'],
      ['Barskog', 'skog-bar'],
      ['Lauvskog', 'skog-lauv']
    ],
    ol: SKOGLAG.skogtyper
  },
  { id: 'myr', navn: 'Tresatt myr', kilde: GK, farger: [['Tresatt myr', 'myr-tresatt']], ol: SKOGLAG.myr },
  {
    id: 'beite',
    navn: 'Tresatt innmarksbeite',
    kilde: GK,
    farger: [['Tresatt innmarksbeite', 'beite-tresatt']],
    ol: SKOGLAG.beite
  }
];
const VATMARK: Kartlag[] = [
  {
    id: 'vatmark',
    navn: 'Økosystemtype våtmark (myr)',
    kilde: GK,
    farger: [['Åpen myr og annen åpen våtmark', 'myr-apen']],
    ol: VATMARKLAG.apen
  },
  { id: 'tresatt', navn: 'Tresatt myr', kilde: GK, farger: [['Tresatt myr', 'myr-tresatt']], ol: VATMARKLAG.tresatt }
];
const VERN: Kartlag[] = [
  {
    id: 'verneformer',
    navn: 'Verneområder per verneform',
    kilde: 'Naturvernområder',
    farger: VERNEFORMGRUPPER.map(([id, navn]) => [navn, VERNEFORMFARGE[id]] as [string, string]),
    ol: VERNLAG.verneformer,
    velg: velgVerneformer
  },
  { id: 'tema', navn: 'Verneområder', kilde: 'Naturvernområder', skjul: true }
];
const VERDI: Kartlag[] = [
  {
    id: 'tema',
    navn: 'Verdsatte naturtyper',
    kilde: 'Naturtyper – verdsatte',
    farger: [
      ...NATURTEMA.find(t => t.id === 'verdi')!.klasser!.map(([navn, farge]) => [navn, farge] as [string, string]),
      ['Vurderes per lokalitet', 'vurderes1'],
      ['Vurderes per naturtype', 'vurderes2'],
      ['Annet (ikke gitt verdi)', 'vurderes3']
    ],
    med: [VERDILAG.vurderes]
  },
  {
    id: 'dekning',
    navn: 'Dekningskart for kartlegging',
    kilde: 'Naturtyper på land (NiN)',
    farger: [['Kartlagt', 'dekning']]
  }
];
const INON: Kartlag[] = [
  {
    id: 'tema',
    navn: 'Inngrepsfri natur',
    kilde: 'Inngrepsfri natur i Norge',
    farger: [2, 1, 0].map(i => [INONSONER[i][4], INONSONER[i][1]] as [string, string])
  }
];
const VILLREIN: Kartlag[] = [
  { id: 'tema', navn: 'Villreinområder', kilde: 'Villreinområder', farger: [['Villreinområde', 'rein']] },
  {
    id: 'graa',
    navn: 'Grått areal',
    kilde: KILDE.graa.datasett,
    farger: [['Grått areal', 'graa-rein']],
    ol: GRAALAG.graa
  }
];
const BYNATUR: Kartlag[] = [
  {
    id: 'tema',
    navn: 'Grått areal',
    kilde: KILDE.graa.datasett,
    farger: [...GRAATRINN.map(([farge, navn]) => [navn, farge] as [string, string]), ['Grønt i bebygd område', 'gront']]
  },
  {
    id: 'gronne',
    navn: 'Grønne arealer i bebyggelse',
    kilde: KILDE.graa.datasett,
    farger: [['50–100 % vegetasjon', 'gronne-arealer']],
    ol: GRAALAG.gronne,
    av: true
  },
  KLASSER,
  PLAN
];
/* Lagene per tema, med id-en i temaer.ts */
export const TEMALAG: Record<string, Kartlag[]> = {
  skog: SKOG,
  vatmark: VATMARK,
  verneomrader: VERN,
  'verdsatte-naturtyper': VERDI,
  'inngrepsfri-natur': INON,
  villrein: VILLREIN,
  bynatur: BYNATUR
};

/* Hovedøkosystemene i figuren og kartlaget om naturen som er vernet, i rekkefølgen og med navnene i skissene: navnet i dataene,
   navnet i figuren, navnet i tegnforklaringen og fargen. Restklassene fra grunnkartet er ikke i skissene, og står til slutt når de har
   areal. */
export const VERNET_NATUR: [data: string, figur: string, kart: string, farge: string][] = [
  ['Skog', 'Skog', 'Skog', 'oko-skog'],
  ['Våtmark', 'Våtmark (myr)', 'Våtmark', 'oko-vatmark'],
  ['Innsjøer og vannmagasiner', 'Innsjø og tjern', 'Innsjø og tjern', 'oko-innsjo'],
  ['Hei og buskmark', 'Hei og buskmark', 'Hei og buskmark', 'oko-hei'],
  ['Grasmark', 'Grasmark', 'Grasmark', 'oko-gras'],
  ['Elver, bekker og kanaler', 'Elver, bekker og kanaler', 'Elver, bekker og kanaler', 'oko-elv'],
  ['Lite vegetert mark', 'Lite vegetert mark', 'Lite vegetert mark', 'oko-lite'],
  ['Kyststrender, svaberg og dyner', 'Kyststrender, svaberg og dyner', 'Kyststrender, svaberg og dyner', 'oko-kyst'],
  ['Dyrket mark', 'Dyrket mark', 'Dyrket mark', 'oko-dyrket'],
  ['Bebygd og opparbeidet areal', 'Bebygd og opparbeidet areal', 'Bebygd og opparbeidet areal', 'oko-bebygd'],
  ['Hav', 'Hav (sjøareal)', 'Hav (sjøareal)', 'oko-hav']
];
export const RESTKLASSER = ['Natur, uspesifisert', 'Jordbruk, uspesifisert'];
/* Fargen for et hovedøkosystem ved navnet i dataene, og restklassene i samme farge */
export const okosystemfarge = (navn: string) => (VERNET_NATUR.find(([data]) => data === navn) || [])[3] || 'oko-annen';
