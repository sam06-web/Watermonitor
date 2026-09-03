/**
 * Canonical preset rivers with full geospatial coordinates, line geometries,
 * bounding boxes, and multi-language / spelling aliases.
 */

export const RIVER_ALIASES = {
  thamirabarani: ['thamirabarani', 'thamirabharani', 'tamirabarani', 'tamiraparani', 'porunai', 'tirunelveli_river'],
  thamirabharani: ['thamirabarani', 'thamirabharani', 'tamirabarani', 'tamiraparani', 'porunai', 'tirunelveli_river'],
  tamirabarani: ['thamirabarani', 'thamirabharani', 'tamirabarani', 'tamiraparani', 'porunai', 'tirunelveli_river'],
  tamiraparani: ['thamirabarani', 'thamirabharani', 'tamirabarani', 'tamiraparani', 'porunai', 'tirunelveli_river'],
  porunai: ['thamirabarani', 'thamirabharani', 'tamirabarani', 'tamiraparani', 'porunai', 'tirunelveli_river'],
  cauvery: ['cauvery', 'kaveri', 'cavery', 'kaviri'],
  kaveri: ['cauvery', 'kaveri', 'cavery', 'kaviri'],
  noyyal: ['noyyal', 'noiyal'],
  noiyal: ['noyyal', 'noiyal'],
  amaravathi: ['amaravathi', 'amaravati'],
  amaravati: ['amaravathi', 'amaravati'],
  vaigai: ['vaigai', 'vaigai_river'],
  bhavani: ['bhavani', 'bhavani_river'],
  palar: ['palar', 'palar_river'],
  kollidam: ['kollidam', 'coleroon'],
  ganga: ['ganga', 'ganges'],
  ganges: ['ganga', 'ganges'],
  yamuna: ['yamuna', 'jamuna'],
  godavari: ['godavari', 'godavari_river']
};

export function getRiverAliasIds(id) {
  const norm = String(id || '').toLowerCase().trim();
  const list = RIVER_ALIASES[norm] ? [...RIVER_ALIASES[norm]] : [norm];
  if (!list.includes(norm)) list.push(norm);
  return list;
}

export const PRESET_RIVERS = [
  {
    id: 'thamirabarani',
    name: 'Thamirabarani River',
    alternate_names: 'Thamirabarani, Thamirabharani, Tamirabarani, Tamiraparani, தாமிரபரணி, Porunai, Tirunelveli, Thoothukudi, Tamil Nadu, India',
    state: 'Tirunelveli, Thoothukudi',
    country: 'India',
    latitude: 8.6336502,
    longitude: 77.8782172,
    bbox: '[77.7392847,8.6064002,78.1027053,8.7820426]',
    length_km: 128,
    basin: 'Thamirabarani Basin',
    geometry: '{"type":"LineString","coordinates":[[77.7392847,8.7566631],[77.7453836,8.7624663],[77.7566902,8.7723494],[77.7695131,8.7796917],[77.7886908,8.7817033],[77.8082602,8.7820426],[77.8207915,8.7703366],[77.8341222,8.7396734],[77.846369,8.6831242],[77.854897,8.6519501],[77.8649646,8.6443536],[77.8792383,8.6336075],[77.8992407,8.6367949],[77.9217003,8.6163524],[77.9446056,8.6090517],[77.9692417,8.607817],[77.9939177,8.620065],[78.0204286,8.6206872],[78.0484469,8.6222418],[78.0760651,8.6325412],[78.1027053,8.6406139]]}',
    description: 'Perennial river originating in the Pothigai Hills of the Western Ghats, flowing through Tirunelveli and Thoothukudi into the Gulf of Mannar.'
  },
  {
    id: 'thamirabharani',
    name: 'Thamirabarani River',
    alternate_names: 'Thamirabarani, Thamirabharani, Tamirabarani, Tamiraparani, தாமிரபரணி, Porunai, Tirunelveli, Thoothukudi, Tamil Nadu, India',
    state: 'Tirunelveli, Thoothukudi',
    country: 'India',
    latitude: 8.6336502,
    longitude: 77.8782172,
    bbox: '[77.7392847,8.6064002,78.1027053,8.7820426]',
    length_km: 128,
    basin: 'Thamirabarani Basin',
    geometry: '{"type":"LineString","coordinates":[[77.7392847,8.7566631],[77.7453836,8.7624663],[77.7566902,8.7723494],[77.7695131,8.7796917],[77.7886908,8.7817033],[77.8082602,8.7820426],[77.8207915,8.7703366],[77.8341222,8.7396734],[77.846369,8.6831242],[77.854897,8.6519501],[77.8649646,8.6443536],[77.8792383,8.6336075],[77.8992407,8.6367949],[77.9217003,8.6163524],[77.9446056,8.6090517],[77.9692417,8.607817],[77.9939177,8.620065],[78.0204286,8.6206872],[78.0484469,8.6222418],[78.0760651,8.6325412],[78.1027053,8.6406139]]}',
    description: 'Perennial river originating in the Pothigai Hills of the Western Ghats, flowing through Tirunelveli and Thoothukudi into the Gulf of Mannar.'
  },
  {
    id: 'cauvery',
    name: 'Cauvery River',
    alternate_names: 'Cauvery, Kaveri, காவிரி, Karnataka, Tamil Nadu, Thanjavur, Trichy, India',
    state: 'Tamil Nadu, Karnataka',
    country: 'India',
    latitude: 10.7905,
    longitude: 78.7047,
    bbox: '[75.5,10.0,79.9,13.0]',
    length_km: 805,
    basin: 'Cauvery Basin',
    geometry: '{"type":"LineString","coordinates":[[75.7,12.4],[76.5,12.3],[77.5,11.8],[78.7,10.8],[79.8,11.1]]}',
    description: 'Sacred river of South India flowing from Talakaveri through Karnataka and Tamil Nadu into the Bay of Bengal.'
  },
  {
    id: 'vaigai',
    name: 'Vaigai River',
    alternate_names: 'Vaigai, வைகை, Madurai, Theni, Dindigul, Ramanathapuram, Tamil Nadu, India',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 9.9252,
    longitude: 78.1198,
    bbox: '[77.3,9.3,79.1,10.2]',
    length_km: 258,
    basin: 'Vaigai Basin',
    geometry: '{"type":"LineString","coordinates":[[77.4,9.8],[77.8,9.9],[78.1,9.92],[78.6,9.6],[79.0,9.35]]}',
    description: 'Historic river flowing through the temple city of Madurai and emptying into the Palk Strait.'
  },
  {
    id: 'bhavani',
    name: 'Bhavani River',
    alternate_names: 'Bhavani, பவானி, Erode, Nilgiris, Coimbatore, Tamil Nadu, India',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 11.4500,
    longitude: 77.6833,
    bbox: '[76.5,11.1,77.8,11.6]',
    length_km: 217,
    basin: 'Bhavani Basin',
    geometry: '{"type":"LineString","coordinates":[[76.6,11.2],[77.1,11.3],[77.4,11.45],[77.68,11.45]]}',
    description: 'Major tributary of the Cauvery River originating in the Silent Valley and flowing across Western Tamil Nadu.'
  },
  {
    id: 'noyyal',
    name: 'Noyyal River',
    alternate_names: 'Noyyal, Noiyal, நொய்யல், Coimbatore, Tirupur, Karur, Tamil Nadu, India',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 11.0055,
    longitude: 77.0000,
    bbox: '[76.6,10.8,77.9,11.2]',
    length_km: 180,
    basin: 'Noyyal Basin',
    geometry: '{"type":"LineString","coordinates":[[76.7,10.9],[77.0,11.0],[77.4,11.05],[77.8,11.02]]}',
    description: 'Important tributary of Cauvery flowing through Coimbatore, Tirupur, and Karur in Tamil Nadu.'
  },
  {
    id: 'amaravathi',
    name: 'Amaravathi River',
    alternate_names: 'Amaravathi, Amaravati, அமராவதி, Karur, Tirupur, Tamil Nadu, India',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 10.9500,
    longitude: 77.9000,
    bbox: '[77.0,10.2,78.1,11.0]',
    length_km: 256,
    basin: 'Amaravathi Basin',
    geometry: '{"type":"LineString","coordinates":[[77.1,10.3],[77.5,10.6],[77.8,10.9],[77.9,10.95]]}',
    description: 'Longest tributary of Cauvery in Tamil Nadu flowing through Indira Gandhi Wildlife Sanctuary and Karur.'
  },
  {
    id: 'palar',
    name: 'Palar River',
    alternate_names: 'Palar, பாலாறு, Vellore, Kanchipuram, Chengalpattu, Tamil Nadu, India',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 12.5000,
    longitude: 79.5000,
    bbox: '[78.1,12.2,80.2,13.1]',
    length_km: 348,
    basin: 'Palar Basin',
    geometry: '{"type":"LineString","coordinates":[[78.2,13.0],[78.9,12.9],[79.5,12.8],[80.1,12.5]]}',
    description: 'River of northern Tamil Nadu providing drinking and irrigation water across Vellore and Kanchipuram.'
  },
  {
    id: 'ganga',
    name: 'Ganga River',
    alternate_names: 'Ganga, Ganges, Ganga River, गंगा, Varanasi, Haridwar, Uttar Pradesh, India',
    state: 'Uttarakhand, Uttar Pradesh, Bihar, West Bengal',
    country: 'India',
    latitude: 25.3176,
    longitude: 83.0062,
    bbox: '[78.0,21.5,88.5,31.0]',
    length_km: 2525,
    basin: 'Ganges Basin',
    geometry: '{"type":"LineString","coordinates":[[78.5,30.1],[80.3,26.5],[83.0,25.3],[85.1,25.6],[88.3,22.5]]}',
    description: 'Trans-boundary river of Asia and the national river of India.'
  },
  {
    id: 'yamuna',
    name: 'Yamuna River',
    alternate_names: 'Yamuna, Jamuna, यमुना, Delhi, Agra, Mathura, Prayagraj, India',
    state: 'Delhi, Uttar Pradesh, Haryana',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.2090,
    bbox: '[77.0,25.0,78.5,31.0]',
    length_km: 1376,
    basin: 'Yamuna Basin',
    geometry: '{"type":"LineString","coordinates":[[78.4,31.0],[77.2,28.6],[77.7,27.5],[78.0,27.18],[81.8,25.4]]}',
    description: 'Second largest tributary river of the Ganges in Northern India.'
  },
  {
    id: 'godavari',
    name: 'Godavari River',
    alternate_names: 'Godavari, गोदावरी, Dakshin Ganga, Rajahmundry, Nashik, India',
    state: 'Andhra Pradesh, Telangana, Maharashtra',
    country: 'India',
    latitude: 17.0005,
    longitude: 81.8040,
    bbox: '[73.5,16.3,82.4,20.0]',
    length_km: 1465,
    basin: 'Godavari Basin',
    geometry: '{"type":"LineString","coordinates":[[73.5,19.9],[76.5,19.0],[79.5,18.8],[81.8,17.0]]}',
    description: 'Second longest river in India after the Ganges, draining into the Bay of Bengal.'
  },
  {
    id: 'amazon',
    name: 'Amazon River',
    alternate_names: 'Amazon, Rio Amazonas, South America, Brazil, Peru',
    state: 'Amazonas',
    country: 'Brazil',
    latitude: -3.4653,
    longitude: -62.2159,
    bbox: '[-73.5,-5.0,-50.0,2.0]',
    length_km: 6400,
    basin: 'Amazon Basin',
    geometry: '{"type":"LineString","coordinates":[[-70.0,-4.2],[-65.0,-3.8],[-60.0,-3.1],[-55.0,-2.5],[-50.0,-0.5]]}',
    description: 'Largest river by discharge volume of water in the world, flowing through South America.'
  },
  {
    id: 'nile',
    name: 'Nile River',
    alternate_names: 'Nile, River Nile, نهر النيل, Egypt, Sudan, Africa',
    state: 'Cairo',
    country: 'Egypt',
    latitude: 30.0444,
    longitude: 31.2357,
    bbox: '[29.0,-3.0,33.0,31.5]',
    length_km: 6650,
    basin: 'Nile Basin',
    geometry: '{"type":"LineString","coordinates":[[31.5,15.6],[32.5,24.0],[31.2,30.0],[31.4,31.3]]}',
    description: 'Iconic river in northeastern Africa flowing through Egypt into the Mediterranean Sea.'
  }
];
