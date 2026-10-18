/* Bronse for NIBIO, Nasjonalt grunnkart for arealanalyse (WMS): kartbilder av dagens arealklasser. Siden ber NIBIO tegne seks
   klasser i rene farger (DATAFARGE i solv/klasser.ts), så klassen kan leses av fargen. Her er også de lagrede klassene: dagens
   klasser per blokk på 21 og 10 meter for noen kommuner, laget av de samme kartbildene og lagret sammen med siden (verktoy/klasser.ts). De
   er det ferdige svaret for solv.klasser. */
import { ALLE, DATAFARGE } from '../solv/klasser.ts';
import { DETALJFARGE, DETALJKLASSER, type Treslag, type Underlag } from '../solv/klasser.ts';
import type { Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { flisUtsnitt, flisnavn, type Flis } from '../solv/felles.ts';
import { GRUNNKART as WMS } from './endepunkter.ts';
import { hent, lagHenter } from './henting.ts';
import { wmsBilde, wmsPunkt, wmsSkjema } from './wms.ts';

const hex = (f: number[]) => '#' + f.map(v => v.toString(16).padStart(2, '0')).join('');
const stil = (regler: string) =>
  `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"><NamedLayer><Name>okosystemtype</Name><UserStyle><FeatureTypeStyle>${regler}</FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
const regel = (filter: string, farge: number[]) =>
  `<Rule><ogc:Filter>${filter}</ogc:Filter><PolygonSymbolizer><Fill><CssParameter name="fill">${hex(farge)}</CssParameter></Fill></PolygonSymbolizer></Rule>`;
/* Stilen som sendes til NIBIO: seks regler med rene farger. Den er lik i alle kall. */
const SLD = (() => {
  const regler = ALLE.map(([id, , verdier]) => {
    let f = verdier
      .map(
        v =>
          `<ogc:PropertyIsEqualTo><ogc:PropertyName>okosystemtypeniva1</ogc:PropertyName><ogc:Literal>${v}</ogc:Literal></ogc:PropertyIsEqualTo>`
      )
      .join('');
    if (verdier.length > 1) f = `<ogc:Or>${f}</ogc:Or>`;
    return regel(f, DATAFARGE[id]);
  }).join('');
  return stil(regler);
})();
/* Stilen for detaljklassene: 19 regler. Skogen deles med økosystemtypen på nivå 2 (lovskog og blandingsskog, resten er barskog) og
   arealdekket på nivå 1 (myr er tresatt myr, jordbruk er tresatt innmarksbeite). Den er for lang til å stå i adressen, så
   kartbildene hentes med POST. */
const DETALJSLD = (() => {
  const er = (felt: string, v: string) =>
      `<ogc:PropertyIsEqualTo><ogc:PropertyName>${felt}</ogc:PropertyName><ogc:Literal>${v}</ogc:Literal></ogc:PropertyIsEqualTo>`,
    og = (...x: string[]) => `<ogc:And>${x.join('')}</ogc:And>`,
    ikke = (x: string) => `<ogc:Not>${x}</ogc:Not>`,
    o2 = (v: string) => er('okosystemtypeniva2', v),
    dekke = (v: string) => er('arealdekkeniva1', v);
  const TRESLAG: Record<Treslag, string> = {
      bar: og(ikke(o2('lovskog')), ikke(o2('blandingsskog'))),
      lauv: o2('lovskog'),
      bland: o2('blandingsskog')
    },
    UNDERLAG: Record<Underlag, string> = {
      vanlig: og(ikke(dekke('myr')), ikke(dekke('jordbruk'))),
      myr: dekke('myr'),
      beite: dekke('jordbruk')
    };
  return stil(
    DETALJKLASSER.filter(k => !k.rest)
      .map((k, i) => {
        const o1 = er('okosystemtypeniva1', k.okosystem);
        return regel(k.treslag ? og(o1, TRESLAG[k.treslag], UNDERLAG[k.underlag!]) : o1, DETALJFARGE[i]);
      })
      .join('')
  );
})();

/* Adressen til et kartbilde på w x h piksler av utsnittet u i UTM33. Kartflisene er 512 x 512. */
export const grunnkartUrl = (u: Utsnitt, w = 512, h = 512) =>
  wmsBilde(WMS, u, w, h, {
    layers: 'okosystemtype',
    styles: '',
    format: 'image/png; mode=8bit',
    transparent: 'true',
    sld_body: SLD
  });
/* Kartbildene hentes gjennom en egen kø */
export const hentGrunnkartFlis = lagHenter('NIBIO', 'Kart');

/* Kartbildene med detaljklassene hentes gjennom en egen kø */
const hentDetaljflis = lagHenter('NIBIO', 'Kart med detaljklasser');
/* Tabellen bronse.detaljflis: et kartbilde av detaljklassene for flisen tc [z, x, y], 512 x 512 piksler med 24 bit farge. Med 19
   farger blir fargetabellen i et bilde med 8 bit for grov til å skille blandingene i kantene. */
export async function detaljflis(tc: Flis): Promise<ArrayBuffer> {
  return hentDetaljflis(
    WMS,
    wmsSkjema(flisUtsnitt(tc), 512, 512, {
      layers: 'okosystemtype',
      styles: '',
      format: 'image/png',
      transparent: 'true',
      sld_body: DETALJSLD
    })
  );
}

/* Registeret over de lagrede klassene: årsversjonen av grunnkartet, når de er laget, og blokkene [x, y] per kommune og nivå
   (kommuner['5001']['10'] er blokkene på 10,6 meter i Trondheim) */
export interface Klasseregister {
  versjon?: string;
  hentet?: string;
  kommuner?: Record<string, Record<string, number[][]>>;
}

/* Tabellen bronse.grunnkartflis: et kartbilde av dagens klasser for flisen tc [z, x, y] i flisnettet */
export async function grunnkartflis(tc: Flis): Promise<ArrayBuffer> {
  return hentGrunnkartFlis(grunnkartUrl(flisUtsnitt(tc)));
}
/* Tabellen bronse.klasseregister: registeret over de lagrede klassene, eller null når det ikke kan hentes. Uten registeret lages
   blokkene av kartbildene fra NIBIO, som for kommunene uten lagrede klasser. */
export async function klasseregister(): Promise<Klasseregister | null> {
  return (hent('Egen fil', 'Register over lagrede klasser', 'klasser.json', true) as Promise<Klasseregister>).catch(
    () => null
  );
}
/* Tabellen bronse.klassefil: dagens klasser i blokken tc [z, x, y] slik de er lagret, som PNG med fargetabell. null når blokken ikke
   står i registeret. */
export async function klassefil(tc: Flis): Promise<ArrayBuffer | null> {
  const reg = await katalog.bronse.klasseregister(),
    finnes = Object.values((reg && reg.kommuner) || {}).some(N =>
      (N[tc[0]] || []).some(([x, y]) => x === tc[1] && y === tc[2])
    );
  if (!finnes) return null;
  return hent('Egen fil', `Lagrede klasser ${flisnavn(tc)}`, `klasser/${flisnavn(tc)}.png`, false, true);
}

/* Tabellen bronse.grunnkartIPunkt: grunnkartet i punktet p [øst, nord] slik NIBIO gir det, med økosystemtype, arealdekke,
   skogbonitet, grunnforhold og kilden, som GML-tekst. Til detaljene ved trykk i kartet. */
export async function grunnkartIPunkt(p: number[]): Promise<string> {
  const buf = await hent(
    'NIBIO',
    'Grunnkartet i et punkt',
    wmsPunkt(WMS, p, {
      layers: 'okosystemtype',
      query_layers: 'okosystemtype',
      styles: '',
      info_format: 'application/vnd.ogc.gml',
      feature_count: '5'
    }),
    false,
    true
  );
  return new TextDecoder().decode(buf);
}

/* Tabellen bronse.detaljregister: registeret over de lagrede detaljklassene (detaljklasser.json), i samme form som for dagens
   klasser, eller null når det ikke kan hentes */
export async function detaljregister(): Promise<Klasseregister | null> {
  return (
    hent('Egen fil', 'Register over lagrede detaljklasser', 'detaljklasser.json', true) as Promise<Klasseregister>
  ).catch(() => null);
}
/* Tabellen bronse.detaljfil: detaljklassene i blokken tc [10, x, y] slik de er lagret, som PNG med fargetabellen DETALJTABELL. null
   når blokken ikke står i registeret. */
export async function detaljfil(tc: Flis): Promise<ArrayBuffer | null> {
  const reg = await katalog.bronse.detaljregister(),
    finnes = Object.values((reg && reg.kommuner) || {}).some(N =>
      (N[tc[0]] || []).some(([x, y]) => x === tc[1] && y === tc[2])
    );
  if (!finnes) return null;
  return hent('Egen fil', `Lagrede detaljklasser ${flisnavn(tc)}`, `detaljklasser/${flisnavn(tc)}.png`, false, true);
}
