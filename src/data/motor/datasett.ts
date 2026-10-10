/* Datasettene: alt datapipelinen lagrer, samlet her. Hvert datasett står i katalogen (katalog.ts) med navn, nøkkel, hvor mange
   nøkler som huskes, og oppskriften som lager det. Navnet sier hvilket lag verdien kommer fra:
     bronse.  svaret fra kilden, slik det kom (bilder) eller i felles form rett fra bronse (kommunelisten)
     solv.    tolket til felles standard: flater i UTM33, ruter i et rutenett, tall fra SSB
     gull.    regnet ut, når det er tungt nok til å være verdt å huske
   Det som er raskt å regne ut, lagres ikke: det regnes ut når visningen spør, se gulldata.ts.

   Hva som lagres: svar fra kildene lagres i formen de brukes i. Rå svar lagres når de brukes slik de er (kartbildene), eller når de
   tar mye mindre plass enn det tolkede (bildene av hele kommunen, som PNG). Grensene er satt så omtrent like mye huskes som før
   katalogen kom: noen få kommuner av det som er stort, flere av det som er lite.

   Oppskriftene bruker bare ETL-koden (bronse, sølv og gull) og andre datasett. De vet ingenting om valgt kommune eller om visningen,
   så de kan kjøres for en hvilken som helst kommune. Nøkkelen er kommunenummeret der ikke annet står. */
import type { Planopplysninger } from '../bronse/dibk-kommuneplan.ts';
import { hentKommuneplanFlis, hentPlandekning, hentPlaninfo } from '../bronse/dibk-kommuneplan.ts';
import { hentKommunegrense, hentKommuneliste } from '../bronse/kartverket.ts';
import { hentInonBilde } from '../bronse/mdir-inon.ts';
import { hentKartlagt, hentTemaflater } from '../bronse/mdir-naturtema.ts';
import { hentGraaBilde, hentGraaFlis } from '../bronse/nibio-graa.ts';
import {
  FLISNIVA,
  hentGrunnkartFlis,
  hentOversiktsbilde,
  hentOversiktsregister,
  type Oversiktsregister
} from '../bronse/nibio-grunnkart.ts';
import { hentArealtall, hentTidsserie } from '../bronse/ssb.ts';
import { flerflate, utsnitt, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import {
  BILDE_PLANDEKNING,
  BILDE_TEMA,
  OPPLOSNINGER,
  arealKm2,
  m2PerKm2,
  rutenett,
  type Fylke,
  type Kommune,
  type Rutebilde
} from '../solv/felles.ts';
import { tolkGraa } from '../solv/graa.ts';
import { tolkInon } from '../solv/inon.ts';
import { planDekning, type Blokk, type Planrutenett } from '../solv/planrutenett.ts';
import { bildePiksler, flatePiksler } from '../solv/raster.ts';
import { tolkAreal, tolkHistorie, type Arealtall, type Historie } from '../solv/ssb.ts';
import { EGENSKAPER, byggDekning, klippNatur, lokaliteter, type Kartlagt, type Maske } from '../solv/temaer.ts';
import { kryssGraa, type Graakryss } from '../gull/graa.ts';
import { klasseAreal, kryssNatur, samletAreal, type Kryssing, type TemaOmrade } from '../gull/temaer.ts';
import { datasett, glem, hent, hentStraks } from './katalog.ts';
import type { Naturtema } from './naturtema.ts';
import { tidSlutt, varsle } from './tilstand.ts';

/* ---------- Kommunene ---------- */

export const KOMMUNER = datasett<string, Fylke[]>({
  navn: 'bronse.kommuner',
  om: 'fylkene og kommunene, sortert etter navn',
  husk: 1,
  lag: async () => {
    const fylker = await hentKommuneliste();
    fylker.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
    fylker.forEach(f => f.kommuner.sort((a, b) => a.navn.localeCompare(b.navn, 'nb')));
    return fylker;
  }
});
/* Kommunen med nummeret nr, fra listen */
async function kommunen(nr: string): Promise<Kommune> {
  for (const f of await hent(KOMMUNER, '')) for (const k of f.kommuner) if (k.nr === nr) return k;
  throw new Error(`fant ikke kommune ${nr}`);
}

/* Kommunegrensen: flerflaten i UTM33, utsnittet og flaten i km² (land og vann) */
export interface Grense {
  nr: string;
  koord: Flerflate;
  ext: Utsnitt;
  km2: number;
}
export const GRENSE = datasett<string, Grense>({
  navn: 'solv.grense',
  om: 'kommunegrensen fra Kartverket som flerflate i UTM33, med utsnitt og flate i km²',
  husk: 6,
  lag: async nr => {
    const koord = flerflate(await hentKommunegrense(await kommunen(nr))),
      ext = utsnitt(koord);
    return { nr, koord, ext, km2: arealKm2(koord, ext) /* rettet for målestokken i UTM */ };
  }
});

/* ---------- SSB ---------- */

export const AREALTALL = datasett<string, Arealtall>({
  navn: 'solv.arealtall',
  om: 'arealet per klasse fra SSB i nyeste år, med landareal, innsjø og elv',
  husk: 6,
  lag: async nr => tolkAreal(await hentArealtall(await kommunen(nr)))
});
export const HISTORIE = datasett<string, Historie | null>({
  navn: 'solv.historie',
  om: 'arealet per klasse fra SSB i 2017 og i nyeste år',
  husk: 6,
  lag: async nr => tolkHistorie(await hentTidsserie(await kommunen(nr)), nr)
});

/* ---------- Dagens klasser: grunnkartet fra NIBIO ---------- */

export const GRUNNKARTFLIS = datasett<string, ArrayBuffer>({
  navn: 'bronse.grunnkartflis',
  om: 'kartbilder av dagens arealklasser fra NIBIO, 512 x 512 piksler. Nøkkel: adressen.',
  husk: 400,
  lag: hentGrunnkartFlis
});
export const OVERSIKTSREGISTER = datasett<string, Oversiktsregister | null>({
  navn: 'bronse.oversiktsregister',
  om: 'kommunene som har lagret oversiktsbilde, og utsnittet hvert bilde dekker',
  husk: 1,
  lag: () => hentOversiktsregister().catch(() => null) /* uten registeret brukes det sammensatte kartet */
});
/* Dagens klasser zoomet ut: det lagrede oversiktsbildet (buf, som PNG), eller det sammensatte kartet (lerret, dynamisk). ext er
   utsnittet bildet dekker, og res meter per piksel. */
export interface Oversikt {
  ext: Utsnitt;
  res: number;
  buf?: ArrayBuffer;
  lerret?: HTMLCanvasElement;
  dynamisk?: boolean;
}
export const OVERSIKTSBILDE = datasett<string, Oversikt>({
  navn: 'bronse.oversiktsbilde',
  om: 'det lagrede oversiktsbildet av kommunen som PNG, med utsnittet og meter per piksel',
  husk: 6,
  lag: async nr => {
    const reg = await hent(OVERSIKTSREGISTER, ''),
      ext = reg && reg.kommuner && reg.kommuner[nr];
    if (!ext) throw new Error('ingen lagret oversikt');
    const buf = await hentOversiktsbilde(await kommunen(nr));
    return { buf, ext, res: (ext[2] - ext[0]) / new DataView(buf).getUint32(16) /* bredden i PNG-hodet */ };
  }
});
export const OVERSIKT_LEST = datasett<string, ImageBitmap>({
  navn: 'solv.oversiktsbilde',
  om: 'det lagrede oversiktsbildet lest inn som bilde, til dagens klasser zoomet ut',
  husk: 1,
  lag: async nr => createImageBitmap(new Blob([(await hent(OVERSIKTSBILDE, nr)).buf!]))
});
/* Det sammensatte kartet: lerretet (c) med klassene i rene farger, meter per piksel, utsnittet det dekker, og flisene som er lagt
   inn, som «nivå/x/y». ov er det samme som Oversikt, til kartet og utregningene. */
export interface Samling {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  res: number;
  ext: Utsnitt;
  har: Set<string>;
  ov: Oversikt;
}
export const SAMMENSATT = datasett<string, Samling>({
  navn: 'solv.sammensatt',
  om: 'dagens klasser satt sammen av kartbildene som er hentet, for kommuner uten lagret oversiktsbilde. Fylles på etter hvert.',
  husk: 4,
  voksende: true,
  lag: async nr => {
    const e = (await hent(GRENSE, nr)).ext,
      res = Math.max(OPPLOSNINGER[FLISNIVA] / 2, Math.max(e[2] - e[0], e[3] - e[1]) / 2048),
      c = document.createElement('canvas');
    c.width = Math.ceil((e[2] - e[0]) / res);
    c.height = Math.ceil((e[3] - e[1]) / res);
    const ext: Utsnitt = [e[0], e[3] - c.height * res, e[0] + c.width * res, e[3]];
    return {
      c,
      g: c.getContext('2d', { willReadFrequently: true })!,
      res,
      ext,
      har: new Set<string>(),
      ov: { lerret: c, ext, res, dynamisk: true }
    };
  },
  glemt: s => {
    s.c.width = 0;
    varsle('samlingFjernet', s.c);
  }
});

/* ---------- Kommuneplanen fra DiBK, og planrutenettet ---------- */

export const PLANFLIS = datasett<string, ArrayBuffer>({
  navn: 'bronse.planflis',
  om: 'kartbilder av kommuneplanen fra DiBK, 512 x 512 piksler. Nøkkel: adressen.',
  husk: 400,
  lag: hentKommuneplanFlis
});
/* Om DiBK har kommuneplanen: hvor stor del av kommunen planlaget dekker, om det regnes som at kommunen har plan, og hvilken plan */
export interface Planinfo {
  finnes: boolean;
  dekning: number;
  plan: Planopplysninger | null;
}
export const PLANINFO = datasett<string, Planinfo>({
  navn: 'solv.planinfo',
  om: 'om DiBK har kommuneplanen: hvor stor del av kommunen planlaget dekker, og hvilken plan det er',
  husk: 6,
  lag: async nr => {
    const k = await kommunen(nr),
      g = await hent(GRENSE, nr),
      R = rutenett(g.ext, ...BILDE_PLANDEKNING),
      { w, h, u } = R;
    const buf = await hentPlandekning(k, u, w, h),
      { dekning, finnes, treff } = planDekning(await bildePiksler(buf, w, h), flatePiksler(g.koord, R));
    let plan = null;
    if (finnes)
      try {
        const q = treff[treff.length >> 1]; /* ett oppslag midt i det dekkede området */
        plan = await hentPlaninfo(k, u, w, h, q % w, Math.floor(q / w));
      } catch (e) {}
    return { finnes, dekning, plan };
  }
});
/* Planrutenettet regnes ut i blokker på 512 x 512 ruter, én per flis på nivå 9, og settes sammen. Motoren legger blokkene og
   rutenettet inn selv (plan.ts), fordi de regnes ut på nytt når det kommer mer kart. egneIder er de egne områdene rutenettet er
   regnet med, i rekkefølge. */
export const PLANBLOKKER = datasett<string, Map<string, Blokk>>({
  navn: 'solv.planblokker',
  om: 'planrutenettet i blokker på 512 x 512 ruter, én per flis på nivå 9. Fylles på etter hvert.',
  husk: 1,
  voksende: true
});
export type Rutenettet = Planrutenett & { egneIder: number[] };
export const PLANRUTENETT = datasett<string, Rutenettet>({
  navn: 'solv.planrutenett',
  om: 'kommuneplanen og egne områder lagt oppå dagens klasser, med smale striper tatt bort. Regnes på nytt når det kommer mer kart.',
  husk: 1
});

/* ---------- Inngrepsfri natur og grått areal: bilder av hele kommunen ---------- */

/* Et bilde av hele kommunen tolket til ruter: rutenettet, kommunen (nr), antall ruter per klasse innenfor kommunen (n), og skala
   (m2PerKm2 for kommunen), så arealet kan regnes ut */
export type Kommuneruter<E> = Rutebilde & { nr: string; n: ArrayLike<number>; skala: number } & E;
export type InonRuter = Kommuneruter<{ sone: Uint8Array }>;
export type GraaRuter = Kommuneruter<{ kl: Uint8Array }>;
/* Rutenettet bildene av kommunen hentes og tolkes i */
const bildenett = async (nr: string) => rutenett((await hent(GRENSE, nr)).ext, ...BILDE_TEMA);
/* Bildene b tolket med tolk, sammen med kommunens flate, i rutenettet for kommunen nr. navn står i tidtakingen. */
async function tolketBilde<E>(
  nr: string,
  b: ArrayBuffer[],
  navn: string,
  tolk: (bilder: ArrayLike<number>[], maske: ArrayLike<number>) => { n: ArrayLike<number> } & E
): Promise<Kommuneruter<E>> {
  const g = await hent(GRENSE, nr),
    R = rutenett(g.ext, ...BILDE_TEMA),
    t0 = performance.now(),
    P: ArrayLike<number>[] = [];
  for (const x of b) P.push(await bildePiksler(x, R.w, R.h));
  const S = tolk(P, flatePiksler(g.koord, R));
  tidSlutt(navn + ', kommunebilde', t0);
  return { ...R, ...S, nr, skala: m2PerKm2(g.ext) };
}

export const INONBILDE = datasett<string, ArrayBuffer>({
  navn: 'bronse.inonbilde',
  om: 'bildet av inngrepsfri natur over hele kommunen fra Miljødirektoratet, som PNG',
  husk: 6,
  lag: async nr => {
    const R = await bildenett(nr);
    return hentInonBilde(await kommunen(nr), R.u, R.w, R.h);
  }
});
export const INON = datasett<string, InonRuter>({
  navn: 'solv.inon',
  om: 'sonen per rute i bildet av kommunen, og antall ruter per sone innenfor kommunen',
  husk: 3,
  lag: async nr => tolketBilde(nr, [await hent(INONBILDE, nr)], 'inngrepsfri natur', ([P], M) => tolkInon(P, M))
});
export const GRAABILDER = datasett<string, ArrayBuffer[]>({
  navn: 'bronse.graabilder',
  om: 'de to bildene av grått areal over hele kommunen fra NIBIO, som PNG: alt grått areal, og flatene med oppgitt andel vegetasjon',
  husk: 6,
  lag: async nr => {
    const k = await kommunen(nr),
      R = await bildenett(nr);
    return Promise.all([hentGraaBilde(k, 0, R.u, R.w, R.h), hentGraaBilde(k, 1, R.u, R.w, R.h)]);
  }
});
export const GRAA = datasett<string, GraaRuter>({
  navn: 'solv.graa',
  om: 'trinnet per rute i bildet av kommunen, og antall ruter per trinn innenfor kommunen',
  husk: 3,
  lag: async nr => tolketBilde(nr, await hent(GRAABILDER, nr), 'grått areal', ([P, V], M) => tolkGraa(P, V, M))
});
export const GRAAFLIS = datasett<string, ArrayBuffer>({
  navn: 'bronse.graaflis',
  om: 'kartbilder av grått areal fra NIBIO, 512 x 512 piksler, til kartlaget. Nøkkel: adressen.',
  husk: 400,
  lag: hentGraaFlis
});
/* Planlagt utbygging krysset med grått areal, for planrutenettet R. utgaver er utgavene av planrutenettet og grått areal, så
   nøkkelen sier hva kryssingen er regnet ut av. */
export const GRAAKRYSS = datasett<{ nr: string; R: Planrutenett; utgaver: number[] }, Graakryss>({
  navn: 'gull.graakryss',
  om: 'planlagt utbygging krysset med grått areal. Nøkkel: kommunen@utgavene av planrutenettet og grått areal.',
  husk: 2,
  nokkel: x => `${x.nr}@${x.utgaver.join('.')}`,
  lag: async x => {
    const D = await hent(GRAA, x.nr),
      t0 = performance.now(),
      K = kryssGraa(x.R, D, x.R.delvis);
    tidSlutt('grått areal, kryssing', t0);
    return K;
  }
});

/* ---------- Naturtemaene fra Miljødirektoratet ---------- */

/* Et naturtema i en kommune. Nøkkelen er «tema/kommune», som «verdi/5001». */
export interface Temanokkel {
  tema: Naturtema;
  nr: string;
}
const temanokkel = (x: Temanokkel) => `${x.tema.id}/${x.nr}`;
export const TEMAOMRADER = datasett<Temanokkel, { omrader: TemaOmrade[]; ufullstendig?: boolean }>({
  navn: 'solv.temaomrader',
  om: 'områdene i hvert naturtema med areal og opplysninger, klippet mot kommunen (verdsatt natur uklippet). Nøkkel: tema/kommune.',
  husk: 90,
  nokkel: temanokkel,
  lag: async ({ tema, nr }) => {
    const j = await hentTemaflater(tema.id, tema.navn, await kommunen(nr));
    if (!j || !Array.isArray(j.features)) throw new Error('uventet svar');
    const g = await hent(GRENSE, nr),
      les = EGENSKAPER[tema.id],
      alle = tema.samlet ? lokaliteter(j.features, g, les) : klippNatur(j.features, g, les),
      omrader = alle.map(o => ({ ...o, ext: utsnitt(o.koord) }));
    return tema.samlet ? { omrader, ufullstendig: !!j.exceededTransferLimit } : { omrader };
  },
  glemt: (_, k) => glem(TEMAMASKE, x => x.startsWith(k + '/'))
});
export const TEMAAREAL = datasett<Temanokkel, { sum: number; klasser?: number[] | null }>({
  navn: 'gull.temaareal',
  om: 'arealet av hvert naturtema i kommunen, samlet og per verdikategori. Nøkkel: tema/kommune.',
  husk: 90,
  nokkel: temanokkel,
  lag: async ({ tema, nr }) => {
    const { omrader } = await hent(TEMAOMRADER, { tema, nr });
    if (!tema.samlet) return { sum: samletAreal(omrader) };
    const r = klasseAreal(omrader, tema.klasser ? tema.klasser.length : 1, await hent(GRENSE, nr));
    return { sum: r.sum, klasser: tema.klasser ? r.klasser : null };
  }
});
export const KARTLAGT = datasett<string, Kartlagt>({
  navn: 'solv.kartlagt',
  om: 'det som er kartlagt for naturtyper etter Miljødirektoratets instruks, klippet mot kommunen',
  husk: 30,
  lag: async nr => {
    const g = await hent(GRENSE, nr),
      j = await hentKartlagt(await kommunen(nr), g.ext);
    return byggDekning(j.features || [], g);
  },
  glemt: (_, k) => glem(TEMAMASKE, x => x === 'kartlagt/' + k)
});
export const TEMAINNE = datasett<Temanokkel, number[] | null>({
  navn: 'gull.temainne',
  om: 'verdsatt natur per verdikategori innenfor det kartlagte. Nøkkel: tema/kommune.',
  husk: 30,
  nokkel: temanokkel,
  lag: async ({ tema, nr }) => {
    const v = await hent(KARTLAGT, nr);
    if (!tema.klasser || !v.flate || !v.flate.length) return null;
    const { omrader } = await hent(TEMAOMRADER, { tema, nr });
    return klasseAreal(omrader, tema.klasser.length, await hent(GRENSE, nr), v.flate).klasser;
  }
});
/* Maskene lages første gang en rute med planlagt utbygging treffer et område, og huskes så lenge området finnes. Nøkkel:
   tema/kommune/plassen i listen over områdene, eller kartlagt/kommune. */
export const TEMAMASKE = datasett<string, Maske | null>({
  navn: 'solv.temamaske',
  om: 'områdene i naturtemaene og det kartlagte som masker i et rutenett, til kryssingen med planrutenettet. Nøkkel: tema/kommune/plassen til området.',
  husk: Infinity
});
/* Et naturtema krysset med planrutenettet R. kartlagt er det kartlagte for temaer med kartleggingsgrad, når det er hentet. utgaver
   er utgavene av planrutenettet, områdene og det kartlagte (0 uten), så nøkkelen sier hva kryssingen er regnet ut av. */
export interface Kryssnokkel extends Temanokkel {
  R: Planrutenett;
  kartlagt: Kartlagt | null;
  utgaver: number[];
}
export const TEMAKRYSS = datasett<Kryssnokkel, Kryssing>({
  navn: 'gull.temakryss',
  om: 'naturtemaene krysset med planrutenettet. Nøkkel: tema/kommune@utgavene av planrutenettet, områdene og det kartlagte.',
  husk: 6,
  nokkel: x => `${temanokkel(x)}@${x.utgaver.join('.')}`,
  lag: async x => {
    const { tema, nr } = x,
      { omrader } = await hent(TEMAOMRADER, x),
      g = await hent(GRENSE, nr),
      navn = new Map<object, string>(omrader.map((o, i) => [o, `${temanokkel(x)}/${i}`]));
    if (x.kartlagt) navn.set(x.kartlagt, 'kartlagt/' + nr);
    const t0 = performance.now(),
      K = kryssNatur(
        { omrader, ekstra: x.kartlagt },
        x.R,
        tema.klasser ? tema.klasser.length : 1,
        !!tema.dekning,
        g,
        (o, lag) => hentStraks(TEMAMASKE, navn.get(o)!, lag)
      );
    tidSlutt(tema.navn.toLowerCase(), t0);
    return K;
  }
});
