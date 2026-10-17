/* Forklaringene bak tallene: hvert kort på sidene som viser tall, med spørsmålet det svarer på, en kort forklaring, tabellene i gull
   det viser, og regnestykket for valgt kommune. Infoknappen på kortet (komponenter/Tallforklaring.tsx) og kapitlene i METODE.md
   (verktoy/forklaringer.ts) lages av det samme: kortet her, og forklaringen, usikkerheten og kilden på tabellene i katalogen.
   Hvilke tabeller hver tabell bygger på, er lest ut av koden (data/avhengigheter.ts).
   Filen bruker verken React eller kartet, så verktøyet kan lese den i Node. Regnestykket lager ingen nye tall: det setter tallene
   fra gull inn i tekst. */
import { AVHENGIGHETER } from '../data/avhengigheter.ts';
import type { Tabell, Tabelldef } from '../data/cache.ts';
import { katalog } from '../data/katalog.ts';
import { ruteKm2, ruteM } from '../data/solv/felles.ts';
import { GRAATRINN } from '../data/solv/graa.ts';
import { INONSONER } from '../data/solv/inon.ts';
import { NATURTEMA } from '../data/solv/temaer.ts';
import type { Temaet, TemaIPlan } from '../data/gull/temaer.ts';
import { dekar, medFortegn, nf, pst, ramse, stor } from './tekst.ts';

/* Henter verdien i en tabell i gull for valgt kommune, eller null når den ikke er klar */
export type Hent = <V>(t: Tabell<string, V>) => V | null;
/* Et kort: id (temaet eller id-en til overskriften), tittel, hvilket kapittel i METODE.md det står i (gruppe), hvilken side det står
   på (side) og hvilken fil komponenten står i, spørsmålet, kort fortalt, tabellene i gull det viser, egne forbehold, og regnestykket
   for valgt kommune. forklarer er tabeller kortet forklarer i tillegg til dem det viser: andre kort som bygger på dem, viser til
   dette kortet i stedet for å gjenta stegene. */
export interface Kort {
  id: string;
  tittel: string;
  gruppe: string;
  side: string;
  komponent: string;
  sporsmal: string;
  kortFortalt: string;
  tabeller: string[];
  forklarer?: string[];
  usikkerhet?: string[];
  regnestykke: (hent: Hent) => string[] | null;
}
/* Overskriften i METODE.md for hver gruppe, der kapitlet står */
export const GRUPPER: Record<string, string> = {
  ssb: 'SSB-tallene og utbredelsesregnskapet',
  plan: 'Planlagt utbygging',
  egne: 'Egne områder og opplastet plan',
  natur: 'Naturtemaene',
  inon: 'Inngrepsfri natur',
  graa: 'Grått areal'
};

/* Tall i hele dekar, med fortegn for endringer, antall, og arealet av en rute i m² */
const daa = (km2: number) => dekar(km2, 'dekar'),
  hele = (km2: number) => nf(Math.round(km2 * 1000), 0),
  pluss = (km2: number) => medFortegn(Math.round(km2 * 1000), v => nf(v, 0)),
  ant = (n: number) => nf(n, 0),
  m2 = (km2: number) => nf(km2 * 1e6, 0),
  prosent = (a: number | null) => `${pst(a)} %`;
/* Landarealet fra SSB, fra utbredelsen i gull */
const land = (hent: Hent) => {
  const U = hent(katalog.gull.utbredelse);
  return U ? U.land : null;
};
/* Summen av områdene i et tema: de største ved navn, og resten samlet */
function omradesum(T: Temaet, flertall: string) {
  const o = [...T.omrader].sort((a, b) => b.km2 - a.km2),
    vis = o.slice(0, 3).map(x => `${x.navn} ${hele(x.km2)}`),
    rest = o.length - vis.length;
  return `${o.length === 1 ? 'Ett område' : `${ant(o.length)} ${flertall}`}: ${ramse([...vis, rest > 0 && `${ant(rest)} til med ${hele(o.slice(3).reduce((s, x) => s + x.km2, 0))}`])} dekar. Til sammen ${daa(T.sum)}.`;
}
/* Planlagt utbygging i et tema, i ruter og dekar */
function iPlanen(I: TemaIPlan | null, best: string, flertall = 'områder') {
  if (!I) return [];
  const N = I.N,
    r = I.K.ruteKm2;
  return [
    N.plan
      ? `Planlagt utbygging innenfor ${best}: ${ant(N.plan)} ruter på ${m2(r)} m², altså ${daa(N.planKm2)}, i ${ant(N.berort)} av ${ant(I.omrader.length)} ${flertall}.`
      : `Ingen ruter med planlagt utbygging ligger innenfor ${best}.`,
    ...(N.smal ? [`I tillegg ${ant(N.smal)} ruter i smale striper, ${daa(N.smalKm2)}.`] : [])
  ];
}
/* Andelen av landarealet */
const avLand = (hent: Hent, andel: number | null) => {
  const L = land(hent);
  return L ? [`Av landarealet på ${daa(L)} er det ${prosent(andel)}.`] : [];
};

const NATUR = 'src/ui/komponenter/Naturtema.tsx',
  [VERN, REIN, VERDI] = NATURTEMA;

export const KORT: Kort[] = [
  {
    id: 'utbredelse',
    tittel: 'Utbredelsesregnskap',
    gruppe: 'ssb',
    side: 'regnskap',
    komponent: 'src/ui/komponenter/Regnskap.tsx',
    sporsmal: 'Hvor mye natur, jordbruk og bebygd areal har kommunen, og er det mer eller mindre natur enn i 2017?',
    kortFortalt:
      'Tallene er SSBs arealstatistikk. Natur, jordbruk og bebygd areal er SSBs arealklasser slått sammen til tre, og andelen er regnet av landarealet. Forskjellen fra 2017 er forskjellen mellom to årganger av statistikken, ikke målt endring.',
    tabeller: ['gull.utbredelse', 'gull.endring', 'gull.oppstilling'],
    regnestykke: hent => {
      const U = hent(katalog.gull.utbredelse);
      if (!U) return null;
      const k = (id: string) => U.klasser.find(x => x.id === id)!,
        n = k('nat');
      const linjer = [
        `Landarealet i ${U.aar} er ${daa(U.land)}: bebygd ${hele(k('beb').km2)}, jordbruk ${hele(k('jor').km2)} og natur ${hele(n.km2)} dekar.`,
        `Natur er ${hele(n.km2)} av ${hele(U.land)} dekar, altså ${prosent(n.andel)} av landarealet.`
      ];
      const O = hent(katalog.gull.oppstilling);
      if (O)
        linjer.push(
          `Natur var ${hele(O.inngaende[0])} dekar i ${O.fra} og ${hele(O.utgaende[0])} dekar i ${O.til}. Forskjellen er ${pluss(O.netto[0])} dekar.`
        );
      return linjer;
    }
  },
  {
    id: 'oppstilling',
    tittel: 'Regnskapsoppstilling',
    gruppe: 'ssb',
    side: 'regnskap',
    komponent: 'src/ui/komponenter/Regnskap.tsx',
    sporsmal: 'Hvor mye areal hadde hver klasse i 2017 og nå, satt opp som et regnskap?',
    kortFortalt:
      'Regnskapet følger mønsteret fra FNs standard for naturregnskap (SEEA EA): areal ved start, netto endring og areal ved slutt. Tallene er SSBs arealstatistikk for 2017 og nyeste år. Regnskapet gjelder landarealet, så vann er ikke med.',
    tabeller: ['gull.oppstilling'],
    usikkerhet: [
      'Planlagt utbygging er ikke med i regnskapet, som viser arealet fram til i dag. Den omtales under regnskapet.'
    ],
    regnestykke: hent => {
      const O = hent(katalog.gull.oppstilling);
      if (!O) return null;
      const linjer = O.kolonner.map(
        (navn, j) =>
          `${navn}: ${hele(O.inngaende[j])} ${O.netto[j] < 0 ? '−' : '+'} ${hele(Math.abs(O.netto[j]))} = ${hele(O.utgaende[j])} dekar.`
      );
      if (O.avvik)
        linjer.push(
          `Landarealet er ${nf(Math.abs(O.avvik), 0)} dekar ${O.avvik > 0 ? 'større' : 'mindre'} i ${O.til}.`
        );
      return linjer;
    }
  },
  {
    id: 'landOgVann',
    tittel: 'Land og vann',
    gruppe: 'ssb',
    side: 'regnskap',
    komponent: 'src/ui/komponenter/Regnskap.tsx',
    sporsmal: 'Hvordan fordeler kommunens flate seg på land, innsjø, elv og hav?',
    kortFortalt:
      'Land, innsjø og elv er SSBs tall. Hav er det som blir igjen når de trekkes fra kommunens flate, som er arealet innenfor kommunegrensen fra Kartverket.',
    tabeller: ['gull.landOgVann'],
    regnestykke: hent => {
      const V = hent(katalog.gull.landOgVann);
      if (!V) return null;
      const del = (id: string) => (V.deler.find(d => d[0] === id) || [0, 0, 0])[2];
      return [
        `Kommunens flate er ${daa(V.flate)}.`,
        `Land ${hele(del('land'))}, innsjø ${hele(del('inn'))} og elv ${hele(del('elv'))} dekar er SSBs tall.`,
        V.hav
          ? `Hav er det som blir igjen: ${daa(V.hav)}.`
          : `Det som blir igjen, ${daa(V.rest)}, er under grensen på 0,5 km² eller 0,5 % av flaten. Det regnes som avvik mellom grense og statistikk, og kommunen vises uten hav.`
      ];
    }
  },
  {
    id: 'planlagt',
    tittel: 'Planlagt utbygging',
    gruppe: 'plan',
    side: 'framtid',
    komponent: 'src/ui/komponenter/Framtid.tsx',
    sporsmal: 'Hvor mye natur og jordbruk setter kommuneplanen av til utbygging?',
    kortFortalt:
      'Kommuneplanen fra DiBK legges oppå dagens arealklasser fra NIBIO i et rutenett, med ruter på 21 meter. Ruter som i dag er natur eller jordbruk, og som planen setter av til bebyggelse, anlegg eller samferdsel, telles. Smale striper, som oftest kommer av at grensene ikke er tegnet helt likt, tas bort.',
    tabeller: ['gull.kommuneplan', 'gull.planlagt'],
    forklarer: ['gull.utbygging', 'gull.dagensKlasser', 'solv.planinfo'],
    usikkerhet: ['Tallene er anslag til illustrasjon, ikke offisiell statistikk.'],
    regnestykke: hent => {
      const R = hent(katalog.gull.utbygging);
      if (!R) return null;
      const r = ruteKm2(R.z),
        linje = (navn: string, uten: number, med: number, iDag: number, ordet: string) =>
          `${navn}: ${ant(uten)} ruter uten smale striper, altså ${daa(uten * r)}. Det er ${prosent(iDag ? (uten / iDag) * 100 : null)} av de ${ant(iDag)} rutene som er ${ordet} i dag. Med smale striper ${ant(med)} ruter, ${daa(med * r)}.`;
      return [
        `Rutene er ${nf(ruteM(R.z))} meter, så hver rute er ${m2(r)} m².`,
        linje('Natur', R.sum.rn, R.n.pnat, R.n.nat, 'natur'),
        linje('Jordbruk', R.sum.rj, R.n.pjor, R.n.jor, 'jordbruk'),
        ...(R.delvis ? ['Bare den delen av kommunen nettleseren har hentet kart for, er med.'] : []),
        ...(R.antallEgne ? ['Egne områder er med i tallene.'] : [])
      ];
    }
  },
  {
    id: 'egne',
    tittel: 'Egne områder',
    gruppe: 'egne',
    side: 'framtid',
    komponent: 'src/ui/komponenter/Egne.tsx',
    sporsmal:
      'Hva skjer med natur og jordbruk om et område bygges ut, eller tas ut av planen? Og hva tar en opplastet plan sammenlignet med kommuneplanen?',
    kortFortalt:
      'Et område du tegner eller laster opp, erstatter kommuneplanen innenfor flatene: som utbygging tar det all natur og alt jordbruk i ruta, og som ikke utbygging fjerner det planen setter av der. Utbyggingen regnes både med og uten egne områder, og tabellen viser forskjellen.',
    tabeller: ['gull.egneRader'],
    forklarer: ['solv.egneruter'],
    usikkerhet: [
      'Områder smalere enn rundt 40 meter faller for regelen om smale striper og gir ikke utslag. Funksjonen passer derfor for kommuneplannivå, ikke for reguleringsplaner.'
    ],
    regnestykke: hent => {
      const E = hent(katalog.gull.egneRader);
      if (!E) return null;
      return E.kommune
        .filter(r => r.navn === 'Natur' || r.navn === 'Jordbruk' || r.navn === 'Grått areal')
        .map(r =>
          r.plan === null
            ? `${r.navn}: ${daa(r.ny)} med egne områder. Kommunen har ingen kommuneplan hos DiBK å sammenligne med.`
            : `${r.navn}: kommuneplanen alene ${hele(r.plan)} dekar, med egne områder ${hele(r.ny)} dekar. Endringen er ${pluss(r.endring)} dekar.`
        );
    }
  },
  {
    id: 'vern',
    tittel: VERN.navn,
    gruppe: 'natur',
    side: 'vern',
    komponent: NATUR,
    sporsmal: 'Hvor mye av kommunen er verneområder, og hvor mye planlagt utbygging ligger innenfor?',
    kortFortalt:
      'Verneområdene kommer fra Miljødirektoratet. Hvert område klippes mot kommunegrensen, og arealet i kommunen er summen av områdene. Planlagt utbygging innenfor er rutene i utbyggingen som ligger i et verneområde.',
    tabeller: ['gull.verneomrader', 'gull.verneomraderIPlan'],
    regnestykke: hent => {
      const T = hent(katalog.gull.verneomrader);
      if (!T || !T.antall) return null;
      return [
        omradesum(T, 'verneområder'),
        ...avLand(hent, T.andelLand),
        ...iPlanen(hent(katalog.gull.verneomraderIPlan), 'verneområdene')
      ];
    }
  },
  {
    id: 'rein',
    tittel: REIN.navn,
    gruppe: 'natur',
    side: 'rein',
    komponent: NATUR,
    sporsmal: 'Hvor mye av kommunen er leveområder for villrein, og hvor mye planlagt utbygging ligger innenfor?',
    kortFortalt:
      'Leveområdene for villrein kommer fra Miljødirektoratet. Hvert område klippes mot kommunegrensen, og arealet i kommunen er summen av områdene. Planlagt utbygging innenfor er rutene i utbyggingen som ligger i et villreinområde.',
    tabeller: ['gull.villrein', 'gull.villreinIPlan'],
    regnestykke: hent => {
      const T = hent(katalog.gull.villrein);
      if (!T || !T.antall) return null;
      return [
        omradesum(T, 'villreinområder'),
        ...avLand(hent, T.andelLand),
        ...iPlanen(hent(katalog.gull.villreinIPlan), 'villreinområdene')
      ];
    }
  },
  {
    id: 'verdi',
    tittel: VERDI.navn,
    gruppe: 'natur',
    side: 'verdi',
    komponent: NATUR,
    sporsmal:
      'Hvor mye verdsatt natur er registrert i kommunen, hvor mye av kommunen er kartlagt, og hvor mye planlagt utbygging ligger i verdsatt natur eller der det ikke er kartlagt?',
    kortFortalt:
      'Lokalitetene er naturtyper med verdi fra Miljødirektoratet. Arealet regnes i et rutenett over kommunen, der overlapp teller én gang, med den høyeste verdien. Kartleggingen viser hvor stor del av landarealet som er kartlagt etter Miljødirektoratets instruks. Utenfor det kartlagte vet vi lite.',
    tabeller: [
      'gull.verdsattNatur',
      'gull.verdsattNaturKartlagt',
      'gull.verdsattNaturIPlan',
      'gull.utbyggingUtenforKartlagt'
    ],
    regnestykke: hent => {
      const T = hent(katalog.gull.verdsattNatur);
      if (!T || !T.antall || !T.perKlasse) return null;
      const linjer = [
        `${stor(ramse(VERDI.klasser!.map(([navn], v) => `${navn.toLowerCase()} ${hele(T.perKlasse![v].km2)}`)))} dekar. Til sammen ${daa(T.sum)} i ${ant(T.antall)} lokaliteter.`,
        ...avLand(hent, T.andelLand)
      ];
      const K = hent(katalog.gull.verdsattNaturKartlagt);
      if (K && K.kartlagt && K.kartlagt.km2 > 0)
        linjer.push(
          `Kartlagt etter instruksen: ${daa(K.kartlagt.km2)}, ${prosent(K.kartlagt.andelLand)} av landarealet.`
        );
      linjer.push(...iPlanen(hent(katalog.gull.verdsattNaturIPlan), 'lokalitetene', 'lokaliteter'));
      const G = hent(katalog.gull.utbyggingUtenforKartlagt);
      if (G && G.nat)
        linjer.push(
          `Av ${daa(G.natKm2)} planlagt utbygging på natur ligger ${daa(G.ukjentKm2)} (${prosent(G.andel)}) der det ikke er kartlagt.`
        );
      return linjer;
    }
  },
  {
    id: 'inon',
    tittel: 'Inngrepsfri natur',
    gruppe: 'inon',
    side: 'inon',
    komponent: 'src/ui/komponenter/Inon.tsx',
    sporsmal:
      'Hvor mye av kommunen ligger minst én kilometer fra tyngre tekniske inngrep, som veier, kraftlinjer og regulerte vassdrag?',
    kortFortalt:
      'Sonene kommer fra Miljødirektoratets kart over inngrepsfri natur, hentet i biter med ruter på 10,6 meter, like store i alle kommuner. Rutene i kommunen telles per sone og regnes om til areal. Inngrepsfri natur krysses ikke med planlagt utbygging.',
    tabeller: ['gull.inon'],
    usikkerhet: [
      'Tallet krysses ikke med planlagt utbygging. Sonene følger avstanden til nærmeste inngrep, så et nytt inngrep flytter sonegrensene flere kilometer unna, også når det ikke ligger i en sone selv.',
      'I kartet får bare klassen natur sonefarge.'
    ],
    regnestykke: hent => {
      const I = hent(katalog.gull.inon);
      if (!I || I.tilstand !== 'ok') return null;
      return [
        `${stor(ramse(INONSONER.map((s, i) => `${s[4].toLowerCase()} ${hele(I.soner[i])}`)))} dekar, hver avrundet til nærmeste 10 dekar. Til sammen ${daa(I.sum)}.`,
        ...avLand(hent, I.andelLand)
      ];
    }
  },
  {
    id: 'graa',
    tittel: 'Grått areal',
    gruppe: 'graa',
    side: 'graa',
    komponent: 'src/ui/komponenter/Graa.tsx',
    sporsmal:
      'Hvor mye av kommunen er alt tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet, hvor mye vegetasjon er det der, og hvor mye av planlagt utbygging ligger på slikt areal?',
    kortFortalt:
      'Grått areal kommer fra Kart over grå arealer, hentet i biter med ruter på 10,6 meter, like store i alle kommuner. Rutene i kommunen telles etter hvor stor del av flaten som er vegetasjon, og regnes om til areal. Planlagt utbygging på grått areal er gjenbruk av areal som alt er tatt i bruk.',
    tabeller: ['gull.graa', 'gull.graaIPlan'],
    forklarer: ['gull.graakryss'],
    regnestykke: hent => {
      const G = hent(katalog.gull.graa);
      if (!G || G.tilstand !== 'ok') return null;
      const linjer = [
        `Etter andel vegetasjon: ${ramse([...GRAATRINN.map(([, navn], i) => `${navn.replace(' vegetasjon', '').toLowerCase()} ${hele(G.trinn[i + 1])}`), G.trinn[6] > 0 && `uten oppgitt andel ${hele(G.trinn[6])}`])} dekar, hvert avrundet til nærmeste 10 dekar. Til sammen ${daa(G.sum)}.`,
        ...avLand(hent, G.andelLand)
      ];
      const I = hent(katalog.gull.graaIPlan),
        P = I && I.plan;
      if (P)
        linjer.push(
          `Av ${daa(P.km2)} planlagt utbygging på land ligger ${daa(P.graa)} på grått areal, altså ${prosent(P.andelGraa)}. Av dette har ${daa(P.gron)} minst halvparten vegetasjon.`
        );
      return linjer;
    }
  }
];

/* Tabellen med det fulle navnet (som solv.arealtall) */
const LAG = ['bronse', 'solv', 'gull'] as const;
export function tabellen(navn: string): Tabelldef<unknown, unknown> {
  const [lag, t] = navn.split('.') as [(typeof LAG)[number], string];
  return (katalog[lag] as unknown as Record<string, Tabelldef<unknown, unknown>>)[t];
}
/* Kortet som forklarer tabellen: det første kortet som viser den eller forklarer den */
const eier = (navn: string) => KORT.find(k => k.tabeller.includes(navn) || (k.forklarer || []).includes(navn));
const egne = (k: Kort) => [...k.tabeller, ...(k.forklarer || [])];

/* Et steg fra kilde til tall: tabellen, og kortet som forklarer den når det er et annet kort (se) */
export interface Steg {
  navn: string;
  tabell: Tabelldef<unknown, unknown>;
  se?: Kort;
}
/* Stegene fra kilde til tall for kortet: tabellene kortet viser og forklarer, og alt de bygger på, kildene først, så sølv og gull.
   Innenfor hvert lag i den rekkefølgen de blir brukt. En tabell et annet kort forklarer, står som ett steg med en henvisning, uten
   det den bygger på. Tekniske steg (teknisk i katalogen) står ikke med, se tekniskeFor. */
function gjennomgang(k: Kort) {
  const sett = new Set<string>(),
    alle: string[] = [],
    egen = egne(k);
  const besok = (n: string) => {
    if (sett.has(n)) return;
    sett.add(n);
    const e = eier(n);
    if (egen.includes(n) || !e) for (const d of AVHENGIGHETER[n] || []) besok(d);
    alle.push(n);
  };
  egen.forEach(besok);
  const lag = (n: string) => LAG.indexOf(n.split('.')[0] as (typeof LAG)[number]);
  return alle.sort((a, b) => lag(a) - lag(b));
}
export function stegFor(k: Kort): Steg[] {
  const egen = egne(k);
  return gjennomgang(k)
    .filter(n => !tabellen(n).teknisk)
    .map(n => {
      const e = eier(n);
      return { navn: n, tabell: tabellen(n), se: e && !egen.includes(n) ? e : undefined };
    });
}
/* Et steg i infoboksen: en kilde i bronse med sølvtabellene som justerer den (hentes fra … og justeres til …), eller ett steg for
   seg */
export type Infosteg = { kilde: Steg; justeres: Steg[] } | { steg: Steg };
/* Stegene for kortet, med hver kilde i bronse og sølvtabellene som leser den slått sammen til ett steg. En sølvtabell hører til
   kilden når den leser nøyaktig én kilde med eier (kilde i katalogen) blant stegene. Ellers hører den til samme kilde som
   sølvtabellen den bygger på (kommunegrensen ikke medregnet), som arealet av verdsatt natur. Ellers, når den leser nøyaktig én
   kilde uten eier, som egne områder, til den. Resten står som før, hver for seg, i samme rekkefølge. */
export function infostegFor(k: Kort): Infosteg[] {
  const S = stegFor(k),
    her = new Map(S.filter(s => !s.se).map(s => [s.navn, s])),
    kilder = new Map<string, Steg[]>() /* kilden i bronse: sølvtabellene som justerer den */,
    hører = new Map<string, string>(); /* sølvtabellen: kilden den hører til */
  for (const s of S) {
    if (s.se || !s.navn.startsWith('solv.')) continue;
    const deps = AVHENGIGHETER[s.navn] || [],
      bronse = deps.filter(d => d.startsWith('bronse.') && her.has(d)),
      medEier = bronse.filter(d => her.get(d)!.tabell.kilde),
      forelder = deps.find(d => d !== 'solv.grense' && hører.has(d)),
      b =
        medEier.length === 1
          ? medEier[0]
          : forelder
            ? hører.get(forelder)
            : bronse.length === 1
              ? bronse[0]
              : undefined;
    if (!b) continue;
    hører.set(s.navn, b);
    kilder.set(b, [...(kilder.get(b) || []), s]);
  }
  return S.flatMap((s): Infosteg[] => {
    if (hører.has(s.navn)) return [];
    const j = kilder.get(s.navn);
    return j ? [{ kilde: s, justeres: j }] : [{ steg: s }];
  });
}
/* De tekniske stegene for kortet: oppslag, lagrede svar og hjelpetabeller som ikke endrer tallene */
export const tekniskeFor = (k: Kort) => gjennomgang(k).filter(n => tabellen(n).teknisk);
/* Forbeholdene for kortet: kortets egne og stegenes, hvert én gang. Steg et annet kort forklarer, har forbeholdene der. */
export const usikkerhetFor = (k: Kort) => [
  ...new Set([
    ...(k.usikkerhet || []),
    ...stegFor(k)
      .filter(s => !s.se)
      .flatMap(s => s.tabell.usikkerhet || [])
  ])
];
/* Kortet med id-en */
export const kortet = (id: string) => KORT.find(k => k.id === id)!;
/* Repoet på GitHub, der METODE.md og koden kan leses */
export const REPO = 'https://github.com/eirikvk/Publicdemorepo/blob/main/';
/* Ankeret GitHub gir en overskrift i METODE.md: små bokstaver, uten tegnsetting, og bindestrek for mellomrom */
export const anker = (overskrift: string) =>
  overskrift
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
/* Ankeret for kortet i METODE.md: kortets egen overskrift når kapitlet har flere kort, ellers kapitlet */
export const ankerFor = (k: Kort) =>
  anker(KORT.filter(x => x.gruppe === k.gruppe).length > 1 ? k.tittel : GRUPPER[k.gruppe]);
