/* Bronse for kart over grå arealer (NIBIO, WMS, testversjon): bilder av alt grått areal og av flatene med oppgitt andel vegetasjon.
   Stilen tegner trinnene i GRAATRINN (solv/graa.ts) i rødt med styrken 51 · trinn, så trinnet kan leses av fargen. */
import { GRAATRINN } from '../solv/graa.ts';
import type { Utsnitt } from '../generelt/geometri.ts';
import type { Kommune } from '../solv/felles.ts';
import { hent, lagHenter } from './henting.ts';
import { wmsBilde } from './wms.ts';

const GRAA = 'https://wms.nibio.no/cgi-bin/graastruktur';
/* Egne stiler uten kantstrek. Alt grått areal tegnes i svart. Flatene med oppgitt andel vegetasjon får en rødfarge som sier hvilket
   trinn de er i. Kartflisene henter begge lagene i ett bilde. Til tallene hentes de hver for seg: i ett bilde blandes fargene
   langs kantene, og med ruter på 20 meter ga det for mye grått areal og for lite vegetasjon. */
const graaFyll = (f: string) =>
  `<PolygonSymbolizer><Fill><CssParameter name="fill">${f}</CssParameter></Fill></PolygonSymbolizer>`;
const graaLagStil = [
  `<NamedLayer><Name>graa_arealer</Name><UserStyle><FeatureTypeStyle><Rule>${graaFyll('#000000')}</Rule></FeatureTypeStyle></UserStyle></NamedLayer>`,
  `<NamedLayer><Name>andel_med_vegetasjon</Name><UserStyle><FeatureTypeStyle>${GRAATRINN.map(([, , fra, til], i) => `<Rule><ogc:Filter><ogc:And><ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyName>andelgron</ogc:PropertyName><ogc:Literal>${fra}</ogc:Literal></ogc:PropertyIsGreaterThanOrEqualTo><ogc:PropertyIsLessThan><ogc:PropertyName>andelgron</ogc:PropertyName><ogc:Literal>${til}</ogc:Literal></ogc:PropertyIsLessThan></ogc:And></ogc:Filter>${graaFyll('#' + (51 * (i + 1)).toString(16).padStart(2, '0') + '0000')}</Rule>`).join('')}</FeatureTypeStyle></UserStyle></NamedLayer>`
];
const graaBilde = (hva: number[], u: Utsnitt, w: number, h: number) =>
  wmsBilde(GRAA, u, w, h, {
    layers: ['graa_arealer', 'andel_med_vegetasjon'].filter((_, i) => hva.includes(i)).join(','),
    sld_body: `<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc">${graaLagStil.filter((_, i) => hva.includes(i)).join('')}</StyledLayerDescriptor>`,
    format: 'image/png',
    transparent: 'true'
  });
/* Kartbildene til kartlaget, med begge lagene i ett bilde, hentes gjennom en egen kø */
export const hentGraaFlis = lagHenter('NIBIO', 'Grått areal');
/* Adressen til et kartbilde på 512 x 512 piksler av utsnittet u, med begge lagene */
export const graaFlisUrl = (u: Utsnitt) => graaBilde([0, 1], u, 512, 512);
/* Ett av de to bildene av utsnittet u med w x h ruter for kommunen k: lag 0 er alt grått areal, lag 1 flatene med oppgitt andel
   vegetasjon. De hentes hver for seg, fordi fargene blandes langs kantene når de hentes i ett bilde. */
export const hentGraaBilde = (k: Kommune, lag: number, u: Utsnitt, w: number, h: number) =>
  hent(
    'NIBIO',
    lag ? `Vegetasjon i grått areal i ${k.navn}` : `Grått areal i ${k.navn}`,
    graaBilde([lag], u, w, h),
    false,
    true
  );
