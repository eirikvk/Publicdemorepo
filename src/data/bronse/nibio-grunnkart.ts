/* Bronse for NIBIO, Nasjonalt grunnkart for arealanalyse (WMS): kartbilder av dagens arealklasser. Siden ber NIBIO tegne seks
   klasser i rene farger (DATAFARGE i solv/klasser.ts), så klassen kan leses av fargen. Her er også de lagrede klassene: dagens
   klasser per blokk på 21 og 10 meter for noen kommuner, laget av de samme kartbildene og lagret sammen med siden (verktoy/klasser.ts). De
   er det ferdige svaret for solv.klasser. */
import { ALLE, DATAFARGE } from '../solv/klasser.ts';
import type { Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { flisUtsnitt, flisnavn, type Flis } from '../solv/felles.ts';
import { hent, lagHenter } from './henting.ts';
import { wmsBilde, wmsPunkt } from './wms.ts';

const WMS = 'https://wms.nibio.no/cgi-bin/grunnkart_arealanalyse';
/* Stilen som sendes til NIBIO: seks regler med rene farger. Den er lik i alle kall. */
const SLD = (() => {
  const hex = (f: number[]) => '#' + f.map(v => v.toString(16).padStart(2, '0')).join('');
  const regler = ALLE.map(([id, , verdier]) => {
    let f = verdier
      .map(
        v =>
          `<ogc:PropertyIsEqualTo><ogc:PropertyName>okosystemtypeniva1</ogc:PropertyName><ogc:Literal>${v}</ogc:Literal></ogc:PropertyIsEqualTo>`
      )
      .join('');
    if (verdier.length > 1) f = `<ogc:Or>${f}</ogc:Or>`;
    return `<Rule><ogc:Filter>${f}</ogc:Filter><PolygonSymbolizer><Fill><CssParameter name="fill">${hex(DATAFARGE[id])}</CssParameter></Fill></PolygonSymbolizer></Rule>`;
  }).join('');
  return `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc"><NamedLayer><Name>okosystemtype</Name><UserStyle><FeatureTypeStyle>${regler}</FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>`;
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

/* Registeret over de lagrede klassene: årsversjonen av grunnkartet, når de er laget, og blokkene [x, y] per kommune og nivå
   (kommuner['5001']['9'] er blokkene på 21 meter i Trondheim) */
export interface Klasseregister {
  versjon?: string;
  hentet?: string;
  kommuner?: Record<string, Record<string, number[][]>>;
}

/* Tabellen bronse.grunnkartflis: et kartbilde av dagens klasser for flisen tc [z, x, y] i flisnettet */
export async function grunnkartflis(tc: Flis): Promise<ArrayBuffer> {
  return hentGrunnkartFlis(grunnkartUrl(flisUtsnitt(tc)));
}
/* Tabellen bronse.klasseregister: registeret over de lagrede klassene, eller null når det ikke kan hentes. Uten registeret brukes
   det sammensatte kartet av det som er hentet. */
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
