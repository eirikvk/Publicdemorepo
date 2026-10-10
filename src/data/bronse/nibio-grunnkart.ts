/* Bronse for NIBIO, Nasjonalt grunnkart for arealanalyse (WMS): kartbilder av dagens arealklasser, og de lagrede oversiktsbildene
   av hele kommuner som er laget av samme tjeneste (verktoy/oversiktsbilde.ts). Siden ber NIBIO tegne seks klasser i rene farger
   (DATAFARGE i solv/klasser.ts), så klassen kan leses av fargen. */
import { ALLE, DATAFARGE } from '../solv/klasser.ts';
import type { Utsnitt } from '../generelt/geometri.ts';
import type { Kommune } from '../solv/felles.ts';
import { hent, lagHenter } from './henting.ts';
import { wmsBilde } from './wms.ts';

const WMS = 'https://wms.nibio.no/cgi-bin/grunnkart_arealanalyse';
/* Groveste flisnivå NIBIO tegner: 512 piksler per flis gir 10,6 meter per piksel, innenfor grensen på 1:50 000. Zoomet lenger ut
   brukes oversiktsbildet. */
export const FLISNIVA = 10;
/* Groveste oppløsning NIBIO tegner grunnkartet i (1:50 000), i meter per piksel. Oversiktsbildene hentes minst så tett. */
export const GROVESTE_M = 17;
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
/* Kartbildene hentes gjennom en egen kø, og de rå bildene huskes (hentGrunnkartFlis.lager) */
export const hentGrunnkartFlis = lagHenter('NIBIO', 'Kart');

/* Registeret over lagrede oversiktsbilder: hvilke kommuner som har et, og utsnittet bildet dekker */
/* Registeret: årsversjonen av grunnkartet, når bildene er laget, og utsnittet hvert bilde dekker, per kommunenummer */
export interface Oversiktsregister {
  versjon?: string;
  hentet?: string;
  kommuner?: Record<string, Utsnitt>;
}
export const hentOversiktsregister = () =>
  hent('Egen fil', 'Register over oversiktsbilder', 'oversikt.json', true) as Promise<Oversiktsregister>;
/* Det lagrede oversiktsbildet for kommunen k, som PNG */
export const hentOversiktsbilde = (k: Kommune) =>
  hent('Egen fil', `Oversiktsbilde for ${k.navn}`, `oversikt/${k.nr}.png`, false, true);
