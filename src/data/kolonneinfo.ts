/* Kolonnene i eksempelradene i katalogen: hva hver kolonne er, enheten, og navnet på kodene, for tabellene der navnene ellers er
   kryptiske (kl, detalj, sone, 01–12) eller enheten er tvetydig. Og for tabellene med ruter: hvilken verdi som betyr at ruta ikke har
   data, så de rutene kan utelates (tom). Brukes på tabellene i katalog.ts (kolonner og tom i Tabelldef), og vises i
   src/ui/eksempelrader.ts og katalogvisningen. Kodene hentes fra listene sidene bruker, så de ikke står to steder. */
import type { Kolonneinfo, Tom } from './cache.ts';
import { ALLE, DETALJKLASSER, OKOSYSTEMTYPER } from './solv/klasser.ts';
import { NATURTEMA, VERNEFORMGRUPPER, VURDERES } from './solv/temaer.ts';
import { GRAATRINN, INONSONER } from './solv/tolking.ts';

type Kolonner = Record<string, Kolonneinfo>;
/* Kodene for navnene i L, fra fra (1 når 0 er tom) */
const koder = (L: string[], fra = 1) => Object.fromEntries(L.map((n, i) => [String(i + fra), n]));

/* Arealklassene og detaljklassene fra grunnkartet: 0 er ukjent, så 1 og oppover etter listene */
export const KLASSER: Kolonner = {
  kl: { om: 'klassen i grunnkartet', koder: koder(ALLE.map(k => k[1])) },
  detalj: {
    om: 'detaljklassen i grunnkartet, som alltid ligger innenfor klassen',
    koder: koder(DETALJKLASSER.map(k => k.navn))
  }
};
export const TOM_KLASSER: Tom = { verdi: 0, betyr: 'ukjent: utenfor kartet eller uten klasse' };

/* Inngrepsfri natur. I biten er villmarkspreget natur 0 og ruter uten sone 255. I flisene er sonen én mer, og 0 uten sone. */
const SONER = INONSONER.map(([, , , avstand, navn]) => `${navn}, ${avstand}`);
export const INONBIT: Kolonner = {
  sone: { om: 'sonen for inngrepsfri natur: avstanden til nærmeste tyngre tekniske inngrep', koder: koder(SONER, 0) }
};
export const TOM_INONBIT: Tom = { verdi: 255, betyr: 'uten sone, under 1 km fra inngrep' };
export const INONFLIS: Kolonner = { kl: { om: INONBIT.sone.om, koder: koder(SONER) } };
export const TOM_INONFLIS: Tom = { verdi: 0, betyr: 'uten sone, under 1 km fra inngrep' };

/* Grått areal: trinnet etter andel vegetasjon, 1–5, og 6 for grått uten oppgitt andel, som veier. 0 er ikke grått. */
export const GRAA: Kolonner = {
  kl: {
    om: 'trinnet for grått areal etter andel vegetasjon i flaten',
    koder: koder([...GRAATRINN.map(t => t[1]), 'Uten oppgitt andel vegetasjon, som veier'])
  }
};
export const TOM_GRAA: Tom = { verdi: 0, betyr: 'ikke grått areal' };

/* Kommuneplanen og egne planer per rute, og oversikten over kommuneplanen */
export const KOMMUNEPLAN: Kolonner = {
  plan: {
    om: 'om minst halve ruta ligger i areal satt av til framtidig utbygging',
    koder: { '1': 'satt av til utbygging' }
  }
};
export const TOM_KOMMUNEPLAN: Tom = { verdi: 0, betyr: 'ikke satt av til utbygging' };
export const EGNE: Kolonner = {
  id: { om: 'planen ruta hører til' },
  plan: { om: 'hva planen sier om ruta', koder: { '1': 'utbygging', '2': 'ikke utbygging' } }
};
export const TOM_EGNE: Tom = { verdi: 0, betyr: 'utenfor planen' };
export const PLANOVERSIKT: Kolonner = {
  x: { om: 'pikselen i oversiktsbildet, mot høyre' },
  y: { om: 'pikselen i oversiktsbildet, nedover' },
  noe: { om: 'om noe av kommuneplanen ligger i pikselen', koder: { '1': 'noe av planen' } }
};
export const TOM_PLANOVERSIKT: Tom = { verdi: 0, betyr: 'ingenting av planen' };

/* Temaene per rute: kategorien er plassen i temaet, fra 0 */
const kategori = (navn: string[]): Kolonner => ({ kategori: { om: 'kategorien i temaet', koder: koder(navn, 0) } });
const [, , VERDI] = NATURTEMA;
export const VERN_ANDEL = kategori(['Verneområdene slått sammen']);
export const VERNEFORM_ANDEL = kategori(VERNEFORMGRUPPER.map(g => g[1]));
export const VILLREIN_ANDEL = kategori(['Villreinområdene slått sammen']);
export const VERDSATT_ANDEL = kategori(VERDI.klasser!.map(k => k[0]));
export const VURDERES_ANDEL = kategori(VURDERES.klasser!.map(k => k[0]));
export const KARTLAGT_ANDEL = kategori(['Det kartlagte slått sammen']);

/* SSBs tabeller for naturregnskapet per kommune: økosystemtypene i KLASS 988 som koder */
export const OKOSYSTEMAREAL: Kolonner = Object.fromEntries(
  OKOSYSTEMTYPER.map(o => [o.kode, { om: `arealet av ${o.navn.toLowerCase()} i 2024`, enhet: 'km²' }])
);
export const OKOSYSTEMENDRING: Kolonner = {
  ...Object.fromEntries(
    OKOSYSTEMTYPER.flatMap(o => [
      [`tilBebygd.${o.kode}`, { om: `fra ${o.navn.toLowerCase()} til bebygd, 2017–2024`, enhet: 'km²' }],
      [`fraBebygd.${o.kode}`, { om: `fra bebygd til ${o.navn.toLowerCase()}, 2017–2024`, enhet: 'km²' }]
    ])
  ),
  endret: { om: 'årene kan ikke sammenlignes, fordi kommunegrensen er flyttet' },
  flyttet: { om: 'kommunegrensen er flyttet, men endringen er regnet likevel' },
  uforklart: { om: 'økningen i bebygd som ikke kunne fordeles på jordbruk og natur', enhet: 'km²' }
};
export const KOMMUNEAREAL: Kolonner = {
  verdi: { om: 'flaten innenfor kommunegrensen, med ferskvann og hav', enhet: 'km²' },
  km2: { om: 'flaten innenfor kommunegrensen, med ferskvann og hav', enhet: 'km²' }
};
export const REGISTER: Kolonner = { '10': { om: 'blokkene på nivå 10 som er lagret, som [x, y] i flisnettet' } };

/* Områdene i naturtemaene, i sølv og i gull */
export const OMRADER: Kolonner = {
  koord: { om: 'flaten klippet mot kommunegrensen, i UTM 33' },
  uklippet: { om: 'flaten kunne ikke klippes mot kommunegrensen, så arealet er regnet på en annen måte' },
  km2: { om: 'arealet av området i kommunen', enhet: 'km²' },
  under: { om: 'en kort beskrivelse, som i listen på siden' },
  url: { om: 'lenken til faktaarket hos Miljødirektoratet' },
  ext: { om: 'utsnittet rundt flaten, i UTM 33' },
  v: {
    om: 'verdikategorien',
    koder: koder(
      VERDI.klasser!.map(k => k[0]),
      0
    )
  }
};
