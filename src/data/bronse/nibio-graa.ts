/* Bronse for kart over grå arealer (NIBIO, WMS, testversjon): bilder av alt grått areal og av flatene med oppgitt andel vegetasjon.
   Stilen tegner trinnene i GRAATRINN (solv/graa.ts) i rødt med styrken 51 · trinn, så trinnet kan leses av fargen. */
import { GRAATRINN } from '../solv/graa.ts';
import type { Utsnitt } from '../generelt/geometri.ts';
import { BIT, flisUtsnitt, flisnavn, type Flis } from '../solv/felles.ts';
import { GRAA } from './endepunkter.ts';
import { hent, lagHenter } from './henting.ts';
import { wmsBilde } from './wms.ts';

/* Egne stiler uten kantstrek. Alt grått areal tegnes i svart. Flatene med oppgitt andel vegetasjon får en rødfarge som sier hvilket
   trinn de er i. De to lagene hentes hver for seg, både til tallene og til kartet: i ett bilde blandes fargene langs kantene, og med
   ruter på 20 meter ga det for mye grått areal og for lite vegetasjon. */
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
/* Kartbildene til kartet zoomet inn hentes gjennom en egen kø */
const hentGraaFlis = lagHenter('NIBIO', 'Grått areal');
/* Tabellen bronse.graaflis: ett av de to bildene av grått areal for flisen tc [z, x, y] finere enn nivå 10, 512 x 512 piksler, kalt
   med [lag, tc]: lag 0 er alt grått areal, lag 1 flatene med oppgitt andel vegetasjon, som for bitene (graabit). Til kartet zoomet
   inn (solv.graatrinn). */
export async function graaflis([lag, tc]: [number, Flis]): Promise<ArrayBuffer> {
  return hentGraaFlis(graaBilde([lag], flisUtsnitt(tc), 512, 512));
}
/* Tabellen bronse.graabit: ett av de to bildene av biten tc (en flis på nivå 8, solv/felles.ts) med 2048 x 2048 ruter à 10,6 meter,
   som PNG. lag 0 er alt grått areal, lag 1 flatene med oppgitt andel vegetasjon. De hentes hver for seg, fordi fargene blandes langs
   kantene når de hentes i ett bilde. */
export async function graabit([lag, tc]: [number, Flis]): Promise<ArrayBuffer> {
  return hent(
    'NIBIO',
    `${lag ? 'Vegetasjon i grått areal' : 'Grått areal'}, bit ${flisnavn(tc)}`,
    graaBilde([lag], flisUtsnitt(tc), BIT, BIT),
    false,
    true
  );
}
