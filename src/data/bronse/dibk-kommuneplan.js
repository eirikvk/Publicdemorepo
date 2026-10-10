/* Bronse for DiBK, den nasjonale tjenesten for kommuneplaner (WMS), laget kparealformalomrade. Siden henter bare flatene med
   arealformål i 1000- og 2000-serien (bebyggelse og anlegg, samferdselsanlegg og teknisk infrastruktur) og arealbruksstatus 2
   (framtidig), som kartbilder. */
import { hent, lagHenter } from './henting.js';

const PLAN = 'https://nap.ft.dibk.no/services/wms/kommuneplaner/';
const planSom = v =>
  `<PropertyIsLike wildCard="*" singleChar="?" escapeChar="!"><PropertyName>arealformål</PropertyName><Literal>${v}</Literal></PropertyIsLike>`;
const PLANFILTER = `<Filter xmlns="http://www.opengis.net/ogc"><And><PropertyIsEqualTo><PropertyName>arealbruksstatus</PropertyName><Literal>2</Literal></PropertyIsEqualTo><Or>${planSom('1*')}${planSom('2*')}</Or></And></Filter>`;
/* Flatene hentes med en egen stil som bare fyller dem, uten kantstrek. DiBKs standardstil tegner en strek rundt hver flate, og den
   er like bred i piksler uansett målestokk. Med ruter på 21 meter la streken rundt en fjerdedel til arealet i et testområde. */
const PLANSTIL =
  '<?xml version="1.0" encoding="UTF-8"?><StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>kparealformalomrade</Name><UserStyle><FeatureTypeStyle><Rule><PolygonSymbolizer><Fill><CssParameter name="fill">#000000</CssParameter></Fill></PolygonSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
/* Adressen til et kartbilde på 512 x 512 piksler av utsnittet u i UTM33, med de planlagte flatene fylt i svart */
export const kommuneplanUrl = u =>
  PLAN +
  '?' +
  new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: 'kparealformalomrade',
    sld_body: PLANSTIL,
    crs: 'EPSG:25833',
    bbox: u.map(v => v.toFixed(2)).join(','),
    width: 512,
    height: 512,
    format: 'image/png8',
    transparent: 'true',
    filter: PLANFILTER
  });
/* Kartbildene hentes gjennom en egen kø, og de rå bildene huskes */
export const hentKommuneplanFlis = lagHenter('DiBK', 'Kommuneplan');

/* Sjekken av om kommunen har plan: ett lite bilde av hele planlaget over utsnittet u, med w x h ruter, i DiBKs egen stil. */
const dekningsvalg = (u, w, h) => ({
  service: 'WMS',
  version: '1.3.0',
  layers: 'kparealformalomrade',
  styles: 'polygon',
  crs: 'EPSG:25833',
  bbox: u.map(v => v.toFixed(1)).join(','),
  width: w,
  height: h
});
export const hentPlandekning = (k, u, w, h) =>
  hent(
    'DiBK',
    `Dekning av kommuneplan for ${k.navn}`,
    PLAN +
      '?' +
      new URLSearchParams({ ...dekningsvalg(u, w, h), request: 'GetMap', format: 'image/png8', transparent: 'true' }),
    false,
    true
  );
/* Opplysningene om kommuneplanen for kommunen k i ruta (i, j) i det samme bildet: { id, vert, kopiert }, der vert er hvem som har
   levert planen og kopiert datoen den ble kopiert til DiBK, som [år, måned, dag]. null hvis ruta ikke har en plan fra kommunen. */
export const hentPlaninfo = (k, u, w, h, i, j) =>
  hent(
    'DiBK',
    `Opplysninger om kommuneplanen for ${k.navn}`,
    PLAN +
      '?' +
      new URLSearchParams({
        ...dekningsvalg(u, w, h),
        request: 'GetFeatureInfo',
        query_layers: 'kparealformalomrade',
        info_format: 'application/json',
        feature_count: 5,
        i,
        j
      }),
    true
  ).then(svar => {
    const f = (svar.features || []).map(x => x.properties || {}).find(x => x['arealplanId.kommunenummer'] === k.nr);
    if (!f) return null;
    const d = /^(\d{4})-(\d\d)-(\d\d)/.exec(f['kopidata.kopidato'] || '');
    return {
      id: f['arealplanId.planidentifikasjon'],
      vert: f['kopidata.originalDatavert'] || '',
      kopiert: d ? [d[1], d[2], d[3]] : null
    };
  });
