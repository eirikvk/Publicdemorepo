/* Bronse for NIBIO, Nasjonalt grunnkart for arealanalyse (WMS): kartbilder av dagens arealklasser, og de lagrede oversiktsbildene
   av hele kommuner som er laget av samme tjeneste (verktoy/oversiktsbilde.py). Siden ber NIBIO tegne seks klasser i rene farger
   (DATAFARGE i solv/klasser.js), så klassen kan leses av fargen. */
import { ALLE, DATAFARGE } from '../solv/klasser.js';
import { hent, lagHenter } from './henting.js';

const WMS = 'https://wms.nibio.no/cgi-bin/grunnkart_arealanalyse';
/* Stilen som sendes til NIBIO: seks regler med rene farger. Den er lik i alle kall. */
const SLD = (() => {
  const hex = f => '#' + f.map(v => v.toString(16).padStart(2, '0')).join('');
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

/* Adressen til et kartbilde på 512 x 512 piksler av utsnittet u i UTM33 */
export const grunnkartUrl = u =>
  WMS +
  '?' +
  new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: 'okosystemtype',
    styles: '',
    crs: 'EPSG:25833',
    bbox: u.map(v => v.toFixed(2)).join(','),
    width: 512,
    height: 512,
    format: 'image/png; mode=8bit',
    transparent: 'true',
    sld_body: SLD
  });
/* Kartbildene hentes gjennom en egen kø, og de rå bildene huskes (hentGrunnkartFlis.lager) */
export const hentGrunnkartFlis = lagHenter('NIBIO', 'Kart');

/* Registeret over lagrede oversiktsbilder: hvilke kommuner som har et, og utsnittet bildet dekker */
export const hentOversiktsregister = () => hent('Egen fil', 'Register over oversiktsbilder', 'oversikt.json', true);
/* Det lagrede oversiktsbildet for kommunen k, som PNG */
export const hentOversiktsbilde = k =>
  hent('Egen fil', `Oversiktsbilde for ${k.navn}`, `oversikt/${k.nr}.png`, false, true);
