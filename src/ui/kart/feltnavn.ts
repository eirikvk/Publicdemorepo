/* Lesbare navn på feltene fra kildene i detaljene for punktet. Nøkkelen er feltnavnet slik kilden gir det, verdien navnet som vises.
   null betyr at feltet bare beskriver flaten eller koblingen i kildens database (id-er, koder som gjentar et navn, lengden og arealet
   av hele flaten), og det vises bare når brukeren har valgt å se alle feltene med kildenes navn. Felt som ikke står her, vises med
   kildens navn. Kildene er kommuneplanen fra DiBK, grunnkartet fra NIBIO, inngrepsfri natur og naturtemaene fra
   Miljødirektoratet. */
const FELTNAVN: Record<string, string | null> = {
  /* Kommuneplanen, DiBK (KpArealformålOmråde) */
  objid: null,
  objekttypenavn: 'Objekttype',
  arealformål: 'Arealformål',
  arealbruksstatus: 'Arealbruksstatus',
  beskrivelse: 'Beskrivelse',
  områdenavn: 'Områdenavn',
  'utnytting.utnyttingstype': 'Utnyttingstype',
  'utnytting.utnyttingstall': 'Utnyttingstall',
  'utnytting.utnyttingstall_minimum': 'Utnyttingstall, minst',
  uteoppholdsareal: 'Uteoppholdsareal',
  eierform: 'Eierform',
  'arealplanId.kommunenummer': 'Kommunenummer for planen',
  'arealplanId.landkode': 'Landkode',
  'arealplanId.planidentifikasjon': 'Planidentifikasjon',
  'identifikasjon.lokalId': null,
  'identifikasjon.navnerom': null,
  'identifikasjon.versjonId': null,
  førsteDigitaliseringsdato: 'Først digitalisert',
  oppdateringsdato: 'Sist oppdatert',
  'kopidata.områdeId': null,
  'kopidata.originalDatavert': 'Opprinnelig datavert',
  'kopidata.kopidato': 'Kopiert til DiBK',
  /* Grunnkartet, NIBIO (laget okosystemtype) */
  okosystemtypeniva1: 'Økosystemtype, nivå 1',
  okosystemtypeniva2: 'Økosystemtype, nivå 2',
  okosystemtypeniva3: 'Økosystemtype, nivå 3',
  okosystemtypekode: null,
  arealdekkeniva1: 'Arealdekke, nivå 1',
  arealdekkeniva2: 'Arealdekke, nivå 2',
  arealdekkekode: null,
  skogbonitet: 'Skogbonitet',
  skogbonitetkode: null,
  grunnforhold: 'Grunnforhold',
  grunnforholdkode: null,
  arealbruklandhovedklasse: 'Arealbruk på land, hovedklasse',
  arealbruklandunderklasse: 'Arealbruk på land, underklasse',
  arealbruklandkode: null,
  arealbrukhav: 'Arealbruk i sjø',
  arealbrukhavkode: null,
  grunnkartkilde: 'Kilde for arealdekket',
  arealbrukkilde: 'Kilde for arealbruken',
  kommunenummer: 'Kommunenummer',
  kystsone: 'Kystsone',
  bebygdmaske: 'Bebygd maske',
  am2: null,
  omkrets: null,
  ff: null,
  id: null,
  /* Inngrepsfri natur, Miljødirektoratet. Sonen står alt i gruppen, med navn. */
  inonid: null,
  vsone: null,
  arealkm2: 'Areal av hele sonen, km²',
  /* Verneområder, Miljødirektoratet */
  naturvernId: 'Naturbase-id',
  cddaId: null,
  navn: 'Navn',
  offisieltNavn: 'Offisielt navn',
  faktaark: 'Faktaark',
  verneform: 'Verneform',
  verneforskrift: 'Verneforskrift',
  vernedato: 'Vernedato',
  foerstegangVernet: 'Først vernet',
  verneplan: 'Verneplan',
  kommune: 'Kommune',
  forvaltningsmyndighet: 'Forvaltningsmyndighet',
  forvaltningsmyndighetType: 'Type forvaltningsmyndighet',
  iucn: 'IUCN-kategori',
  revisjon: 'Revisjon',
  truetVurdering: 'Truet-vurdering',
  majorEcosystemType: 'Hovedøkosystem',
  GlobalID: null,
  verneformAggregert: null,
  OBJECTID: null,
  NaturvernFKID: null,
  'SHAPE.STArea()': null,
  'SHAPE.STLength()': null,
  /* Villrein, Miljødirektoratet (navnene som tjenesten selv bruker) */
  lokalId: 'Naturbase-id',
  registreringsdato: 'Registreringsdato',
  villreinområdeNasjonalt: 'Nasjonalt villreinområde',
  villreinregionEuropeisk: 'Europeisk villreinregion',
  villreinområdeNavn: 'Områdenavn',
  kilde: 'Kilde',
  villreinOpphav: 'Opphav',
  faktarkVillreinNo: 'Faktaark fra villrein.no',
  villreinnemd: 'Villreinnemnd',
  villreinområdeId: 'Villreinområde-id',
  merknad: 'Merknad',
  funksjon: 'Funksjon',
  funksjonsperiode: 'Funksjonsperiode',
  /* Verdsatte naturtyper, Miljødirektoratet */
  KuverdiNaturtypeId: 'Naturbase-id',
  Verdikriterier: 'Verdikriterier',
  FaktaarkLokalitet: 'Faktaark for lokaliteten'
};

/* Feltene [feltnavn, verdi] slik de vises: med kildenes navn og alle felt når kildenavn er sann, ellers med lesbare navn og uten
   feltene som bare beskriver flaten eller databasen */
export function visteFelt(felt: [string, string][], kildenavn: boolean): [string, string][] {
  if (kildenavn) return felt;
  return felt.flatMap(([navn, v]): [string, string][] => {
    const lesbart = Object.hasOwn(FELTNAVN, navn) ? FELTNAVN[navn] : navn;
    return lesbart === null ? [] : [[lesbart, v]];
  });
}
