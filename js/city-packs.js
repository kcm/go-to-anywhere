// Multi-city registry & active city pack configuration.
// Supports 20 worldwide cities: 'sanfrancisco' (default), 'royaloak', 'oakland', 'annarbor', 'newyork', 'pompanobeach',
// 'sydney', 'venice', 'amsterdam', 'hongkong', 'paris', 'london', 'tokyo', 'barcelona', 'rio', 'vancouver',
// 'capetown', 'chicago', 'boston', and 'seattle'.

const CITY_ALIASES = {
  sanfrancisco: 'sanfrancisco',
  'san-francisco': 'sanfrancisco',
  sf: 'sanfrancisco',
  sfo: 'sanfrancisco',
  royaloak: 'royaloak',
  'royal-oak': 'royaloak',
  ro: 'royaloak',
  oakland: 'oakland',
  oak: 'oakland',
  annarbor: 'annarbor',
  'ann-arbor': 'annarbor',
  a2: 'annarbor',
  aa: 'annarbor',
  newyork: 'newyork',
  'new-york': 'newyork',
  ny: 'newyork',
  nyc: 'newyork',
  pompanobeach: 'pompanobeach',
  'pompano-beach': 'pompanobeach',
  pompano: 'pompanobeach',
  pb: 'pompanobeach',
  fl: 'pompanobeach',
  sydney: 'sydney',
  syd: 'sydney',
  venice: 'venice',
  venezia: 'venice',
  ven: 'venice',
  amsterdam: 'amsterdam',
  ams: 'amsterdam',
  hongkong: 'hongkong',
  'hong-kong': 'hongkong',
  hk: 'hongkong',
  hkg: 'hongkong',
  paris: 'paris',
  par: 'paris',
  london: 'london',
  lon: 'london',
  ldn: 'london',
  tokyo: 'tokyo',
  tyo: 'tokyo',
  barcelona: 'barcelona',
  bcn: 'barcelona',
  rio: 'rio',
  'rio-de-janeiro': 'rio',
  riodejaneiro: 'rio',
  rdj: 'rio',
  vancouver: 'vancouver',
  van: 'vancouver',
  yvr: 'vancouver',
  capetown: 'capetown',
  'cape-town': 'capetown',
  cpt: 'capetown',
  chicago: 'chicago',
  chi: 'chicago',
  ord: 'chicago',
  boston: 'boston',
  bos: 'boston',
  seattle: 'seattle',
  sea: 'seattle'
};

const RESERVED_CITY_KEYS = new Set(['__proto__', 'constructor', 'prototype', 'tostring', 'valueof']);

function normalizeCityId(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key || RESERVED_CITY_KEYS.has(key)) return '';
  if (Object.hasOwn(CITY_ALIASES, key)) return CITY_ALIASES[key];
  if (/^[a-z0-9][a-z0-9_-]*$/.test(key)) return key;
  return '';
}

function resolveActiveCityId() {
  let raw = globalThis.__CITY_ID__ || '';
  if (!raw && typeof globalThis.location?.search === 'string') {
    raw = new URLSearchParams(globalThis.location.search).get('city') || '';
  }
  return normalizeCityId(raw) || 'sanfrancisco';
}

const ACTIVE_CITY_ID = resolveActiveCityId();

function cityAssetPath(relPath) {
  const clean = String(relPath).replace(/^\.?\//, '');
  return `cities/${ACTIVE_CITY_ID}/${clean}`;
}

function switchCity(cityId) {
  const target = normalizeCityId(cityId) || 'sanfrancisco';
  if (typeof globalThis.location !== 'undefined') {
    const url = new URL(globalThis.location.href);
    url.searchParams.set('city', target);
    globalThis.location.href = url.toString();
  }
}

const FOLLOW_CAMERAS = [
  { id: 'chase',  name: '3rd-Person Chase',       category: 'follow', fov: 56 },
  { id: 'action', name: 'Low-Angle Action',       category: 'follow', fov: 60 },
  { id: 'pov',    name: 'First-Person / Cockpit', category: 'follow', fov: 68 }
];

const DRONE_CAMERA = { id: 'drone', name: 'Auto-Director Aerial', category: 'scenic', fov: 50 };

const CITY_PACKS = {
  royaloak: {
    id: 'royaloak',
    title: 'Royal Oak',
    stateCode: 'MI',
    stateLabel: 'Michigan',
    displayName: 'Royal Oak, MI',
    icon: 'img/icon-royaloak.svg',
    subtitle: 'Downtown, Woodward Ave, Detroit Zoo & Shrine of the Little Flower',
    countyLabel: 'OAKLAND COUNTY',
    cityLabel: 'ROYAL OAK',
    searchPlaceholder: 'Street or landmark (Main St, Woodward, 4th St, Detroit Zoo...)',
    loadingStages: {
      streets: 'Building Main Street, Woodward Ave and Royal Oak parks...',
      outskirts: 'Laying out Oakland County and the Woodward corridor...',
      landmarks: 'Building Shrine of the Little Flower, Detroit Zoo and Downtown...'
    },
    timeZone: 'America/Detroit',
    lat: 42.4876,
    lon: -83.1446,
    baseElev: 200.0,
    weatherStation: 'KVLL',
    riverGaugeSite: '04166100',
    riverGaugeBaseFt: 2.2,
    usualCfs: 45,
    kayakLaunch: { x: -1820, z: 1620 },
    defaultSpawn: { x: -4.5, z: 85 },
    police: {
      name: 'ROPD',
      doorTop: 'ROYAL OAK',
      doorBottom: 'POLICE',
      doorSub: 'OAKLAND COUNTY',
      badgeTitle: 'ROPD',
      baseColor: 0x16191e,
      stripeColor: 0x2b5fb8
    },
    plate: {
      state: 'MICHIGAN',
      slogan: 'WATER-WINTER WONDERLAND',
      sample: 'ROK 248',
      bg: '#f4f6f8',
      topBand: '#00274c',
      text: '#00274c',
      scriptColor: '#00274c',
      legacyEvery4: false
    },
    transit: {
      name: 'SMART',
      shortName: 'SMART',
      bodyColor: 0xf4f5f7,
      bandColor: 0xd62828,
      accentColor: 0xf77f00
    },
    ownCar: {
      kind: 'sports',
      hex: 0xd62828,
      plateText: 'ROK 248',
      state: 'MICHIGAN'
    },
    areas: [
      [-20, 0, 'Downtown Royal Oak'],
      [180, -60, 'Centennial Commons & Civic Center'],
      [-1180, -1820, 'Shrine / Northwood'],
      [-1850, 1650, 'Detroit Zoo / Huntington Woods'],
      [-900, -900, 'Woodward Corridor'],
      [-750, -1350, 'Vinsetta'],
      [1100, -1400, 'Red Run'],
      [-2550, -4150, 'Normandy Oaks'],
      [-1600, -4830, '14 Mile & Crooks'],
      [830, -4830, '14 Mile & Rochester'],
      [900, 900, 'Stephenson Corridor'],
      [-1100, 300, 'West Fourth']
    ],
    landmarks: [
      { id: 'main4th',  name: 'Main & 4th (Downtown Royal Oak)',              short: 'Main & 4th',         x: 0,     z: 0,     heading: 0 },
      { id: 'music',    name: 'Royal Oak Music Theatre',                      short: 'Music Theatre',      x: -165,  z: 110,   heading: 0 },
      { id: 'cityhall', name: 'Centennial Commons & City Hall',               short: 'Centennial Commons', x: 155,   z: -65,   heading: -Math.PI / 2 },
      { id: 'farmers',  name: 'Royal Oak Farmers Market',                     short: 'Farmers Market',     x: 220,   z: -40,   heading: -Math.PI / 2 },
      { id: 'amtrak',   name: 'Royal Oak Amtrak Station',                     short: 'Amtrak Depot',       x: -190,  z: 95,    heading: Math.PI / 2 },
      { id: 'shrine',   name: 'National Shrine of the Little Flower Basilica', short: 'Shrine Basilica',    x: -1180, z: -1820, heading: Math.PI },
      { id: 'zoo',      name: 'Detroit Zoo & Water Tower',                    short: 'Detroit Zoo',        x: -1850, z: 1650,  heading: Math.PI / 2 },
      { id: 'vinsetta', name: 'Woodward Ave & Vinsetta Blvd',                 short: 'Woodward & Vinsetta',x: -1020, z: -1450, heading: -0.5 },
      { id: 'normandy', name: 'Normandy Oaks Park & 14 Mile Corridor',        short: 'Normandy Oaks / 14 Mile', x: -2450, z: -4150, heading: 0 }
    ],
    teleportIds: ['main4th', 'music', 'cityhall', 'shrine', 'zoo', 'vinsetta', 'farmers', 'normandy'],
    modelledLandmarks: [
      'National Shrine of the Little Flower Basilica',
      'Shrine of the Little Flower',
      'Detroit Zoo Water Tower',
      'Royal Oak Music Theatre',
      'Royal Oak City Hall',
      'Royal Oak Farmers Market'
    ],
    areaLabels: [
      ['ROYAL OAK', 0, -200, 0],
      ['RED RUN', 1400, -1800, 1],
      ['DOWNTOWN', 0, 0, 2],
      ['CENTENNIAL COMMONS', 170, -65, 2],
      ['WOODWARD CORRIDOR', -950, -950, 2],
      ['SHRINE \u00b7 NORTHWOOD', -1180, -1820, 2],
      ['DETROIT ZOO', -1850, 1650, 2],
      ['HUNTINGTON WOODS', -1600, 900, 2],
      ['PLEASANT RIDGE', -900, 1650, 2],
      ['VINSETTA', -750, -1350, 2],
      ['NORMANDY OAKS', -2450, -4150, 2],
      ['14 MILE \u00b7 CROOKS', -1600, -4830, 2],
      ['13 MILE \u00b7 ROCHESTER', 450, -3220, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'mainStreet',     name: 'Main & 4th Downtown',        category: 'scenic', fov: 52 },
      { id: 'musicTheatre',   name: 'Royal Oak Music Theatre',    category: 'scenic', fov: 48 },
      { id: 'shrine',         name: 'Shrine of the Little Flower', category: 'scenic', fov: 46 },
      { id: 'shrineTop',      name: 'Shrine Tower Panorama',      category: 'scenic', fov: 54 },
      { id: 'detroitZoo',     name: 'Detroit Zoo & Water Tower',  category: 'scenic', fov: 50 },
      { id: 'woodward',       name: 'Woodward Ave Cruise',        category: 'scenic', fov: 50 },
      { id: 'royalOakAerial', name: 'Royal Oak Aerial',           category: 'scenic', fov: 46 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      mainStreet:     { pos: [12, 8.5, 68],        look: [-2, 6, -40],          ampPos: [5, 0.25, 4],   ampLook: [4, 0, 4],     freq: 0.14 },
      musicTheatre:   { pos: [-140, 6.5, 72],      look: [-168, 9, 114],        ampPos: [5, 0.2, 3],    ampLook: [3, 0, 2],     freq: 0.15 },
      shrine:         { pos: [-1125, 11, -1760],   look: [-1180, 19, -1820],    ampPos: [6, 0.3, 6],    ampLook: [3, 1, 3],     freq: 0.13 },
      shrineTop:      { pos: [-1170, 46, -1800],   look: [-400, 12, -600],      ampPos: [8, 0.5, 8],    ampLook: [90, 0, 90],   freq: 0.08 },
      detroitZoo:     { pos: [-1790, 12, 1605],    look: [-1855, 22, 1655],     ampPos: [6, 0.3, 6],    ampLook: [4, 1, 4],     freq: 0.12 },
      woodward:       { pos: [-960, 9.5, -1360],   look: [-1080, 7, -1540],     ampPos: [6, 0.25, 6],   ampLook: [5, 0, 5],     freq: 0.15 },
      royalOakAerial: { pos: [340, 155, 420],      look: [-120, 10, -180],      ampPos: [20, 2.0, 18],  ampLook: [25, 0, 25],   freq: 0.07 }
    },
    scenicStarts: {
      person:     { x: 14,    z: -12,  heading: Math.PI },
      car:        { x: -4.5,  z: 85,   heading: Math.PI },
      cyclist:    { x: 140,   z: -65,  heading: Math.PI },
      helicopter: { x: 180,   z: 420,  heading: Math.PI + 0.35, above: 130 },
      kayak:      { x: -1820, z: 1620, heading: Math.PI / 2 }
    },
    archetypes: {
      style: 'midwest-bungalow-brick',
      treeCoverage: { canopyCover: 0.33, streetTreeDensity: 1.2, streetTreeSpacing: 18.3, parkTreeDensity: 1.22, foliageScale: 1.18 },
      housingDensity: { form: 'suburban', buildingsPerKm2: 1351, footprintCoverage: 0.28, wallEnclosure: 0.43, lotInfill: 0.2, rowhouseAttachment: 0.04, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.22, shrubDensity: 1.28 },
      residential: {
        walls: { clapboard: 0.44, brick: 0.42, stone: 0.04, stucco: 0.04, shake: 0.06 },
        roofs: { flat: 0.04, hip: 0.38, gable: 0.56, gambrel: 0.02 },
        pitch: { hip: 0.36, gable: 0.44, historic: 0.52 },
        bricks: [0x8e4232, 0x9c4e3c, 0x7a382a, 0x6e4836, 0xa86448, 0xb87b56]
      },
      midrise: {
        masonry: { stoneColor: 0xb87452, trimColor: 0xd8d0c0, windowWidth: 2.6, floorHeight: 3.6 },
        historic: { stoneColor: 0x8e4232, trimColor: 0xcab9a0, windowWidth: 2.4, floorHeight: 3.6 },
        waterTowerProb: 0.03,
        fireEscapes: true
      },
      neighborhoods: {
        downtown_royal_oak: {
          treeCoverage: { canopyCover: 0.16, streetTreeDensity: 0.68, streetTreeSpacing: 32.4, parkTreeDensity: 1.08, foliageScale: 1.11 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1002, footprintCoverage: 0.4, wallEnclosure: 0.28, lotInfill: 0.2, rowhouseAttachment: 0.74, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 0.79, shrubDensity: 0.74 },
          midrise: { stoneColor: 0x9c4a38, trimColor: 0xded6c4, windowWidth: 2.5, floorHeight: 3.7, storefronts: true }
        },
        vinsetta: {
          treeCoverage: { canopyCover: 0.33, streetTreeDensity: 1.38, streetTreeSpacing: 15.9, parkTreeDensity: 1.22, foliageScale: 1.2 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1540, footprintCoverage: 0.23, wallEnclosure: 0.28, lotInfill: 0.2, rowhouseAttachment: 0.04, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.32, shrubDensity: 1.38 },
          residential: {
            walls: { clapboard: 0.22, brick: 0.54, stone: 0.14, stucco: 0.06, shake: 0.04 },
            roofs: { flat: 0.02, hip: 0.32, gable: 0.64, gambrel: 0.02 },
            pitch: { hip: 0.42, gable: 0.54, historic: 0.60 }
          }
        },
        shrine_northwood: {
          treeCoverage: { canopyCover: 0.35, streetTreeDensity: 1.23, streetTreeSpacing: 17.9, parkTreeDensity: 1.24, foliageScale: 1.18 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1420, footprintCoverage: 0.21, wallEnclosure: 0.28, lotInfill: 0.2, rowhouseAttachment: 0.04, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.22, shrubDensity: 1.28 },
          residential: {
            walls: { clapboard: 0.38, brick: 0.48, stone: 0.06, stucco: 0.04, shake: 0.04 },
            pitch: { hip: 0.38, gable: 0.48, historic: 0.54 }
          }
        }
      },
      landmarks: {
        'National Shrine of the Little Flower Basilica': { form: 'clock_tower', w: 54, d: 46, h: 42, primaryColor: 0xe3dccb, secondaryColor: 0xaca69b, roofColor: 0x457d68, accentColor: 0xffcf78 },
        'Detroit Zoo Water Tower': { form: 'observation_needle', w: 28, d: 28, h: 43, primaryColor: 0xd8e0e8, secondaryColor: 0xe8dec9, roofColor: 0x15589c, accentColor: 0xb54d32 },
        'Royal Oak Music Theatre': { form: 'historic_row', w: 32, d: 44, h: 18, primaryColor: 0x8f3f31, secondaryColor: 0xded6c6, accentColor: 0xffbf40, glowColor: 0xff3b2f, signText: 'ROYAL OAK MUSIC THEATRE' },
        'Royal Oak Farmers Market': { form: 'canal_palazzo', w: 62, d: 34, h: 12, primaryColor: 0xa64b38, secondaryColor: 0xe2dac9, roofColor: 0x4b565e }
      }
    }
  },

  oakland: {
    id: 'oakland',
    title: 'Oakland',
    stateCode: 'CA',
    stateLabel: 'California',
    displayName: 'Oakland, CA',
    icon: 'img/app-icon.png',
    subtitle: 'Downtown, Uptown, Lake Merritt & the Inner Harbor',
    countyLabel: 'ALAMEDA COUNTY',
    cityLabel: 'OAKLAND',
    searchPlaceholder: 'Street or landmark (Broadway, Telegraph, Lake Merritt, 14th St...)',
    loadingStages: {
      streets: 'Building streets, parks and Lake Merritt...',
      outskirts: 'Laying out the East Bay Hills and Alameda...',
      landmarks: 'Building the Tribune Tower, City Hall and Port Cranes...'
    },
    timeZone: 'America/Los_Angeles',
    lat: 37.8044,
    lon: -122.2712,
    baseElev: 0.0,
    weatherStation: 'KOAK',
    riverGaugeSite: '11181040',
    riverGaugeBaseFt: 2.5,
    usualCfs: 20,
    kayakLaunch: { x: 1050, z: -200 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'OPD',
      doorTop: 'OAKLAND',
      doorBottom: 'POLICE',
      doorSub: 'CITY OF OAKLAND',
      badgeTitle: 'OPD',
      baseColor: 0x16191e,
      stripeColor: 0x1b3d8a
    },
    plate: {
      state: 'California',
      slogan: 'dmv.ca.gov',
      sample: 'OAK 510',
      bg: '#f4f5f2',
      topBand: null,
      text: '#122b66',
      scriptColor: '#c81e2b',
      legacyEvery4: true
    },
    transit: {
      name: 'AC Transit',
      shortName: 'AC TRANSIT',
      bodyColor: 0xf2f4f5,
      bandColor: 0x008566,
      accentColor: 0xd93a2b
    },
    ownCar: {
      kind: 'sports',
      hex: 0xffcb05,
      plateText: 'OAK 510',
      state: 'CALIFORNIA'
    },
    areas: [
      [0, 0, 'Downtown Oakland'],
      [150, -550, 'Uptown'],
      [1100, -200, 'Lake Merritt'],
      [-150, 900, 'Jack London Square'],
      [150, 350, 'Chinatown'],
      [-350, 250, 'Old Oakland'],
      [-1200, 150, 'West Oakland'],
      [900, -900, 'Adams Point'],
      [1700, -900, 'Grand Lake'],
      [1400, 800, 'Merritt / Clinton'],
      [500, -1800, 'PIEDMONT AVE'],
      [-300, -1800, 'Temescal / Pill Hill']
    ],
    landmarks: [
      { id: 'cityhall',    name: 'Oakland City Hall & Frank Ogawa Plaza', short: 'City Hall',          x: -55,   z: -95,   heading: 0 },
      { id: 'tribune',     name: 'Oakland Tribune Tower',                 short: 'Tribune Tower',      x: 82,    z: 28,    heading: Math.PI },
      { id: 'fox',         name: 'Fox Oakland Theater',                   short: 'Fox Theater',        x: 68,    z: -480,  heading: 0 },
      { id: 'paramount',   name: 'Paramount Theatre',                     short: 'Paramount Theatre',  x: 195,   z: -620,  heading: 0 },
      { id: 'lakemerritt', name: 'Lake Merritt & The Pergola',            short: 'Lake Merritt',       x: 1380,  z: -680,  heading: Math.PI },
      { id: 'cathedral',   name: 'Cathedral of Christ the Light',         short: 'Christ the Light',   x: 780,   z: -690,  heading: Math.PI / 2 },
      { id: 'jacklondon',  name: 'Jack London Square Waterfront',         short: 'Jack London Sq',     x: -220,  z: 980,   heading: Math.PI },
      { id: 'omca',        name: 'Oakland Museum of California',          short: 'Oakland Museum',     x: 740,   z: 480,   heading: -Math.PI / 2 },
      { id: 'chinatown',   name: 'Oakland Chinatown (9th & Franklin)',    short: 'Chinatown',          x: 110,   z: 360,   heading: 0 },
      { id: 'grandlake',   name: 'Grand Lake Theatre',                    short: 'Grand Lake Theatre', x: 1750,  z: -1020, heading: Math.PI },
      { id: 'portcranes',  name: 'Port of Oakland Container Cranes',      short: 'Port Cranes',        x: -1600, z: 1050,  heading: Math.PI / 2 }
    ],
    teleportIds: ['cityhall', 'tribune', 'fox', 'lakemerritt', 'jacklondon', 'cathedral', 'chinatown'],
    modelledLandmarks: [
      'Tribune Tower',
      'Oakland City Hall',
      'Fox Theater',
      'Paramount Theatre',
      'Cathedral of Christ the Light',
      'Lake Merritt Pergola',
      'Oakland Museum of California',
      'Port of Oakland Cranes',
      'Grand Lake Theatre',
      'Lake Merritt Amphitheater'
    ],
    areaLabels: [
      ['OAKLAND', 100, -100, 0],
      ['LAKE MERRITT', 1100, -200, 1], ['OAKLAND ESTUARY', -400, 1450, 1], ['LAKE MERRITT CHANNEL', 1050, 950, 1],
      ['DOWNTOWN', 0, 50, 2], ['UPTOWN', 180, -580, 2], ['OLD OAKLAND', -340, 260, 2], ['CHINATOWN', 180, 380, 2],
      ['JACK LONDON SQUARE', -180, 960, 2], ['WEST OAKLAND', -1250, 100, 2], ['ADAMS POINT', 1150, -900, 2],
      ['GRAND LAKE', 1750, -1050, 2], ['LAKESIDE', 620, -380, 2], ['CLINTON', 1650, 650, 2],
      ['KONO', 180, -1100, 2], ['PILL HILL', 50, -1650, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'broadway',     name: 'Broadway & City Hall',       category: 'scenic', fov: 52 },
      { id: 'tribuneTower', name: 'Tribune Tower & 13th St',    category: 'scenic', fov: 48 },
      { id: 'tribuneTop',   name: 'Tribune Tower Panorama',     category: 'scenic', fov: 54 },
      { id: 'foxTheater',   name: 'Fox Theater & Uptown',       category: 'scenic', fov: 48 },
      { id: 'lakeMerritt',  name: 'Lake Merritt & Pergola',     category: 'scenic', fov: 50 },
      { id: 'jackLondon',   name: 'Jack London Waterfront',     category: 'scenic', fov: 50 },
      { id: 'oaklandHills', name: 'Lake Merritt Aerial',        category: 'scenic', fov: 46 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      broadway:     { pos: [12, 8.5, -25],      look: [-55, 28, -95],     ampPos: [5, 0.25, 4],   ampLook: [6, 0, 6],     freq: 0.14 },
      tribuneTower: { pos: [20, 7.5, -35],      look: [82, 42, 28],       ampPos: [6, 0.25, 4],   ampLook: [4, 3, 4],     freq: 0.15 },
      tribuneTop:   { pos: [82, 96, 28],        look: [680, 18, -280],    ampPos: [3, 0.5, 3],    ampLook: [120, 0, 120], freq: 0.08, absoluteY: true },
      foxTheater:   { pos: [25, 7.0, -420],     look: [68, 16, -480],     ampPos: [5, 0.2, 4],    ampLook: [4, 0, 3],     freq: 0.16 },
      lakeMerritt:  { pos: [1320, 6.5, -620],   look: [780, 22, -450],    ampPos: [8, 0.3, 6],    ampLook: [15, 0, 15],   freq: 0.13 },
      jackLondon:   { pos: [-260, 18.0, 1080],  look: [-900, 24, 980],    ampPos: [10, 0.5, 8],   ampLook: [20, 0, 15],   freq: 0.12 },
      oaklandHills: { pos: [1480, 135, 320],    look: [250, 24, -180],    ampPos: [18, 2.0, 16],  ampLook: [20, 0, 20],   freq: 0.07 }
    },
    scenicStarts: {
      person:     { x: -12,  z: -60,  heading: Math.atan2(-55 - -12, -95 - -60) },
      car:        { x: 18,   z: 120,  heading: Math.PI },
      cyclist:    { x: 820,  z: -420, heading: 0.5 },
      helicopter: { x: 1100, z: 300,  heading: -Math.PI / 2, above: 130 },
      kayak:      { x: 1050, z: -200, heading: 0 }
    },
    archetypes: {
      style: 'east-bay-craftsman-stucco',
      treeCoverage: { canopyCover: 0.19, streetTreeDensity: 0.84, streetTreeSpacing: 26.2, parkTreeDensity: 1.05, foliageScale: 1.02 },
      housingDensity: { form: 'urban', buildingsPerKm2: 1385, footprintCoverage: 0.41, wallEnclosure: 0.65, lotInfill: 0.22, rowhouseAttachment: 0.22, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.08, shrubDensity: 1.05 },
      residential: {
        walls: { clapboard: 0.42, brick: 0.03, stone: 0.02, stucco: 0.40, shake: 0.13 },
        roofs: { flat: 0.28, hip: 0.36, gable: 0.35, gambrel: 0.01 },
        pitch: { hip: 0.34, gable: 0.38, historic: 0.50 }
      },
      midrise: {
        masonry: { stoneColor: 0xd8cdb8, trimColor: 0x9e937f, windowWidth: 2.6, floorHeight: 3.7 },
        historic: { stoneColor: 0xa45a45, trimColor: 0xcab9a0, windowWidth: 2.4, floorHeight: 3.5 },
        waterTowerProb: 0.05,
        fireEscapes: true
      },
      neighborhoods: {
        old_oakland: {
          treeCoverage: { canopyCover: 0.15, streetTreeDensity: 0.79, streetTreeSpacing: 27.8, parkTreeDensity: 1.01, foliageScale: 1.01 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1130, footprintCoverage: 0.4, wallEnclosure: 0.48, lotInfill: 0.22, rowhouseAttachment: 0.22, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.08, shrubDensity: 1.05 },
          style: 'victorian-italianate-commercial-row',
          residential: {
            walls: { clapboard: 0.65, brick: 0.15, stone: 0.05, stucco: 0.10, shake: 0.05 },
            roofs: { flat: 0.45, hip: 0.30, gable: 0.25, gambrel: 0.0 },
            siding: [0xd99b52, 0x5c8294, 0x7c9c72, 0xc86452, 0xeadbc4]
          },
          midrise: { stoneColor: 0xb85c42, trimColor: 0xeadbc4, storefronts: true, fireEscapes: true }
        },
        west_oakland: {
          treeCoverage: { canopyCover: 0.25, streetTreeDensity: 0.92, streetTreeSpacing: 23.9, parkTreeDensity: 1.12, foliageScale: 1.03 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1508, footprintCoverage: 0.43, wallEnclosure: 0.75, lotInfill: 0.22, rowhouseAttachment: 0.22, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.08, shrubDensity: 1.05 },
          style: 'queen-anne-victorian-cottages',
          residential: {
            walls: { clapboard: 0.72, brick: 0.02, stone: 0.01, stucco: 0.15, shake: 0.10 },
            roofs: { flat: 0.08, hip: 0.32, gable: 0.58, gambrel: 0.02 },
            siding: [0x6e8c9e, 0xd4a259, 0x829c7a, 0xe8dfd0, 0xb86b58]
          }
        },
        chinatown: {
          treeCoverage: { canopyCover: 0.1, streetTreeDensity: 0.49, streetTreeSpacing: 38.0, parkTreeDensity: 0.95, foliageScale: 0.98 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1159, footprintCoverage: 0.49, wallEnclosure: 0.53, lotInfill: 0.22, rowhouseAttachment: 0.74, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.7, shrubDensity: 0.61 },
          style: 'oakland-chinatown-masonry-shopfronts',
          midrise: { stoneColor: 0xc86446, trimColor: 0xe2b857, storefronts: true, fireEscapes: true }
        },
        uptown: {
          treeCoverage: { canopyCover: 0.18, streetTreeDensity: 0.83, streetTreeSpacing: 26.5, parkTreeDensity: 1.04, foliageScale: 1.02 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1154, footprintCoverage: 0.44, wallEnclosure: 0.88, lotInfill: 0.22, rowhouseAttachment: 0.22, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.08, shrubDensity: 1.05 },
          style: 'art-deco-terracotta-theater-district',
          midrise: { stoneColor: 0x7a9e95, trimColor: 0xd9c282, storefronts: true, fireEscapes: true }
        },
        piedmont_ave: {
          treeCoverage: { canopyCover: 0.34, streetTreeDensity: 1.22, streetTreeSpacing: 18.0, parkTreeDensity: 1.22, foliageScale: 1.07 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1680, footprintCoverage: 0.26, wallEnclosure: 0.39, lotInfill: 0.22, rowhouseAttachment: 0.14, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.21, shrubDensity: 1.21 },
          style: 'east-bay-craftsman-bungalow',
          residential: {
            walls: { clapboard: 0.45, brick: 0.03, stone: 0.04, stucco: 0.22, shake: 0.26 },
            roofs: { flat: 0.06, hip: 0.34, gable: 0.60, gambrel: 0.0 },
            siding: [0x7a6855, 0x627362, 0xcab89e, 0x8c735b, 0x586875]
          }
        }
      },
      landmarks: {
        'Tribune Tower': { form: 'clock_tower', w: 26, d: 26, h: 93, wallColor: 0xa45a45, trimColor: 0xd8c8a8, roofColor: 0x4a7c6b },
        'Oakland City Hall': { form: 'clock_tower', w: 54, d: 38, h: 98, wallColor: 0xe6dfd0, trimColor: 0xb8ae9c, roofColor: 0x8a7d68 },
        'Fox Theater': { form: 'dome_palace', w: 52, d: 46, h: 36, wallColor: 0xd49b58, trimColor: 0x3b7a75, roofColor: 0xb8860b },
        'Paramount Theatre': { form: 'triumphal_arch', w: 38, d: 52, h: 32, wallColor: 0x7a9e95, trimColor: 0xd9b854 },
        'Cathedral of Christ the Light': { form: 'diagrid_prism', w: 42, d: 58, h: 38, wallColor: 0xdce8f0, trimColor: 0xc4a478 }
      }
    }
  },

  annarbor: {
    id: 'annarbor',
    title: 'Ann Arbor',
    stateCode: 'MI',
    stateLabel: 'Michigan',
    displayName: 'Ann Arbor, MI',
    icon: 'img/icon-annarbor.svg',
    subtitle: 'Downtown, the University of Michigan & the Huron River',
    countyLabel: 'WASHTENAW COUNTY',
    cityLabel: 'ANN ARBOR',
    searchPlaceholder: 'Street or landmark (Main St, State St, Huron, Big House...)',
    loadingStages: {
      streets: 'Building streets, parks and the Huron River...',
      outskirts: 'Laying out the hills of Washtenaw County...',
      landmarks: 'Building the Big House...'
    },
    timeZone: 'America/Detroit',
    lat: 42.2808,
    lon: -83.7430,
    baseElev: 256.0,
    weatherStation: 'KARB',
    riverGaugeSite: '04174500',
    riverGaugeBaseFt: 12.6,
    usualCfs: 350,
    kayakLaunch: { x: 196, z: -1310 },
    defaultSpawn: { x: -23, z: 228 },
    police: {
      name: 'AAPD',
      doorTop: 'ANN ARBOR',
      doorBottom: 'POLICE',
      doorSub: 'CITY OF ANN ARBOR',
      badgeTitle: 'AAPD',
      baseColor: 0xf6f9fc,
      stripeColor: 0x1b3d8a
    },
    plate: {
      state: 'MICHIGAN',
      slogan: 'WATER-WINTER WONDERLAND',
      sample: 'GO BLUE',
      bg: '#f4f6f8',
      topBand: '#00274c',
      text: '#00274c',
      scriptColor: '#00274c',
      legacyEvery4: false
    },
    transit: {
      name: 'TheRide',
      shortName: 'THERIDE',
      bodyColor: 0xf4f5f7,
      bandColor: 0x00549f,
      accentColor: 0x58a7dc
    },
    ownCar: {
      kind: 'sports',
      hex: 0xffcb05,
      plateText: 'GO BLUE',
      state: 'MICHIGAN'
    },
    areas: [
      [-60, 40, 'Downtown'],
      [220, -620, 'Kerrytown'],
      [540, 160, 'State Street'],
      [950, 280, 'Central Campus'],
      [1300, -700, 'Medical Campus'],
      [2900, -2200, 'North Campus'],
      [300, 1500, 'South Campus'],
      [1700, 1350, 'Burns Park'],
      [-800, 300, 'Old West Side'],
      [-700, -850, 'Water Hill'],
      [900, -1150, 'Lower Town'],
      [2300, 50, 'Nichols Arboretum']
    ],
    landmarks: [
      { id: 'diag',        name: 'The Diag (University of Michigan)', short: 'The Diag',         x: 842,   z: 277,   heading: 0 },
      { id: 'burton',      name: 'Burton Memorial Tower',             short: 'Burton Tower',     x: 713,   z: 109,   heading: Math.PI },
      { id: 'hill',        name: 'Hill Auditorium',                   short: 'Hill Auditorium',  x: 797,   z: 23,    heading: 0 },
      { id: 'union',       name: 'Michigan Union',                    short: 'Michigan Union',   x: 562,   z: 400,   heading: Math.PI / 2 },
      { id: 'lawquad',     name: 'Law Quadrangle',                    short: 'Law Quad',         x: 707,   z: 511,   heading: 0 },
      { id: 'michigantht', name: 'Michigan Theater',                  short: 'Michigan Theater', x: 465,   z: 24,    heading: 0 },
      { id: 'nickels',     name: 'Nickels Arcade',                    short: 'Nickels Arcade',   x: 556,   z: 138,   heading: -Math.PI / 2 },
      { id: 'mainst',      name: 'Main & Liberty (Downtown)',         short: 'Main & Liberty',   x: -11,   z: 22,    heading: Math.PI },
      { id: 'kerrytown',   name: 'Kerrytown Market & Farmers Market', short: 'Kerrytown',        x: 72,    z: -621,  heading: 0 },
      { id: 'bighouse',    name: 'Michigan Stadium (The Big House)',  short: 'Michigan Stadium', x: -26,   z: 1524,  heading: Math.PI },
      { id: 'crisler',     name: 'Crisler Center',                    short: 'Crisler Center',   x: 204,   z: 1711,  heading: -Math.PI / 2 },
      { id: 'arb',         name: 'Nichols Arboretum & Huron River',   short: 'The Arb',          x: 2250,  z: 30,    heading: Math.PI },
      { id: 'lurie',       name: 'Lurie Tower (North Campus)',        short: 'Lurie Tower',      x: 2954,  z: -1957, heading: 0 }
    ],
    teleportIds: ['mainst', 'diag', 'burton', 'lawquad', 'kerrytown', 'bighouse', 'arb'],
    modelledLandmarks: ['Michigan Stadium'],
    areaLabels: [
      ['ANN ARBOR', 600, -300, 0],
      ['HURON RIVER', 420, -1556, 1], ['HURON RIVER', 2979, -138, 1], ['HURON RIVER', -347, -2830, 1],
      ['DOWNTOWN', 0, -60, 2], ['KERRYTOWN', 220, -620, 2], ['STATE STREET', 540, 160, 2], ['CENTRAL CAMPUS', 950, 280, 2],
      ['MEDICAL CAMPUS', 1300, -700, 2], ['NORTH CAMPUS', 2900, -2200, 2], ['SOUTH CAMPUS', 300, 1300, 2],
      ['BURNS PARK', 1700, 1350, 2], ['OLD WEST SIDE', -800, 300, 2], ['WATER HILL', -700, -850, 2], ['LOWER TOWN', 900, -1150, 2],
      ['NICHOLS ARBORETUM', 2300, 50, 2], ['THE BIG HOUSE', -26, 1780, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'mainStreet',    name: 'Main & Liberty Downtown',    category: 'scenic', fov: 52 },
      { id: 'theDiag',       name: 'The Diag & Hatcher Library', category: 'scenic', fov: 50 },
      { id: 'burtonTower',   name: 'Burton Tower & Hill Aud.',   category: 'scenic', fov: 46 },
      { id: 'towerPlaza',    name: 'Tower Plaza Panorama',       category: 'scenic', fov: 54 },
      { id: 'stateStreet',   name: 'State St & Michigan Theater',category: 'scenic', fov: 48 },
      { id: 'huronRiver',    name: 'Huron River & Broadway',     category: 'scenic', fov: 50 },
      { id: 'bigHouse',      name: 'The Big House Aerial',       category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      mainStreet:  { pos: [-11, 7.5, 110],    look: [-11, 9, -40],     ampPos: [4, 0.25, 3],   ampLook: [5, 0, 0],     freq: 0.14 },
      theDiag:     { pos: [810, 6.0, 200],    look: [855, 14, 340],    ampPos: [8, 0.25, 4],   ampLook: [6, 0, 4],     freq: 0.15 },
      burtonTower: { pos: [760, 7.0, 210],    look: [740, 28, 70],     ampPos: [7, 0.3, 4],    ampLook: [4, 2, 2],     freq: 0.13 },
      towerPlaza:  { pos: [414, 92, 134],     look: [680, 22, 180],    ampPos: [3, 0.4, 3],    ampLook: [80, 0, 90],   freq: 0.09 },
      stateStreet: { pos: [540, 6.8, 95],     look: [465, 11, 24],     ampPos: [4, 0.2, 5],    ampLook: [3, 0, 3],     freq: 0.16 },
      huronRiver:  { pos: [480, 14, -1020],   look: [680, 4, -1120],   ampPos: [10, 0.4, 8],   ampLook: [12, 0, 10],   freq: 0.12 },
      bigHouse:    { pos: [190, 125, 1330],   look: [-26, 8, 1524],    ampPos: [18, 2.0, 16],  ampLook: [8, 0, 8],     freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: 845, z: 242,  heading: Math.atan2(797 - 845, 23 - 242) },
      car:        { x: -23, z: 228,  heading: Math.atan2(14.8, -378) },
      cyclist:    { x: 660, z: 529,  heading: Math.PI / 2 },
      helicopter: { x: -30, z: 1950, heading: Math.PI, above: 130 },
      kayak:      { x: 325, z: -1228, heading: Math.PI / 2 }
    },
    archetypes: {
      style: 'midwest-collegiate-clapboard',
      treeCoverage: { canopyCover: 0.31, streetTreeDensity: 1.14, streetTreeSpacing: 19.3, parkTreeDensity: 1.24, foliageScale: 1.18 },
      housingDensity: { form: 'suburban', buildingsPerKm2: 1180, footprintCoverage: 0.29, wallEnclosure: 0.62, lotInfill: 0.25, rowhouseAttachment: 0.08, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.24, shrubDensity: 1.25 },
      residential: {
        walls: { clapboard: 0.62, brick: 0.22, stone: 0.04, stucco: 0.06, shake: 0.06 },
        roofs: { flat: 0.04, hip: 0.36, gable: 0.56, gambrel: 0.04 },
        pitch: { hip: 0.36, gable: 0.44, historic: 0.54 }
      },
      midrise: {
        masonry: { stoneColor: 0x8a4632, trimColor: 0xd9ccb0, windowWidth: 2.3, floorHeight: 4.0 },
        historic: { stoneColor: 0xa45a45, trimColor: 0xcab9a0, windowWidth: 2.4, floorHeight: 3.5 },
        waterTowerProb: 0.04,
        fireEscapes: true
      },
      neighborhoods: {
        old_west_side: {
          treeCoverage: { canopyCover: 0.48, streetTreeDensity: 1.38, streetTreeSpacing: 15.9, parkTreeDensity: 1.39, foliageScale: 1.21 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1180, footprintCoverage: 0.19, wallEnclosure: 0.46, lotInfill: 0.25, rowhouseAttachment: 0.05, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.32, shrubDensity: 1.38 },
          residential: {
            walls: { clapboard: 0.72, brick: 0.18, stone: 0.02, stucco: 0.04, shake: 0.04 },
            roofs: { flat: 0.02, hip: 0.28, gable: 0.66, gambrel: 0.04 },
            pitch: { hip: 0.40, gable: 0.52, historic: 0.58 },
            siding: [0x7a3b33, 0x46604a, 0xb8924a, 0x52616d, 0xe6dcc3, 0x8c6f4e, 0xd8c8a0]
          }
        },
        kerrytown: {
          treeCoverage: { canopyCover: 0.32, streetTreeDensity: 1.15, streetTreeSpacing: 19.1, parkTreeDensity: 1.25, foliageScale: 1.18 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1180, footprintCoverage: 0.24, wallEnclosure: 0.43, lotInfill: 0.25, rowhouseAttachment: 0.08, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.24, shrubDensity: 1.25 },
          midrise: { stoneColor: 0x8e4232, trimColor: 0xd9ccb0, windowWidth: 2.3, floorHeight: 3.6, storefronts: true }
        },
        central_campus: {
          treeCoverage: { canopyCover: 0.15, streetTreeDensity: 0.65, streetTreeSpacing: 33.8, parkTreeDensity: 1.1, foliageScale: 1.11 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1180, footprintCoverage: 0.46, wallEnclosure: 0.74, lotInfill: 0.25, rowhouseAttachment: 0.74, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 0.81, shrubDensity: 0.72 },
          midrise: { stoneColor: 0x8a4632, trimColor: 0xd9ccb0, windowWidth: 2.2, floorHeight: 4.2 }
        }
      },
      landmarks: {
        'Burton Memorial Tower': { form: 'clock_tower', w: 14, d: 14, h: 65, primaryColor: 0xdcd5c6, secondaryColor: 0x9e9585, roofColor: 0x457d68 },
        'Michigan Stadium': { form: 'stadium_bowl', w: 230, d: 190, h: 32, primaryColor: 0x8e4232, secondaryColor: 0x2e6f40, roofColor: 0x162d4c },
        'Michigan Theater': { form: 'historic_row', w: 32, d: 46, h: 18, primaryColor: 0x9c4836, secondaryColor: 0xd8cfb8, glowColor: 0xffbf40 }
      }
    }
  },

  newyork: {
    id: 'newyork',
    title: 'New York',
    stateCode: 'NY',
    stateLabel: 'New York',
    displayName: 'New York, NY',
    icon: 'img/icon-newyork.svg',
    subtitle: 'Manhattan, the Hudson & East Rivers, and the Five Boroughs',
    countyLabel: 'NEW YORK CITY',
    cityLabel: 'MANHATTAN',
    searchPlaceholder: 'Street, avenue or landmark (e.g. 42nd St, Broadway, Wall St...)',
    loadingStages: {
      streets: 'Building streets, Central Park and waterfronts...',
      outskirts: 'Building bridges and surrounding boroughs...',
      landmarks: 'Building Empire State, Chrysler, One WTC and Midtown landmarks...'
    },
    timeZone: 'America/New_York',
    lat: 40.7580,
    lon: -73.9855,
    baseElev: 0.0,
    weatherStation: 'KNYC',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.0,
    usualCfs: 12000,
    kayakLaunch: { x: -1750, z: 180 },
    defaultSpawn: { x: 0, z: 320 },
    police: {
      name: 'NYPD',
      doorTop: 'NYPD',
      doorBottom: 'POLICE',
      doorSub: 'COURTESY PROFESSIONALISM RESPECT',
      badgeTitle: 'NYPD',
      baseColor: 0xf6f9fc,
      stripeColor: 0x1b3d8a
    },
    plate: {
      state: 'NEW YORK',
      slogan: 'EMPIRE STATE',
      sample: 'NYC 212',
      bg: '#f5b82e',
      topBand: '#102448',
      text: '#102448',
      scriptColor: '#102448',
      legacyEvery4: false
    },
    transit: {
      name: 'MTA',
      shortName: 'MTA NYC BUS',
      bodyColor: 0xf4f6f8,
      bandColor: 0x0039a6,
      accentColor: 0x006bb6
    },
    ownCar: {
      kind: 'taxi',
      hex: 0xf7b512,
      plateText: 'NYC 212',
      state: 'NEW YORK'
    },
    areas: [
      [0, -400, 'Midtown'],
      [-201, -40, 'Times Square'],
      [-310, -2960, 'Central Park'],
      [0, 1560, 'Flatiron / Gramercy'],
      [-540, 2830, 'Greenwich Village'],
      [200, 3560, 'SoHo'],
      [-140, 4460, 'TriBeCa'],
      [455, 5715, 'Financial District'],
      [-1410, -3070, 'Upper West Side'],
      [590, -2680, 'Upper East Side'],
      [-320, -6750, 'Harlem']
    ],
    landmarks: [
      { id: 'esb',          name: 'Empire State Building',      short: 'Empire State',       x: -69,   z: 676,   heading: Math.PI },
      { id: 'chrysler',     name: 'Chrysler Building',          short: 'Chrysler Bldg',      x: 547,   z: 27,    heading: Math.PI },
      { id: 'vanderbilt',   name: 'One Vanderbilt',             short: 'One Vanderbilt',     x: 245,   z: -4,    heading: 0 },
      { id: 'grandcentral', name: 'Grand Central Terminal',     short: 'Grand Central',      x: 342,   z: -16,   heading: 0 },
      { id: 'bryant',       name: 'Bryant Park & NYPL',         short: 'Bryant Park & NYPL', x: -115,  z: 86,    heading: 0 },
      { id: 'timessq',      name: 'Times Square (Bowtie)',      short: 'Times Square',       x: -201,  z: -40,   heading: Math.PI },
      { id: 'rockefeller',  name: 'Rockefeller Center',         short: '30 Rock',            x: -102,  z: -480,  heading: 0 },
      { id: 'citigroup',    name: 'Citigroup Center',           short: 'Citigroup Ctr',      x: 526,   z: -867,  heading: Math.PI },
      { id: 'flatiron',     name: 'Flatiron Building',          short: 'Flatiron Bldg',      x: 1,     z: 1560,  heading: Math.PI },
      { id: 'centralpark',  name: 'Central Park South',         short: 'Central Park',       x: -310,  z: -1350, heading: Math.PI },
      { id: 'hudsonpier',   name: 'Hudson River Piers',         short: 'Hudson Piers',       x: -1620, z: 180,   heading: Math.PI * 0.5 },
      { id: 'wtc',          name: 'One World Trade Center',     short: 'One WTC',            x: -414,  z: 5390,  heading: 0 },
      { id: 'wallst',       name: 'Wall Street & NYSE',         short: 'Wall Street',        x: 326,   z: 5955,  heading: Math.PI }
    ],
    teleportIds: ['timessq', 'esb', 'grandcentral', 'rockefeller', 'centralpark', 'flatiron', 'wtc'],
    modelledLandmarks: [
      'Empire State Building',
      'Chrysler Building',
      'One Vanderbilt',
      'Grand Central Terminal',
      'MetLife Building',
      'Stephen A. Schwarzman Building',
      'One Times Square',
      '30 Rockefeller Plaza',
      'Citigroup Center',
      'Seagram Building',
      'Flatiron Building',
      'One World Trade Center',
      'New York Stock Exchange'
    ],
    areaLabels: [
      ['MANHATTAN', 120, -1500, 0], ['NEW JERSEY', -7000, 2000, 0], ['BROOKLYN', 7850, 8780, 0], ['QUEENS', 8810, -1680, 0],
      ['THE BRONX', 1010, -9640, 0], ['STATEN ISLAND', -1800, 19220, 0],
      ['HUDSON RIVER', -2680, -300, 1], ['HUDSON RIVER', -2650, -5600, 1], ['EAST RIVER', 1700, 800, 1],
      ['HARLEM RIVER', 220, -7930, 1], ['UPPER NEW YORK BAY', 130, 10530, 1],
      ['HARLEM', -320, -6750, 2], ['MORNINGSIDE HEIGHTS', -1600, -6160, 2], ['EAST HARLEM', 830, -5820, 2],
      ['UPPER WEST SIDE', -1410, -3070, 2], ['CENTRAL PARK', -430, -3280, 2], ['UPPER EAST SIDE', 590, -2680, 2],
      ['ROOSEVELT ISLAND', 1810, -2030, 2], ["HELL'S KITCHEN", -1350, -590, 2], ['MIDTOWN', 100, -500, 2],
      ['MURRAY HILL', 680, 330, 2], ['HUDSON YARDS', -1510, 770, 2], ['CHELSEA', -1030, 1650, 2],
      ['FLATIRON \u00b7 GRAMERCY', 330, 1660, 2], ['GREENWICH VILLAGE', -540, 2830, 2], ['EAST VILLAGE', 1250, 2800, 2],
      ['SOHO', 200, 3560, 2], ['LOWER EAST SIDE', 1690, 3760, 2], ['TRIBECA', -140, 4460, 2], ['CHINATOWN', 850, 4420, 2],
      ['BATTERY PARK CITY', -370, 5540, 2], ['FINANCIAL DISTRICT', 455, 5715, 2], ['GOVERNORS ISLAND', 795, 7685, 2],
      ['LIBERTY ISLAND', -1234, 8849, 2], ['ELLIS ISLAND', -1427, 7648, 2], ["RANDALL'S ISLAND", 2268, -6301, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'timesSquare',   name: 'Times Square Bowtie',      category: 'scenic', fov: 54 },
      { id: 'fifthAve',      name: '5th Ave & Empire State',   category: 'scenic', fov: 46 },
      { id: 'esbObservatory',name: 'Empire State 86th Deck',   category: 'scenic', fov: 54 },
      { id: 'grandCentral',  name: '42nd St & Chrysler Spire', category: 'scenic', fov: 48 },
      { id: 'centralPark',   name: 'Central Park South',       category: 'scenic', fov: 50 },
      { id: 'hudsonRiver',   name: 'Hudson River Skyline',     category: 'scenic', fov: 44 },
      { id: 'lowerManhattan',name: 'One WTC & Financial Dist.',category: 'scenic', fov: 46 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      timesSquare:    { pos: [-201, 9.5, -205],     look: [-194, 24, 15],        ampPos: [5.5, 0.35, 3.0], ampLook: [4.5, 0, 0],     freq: 0.14, absoluteY: true },
      fifthAve:       { pos: [0, 8.2, 220],         look: [-65, 115, 676],       ampPos: [4.5, 0, 12],     ampLook: [0, 8, 0],       freq: 0.12, absoluteY: true },
      esbObservatory: { pos: [-69, 326.5, 646],     look: [40, 92, -320],        ampPos: [6, 0, 2],        ampLook: [95, 0, 45],     freq: 0.09, absoluteY: true },
      grandCentral:   { pos: [148, 9.0, 40],        look: [480, 92, 22],         ampPos: [5, 0.25, 2],     ampLook: [0, 6, 0],       freq: 0.11, absoluteY: true },
      centralPark:    { pos: [-195, 22, -1355],     look: [-60, 72, -480],       ampPos: [14, 1.2, 0],     ampLook: [10, 0, 0],      freq: 0.10, absoluteY: true },
      hudsonRiver:    { pos: [-2150, 96, 120],      look: [-60, 95, 160],        ampPos: [0, 5, 65],       ampLook: [0, 0, 28],      freq: 0.08, absoluteY: true },
      lowerManhattan: { pos: [-960, 145, 5820],     look: [-120, 125, 5520],     ampPos: [18, 4, 28],      ampLook: [12, 0, 12],     freq: 0.08, absoluteY: true }
    },
    scenicStarts: {
      person:     { x: -19.2, z: 320,  heading: Math.PI },
      car:        { x: -7.0,  z: 308,  heading: Math.PI },
      cyclist:    { x: -18.2, z: 312,  heading: Math.PI },
      helicopter: { x: -140,  z: 400,  heading: 2.6, above: 96 },
      kayak:      { x: -1750, z: 180,  heading: 0 }
    },
    archetypes: {
      style: 'manhattan-brownstone-prewar',
      treeCoverage: { canopyCover: 0.21, streetTreeDensity: 0.68, streetTreeSpacing: 32.4, parkTreeDensity: 1.28, foliageScale: 0.81 },
      housingDensity: { form: 'highrise', buildingsPerKm2: 3200, footprintCoverage: 0.58, wallEnclosure: 0.62, lotInfill: 0.1, rowhouseAttachment: 0.88, maxHouseHeight: 8.8, maxHouseFootprint: 240, porchProbScale: 0.42, shrubDensity: 0.35 },
      residential: {
        walls: { clapboard: 0.08, brick: 0.64, stone: 0.22, stucco: 0.04, shake: 0.02 },
        roofs: { flat: 0.86, hip: 0.06, gable: 0.06, gambrel: 0.02 },
        pitch: { hip: 0.32, gable: 0.38, historic: 0.44 },
        bricks: [0x7c3b2c, 0x6b3e2e, 0x8e4a38, 0x5c3426, 0x9a5240, 0x7b5944]
      },
      midrise: {
        masonry: { stoneColor: 0xd8cdb8, trimColor: 0x9e937f, windowWidth: 2.6, floorHeight: 3.7 },
        historic: { stoneColor: 0xa45a45, trimColor: 0xcab9a0, windowWidth: 2.4, floorHeight: 3.5 },
        waterTowerProb: 0.26,
        fireEscapes: true
      },
      neighborhoods: {
        harlem: {
          treeCoverage: { canopyCover: 0.15, streetTreeDensity: 0.59, streetTreeSpacing: 37.3, parkTreeDensity: 1.15, foliageScale: 0.8 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3200, footprintCoverage: 0.6, wallEnclosure: 0.43, lotInfill: 0.1, rowhouseAttachment: 0.88, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.42, shrubDensity: 0.35 },
          midrise: { stoneColor: 0x6e4232, trimColor: 0xb8a894, windowWidth: 2.2, floorHeight: 3.5, fireEscapes: true, waterTowerProb: 0.30 }
        },
        village: {
          treeCoverage: { canopyCover: 0.12, streetTreeDensity: 0.54, streetTreeSpacing: 38.0, parkTreeDensity: 1.08, foliageScale: 0.79 },
          housingDensity: { form: 'highrise', buildingsPerKm2: 3200, footprintCoverage: 0.6, wallEnclosure: 0.78, lotInfill: 0.1, rowhouseAttachment: 0.88, maxHouseHeight: 8.8, maxHouseFootprint: 240, porchProbScale: 0.42, shrubDensity: 0.35 },
          midrise: { stoneColor: 0x8e3e2e, trimColor: 0xd8cfc0, windowWidth: 2.2, floorHeight: 3.4, fireEscapes: true, storefronts: true, waterTowerProb: 0.32 }
        },
        soho: {
          treeCoverage: { canopyCover: 0.12, streetTreeDensity: 0.54, streetTreeSpacing: 38.0, parkTreeDensity: 1.08, foliageScale: 0.79 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3200, footprintCoverage: 0.68, wallEnclosure: 0.78, lotInfill: 0.1, rowhouseAttachment: 0.88, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.42, shrubDensity: 0.35 },
          midrise: { stoneColor: 0xd8d2c6, trimColor: 0x585c62, windowWidth: 2.8, floorHeight: 4.1, fireEscapes: true, storefronts: true, waterTowerProb: 0.34 }
        },
        uws: {
          treeCoverage: { canopyCover: 0.12, streetTreeDensity: 0.54, streetTreeSpacing: 38.0, parkTreeDensity: 1.08, foliageScale: 0.79 },
          housingDensity: { form: 'highrise', buildingsPerKm2: 3200, footprintCoverage: 0.6, wallEnclosure: 0.78, lotInfill: 0.1, rowhouseAttachment: 0.88, maxHouseHeight: 8.8, maxHouseFootprint: 240, porchProbScale: 0.42, shrubDensity: 0.35 },
          midrise: { stoneColor: 0xb88468, trimColor: 0xd8cdb8, windowWidth: 2.4, floorHeight: 3.6, fireEscapes: true, waterTowerProb: 0.28 }
        }
      },
      landmarks: {
        'Empire State Building': { form: 'stepped_bundled_tube', w: 129, d: 57, h: 381, primaryColor: 0xd8cdb8, secondaryColor: 0x9e937f, accentColor: 0xc8d0d8, twinSpire: false },
        'Chrysler Building': { form: 'stepped_bundled_tube', w: 62, d: 62, h: 319, primaryColor: 0xdfd8c8, secondaryColor: 0xc8d0d8, accentColor: 0xe8eef4, twinSpire: false },
        'One World Trade Center': { form: 'diagrid_prism', w: 61, d: 61, h: 417, primaryColor: 0x385e82, secondaryColor: 0xb8c6d4, accentColor: 0xe6edf5 }
      }
    }
  },

  pompanobeach: {
    id: 'pompanobeach',
    title: 'Pompano Beach',
    stateCode: 'FL',
    stateLabel: 'Florida',
    displayName: 'Pompano Beach, FL',
    icon: 'img/icon-pompanobeach.svg',
    subtitle: 'Fisher Family Pier, Hillsboro Inlet Lighthouse, Intracoastal Canals & Airpark',
    countyLabel: 'BROWARD COUNTY',
    cityLabel: 'POMPANO BEACH',
    searchPlaceholder: 'Street or landmark (Atlantic Blvd, Ocean Blvd, Pier, Hillsboro Inlet, US-1...)',
    loadingStages: {
      streets: 'Building Atlantic Blvd, A1A, the Intracoastal and finger canals...',
      outskirts: 'Laying out Broward County, Pompano Airpark and the Atlantic coast...',
      landmarks: 'Building Fisher Family Pier, Hillsboro Lighthouse and the Goodyear Blimp...'
    },
    timeZone: 'America/New_York',
    lat: 26.2318,
    lon: -80.1038,
    baseElev: 0.0,
    weatherStation: 'KPMP',
    riverGaugeSite: '02281500',
    riverGaugeBaseFt: 1.8,
    usualCfs: 35,
    kayakLaunch: { x: 1120, z: 60 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'BSO',
      doorTop: 'BROWARD',
      doorBottom: 'SHERIFF',
      doorSub: 'POMPANO BEACH',
      badgeTitle: 'BSO',
      baseColor: 0x143322,
      stripeColor: 0xd4af37
    },
    plate: {
      state: 'MYFLORIDA.COM',
      slogan: 'SUNSHINE STATE',
      sample: 'PMP 954',
      bg: '#f7f8f5',
      topBand: '#e87722',
      text: '#006847',
      scriptColor: '#e87722',
      legacyEvery4: false
    },
    transit: {
      name: 'Broward County Transit',
      shortName: 'BCT',
      bodyColor: 0xf4f6f8,
      bandColor: 0x0072ce,
      accentColor: 0xf58220
    },
    ownCar: {
      kind: 'sports',
      hex: 0x00b4d8,
      plateText: 'PMP 954',
      state: 'FLORIDA'
    },
    areas: [
      [0, 0, 'Atlantic & Federal (US-1)'],
      [1728, -345, 'Pompano Beach & Fisher Family Pier'],
      [2317, -3034, 'Hillsboro Inlet Lighthouse'],
      [1188, -11, 'Intracoastal Waterway & Atlantic Bridge'],
      [879, 533, 'Harbor Village Finger Canals'],
      [750, 1650, 'Santa Barbara Shores Canals'],
      [1538, -2112, 'NE 14th St Causeway'],
      [-719, -1689, 'Pompano Beach Airpark & Blimp Base'],
      [-1867, -22, 'Civic Center & Amphitheater'],
      [-2217, -78, 'Old Town Pompano']
    ],
    landmarks: [
      { id: 'atlanticus1', name: 'Atlantic Blvd & Federal Hwy (US-1)',            short: 'Atlantic & US-1',      x: 0,     z: 0,     heading: Math.PI / 2 },
      { id: 'pier',        name: 'Pompano Beach Fisher Family Pier',              short: 'Fisher Family Pier',   x: 1620,  z: -345,  heading: Math.PI / 2 },
      { id: 'lighthouse',  name: 'Hillsboro Inlet Lighthouse & Coast Guard',      short: 'Hillsboro Lighthouse', x: 2260,  z: -2980, heading: 0 },
      { id: 'icwbridge',   name: 'Atlantic Blvd Intracoastal Drawbridge',         short: 'Intracoastal Bridge',  x: 1140,  z: -11,   heading: Math.PI / 2 },
      { id: 'canals',      name: 'Harbor Village Finger Canals',                  short: 'Finger Canals',        x: 879,   z: 533,   heading: 0 },
      { id: 'airpark',     name: 'Pompano Beach Airpark & Goodyear Blimp Base',   short: 'Airpark & Blimp Base', x: -650,  z: -1620, heading: 0 },
      { id: 'amp',         name: 'Pompano Beach Amphitheater (The Amp)',          short: 'The Amp / Civic Ctr',  x: -1820, z: 20,    heading: -Math.PI / 2 },
      { id: 'oldtown',     name: 'Old Town Pompano & Arts District',              short: 'Old Town Pompano',     x: -2217, z: -20,   heading: -Math.PI / 2 }
    ],
    teleportIds: ['atlanticus1', 'pier', 'lighthouse', 'icwbridge', 'canals', 'airpark', 'amp', 'oldtown'],
    modelledLandmarks: [
      'Pompano Beach Fisher Family Pier',
      'Hillsboro Inlet Lighthouse',
      'Pompano Beach Amphitheater',
      'Pompano Airpark Goodyear Blimp Hangar',
      'Atlantic Blvd Intracoastal Control Tower',
      'Old Town Pompano Civic Plaza'
    ],
    areaLabels: [
      ['POMPANO BEACH', 0, -200, 0],
      ['ATLANTIC OCEAN', 2250, -500, 1],
      ['INTRACOASTAL WATERWAY', 1200, -700, 1],
      ['HILLSBORO INLET', 2317, -3034, 2],
      ['FISHER FAMILY PIER', 1728, -345, 2],
      ['ATLANTIC \u00b7 US-1', 0, 0, 2],
      ['HARBOR VILLAGE CANALS', 879, 533, 2],
      ['SANTA BARBARA SHORES', 750, 1650, 2],
      ['POMPANO AIRPARK (KPMP)', -719, -1689, 2],
      ['MUNICIPAL GOLF COURSE', -450, -1350, 2],
      ['CIVIC CENTER \u00b7 THE AMP', -1867, -22, 2],
      ['OLD TOWN POMPANO', -2217, -78, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'pierSunset',       name: 'Fisher Family Pier & Ocean',   category: 'scenic', fov: 50 },
      { id: 'hillsboroLight',   name: 'Hillsboro Inlet Lighthouse',   category: 'scenic', fov: 48 },
      { id: 'intracoastalBridge', name: 'Atlantic Intracoastal Bridge', category: 'scenic', fov: 50 },
      { id: 'fingerCanals',     name: 'Harbor Village Finger Canals', category: 'scenic', fov: 52 },
      { id: 'blimpBase',        name: 'Airpark & Goodyear Blimp',     category: 'scenic', fov: 48 },
      { id: 'theAmp',           name: 'Pompano Amphitheater',         category: 'scenic', fov: 50 },
      { id: 'coastalAerial',    name: 'Barrier Island & Coast Aerial',category: 'scenic', fov: 46 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      pierSunset:         { pos: [1580, 12, -290],    look: [1760, 8, -345],      ampPos: [8, 0.4, 6],   ampLook: [4, 0, 4],   freq: 0.12 },
      hillsboroLight:     { pos: [2220, 14, -2940],   look: [2317, 24, -3034],    ampPos: [7, 0.4, 7],   ampLook: [3, 1, 3],   freq: 0.11 },
      intracoastalBridge: { pos: [1080, 15, 65],      look: [1200, 8, -20],       ampPos: [6, 0.3, 6],   ampLook: [4, 0, 4],   freq: 0.13 },
      fingerCanals:       { pos: [980, 45, 720],      look: [850, 4, 480],        ampPos: [10, 0.8, 10], ampLook: [8, 0, 8],   freq: 0.09 },
      blimpBase:          { pos: [-580, 18, -1580],   look: [-719, 28, -1689],    ampPos: [8, 0.5, 8],   ampLook: [5, 1, 5],   freq: 0.10 },
      theAmp:             { pos: [-1790, 11, 45],     look: [-1867, 10, -22],     ampPos: [5, 0.3, 5],   ampLook: [3, 0, 3],   freq: 0.13 },
      coastalAerial:      { pos: [2150, 165, 250],    look: [1250, 10, -450],     ampPos: [22, 2.0, 20], ampLook: [20, 0, 20], freq: 0.07 }
    },
    scenicStarts: {
      person:     { x: 1595, z: -345, heading: Math.PI / 2 },
      car:        { x: 0,    z: 0,    heading: Math.PI / 2 },
      cyclist:    { x: 1580, z: -200, heading: 0 },
      helicopter: { x: 1650, z: -250, heading: -0.4, above: 120 },
      kayak:      { x: 1120, z: 60,   heading: 0 }
    },
    archetypes: {
      style: 'florida-coastal-stucco-tile',
      treeCoverage: { canopyCover: 0.23, streetTreeDensity: 0.94, streetTreeSpacing: 23.4, parkTreeDensity: 1.07, foliageScale: 1.07 },
      housingDensity: { form: 'suburban', buildingsPerKm2: 835, footprintCoverage: 0.3, wallEnclosure: 0.37, lotInfill: 0.68, rowhouseAttachment: 0.06, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 0.95, shrubDensity: 1.22 },
      residential: {
        walls: { clapboard: 0.08, brick: 0.02, stone: 0.04, stucco: 0.84, shake: 0.02 },
        roofs: { flat: 0.34, hip: 0.50, gable: 0.16, gambrel: 0.0 },
        pitch: { hip: 0.24, gable: 0.26, historic: 0.30 },
        stucco: [0xf5efe2, 0xf2dfd3, 0xe8d8bf, 0xd8ebe4, 0xf4e3b8, 0xebe6dc, 0xe2c7b8],
        shingles: [0xb85238, 0xc45e40, 0xd6cfc2, 0x8c4a38, 0x9ea3a8, 0xa84c34]
      },
      midrise: {
        masonry: { stoneColor: 0xefe9dd, trimColor: 0xc8c0b0, windowWidth: 3.0, floorHeight: 3.6 },
        historic: { stoneColor: 0xe6d2bd, trimColor: 0xf5f2eb, windowWidth: 2.8, floorHeight: 3.5 },
        waterTowerProb: 0.0,
        fireEscapes: false
      },
      neighborhoods: {
        pompano_beach_fisher_family_pier: {
          treeCoverage: { canopyCover: 0.13, streetTreeDensity: 0.81, streetTreeSpacing: 27.2, parkTreeDensity: 0.96, foliageScale: 1.06 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1150, footprintCoverage: 0.21, wallEnclosure: 0.27, lotInfill: 0.68, rowhouseAttachment: 0.06, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 0.95, shrubDensity: 1.22 },
          midrise: { stoneColor: 0xf4f2ec, trimColor: 0x52b8c4, windowWidth: 3.2, floorHeight: 3.6, storefronts: true }
        },
        harbor_village_finger_canals: {
          treeCoverage: { canopyCover: 0.31, streetTreeDensity: 1.23, streetTreeSpacing: 17.9, parkTreeDensity: 1.15, foliageScale: 1.11 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 963, footprintCoverage: 0.19, wallEnclosure: 0.27, lotInfill: 0.68, rowhouseAttachment: 0.04, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.06, shrubDensity: 1.38 },
          residential: {
            walls: { clapboard: 0.04, brick: 0.02, stone: 0.04, stucco: 0.88, shake: 0.02 },
            roofs: { flat: 0.24, hip: 0.64, gable: 0.12, gambrel: 0.0 },
            stucco: [0xf7f2e8, 0xf5dfd0, 0xd6ece6, 0xf6e6be, 0xede6da]
          }
        },
        old_town_pompano: {
          treeCoverage: { canopyCover: 0.31, streetTreeDensity: 1.05, streetTreeSpacing: 21.0, parkTreeDensity: 1.15, foliageScale: 1.09 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 835, footprintCoverage: 0.27, wallEnclosure: 0.28, lotInfill: 0.68, rowhouseAttachment: 0.06, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 0.95, shrubDensity: 1.22 },
          midrise: { stoneColor: 0xe6d4be, trimColor: 0xc86448, windowWidth: 2.6, floorHeight: 3.5, storefronts: true }
        }
      },
      landmarks: {
        'Pompano Beach Fisher Family Pier': { form: 'arch_bridge', w: 260, d: 28, h: 14, primaryColor: 0xe8eef2, secondaryColor: 0x2892a8 },
        'Hillsboro Inlet Lighthouse': { form: 'observation_needle', w: 28, d: 28, h: 42, primaryColor: 0xf4f6f8, secondaryColor: 0x1e2228, glowColor: 0xfff2a8 },
        'Pompano Beach Amphitheater': { form: 'opera_sails', w: 64, d: 58, h: 18, primaryColor: 0xf7f9fb, secondaryColor: 0xcfc8bc, sails: 2 }
      }
    }
  },

  sanfrancisco: {
    id: 'sanfrancisco',
    title: 'San Francisco',
    stateCode: 'CA',
    stateLabel: 'California',
    displayName: 'San Francisco, CA',
    icon: 'img/icon-sanfrancisco.svg',
    subtitle: 'Full 7x7 Mile City: Golden Gate Bridge, Union Square, Golden Gate Park, Twin Peaks & Embarcadero',
    countyLabel: 'CITY & COUNTY OF SF',
    cityLabel: 'SAN FRANCISCO',
    searchPlaceholder: 'Street or landmark (Market St, Golden Gate Bridge, Lombard, Golden Gate Park, Castro...)',
    loadingStages: {
      streets: 'Building the 7x7 mile streets, hills, Golden Gate Park and the Embarcadero...',
      outskirts: 'Laying out the Golden Gate Strait, Pacific Ocean and San Francisco Bay...',
      landmarks: 'Building Golden Gate Bridge, Transamerica Pyramid, Coit Tower, Sutro Tower and City Hall...'
    },
    timeZone: 'America/Los_Angeles',
    lat: 37.7879,
    lon: -122.4075,
    baseElev: 0.0,
    weatherStation: 'KSFO',
    riverGaugeSite: '11162765',
    riverGaugeBaseFt: 3.0,
    usualCfs: 25,
    kayakLaunch: { x: -1350, z: -2120 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'SFPD',
      doorTop: 'SAN FRANCISCO',
      doorBottom: 'POLICE',
      doorSub: 'ORO EN PAZ FIERRO EN GUERRA',
      badgeTitle: 'SFPD',
      baseColor: 0x14171c,
      stripeColor: 0x1e4d8c
    },
    plate: {
      state: 'California',
      slogan: 'dmv.ca.gov',
      sample: 'SFO 415',
      bg: '#f4f5f2',
      topBand: null,
      text: '#122b66',
      scriptColor: '#c81e2b',
      legacyEvery4: true
    },
    transit: {
      name: 'SF Muni',
      shortName: 'MUNI',
      bodyColor: 0xf2f4f5,
      bandColor: 0xcc0033,
      accentColor: 0xf58220
    },
    ownCar: {
      kind: 'sports',
      hex: 0xf04a24,
      plateText: 'SFO 415',
      state: 'CALIFORNIA'
    },
    areas: [
      [0, 0, 'Union Square'],
      [580, -520, 'Financial District'],
      [167, -550, 'Chinatown'],
      [40, -1450, 'North Beach'],
      [150, -1611, 'Telegraph Hill & Coit Tower'],
      [-985, -1578, 'Russian Hill & Lombard Street'],
      [-260, -420, 'Nob Hill'],
      [-202, -2312, 'Fisherman\'s Wharf & Pier 39'],
      [1214, -845, 'The Embarcadero & Ferry Building'],
      [380, 520, 'South of Market (SoMa)'],
      [-1038, 956, 'Civic Center'],
      [1601, 1034, 'China Basin & Oracle Park'],
      [-2226, 1289, 'Alamo Square & Painted Ladies'],
      [-3598, -1667, 'Marina & Palace of Fine Arts'],
      [-5164, -1223, 'The Presidio'],
      [-6229, -3556, 'Golden Gate Bridge'],
      [-5384, 1823, 'Golden Gate Park'],
      [-3466, 2000, 'Haight-Ashbury'],
      [-2402, 2878, 'The Castro'],
      [-1724, 3134, 'Mission District & Dolores Park'],
      [-3537, 3979, 'Twin Peaks & Sutro Tower'],
      [-6200, 650, 'Richmond District'],
      [-6800, 3400, 'Sunset District'],
      [-8947, 3056, 'Ocean Beach & Lands End'],
      [-7522, 7435, 'Lake Merced & SF Zoo'],
      [1672, 3378, 'Potrero Hill & Dogpatch'],
      [3035, 6323, 'Bayview & Hunters Point']
    ],
    landmarks: [
      { id: 'unionsq',      name: 'Union Square (Post & Powell)',            short: 'Union Square',         x: 0,     z: 0,     heading: 0 },
      { id: 'goldengate',   name: 'Golden Gate Bridge (Toll Plaza & Span)',  short: 'Golden Gate Bridge',   x: -5938, z: -2189, heading: Math.PI },
      { id: 'transamerica', name: 'Transamerica Pyramid',                    short: 'Transamerica Pyramid', x: 365,   z: -811,  heading: 0 },
      { id: 'salesforce',   name: 'Salesforce Tower & Transit Center',       short: 'Salesforce Tower',     x: 880,   z: -200,  heading: 0 },
      { id: 'ferrybldg',    name: 'San Francisco Ferry Building',            short: 'Ferry Building',       x: 1155,  z: -845,  heading: Math.PI / 2 },
      { id: 'coittower',    name: 'Coit Tower & Telegraph Hill',             short: 'Coit Tower',           x: 120,   z: -1580, heading: 0 },
      { id: 'lombard',      name: 'Lombard Street (Crookedest Street)',      short: 'Lombard Street',       x: -985,  z: -1578, heading: Math.PI / 2 },
      { id: 'palace',       name: 'Palace of Fine Arts & Marina',            short: 'Palace of Fine Arts',  x: -3550, z: -1667, heading: -Math.PI / 2 },
      { id: 'ggpark',       name: 'Golden Gate Park (Music Concourse)',      short: 'Golden Gate Park',     x: -5384, z: 1823,  heading: -Math.PI / 2 },
      { id: 'twinpeaks',    name: 'Twin Peaks Summit & Sutro Tower',         short: 'Twin Peaks & Sutro',   x: -3537, z: 3979,  heading: 0 },
      { id: 'haight',       name: 'Haight & Ashbury',                        short: 'Haight-Ashbury',       x: -3466, z: 2000,  heading: Math.PI / 2 },
      { id: 'castro',       name: 'Castro & Market (Castro Theatre)',        short: 'The Castro',           x: -2402, z: 2878,  heading: 0 },
      { id: 'oceanbeach',   name: 'Ocean Beach & Great Highway',             short: 'Ocean Beach',          x: -8947, z: 3056,  heading: 0 },
      { id: 'sfcityhall',   name: 'San Francisco City Hall & Civic Center',  short: 'SF City Hall',         x: -960,  z: 956,   heading: -Math.PI / 2 },
      { id: 'wharf',        name: 'Fisherman\'s Wharf & Pier 39',            short: 'Fisherman\'s Wharf',   x: -202,  z: -2220, heading: 0 },
      { id: 'alamo',        name: 'Alamo Square & Painted Ladies',           short: 'Painted Ladies',       x: -2210, z: 1289,  heading: Math.PI / 2 }
    ],
    teleportIds: ['unionsq', 'goldengate', 'transamerica', 'ferrybldg', 'coittower', 'lombard', 'palace', 'ggpark', 'twinpeaks', 'oceanbeach', 'sfcityhall', 'alamo'],
    modelledLandmarks: [
      'Transamerica Pyramid',
      'Salesforce Tower',
      'Ferry Building',
      'Coit Tower',
      'San Francisco City Hall',
      'Chinatown Dragon Gate',
      'Painted Ladies',
      'Golden Gate Bridge',
      'Palace of Fine Arts',
      'Sutro Tower'
    ],
    areaLabels: [
      ['SAN FRANCISCO', -2000, 1000, 0],
      ['SAN FRANCISCO BAY', 2200, -1600, 1],
      ['PACIFIC OCEAN', -9200, 2200, 1],
      ['GOLDEN GATE STRAIT', -6229, -3556, 1],
      ['LAKE MERCED', -7522, 7435, 1],
      ['UNION SQUARE', 0, 0, 2],
      ['FINANCIAL DISTRICT', 620, -520, 2],
      ['CHINATOWN', 167, -580, 2],
      ['NOB HILL', -260, -420, 2],
      ['RUSSIAN HILL \u00b7 LOMBARD', -985, -1578, 2],
      ['TELEGRAPH HILL \u00b7 COIT', 150, -1611, 2],
      ['NORTH BEACH', 40, -1350, 2],
      ['FISHERMAN\'S WHARF', -202, -2312, 2],
      ['THE EMBARCADERO', 1214, -845, 2],
      ['SOUTH OF MARKET (SOMA)', 380, 520, 2],
      ['CIVIC CENTER', -1038, 956, 2],
      ['CHINA BASIN \u00b7 ORACLE PARK', 1601, 1034, 2],
      ['ALAMO SQUARE', -2226, 1289, 2],
      ['PACIFIC HEIGHTS', -1950, -650, 2],
      ['MARINA \u00b7 PALACE OF FINE ARTS', -3598, -1667, 2],
      ['THE PRESIDIO', -5164, -1223, 2],
      ['GOLDEN GATE BRIDGE', -6229, -3100, 2],
      ['RICHMOND DISTRICT', -6200, 650, 2],
      ['GOLDEN GATE PARK', -5800, 1950, 2],
      ['HAIGHT-ASHBURY', -3466, 2000, 2],
      ['THE CASTRO', -2402, 2878, 2],
      ['MISSION DISTRICT', -1724, 3134, 2],
      ['TWIN PEAKS \u00b7 SUTRO TOWER', -3750, 3800, 2],
      ['SUNSET DISTRICT', -6800, 3400, 2],
      ['OCEAN BEACH \u00b7 LANDS END', -8947, 2200, 2],
      ['POTRERO HILL \u00b7 DOGPATCH', 1672, 3378, 2],
      ['NOE VALLEY', -2350, 4250, 2],
      ['BERNAL HEIGHTS', -950, 4850, 2],
      ['BAYVIEW \u00b7 HUNTERS POINT', 3035, 6323, 2],
      ['ALCATRAZ ISLAND', -1364, -4312, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'goldenGate',     name: 'Golden Gate Bridge Span',      category: 'scenic', fov: 48 },
      { id: 'unionSquare',    name: 'Union Square & Powell St',     category: 'scenic', fov: 50 },
      { id: 'transamerica',   name: 'Transamerica Pyramid',         category: 'scenic', fov: 46 },
      { id: 'ferryBuilding',  name: 'Ferry Building & Embarcadero', category: 'scenic', fov: 48 },
      { id: 'coitTower',      name: 'Coit Tower & Telegraph Hill',  category: 'scenic', fov: 50 },
      { id: 'lombardStreet',  name: 'Lombard St & Russian Hill',    category: 'scenic', fov: 50 },
      { id: 'twinPeaks',      name: 'Twin Peaks & Sutro Tower',     category: 'scenic', fov: 48 },
      { id: 'baySkyline',     name: 'San Francisco Bay Skyline',    category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      goldenGate:    { pos: -5850 ? [-5860, 85, -2420] : [0, 0, 0], look: [-6229, 115, -3556], ampPos: [14, 1.5, 14], ampLook: [6, 2, 6],   freq: 0.09 },
      unionSquare:   { pos: [-55, 11, 65],        look: [10, 14, -40],          ampPos: [5, 0.3, 4],   ampLook: [3, 0, 3],   freq: 0.13 },
      transamerica:  { pos: [260, 18, -640],      look: [414, 125, -811],       ampPos: [6, 0.4, 6],   ampLook: [3, 4, 3],   freq: 0.11 },
      ferryBuilding: { pos: [1095, 14, -760],     look: [1214, 38, -845],       ampPos: [6, 0.3, 6],   ampLook: [3, 1, 3],   freq: 0.12 },
      coitTower:     { pos: [70, 22, -1520],      look: [150, 42, -1611],       ampPos: [6, 0.4, 6],   ampLook: [3, 1, 3],   freq: 0.11 },
      lombardStreet: { pos: [-880, 18, -1565],    look: [-1010, 26, -1580],     ampPos: [5, 0.3, 5],   ampLook: [3, 1, 3],   freq: 0.12 },
      twinPeaks:     { pos: [-3450, 32, 3920],    look: [-500, 45, 200],        ampPos: [10, 0.8, 10], ampLook: [20, 0, 20], freq: 0.08 },
      baySkyline:    { pos: [1680, 145, -1150],   look: [580, 85, -520],        ampPos: [20, 2.0, 20], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: -12,   z: 18,    heading: Math.PI },
      car:        { x: 0,     z: 45,    heading: Math.PI },
      cyclist:    { x: 1145,  z: -845,  heading: Math.PI },
      helicopter: { x: 1450,  z: -1050, heading: -1.8, above: 165 },
      kayak:      { x: -1350, z: -2120, heading: Math.PI / 2 }
    },
    archetypes: {
      style: 'sf-victorian-edwardian-marina',
      treeCoverage: { canopyCover: 0.13, streetTreeDensity: 0.67, streetTreeSpacing: 32.8, parkTreeDensity: 1.0, foliageScale: 0.88 },
      housingDensity: { form: 'rowhouse', buildingsPerKm2: 1952, footprintCoverage: 0.51, wallEnclosure: 0.66, lotInfill: 0.15, rowhouseAttachment: 0.78, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.65, shrubDensity: 0.58 },
      residential: {
        walls: { clapboard: 0.48, brick: 0.04, stone: 0.02, stucco: 0.42, shake: 0.04 },
        roofs: { flat: 0.46, hip: 0.24, gable: 0.28, gambrel: 0.02 },
        pitch: { hip: 0.34, gable: 0.42, historic: 0.54 },
        siding: [0xf4efe6, 0xe8d8b8, 0xd9bf72, 0x9fb5a5, 0x7b98b2, 0xc98b78, 0xd8a8b0, 0x8899a6, 0xe6dcc4, 0x6b8299],
        stucco: [0xf2ece1, 0xe8dec8, 0xdfd1b8, 0xf5e6d3, 0xd8e2dc, 0xeeddd3]
      },
      midrise: {
        masonry: { stoneColor: 0xe2d9c5, trimColor: 0xa69b86, windowWidth: 2.5, floorHeight: 3.6 },
        historic: { stoneColor: 0xad5d45, trimColor: 0xd8c8b0, windowWidth: 2.4, floorHeight: 3.6 },
        waterTowerProb: 0.05,
        fireEscapes: true
      },
      neighborhoods: {
        chinatown: {
          treeCoverage: { canopyCover: 0.05, streetTreeDensity: 0.37, streetTreeSpacing: 38.0, parkTreeDensity: 0.87, foliageScale: 0.85 },
          housingDensity: { form: 'highrise', buildingsPerKm2: 2187, footprintCoverage: 0.64, wallEnclosure: 0.98, lotInfill: 0.15, rowhouseAttachment: 0.78, maxHouseHeight: 8.8, maxHouseFootprint: 240, porchProbScale: 0.42, shrubDensity: 0.34 },
          midrise: { stoneColor: 0xc44b38, trimColor: 0xe8be52, windowWidth: 2.2, floorHeight: 3.5, storefronts: true, fireEscapes: true }
        },
        alamo_square_painted_ladies: {
          treeCoverage: { canopyCover: 0.16, streetTreeDensity: 0.72, streetTreeSpacing: 30.6, parkTreeDensity: 1.05, foliageScale: 0.89 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2198, footprintCoverage: 0.52, wallEnclosure: 0.6, lotInfill: 0.15, rowhouseAttachment: 0.78, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.65, shrubDensity: 0.58 },
          residential: {
            walls: { clapboard: 0.78, brick: 0.02, stone: 0.02, stucco: 0.14, shake: 0.04 },
            roofs: { flat: 0.16, hip: 0.24, gable: 0.58, gambrel: 0.02 },
            pitch: { hip: 0.42, gable: 0.58, historic: 0.68 },
            siding: [0xf2d1a0, 0xa8d5ba, 0xf4b6c2, 0xaec6cf, 0xf7e396, 0xd7bde2, 0xf5e8d0]
          }
        },
        haight_ashbury: {
          treeCoverage: { canopyCover: 0.16, streetTreeDensity: 0.72, streetTreeSpacing: 30.6, parkTreeDensity: 1.05, foliageScale: 0.89 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2413, footprintCoverage: 0.52, wallEnclosure: 0.6, lotInfill: 0.15, rowhouseAttachment: 0.78, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.65, shrubDensity: 0.58 },
          residential: {
            walls: { clapboard: 0.74, brick: 0.04, stone: 0.02, stucco: 0.16, shake: 0.04 },
            roofs: { flat: 0.18, hip: 0.26, gable: 0.54, gambrel: 0.02 },
            pitch: { hip: 0.40, gable: 0.56, historic: 0.64 },
            siding: [0xe8c48e, 0x8fb8a2, 0xd88a98, 0x7ea6c2, 0xd9bf72, 0xb896c8]
          },
          midrise: { stoneColor: 0xc97b58, trimColor: 0xf2ece0, windowWidth: 2.3, floorHeight: 3.6, storefronts: true }
        },
        marina_palace_of_fine_arts: {
          treeCoverage: { canopyCover: 0.16, streetTreeDensity: 0.72, streetTreeSpacing: 30.6, parkTreeDensity: 1.05, foliageScale: 0.89 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2850, footprintCoverage: 0.46, wallEnclosure: 0.6, lotInfill: 0.15, rowhouseAttachment: 0.78, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.65, shrubDensity: 0.58 },
          residential: {
            walls: { clapboard: 0.18, brick: 0.04, stone: 0.02, stucco: 0.74, shake: 0.02 },
            roofs: { flat: 0.56, hip: 0.34, gable: 0.10, gambrel: 0.0 },
            stucco: [0xf6efe2, 0xf2dfd0, 0xebe0c8, 0xdce8e2, 0xf4e4c2]
          }
        },
        sunset_district: {
          treeCoverage: { canopyCover: 0.23, streetTreeDensity: 0.98, streetTreeSpacing: 22.4, parkTreeDensity: 1.16, foliageScale: 0.92 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2702, footprintCoverage: 0.39, wallEnclosure: 0.6, lotInfill: 0.15, rowhouseAttachment: 0.51, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.73, shrubDensity: 0.67 },
          residential: {
            walls: { clapboard: 0.16, brick: 0.02, stone: 0.02, stucco: 0.78, shake: 0.02 },
            roofs: { flat: 0.64, hip: 0.26, gable: 0.10, gambrel: 0.0 },
            stucco: [0xf2ebe0, 0xe8d8c8, 0xd8e4e0, 0xf0dcd0, 0xe6dfc8, 0xd4dfe8]
          }
        },
        north_beach_little_italy: {
          treeCoverage: { canopyCover: 0.12, streetTreeDensity: 0.66, streetTreeSpacing: 33.3, parkTreeDensity: 0.98, foliageScale: 0.88 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2760, footprintCoverage: 0.62, wallEnclosure: 0.77, lotInfill: 0.15, rowhouseAttachment: 0.78, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.65, shrubDensity: 0.58 },
          midrise: { stoneColor: 0xe8dcc4, trimColor: 0x3b6e52, windowWidth: 2.3, floorHeight: 3.5, storefronts: true, fireEscapes: true }
        },
        south_of_market_soma: {
          treeCoverage: { canopyCover: 0.1, streetTreeDensity: 0.43, streetTreeSpacing: 38.0, parkTreeDensity: 0.95, foliageScale: 0.86 },
          housingDensity: { form: 'highrise', buildingsPerKm2: 1770, footprintCoverage: 0.62, wallEnclosure: 0.4, lotInfill: 0.15, rowhouseAttachment: 0.78, maxHouseHeight: 8.8, maxHouseFootprint: 240, porchProbScale: 0.42, shrubDensity: 0.34 },
          midrise: { stoneColor: 0x9c4836, trimColor: 0xb8b2a6, windowWidth: 2.8, floorHeight: 4.0, storefronts: true }
        }
      },
      landmarks: {
        'Transamerica Pyramid': { form: 'diagrid_prism', w: 54, d: 54, h: 260, primaryColor: 0xebe7de, secondaryColor: 0xded9ce, glowColor: 0xfff0c2 },
        'Salesforce Tower': { form: 'stepped_bundled_tube', w: 52, d: 52, h: 326, primaryColor: 0x6ea8d6, secondaryColor: 0xe9eef4, glowColor: 0x6bc4ff, twinSpire: false },
        'Ferry Building': { form: 'clock_tower', w: 48, d: 200, h: 75, hallW: 36, hallD: 196, hallH: 18, primaryColor: 0xdcd5c6, secondaryColor: 0x5c6970, roofColor: 0x5c6970, glowColor: 0xffc86b },
        'Coit Tower': { form: 'clock_tower', w: 26, d: 26, h: 64, primaryColor: 0xf0ece1, secondaryColor: 0xdcd5c6, glowColor: 0xffd27d },
        'San Francisco City Hall': { form: 'dome_palace', w: 118, d: 94, h: 94, primaryColor: 0xdad6ce, secondaryColor: 0xb8b2a6, roofColor: 0x457b66, accentColor: 0xf5c842 },
        'Chinatown Dragon Gate': { form: 'torii_temple', w: 22, d: 10, h: 14, primaryColor: 0xb82921, secondaryColor: 0xf2c138, roofColor: 0x1b6e44 },
        'Painted Ladies': { form: 'historic_row', w: 18, d: 54, h: 16, rowCount: 6, rowColors: [0xf2d1a0, 0xa8d5ba, 0xf4b6c2, 0xaec6cf, 0xf7e396, 0xd7bde2] },
        'Golden Gate Bridge': { form: 'suspension_bridge', w: 36, d: 1980, h: 227, deckY: 67, primaryColor: 0xc0362c, secondaryColor: 0x33373d, accentColor: 0xc0362c },
        'Palace of Fine Arts': { form: 'dome_palace', w: 68, d: 120, h: 48, primaryColor: 0xe6d3b3, secondaryColor: 0xd8c3a0, roofColor: 0xc87d55 },
        'Sutro Tower': { form: 'lattice_tower', w: 52, d: 52, h: 298, primaryColor: 0xc92a2a, secondaryColor: 0xf4f6f8, glowColor: 0xff1744 }
      }
    }
  },

  sydney: {
    id: 'sydney',
    title: 'Sydney',
    stateCode: 'NSW',
    stateLabel: 'New South Wales',
    displayName: 'Sydney, Australia',
    icon: 'img/icon-sydney.svg',
    subtitle: 'Sydney Opera House, Harbour Bridge, Circular Quay, The Rocks & Darling Harbour',
    countyLabel: 'NEW SOUTH WALES',
    cityLabel: 'SYDNEY',
    searchPlaceholder: 'Street or landmark (George St, Opera House, Harbour Bridge, Circular Quay, The Rocks...)',
    loadingStages: {
      streets: 'Building George Street, Circular Quay, The Rocks and Darling Harbour...',
      outskirts: 'Laying out Port Jackson, North Sydney and Pyrmont...',
      landmarks: 'Building the Sydney Opera House, Harbour Bridge and Sydney Tower Eye...'
    },
    timeZone: 'Australia/Sydney',
    lat: -33.8615,
    lon: 151.2108,
    baseElev: 0.0,
    weatherStation: 'YSSY',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.0,
    usualCfs: 400,
    kayakLaunch: { x: 180, z: -480 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'NSWPF',
      doorTop: 'NSW',
      doorBottom: 'POLICE',
      doorSub: 'SYDNEY CITY PAC',
      badgeTitle: 'NSWPF',
      baseColor: 0xf4f7fa,
      stripeColor: 0x0047ab
    },
    plate: {
      state: 'NEW SOUTH WALES',
      slogan: 'THE PREMIER STATE',
      sample: 'SYD 02A',
      bg: '#f7c816',
      topBand: null,
      text: '#141414',
      scriptColor: '#141414',
      legacyEvery4: false
    },
    transit: {
      name: 'Transport for NSW',
      shortName: 'SYDNEY BUSES',
      bodyColor: 0xf4f7fa,
      bandColor: 0x0098cd,
      accentColor: 0x005aa3
    },
    ownCar: {
      kind: 'sports',
      hex: 0x0077b6,
      plateText: 'SYD 02A',
      state: 'NSW'
    },
    areas: [
      [0, 0, 'Circular Quay'],
      [388, -534, 'Bennelong Point & Opera House'],
      [-120, -1045, 'Sydney Harbour Bridge'],
      [-231, -244, 'The Rocks'],
      [-212, 667, 'CBD & Martin Place'],
      [-860, 1056, 'Darling Harbour'],
      [416, 1089, 'Royal Botanic Garden'],
      [-814, -44, 'Barangaroo'],
      [1156, 1467, 'Potts Point & Woolloomooloo'],
      [-55, -2034, 'Milsons Point & Kirribilli']
    ],
    landmarks: [
      { id: 'circularquay', name: 'Circular Quay Ferry Wharves',           short: 'Circular Quay',        x: 0,     z: 0,     heading: 0 },
      { id: 'operahouse',   name: 'Sydney Opera House (Bennelong Point)',  short: 'Sydney Opera House',   x: 388,   z: -534,  heading: Math.PI },
      { id: 'harbourbridge',name: 'Sydney Harbour Bridge',                 short: 'Harbour Bridge',       x: -120,  z: -1045, heading: 0 },
      { id: 'therocks',     name: 'The Rocks & George Street',             short: 'The Rocks',            x: -231,  z: -244,  heading: 0 },
      { id: 'sydneytower',  name: 'Sydney Tower Eye & Pitt Street Mall',   short: 'Sydney Tower Eye',     x: -175,  z: 989,   heading: 0 },
      { id: 'darling',      name: 'Darling Harbour & Pyrmont Bridge',      short: 'Darling Harbour',      x: -860,  z: 1056,  heading: Math.PI / 2 },
      { id: 'botanic',      name: 'Royal Botanic Garden & Mrs Macquaries', short: 'Botanic Garden',       x: 680,   z: 520,   heading: -Math.PI / 2 },
      { id: 'barangaroo',   name: 'Barangaroo Reserve & Crown Sydney',     short: 'Barangaroo',           x: -814,  z: -44,   heading: Math.PI / 2 }
    ],
    teleportIds: ['circularquay', 'operahouse', 'harbourbridge', 'therocks', 'sydneytower', 'darling', 'botanic', 'barangaroo'],
    modelledLandmarks: [
      'Sydney Opera House',
      'Sydney Harbour Bridge',
      'Sydney Tower Eye'
    ],
    areaLabels: [
      ['SYDNEY', -100, 600, 0],
      ['SYDNEY HARBOUR (PORT JACKSON)', 450, -1100, 1],
      ['DARLING HARBOUR', -920, 900, 1],
      ['CIRCULAR QUAY', 0, 0, 2],
      ['SYDNEY OPERA HOUSE', 388, -534, 2],
      ['HARBOUR BRIDGE', -120, -1045, 2],
      ['THE ROCKS', -231, -244, 2],
      ['BARANGAROO', -814, -44, 2],
      ['MARTIN PLACE \u00b7 CBD', -175, 680, 2],
      ['ROYAL BOTANIC GARDEN', 650, 750, 2],
      ['PYRMONT', -1550, 1100, 2],
      ['MILSONS POINT \u00b7 NORTH SYDNEY', -120, -2100, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'operaHouse',    name: 'Sydney Opera House & Quay',   category: 'scenic', fov: 48 },
      { id: 'harbourBridge', name: 'Sydney Harbour Bridge Span',  category: 'scenic', fov: 48 },
      { id: 'circularQuay',  name: 'Circular Quay Wharves',       category: 'scenic', fov: 50 },
      { id: 'theRocks',      name: 'The Rocks & Dawes Point',     category: 'scenic', fov: 50 },
      { id: 'darlingHarbour',name: 'Darling Harbour Skyline',     category: 'scenic', fov: 48 },
      { id: 'harbourAerial', name: 'Port Jackson Aerial',         category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      operaHouse:    { pos: [190, 14, -340],     look: [388, 28, -534],     ampPos: [8, 0.5, 8],   ampLook: [4, 1, 4],   freq: 0.11 },
      harbourBridge: { pos: [140, 28, -680],     look: [-120, 65, -1045],   ampPos: [10, 0.8, 10], ampLook: [6, 2, 6],   freq: 0.10 },
      circularQuay:  { pos: [-45, 11, 80],       look: [40, 12, -120],      ampPos: [5, 0.3, 5],   ampLook: [3, 0, 3],   freq: 0.13 },
      theRocks:      { pos: [-180, 12, -160],    look: [-240, 14, -320],    ampPos: [5, 0.3, 5],   ampLook: [3, 0, 3],   freq: 0.13 },
      darlingHarbour:{ pos: [-960, 18, 920],     look: [-420, 42, 980],     ampPos: [8, 0.5, 8],   ampLook: [6, 1, 6],   freq: 0.11 },
      harbourAerial: { pos: [820, 165, -920],    look: [120, 35, -420],     ampPos: [20, 2.0, 20], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: 18,   z: 24,   heading: 0 },
      car:        { x: -120, z: 240,  heading: 0 },
      cyclist:    { x: 240,  z: -320, heading: 0 },
      helicopter: { x: 640,  z: -780, heading: -2.2, above: 155 },
      kayak:      { x: 180,  z: -480, heading: 0 }
    },
    archetypes: {
      style: 'sydney-sandstone-federation-terrace',
      treeCoverage: { canopyCover: 0.18, streetTreeDensity: 0.8, streetTreeSpacing: 27.5, parkTreeDensity: 1.08, foliageScale: 1.02 },
      housingDensity: { form: 'urban', buildingsPerKm2: 1950, footprintCoverage: 0.45, wallEnclosure: 0.68, lotInfill: 0.3, rowhouseAttachment: 0.52, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.88, shrubDensity: 0.92 },
      residential: {
        walls: { clapboard: 0.16, brick: 0.42, stone: 0.14, stucco: 0.26, shake: 0.02 },
        roofs: { flat: 0.24, hip: 0.44, gable: 0.32, gambrel: 0.0 },
        pitch: { hip: 0.32, gable: 0.38, historic: 0.46 },
        bricks: [0x9c4632, 0x8a3b2a, 0xb0583c, 0x7d3a2c, 0xc47a52],
        stucco: [0xf2ead8, 0xe8dcc2, 0xd8c6a4, 0xf6f2e8, 0xcfd8dc],
        shingles: [0xb84a32, 0x6e7880, 0x4a5258, 0x9e3e28, 0x3b4045]
      },
      midrise: {
        masonry: { stoneColor: 0xdcc59a, trimColor: 0xa89068, windowWidth: 2.6, floorHeight: 3.8 },
        historic: { stoneColor: 0x9e4834, trimColor: 0xe6dcc4, windowWidth: 2.4, floorHeight: 3.6 },
        waterTowerProb: 0.0,
        fireEscapes: false
      },
      neighborhoods: {
        the_rocks: {
          treeCoverage: { canopyCover: 0.28, streetTreeDensity: 0.93, streetTreeSpacing: 23.7, parkTreeDensity: 1.2, foliageScale: 1.04 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 1950, footprintCoverage: 0.48, wallEnclosure: 0.53, lotInfill: 0.3, rowhouseAttachment: 0.74, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.88, shrubDensity: 0.92 },
          style: 'colonial-sydney-sandstone-bond-stores',
          residential: {
            walls: { clapboard: 0.04, brick: 0.36, stone: 0.48, stucco: 0.12, shake: 0.0 },
            roofs: { flat: 0.14, hip: 0.38, gable: 0.48, gambrel: 0.0 },
            stucco: [0xdcc59a, 0xcfb484, 0xe6d4b0, 0xc4a675]
          },
          midrise: { stoneColor: 0xd6bc8c, trimColor: 0x9c8258, storefronts: true }
        },
        potts_point_woolloomooloo: {
          treeCoverage: { canopyCover: 0.23, streetTreeDensity: 0.87, streetTreeSpacing: 25.3, parkTreeDensity: 1.14, foliageScale: 1.03 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1950, footprintCoverage: 0.37, wallEnclosure: 0.48, lotInfill: 0.3, rowhouseAttachment: 0.52, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.88, shrubDensity: 0.92 },
          style: 'victorian-filigree-terrace-art-deco',
          residential: {
            walls: { clapboard: 0.05, brick: 0.35, stone: 0.10, stucco: 0.50, shake: 0.0 },
            roofs: { flat: 0.35, hip: 0.45, gable: 0.20, gambrel: 0.0 },
            stucco: [0xf2ead8, 0xd8e2dc, 0xead4be, 0xf5f0e4]
          },
          midrise: { stoneColor: 0x9c4632, trimColor: 0xf2ead8, storefronts: true }
        },
        milsons_point_kirribilli: {
          treeCoverage: { canopyCover: 0.2, streetTreeDensity: 0.83, streetTreeSpacing: 26.5, parkTreeDensity: 1.1, foliageScale: 1.03 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1950, footprintCoverage: 0.47, wallEnclosure: 0.72, lotInfill: 0.3, rowhouseAttachment: 0.52, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.88, shrubDensity: 0.92 },
          style: 'federation-queen-anne-redbrick-terrace',
          residential: {
            walls: { clapboard: 0.08, brick: 0.68, stone: 0.08, stucco: 0.16, shake: 0.0 },
            roofs: { flat: 0.10, hip: 0.48, gable: 0.42, gambrel: 0.0 },
            bricks: [0x9c4632, 0xad4f38, 0x8a3b2a],
            shingles: [0xb84a32, 0xc45638, 0x9e3e28]
          }
        }
      },
      landmarks: {
        'Sydney Opera House': { form: 'opera_sails', x: 388, z: -534, w: 120, d: 185, h: 65, wallColor: 0xf7f5ef, trimColor: 0xd8c3a5 },
        'Sydney Harbour Bridge': { form: 'arch_bridge', x: -120, z: -1045, w: 500, d: 49, h: 134, heading: 0.42, wallColor: 0x5c646d, trimColor: 0xcab99b },
        'Sydney Tower Eye': { form: 'observation_needle', x: -175, z: 989, w: 36, d: 36, h: 309, wallColor: 0xd9c282, trimColor: 0x5c646d },
        'The Rocks & George Street': { form: 'historic_row', x: -231, z: -244, w: 72, d: 24, h: 16, wallColor: 0xdcc59a, trimColor: 0x8a3b2a, roofColor: 0x4a5258 }
      }
    }
  },

  venice: {
    id: 'venice',
    title: 'Venice',
    stateCode: 'VE',
    stateLabel: 'Veneto, Italy',
    displayName: 'Venice, Italy',
    icon: 'img/icon-venice.svg',
    subtitle: 'Grand Canal, Rialto Bridge, Piazza San Marco, Doge\'s Palace & Venetian Lagoon',
    countyLabel: 'CITTA DI VENEZIA',
    cityLabel: 'VENEZIA',
    searchPlaceholder: 'Canal or landmark (Rialto, San Marco, Grand Canal, Accademia, Murano...)',
    loadingStages: {
      streets: 'Building the Grand Canal, calli, campi and footbridges of Venice...',
      outskirts: 'Laying out the Venetian Lagoon, Giudecca and San Giorgio Maggiore...',
      landmarks: 'Building Rialto Bridge, St Mark\'s Campanile and Doge\'s Palace...'
    },
    timeZone: 'Europe/Rome',
    lat: 45.4380,
    lon: 12.3359,
    baseElev: 0.0,
    weatherStation: 'LIPZ',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.0,
    usualCfs: 150,
    kayakLaunch: { x: -45, z: 35 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'POLIZIA',
      doorTop: 'POLIZIA',
      doorBottom: 'LOCALE',
      doorSub: 'COMUNE DI VENEZIA',
      badgeTitle: 'VE',
      baseColor: 0x5698d4,
      stripeColor: 0xffffff
    },
    plate: {
      state: 'ITALIA',
      slogan: 'VENEZIA',
      sample: 'VE 421A',
      bg: '#f4f6f8',
      topBand: '#003399',
      text: '#141414',
      scriptColor: '#003399',
      legacyEvery4: false
    },
    transit: {
      name: 'ACTV Vaporetto',
      shortName: 'ACTV',
      bodyColor: 0xf4f5f0,
      bandColor: 0x1b365d,
      accentColor: 0xe87722
    },
    ownCar: {
      kind: 'sports',
      hex: 0xc81d25,
      plateText: 'VE 421A',
      state: 'ITALIA'
    },
    areas: [
      [0, 0, 'Rialto Bridge & Grand Canal'],
      [251, 412, 'Piazza San Marco'],
      [-376, 656, 'Ponte dell\'Accademia & Dorsoduro'],
      [-251, 89, 'San Polo & Frari'],
      [-1034, -400, 'Santa Lucia Station & Piazzale Roma'],
      [1190, 689, 'Arsenale & Castello'],
      [-548, -500, 'Cannaregio & Jewish Ghetto'],
      [407, 1023, 'San Giorgio Maggiore'],
      [-141, 1278, 'Giudecca Canal & Redentore']
    ],
    landmarks: [
      { id: 'rialto',      name: 'Ponte di Rialto & Grand Canal',          short: 'Rialto Bridge',        x: 0,     z: 0,     heading: 0 },
      { id: 'sanmarco',    name: 'Piazza San Marco & Campanile',           short: 'Piazza San Marco',     x: 251,   z: 412,   heading: Math.PI / 2 },
      { id: 'dogespalace', name: 'Doge\'s Palace & Riva degli Schiavoni',  short: 'Doge\'s Palace',       x: 345,   z: 489,   heading: Math.PI },
      { id: 'accademia',   name: 'Ponte dell\'Accademia & Grand Canal',    short: 'Accademia Bridge',     x: -376,  z: 656,   heading: 0 },
      { id: 'salute',      name: 'Basilica di Santa Maria della Salute',   short: 'La Salute',            x: -86,   z: 767,   heading: 0 },
      { id: 'arsenale',    name: 'Venezia Arsenale & Historic Gates',      short: 'Arsenale',             x: 1190,  z: 689,   heading: -Math.PI / 2 },
      { id: 'piazzaleroma',name: 'Piazzale Roma & Ponte della Costituzione',short: 'Piazzale Roma',       x: -1150, z: 0,     heading: Math.PI / 2 },
      { id: 'sangiorgio',  name: 'Isola di San Giorgio Maggiore',          short: 'San Giorgio Maggiore', x: 407,   z: 1023,  heading: 0 }
    ],
    teleportIds: ['rialto', 'sanmarco', 'dogespalace', 'accademia', 'salute', 'arsenale', 'piazzaleroma', 'sangiorgio'],
    modelledLandmarks: [
      'St Mark\'s Campanile',
      'Ponte di Rialto',
      'Basilica di San Marco'
    ],
    areaLabels: [
      ['VENEZIA', 0, 200, 0],
      ['CANAL GRANDE', -180, 280, 1],
      ['CANALE DELLA GIUDECCA', -200, 1050, 1],
      ['BACINO DI SAN MARCO', 520, 720, 1],
      ['PONTE DI RIALTO', 0, 0, 2],
      ['PIAZZA SAN MARCO', 251, 412, 2],
      ['SAN POLO', -251, 89, 2],
      ['DORSODURO \u00b7 ACCADEMIA', -376, 656, 2],
      ['CANNAREGIO', -548, -500, 2],
      ['CASTELLO \u00b7 ARSENALE', 1190, 689, 2],
      ['SANTA CROCE \u00b7 PIAZZALE ROMA', -1034, -100, 2],
      ['GIUDECCA', -141, 1278, 2],
      ['SAN GIORGIO MAGGIORE', 407, 1023, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'rialtoBridge', name: 'Ponte di Rialto & Grand Canal', category: 'scenic', fov: 48 },
      { id: 'sanMarco',     name: 'Piazza San Marco & Campanile',  category: 'scenic', fov: 48 },
      { id: 'accademia',    name: 'Accademia & Santa Maria Salute',category: 'scenic', fov: 50 },
      { id: 'bacino',       name: 'Bacino di San Marco Lagoon',    category: 'scenic', fov: 48 },
      { id: 'veniceAerial', name: 'Venetian Lagoon Aerial',        category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      rialtoBridge: { pos: [-65, 11, 75],       look: [10, 12, -15],       ampPos: [5, 0.3, 5],   ampLook: [3, 0, 3],   freq: 0.12 },
      sanMarco:     { pos: [175, 12, 420],      look: [280, 32, 412],      ampPos: [6, 0.3, 6],   ampLook: [4, 1, 4],   freq: 0.12 },
      accademia:    { pos: [-376, 12, 656],     look: [-86, 24, 767],      ampPos: [6, 0.3, 6],   ampLook: [4, 1, 4],   freq: 0.11 },
      bacino:       { pos: [380, 16, 780],      look: [260, 28, 440],      ampPos: [10, 0.5, 10], ampLook: [6, 1, 6],   freq: 0.10 },
      veniceAerial: { pos: [620, 155, 920],     look: [120, 18, 320],      ampPos: [20, 2.0, 20], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: 18,    z: 12,   heading: Math.PI },
      car:        { x: -1150, z: 0,    heading: Math.PI / 2 },
      cyclist:    { x: 251,   z: 412,  heading: 0 },
      helicopter: { x: 480,   z: 820,  heading: -2.5, above: 145 },
      kayak:      { x: -45,   z: 35,   heading: 0.4 }
    },
    archetypes: {
      style: 'venetian-gothic-terracotta-plaster',
      treeCoverage: { canopyCover: 0.05, streetTreeDensity: 0.21, streetTreeSpacing: 38.0, parkTreeDensity: 0.5, foliageScale: 0.76 },
      housingDensity: { form: 'rowhouse', buildingsPerKm2: 3650, footprintCoverage: 0.57, wallEnclosure: 0.68, lotInfill: 0.15, rowhouseAttachment: 0.94, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.25, shrubDensity: 0.28 },
      residential: {
        walls: { clapboard: 0.0, brick: 0.28, stone: 0.10, stucco: 0.62, shake: 0.0 },
        roofs: { flat: 0.06, hip: 0.66, gable: 0.28, gambrel: 0.0 },
        pitch: { hip: 0.28, gable: 0.30, historic: 0.32 },
        stucco: [0xd9825b, 0xe3a869, 0xc85a42, 0xead4b4, 0xd46f54, 0xe8be82, 0xf0e4ce],
        bricks: [0xa64432, 0x943b2b, 0xb8523b, 0x823426],
        shingles: [0xb84a2e, 0xc45638, 0x9e3e26, 0xad4830, 0x8c3822]
      },
      midrise: {
        masonry: { stoneColor: 0xd47a55, trimColor: 0xf2eadc, windowWidth: 2.3, floorHeight: 3.8 },
        historic: { stoneColor: 0xe3b278, trimColor: 0xf5efe4, windowWidth: 2.2, floorHeight: 3.7 },
        waterTowerProb: 0.0,
        fireEscapes: false
      },
      neighborhoods: {
        rialto_bridge_grand_canal: {
          treeCoverage: { canopyCover: 0.05, streetTreeDensity: 0.21, streetTreeSpacing: 38.0, parkTreeDensity: 0.5, foliageScale: 0.76 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3650, footprintCoverage: 0.62, wallEnclosure: 0.8, lotInfill: 0.15, rowhouseAttachment: 0.94, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.25, shrubDensity: 0.28 },
          style: 'grand-canal-istrian-stone-palazzi',
          residential: {
            walls: { clapboard: 0.0, brick: 0.18, stone: 0.28, stucco: 0.54, shake: 0.0 },
            stucco: [0xf2eadc, 0xd9825b, 0xe8be82, 0xd46f54]
          },
          midrise: { stoneColor: 0xe8d8be, trimColor: 0xf7f4ec, storefronts: true }
        },
        cannaregio_jewish_ghetto: {
          treeCoverage: { canopyCover: 0.05, streetTreeDensity: 0.21, streetTreeSpacing: 38.0, parkTreeDensity: 0.5, foliageScale: 0.76 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3650, footprintCoverage: 0.68, wallEnclosure: 0.8, lotInfill: 0.15, rowhouseAttachment: 0.94, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.25, shrubDensity: 0.28 },
          style: 'cannaregio-tall-brick-sestiere',
          residential: {
            walls: { clapboard: 0.0, brick: 0.45, stone: 0.05, stucco: 0.50, shake: 0.0 },
            stucco: [0xc85a42, 0xd9825b, 0xe3a869, 0xbd543c]
          },
          midrise: { stoneColor: 0xb8523b, trimColor: 0xeadcc6, storefronts: true }
        },
        arsenale_castello: {
          treeCoverage: { canopyCover: 0.05, streetTreeDensity: 0.21, streetTreeSpacing: 38.0, parkTreeDensity: 0.5, foliageScale: 0.76 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3650, footprintCoverage: 0.62, wallEnclosure: 0.8, lotInfill: 0.15, rowhouseAttachment: 0.94, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.25, shrubDensity: 0.28 },
          style: 'venetian-arsenale-red-brick-fortress',
          residential: {
            walls: { clapboard: 0.0, brick: 0.62, stone: 0.08, stucco: 0.30, shake: 0.0 }
          },
          midrise: { stoneColor: 0x9e3e2b, trimColor: 0xdfd3be, storefronts: false }
        }
      },
      landmarks: {
        'St Mark\'s Campanile': { form: 'clock_tower', x: 251, z: 412, w: 12, d: 12, h: 98.6, wallColor: 0xa64432, trimColor: 0xf2eadc, roofColor: 0x4a7c6b },
        'Ponte di Rialto': { form: 'canal_palazzo', x: 0, z: 0, w: 48, d: 22, h: 14, wallColor: 0xf2eadc, trimColor: 0xd8cdb8, roofColor: 0x7a8086 },
        'Basilica di San Marco': { form: 'dome_palace', x: 305, z: 398, w: 76, d: 62, h: 43, wallColor: 0xeadbc4, trimColor: 0xd4af37, roofColor: 0x6e7880 },
        'Doge\'s Palace & Riva degli Schiavoni': { form: 'canal_palazzo', x: 345, z: 489, w: 72, d: 75, h: 28, wallColor: 0xf2d8cc, trimColor: 0xf7f5ef, roofColor: 0xb84a2e },
        'Basilica di Santa Maria della Salute': { form: 'dome_palace', x: -86, z: 767, w: 58, d: 58, h: 48, wallColor: 0xf5f2ea, trimColor: 0xd8d2c6, roofColor: 0x707880 }
      }
    }
  },

  amsterdam: {
    id: 'amsterdam',
    title: 'Amsterdam',
    stateCode: 'NH',
    stateLabel: 'North Holland, NL',
    displayName: 'Amsterdam, Netherlands',
    icon: 'img/icon-amsterdam.svg',
    subtitle: 'Canal Ring (Grachtengordel), Dam Square, Rijksmuseum, Jordaan & Amstel River',
    countyLabel: 'GEMEENTE AMSTERDAM',
    cityLabel: 'AMSTERDAM',
    searchPlaceholder: 'Canal or landmark (Dam Square, Herengracht, Prinsengracht, Rijksmuseum, Vondelpark...)',
    loadingStages: {
      streets: 'Building Herengracht, Keizersgracht, Prinsengracht and canal bridges...',
      outskirts: 'Laying out the IJ Waterfront, Jordaan, De Pijp and Vondelpark...',
      landmarks: 'Building Royal Palace, Rijksmuseum, Westerkerk and Amsterdam Centraal...'
    },
    timeZone: 'Europe/Amsterdam',
    lat: 52.3731,
    lon: 4.8926,
    baseElev: 0.0,
    weatherStation: 'EHAM',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.0,
    usualCfs: 220,
    kayakLaunch: { x: -340, z: 120 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'POLITIE',
      doorTop: 'POLITIE',
      doorBottom: 'AMSTERDAM',
      doorSub: 'WAAKZAAM EN DIENSTBAAR',
      badgeTitle: 'NL',
      baseColor: 0xf4f6f8,
      stripeColor: 0x003882
    },
    plate: {
      state: 'NEDERLAND',
      slogan: 'AMSTERDAM XXX',
      sample: 'AMS-20-N',
      bg: '#f2b705',
      topBand: '#003399',
      text: '#141414',
      scriptColor: '#141414',
      legacyEvery4: false
    },
    transit: {
      name: 'GVB Amsterdam',
      shortName: 'GVB',
      bodyColor: 0xf4f6f8,
      bandColor: 0x004b93,
      accentColor: 0x009fe3
    },
    ownCar: {
      kind: 'sports',
      hex: 0xff6b00,
      plateText: 'AMS-20-N',
      state: 'NEDERLAND'
    },
    areas: [
      [0, 0, 'Dam Square & Royal Palace'],
      [531, -667, 'Amsterdam Centraal & IJ Waterfront'],
      [-586, -156, 'Jordaan & Westerkerk'],
      [-320, 480, 'Grachtengordel (Canal Ring)'],
      [-265, 1479, 'Museumplein & Rijksmuseum'],
      [-1130, 1668, 'Vondelpark'],
      [348, 867, 'Amstel River & Magere Brug'],
      [220, 1780, 'De Pijp & Albert Cuyp'],
      [1212, -233, 'NEMO & Oosterdok']
    ],
    landmarks: [
      { id: 'damsquare',   name: 'Dam Square & Royal Palace',              short: 'Dam Square',           x: 0,     z: 0,     heading: 0 },
      { id: 'centraal',    name: 'Amsterdam Centraal Station',             short: 'Amsterdam Centraal',   x: 531,   z: -667,  heading: Math.PI },
      { id: 'westerkerk',  name: 'Westerkerk & Anne Frank House (Prinsengracht)', short: 'Westerkerk & Jordaan', x: -586, z: -156, heading: 0 },
      { id: 'rijksmuseum', name: 'Rijksmuseum & Museumplein',              short: 'Rijksmuseum',          x: -265,  z: 1479,  heading: 0 },
      { id: 'vondelpark',  name: 'Vondelpark Pavilion',                    short: 'Vondelpark',           x: -1130, z: 1668,  heading: Math.PI / 2 },
      { id: 'magerebrug',  name: 'Magere Brug (Skinny Bridge) on Amstel',  short: 'Magere Brug',          x: 688,   z: 1112,  heading: 0 },
      { id: 'rembrandt',   name: 'Rembrandtplein & Golden Bend',           short: 'Rembrandtplein',       x: 260,   z: 780,   heading: 0 },
      { id: 'nemo',        name: 'NEMO Science Museum & Oosterdok',        short: 'NEMO & Oosterdok',     x: 1212,  z: -233,  heading: -Math.PI / 2 }
    ],
    teleportIds: ['damsquare', 'centraal', 'westerkerk', 'rijksmuseum', 'vondelpark', 'magerebrug', 'rembrandt', 'nemo'],
    modelledLandmarks: [
      'Royal Palace Amsterdam',
      'Rijksmuseum',
      'Westerkerk'
    ],
    areaLabels: [
      ['AMSTERDAM', 0, 400, 0],
      ['HET IJ', 600, -1100, 1],
      ['AMSTEL', 688, 1200, 1],
      ['PRINSENGRACHT \u00b7 KEIZERSGRACHT', -480, 420, 1],
      ['DE DAM', 0, 0, 2],
      ['AMSTERDAM CENTRAAL', 531, -667, 2],
      ['JORDAAN', -820, -180, 2],
      ['GRACHTENGORDEL (CANAL RING)', -240, 580, 2],
      ['REMBRANDTPLEIN', 260, 780, 2],
      ['MUSEUMPLEIN \u00b7 RIJKSMUSEUM', -265, 1479, 2],
      ['VONDELPARK', -1130, 1668, 2],
      ['DE PIJP', 220, 1850, 2],
      ['OOSTERDOK \u00b7 PLANTAGE', 1212, 180, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'canalRing',     name: 'Prinsengracht & Westerkerk',  category: 'scenic', fov: 48 },
      { id: 'damSquare',     name: 'Dam Square & Royal Palace',   category: 'scenic', fov: 50 },
      { id: 'rijksmuseum',   name: 'Rijksmuseum & Museumplein',   category: 'scenic', fov: 48 },
      { id: 'amstelBridge',  name: 'Magere Brug & Amstel River',  category: 'scenic', fov: 50 },
      { id: 'amsterdamAerial',name: 'Concentric Canal Ring Aerial',category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      canalRing:       { pos: [-510, 11, -60],    look: [-586, 26, -156],   ampPos: [5, 0.3, 5],   ampLook: [3, 1, 3],   freq: 0.12 },
      damSquare:       { pos: [45, 11, 55],       look: [-35, 18, -10],     ampPos: [5, 0.3, 5],   ampLook: [3, 0, 3],   freq: 0.13 },
      rijksmuseum:     { pos: [-340, 12, 1620],   look: [-265, 24, 1479],   ampPos: [6, 0.3, 6],   ampLook: [4, 1, 4],   freq: 0.11 },
      amstelBridge:    { pos: [620, 10, 1180],    look: [688, 9, 1112],     ampPos: [6, 0.3, 6],   ampLook: [3, 0, 3],   freq: 0.12 },
      amsterdamAerial: { pos: [-420, 165, 920],   look: [-120, 14, 240],    ampPos: [20, 2.0, 20], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: 18,   z: 14,   heading: Math.PI },
      car:        { x: -240, z: 320,  heading: 0 },
      cyclist:    { x: -520, z: -80,  heading: 0 },
      helicopter: { x: -320, z: 780,  heading: 0.2, above: 145 },
      kayak:      { x: -340, z: 120,  heading: 0 }
    },
    archetypes: {
      style: 'dutch-canal-gabled-brick',
      treeCoverage: { canopyCover: 0.24, streetTreeDensity: 0.97, streetTreeSpacing: 22.7, parkTreeDensity: 1.1, foliageScale: 0.98 },
      housingDensity: { form: 'rowhouse', buildingsPerKm2: 2950, footprintCoverage: 0.53, wallEnclosure: 0.69, lotInfill: 0.2, rowhouseAttachment: 0.9, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.38, shrubDensity: 0.52 },
      residential: {
        walls: { clapboard: 0.04, brick: 0.86, stone: 0.06, stucco: 0.04, shake: 0.0 },
        roofs: { flat: 0.06, hip: 0.08, gable: 0.68, gambrel: 0.18 },
        pitch: { hip: 0.48, gable: 0.68, historic: 0.76 },
        bricks: [0x6e2e24, 0x85382a, 0x383230, 0x9c4430, 0x542c24, 0x7a4232],
        shingles: [0x2b2d30, 0x9e3e28, 0x3b3e42, 0x8c3824]
      },
      midrise: {
        masonry: { stoneColor: 0x7a3428, trimColor: 0xf2eee4, windowWidth: 2.2, floorHeight: 3.5 },
        historic: { stoneColor: 0x3d3532, trimColor: 0xf5f2ea, windowWidth: 2.1, floorHeight: 3.6 },
        waterTowerProb: 0.0,
        fireEscapes: false
      },
      neighborhoods: {
        grachtengordel_canal_ring: {
          treeCoverage: { canopyCover: 0.21, streetTreeDensity: 0.93, streetTreeSpacing: 23.7, parkTreeDensity: 1.07, foliageScale: 0.97 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2950, footprintCoverage: 0.56, wallEnclosure: 0.64, lotInfill: 0.2, rowhouseAttachment: 0.9, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.38, shrubDensity: 0.52 },
          style: 'golden-age-step-and-bell-gabled-canal-houses',
          residential: {
            walls: { clapboard: 0.0, brick: 0.90, stone: 0.08, stucco: 0.02, shake: 0.0 },
            roofs: { flat: 0.02, hip: 0.04, gable: 0.74, gambrel: 0.20 },
            pitch: { hip: 0.52, gable: 0.72, historic: 0.80 },
            bricks: [0x6e2e24, 0x383230, 0x85382a, 0x483832]
          },
          midrise: { stoneColor: 0x6e2e24, trimColor: 0xf7f5ef, storefronts: true }
        },
        jordaan_westerkerk: {
          treeCoverage: { canopyCover: 0.21, streetTreeDensity: 0.93, streetTreeSpacing: 23.7, parkTreeDensity: 1.07, foliageScale: 0.97 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2950, footprintCoverage: 0.56, wallEnclosure: 0.64, lotInfill: 0.2, rowhouseAttachment: 0.9, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.38, shrubDensity: 0.52 },
          style: 'jordaan-artisan-brick-gable-rows',
          residential: {
            walls: { clapboard: 0.02, brick: 0.92, stone: 0.02, stucco: 0.04, shake: 0.0 },
            roofs: { flat: 0.04, hip: 0.06, gable: 0.78, gambrel: 0.12 },
            bricks: [0x85382a, 0x9c4430, 0x6e2e24, 0x7a4232]
          },
          midrise: { stoneColor: 0x85382a, trimColor: 0xf2eee4, storefronts: true }
        },
        de_pijp_albert_cuyp: {
          treeCoverage: { canopyCover: 0.21, streetTreeDensity: 0.93, streetTreeSpacing: 23.7, parkTreeDensity: 1.07, foliageScale: 0.97 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2950, footprintCoverage: 0.56, wallEnclosure: 0.64, lotInfill: 0.2, rowhouseAttachment: 0.9, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.38, shrubDensity: 0.52 },
          style: 'amsterdam-school-expressionist-brick',
          midrise: { stoneColor: 0x94422e, trimColor: 0xdfd8c8, storefronts: true }
        }
      },
      landmarks: {
        'Royal Palace Amsterdam': { form: 'dome_palace', x: 0, z: 0, w: 80, d: 63, h: 52, wallColor: 0xd8ccb8, trimColor: 0x9e9482, roofColor: 0x4a7c6b },
        'Rijksmuseum': { form: 'cathedral_spires', x: -265, z: 1479, w: 135, d: 84, h: 62, wallColor: 0x8a3b2c, trimColor: 0xdfd6c4, roofColor: 0x383e45 },
        'Westerkerk': { form: 'clock_tower', x: -586, z: -156, w: 28, d: 52, h: 85, wallColor: 0x7a3428, trimColor: 0xd8d0c0, roofColor: 0x2e5894 },
        'Amsterdam Centraal Station': { form: 'cathedral_spires', x: 531, z: -667, w: 150, d: 65, h: 48, wallColor: 0x8e3c2c, trimColor: 0xe6dfd0, roofColor: 0x3b4045 },
        'Magere Brug (Skinny Bridge) on Amstel': { form: 'bascule_bridge', x: 688, z: 1112, w: 80, d: 9, h: 12, wallColor: 0xf7f5ef, trimColor: 0xd8d2c6 }
      }
    }
  },

  hongkong: {
    id: 'hongkong',
    title: 'Hong Kong',
    stateCode: 'HK',
    stateLabel: 'Hong Kong SAR',
    displayName: 'Hong Kong',
    icon: 'img/icon-hongkong.svg',
    subtitle: 'Victoria Harbour, Central Skyline, Bank of China, Victoria Peak & Tsim Sha Tsui',
    countyLabel: 'HONG KONG SAR',
    cityLabel: 'HONG KONG',
    searchPlaceholder: 'Street or landmark (Central, Victoria Peak, Star Ferry, Tsim Sha Tsui, Wan Chai...)',
    loadingStages: {
      streets: 'Building Central, Admiralty, Wan Chai and Tsim Sha Tsui...',
      outskirts: 'Laying out Victoria Harbour, Kowloon and Victoria Peak...',
      landmarks: 'Building Bank of China Tower, IFC, ICC and Star Ferry Piers...'
    },
    timeZone: 'Asia/Hong_Kong',
    lat: 22.2855,
    lon: 114.1577,
    baseElev: 0.0,
    weatherStation: 'VHHH',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.0,
    usualCfs: 500,
    kayakLaunch: { x: 260, z: -280 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'HKPF',
      doorTop: 'HONG KONG',
      doorBottom: 'POLICE',
      doorSub: 'CENTRAL DISTRICT',
      badgeTitle: 'HKPF',
      baseColor: 0xf4f7fa,
      stripeColor: 0x003893
    },
    plate: {
      state: 'HONG KONG',
      slogan: 'ASIA WORLD CITY',
      sample: 'HK 852',
      bg: '#f7b500',
      topBand: null,
      text: '#141414',
      scriptColor: '#141414',
      legacyEvery4: false
    },
    transit: {
      name: 'Citybus / KMB',
      shortName: 'HK BUS',
      bodyColor: 0xf5c400,
      bandColor: 0xd92626,
      accentColor: 0x0055a5
    },
    ownCar: {
      kind: 'taxi',
      hex: 0xd91e2a,
      plateText: 'HK 852',
      state: 'HONG KONG'
    },
    areas: [
      [0, 0, 'Central & IFC'],
      [402, 689, 'Bank of China & Admiralty'],
      [-515, 222, 'SoHo & Mid-Levels Escalator'],
      [-1154, 1656, 'Victoria Peak (The Peak)'],
      [1762, 622, 'Wan Chai & Convention Centre'],
      [2720, 622, 'Causeway Bay'],
      [1236, -967, 'Tsim Sha Tsui & Avenue of Stars'],
      [412, -1934, 'West Kowloon & ICC']
    ],
    landmarks: [
      { id: 'central',      name: 'Central & International Finance Centre (IFC)', short: 'Central & IFC',   x: 0,     z: 0,     heading: 0 },
      { id: 'boctower',     name: 'Bank of China Tower & Chater Garden',          short: 'Bank of China',   x: 402,   z: 689,   heading: 0 },
      { id: 'starferry',    name: 'Central Star Ferry Pier & Harbourfront',       short: 'Star Ferry Pier', x: 240,   z: -120,  heading: 0 },
      { id: 'thepeak',      name: 'Victoria Peak (Peak Tower & Lugard Road)',     short: 'Victoria Peak',   x: -1154, z: 1656,  heading: 0 },
      { id: 'tst',          name: 'Tsim Sha Tsui Promenade & Clock Tower',        short: 'Tsim Sha Tsui',   x: 1236,  z: -967,  heading: Math.PI },
      { id: 'wanchai',      name: 'Hong Kong Convention Centre & Wan Chai',       short: 'Wan Chai',        x: 1762,  z: 245,   heading: 0 },
      { id: 'soho',         name: 'Lan Kwai Fong & Mid-Levels',                   short: 'SoHo / LKF',      x: -240,  z: 480,   heading: 0 },
      { id: 'icc',          name: 'International Commerce Centre (West Kowloon)', short: 'ICC Kowloon',     x: 412,   z: -1934, heading: Math.PI }
    ],
    teleportIds: ['central', 'boctower', 'starferry', 'thepeak', 'tst', 'wanchai', 'soho', 'icc'],
    modelledLandmarks: [
      'Bank of China Tower',
      'Two International Finance Centre',
      'Hong Kong Convention Centre'
    ],
    areaLabels: [
      ['HONG KONG', 200, 400, 0],
      ['KOWLOON', 1200, -1600, 0],
      ['VICTORIA HARBOUR', 800, -520, 1],
      ['CENTRAL', 0, 200, 2],
      ['ADMIRALTY \u00b7 BANK OF CHINA', 520, 689, 2],
      ['SOHO \u00b7 MID-LEVELS', -515, 520, 2],
      ['VICTORIA PEAK', -1154, 1656, 2],
      ['SHEUNG WAN', -950, -100, 2],
      ['WAN CHAI', 1762, 622, 2],
      ['CAUSEWAY BAY', 2720, 622, 2],
      ['TSIM SHA TSUI', 1236, -1100, 2],
      ['WEST KOWLOON \u00b7 ICC', 412, -1934, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'victoriaHarbour', name: 'Victoria Harbour & Central',  category: 'scenic', fov: 46 },
      { id: 'bankOfChina',     name: 'Bank of China Prism Tower',   category: 'scenic', fov: 48 },
      { id: 'victoriaPeak',    name: 'Victoria Peak Panorama',      category: 'scenic', fov: 46 },
      { id: 'tsimShaTsui',     name: 'Tsim Sha Tsui Waterfront',    category: 'scenic', fov: 48 },
      { id: 'harbourAerial',   name: 'Hong Kong Harbour Aerial',    category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      victoriaHarbour: { pos: [980, 18, -760],    look: [220, 95, 240],      ampPos: [12, 0.6, 12], ampLook: [8, 2, 8],   freq: 0.10 },
      bankOfChina:     { pos: [260, 18, 480],     look: [402, 135, 689],     ampPos: [6, 0.4, 6],   ampLook: [4, 3, 4],   freq: 0.11 },
      victoriaPeak:    { pos: [-1080, 42, 1520],  look: [200, 65, 100],      ampPos: [12, 1.0, 12], ampLook: [15, 0, 15], freq: 0.08 },
      tsimShaTsui:     { pos: [1180, 14, -920],   look: [380, 85, 320],      ampPos: [8, 0.4, 8],   ampLook: [6, 2, 6],   freq: 0.11 },
      harbourAerial:   { pos: [1450, 195, -820],  look: [350, 80, 350],      ampPos: [22, 2.0, 22], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: 180,  z: -60,  heading: 0 },
      car:        { x: 60,   z: 180,  heading: Math.PI / 2 },
      cyclist:    { x: 1180, z: -920, heading: -Math.PI / 2 },
      helicopter: { x: 880,  z: -520, heading: -2.4, above: 185 },
      kayak:      { x: 260,  z: -280, heading: 0.5 }
    },
    archetypes: {
      style: 'hong-kong-subtropical-podium-tower',
      treeCoverage: { canopyCover: 0.11, streetTreeDensity: 0.4, streetTreeSpacing: 38.0, parkTreeDensity: 1.14, foliageScale: 0.8 },
      housingDensity: { form: 'highrise', buildingsPerKm2: 2600, footprintCoverage: 0.58, wallEnclosure: 0.82, lotInfill: 0.12, rowhouseAttachment: 0.82, maxHouseHeight: 8.8, maxHouseFootprint: 240, porchProbScale: 0.28, shrubDensity: 0.42 },
      residential: {
        walls: { clapboard: 0.02, brick: 0.06, stone: 0.08, stucco: 0.84, shake: 0.0 },
        roofs: { flat: 0.84, hip: 0.10, gable: 0.06, gambrel: 0.0 },
        pitch: { hip: 0.24, gable: 0.26, historic: 0.32 },
        stucco: [0xe8e4dc, 0xd8d2c6, 0xf2ded6, 0xd4e2dc, 0xe6d8c4, 0xc9d2d8]
      },
      midrise: {
        masonry: { stoneColor: 0xded9ce, trimColor: 0x9c968c, windowWidth: 2.4, floorHeight: 3.4 },
        historic: { stoneColor: 0xc8b8a6, trimColor: 0x8c7e70, windowWidth: 2.3, floorHeight: 3.4 },
        waterTowerProb: 0.08,
        fireEscapes: false
      },
      neighborhoods: {
        soho_mid_levels_escalator: {
          treeCoverage: { canopyCover: 0.2, streetTreeDensity: 0.48, streetTreeSpacing: 38.0, parkTreeDensity: 1.28, foliageScale: 0.81 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2600, footprintCoverage: 0.64, wallEnclosure: 0.74, lotInfill: 0.12, rowhouseAttachment: 0.82, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.28, shrubDensity: 0.42 },
          style: 'tong-lau-verandah-shophouses',
          residential: {
            walls: { clapboard: 0.0, brick: 0.12, stone: 0.08, stucco: 0.80, shake: 0.0 },
            roofs: { flat: 0.88, hip: 0.08, gable: 0.04, gambrel: 0.0 },
            stucco: [0xf2ded6, 0xd4e2dc, 0xf5e8c8, 0xe8d4c4]
          },
          midrise: { stoneColor: 0xd8c8b4, trimColor: 0x4a6b5c, storefronts: true }
        },
        victoria_peak_the_peak: {
          treeCoverage: { canopyCover: 0.36, streetTreeDensity: 0.72, streetTreeSpacing: 30.6, parkTreeDensity: 1.54, foliageScale: 0.83 },
          housingDensity: { form: 'highrise', buildingsPerKm2: 2600, footprintCoverage: 0.57, wallEnclosure: 0.74, lotInfill: 0.12, rowhouseAttachment: 0.82, maxHouseHeight: 8.8, maxHouseFootprint: 240, porchProbScale: 0.28, shrubDensity: 0.48 },
          style: 'peak-subtropical-hillside-villas',
          residential: {
            walls: { clapboard: 0.0, brick: 0.05, stone: 0.25, stucco: 0.70, shake: 0.0 },
            roofs: { flat: 0.45, hip: 0.40, gable: 0.15, gambrel: 0.0 },
            stucco: [0xf7f5ef, 0xf2ece0, 0xe8dfd0]
          }
        },
        tsim_sha_tsui_avenue_of_stars: {
          treeCoverage: { canopyCover: 0.12, streetTreeDensity: 0.28, streetTreeSpacing: 38.0, parkTreeDensity: 1.15, foliageScale: 0.79 },
          housingDensity: { form: 'highrise', buildingsPerKm2: 2600, footprintCoverage: 0.7, wallEnclosure: 0.74, lotInfill: 0.12, rowhouseAttachment: 0.82, maxHouseHeight: 8.8, maxHouseFootprint: 240, porchProbScale: 0.25, shrubDensity: 0.24 },
          style: 'kowloon-neon-podium-commercial',
          midrise: { stoneColor: 0xd4cfc4, trimColor: 0x8c8478, storefronts: true, waterTowerProb: 0.14 }
        }
      },
      landmarks: {
        'Bank of China Tower': { form: 'diagrid_prism', x: 402, z: 689, w: 52, d: 52, h: 367, wallColor: 0xa8c8dc, trimColor: 0xe6edf2 },
        'Two International Finance Centre': { form: 'stepped_bundled_tube', x: 0, z: 0, w: 58, d: 58, h: 415, wallColor: 0xb8d4e6, trimColor: 0xdce6ed },
        'Hong Kong Convention Centre': { form: 'opera_sails', x: 1762, z: 245, w: 145, d: 220, h: 48, wallColor: 0xdce6ed, trimColor: 0x8ea4b5 },
        'International Commerce Centre (West Kowloon)': { form: 'stepped_bundled_tube', x: 412, z: -1934, w: 62, d: 62, h: 484, wallColor: 0xa8c4d8, trimColor: 0xd8e4ec }
      }
    }
  },

  paris: {
    id: 'paris',
    title: 'Paris',
    stateCode: '75',
    stateLabel: 'Ile-de-France',
    displayName: 'Paris, France',
    icon: 'img/icon-paris.svg',
    subtitle: 'Eiffel Tower, River Seine, Louvre, Notre-Dame, Champs-Elysees & Haussmann Boulevards',
    countyLabel: 'VILLE DE PARIS',
    cityLabel: 'PARIS',
    searchPlaceholder: 'Boulevard or monument (Tour Eiffel, Louvre, Notre-Dame, Champs-Elysees, Seine...)',
    loadingStages: {
      streets: 'Building the River Seine bridges, Champs-Elysees and Haussmann boulevards...',
      outskirts: 'Laying out Ile de la Cite, Saint-Germain, Le Marais and Trocadero...',
      landmarks: 'Building the Eiffel Tower, Louvre Pyramid, Arc de Triomphe and Notre-Dame...'
    },
    timeZone: 'Europe/Paris',
    lat: 48.8606,
    lon: 2.3376,
    baseElev: 28.0,
    weatherStation: 'LFPG',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.5,
    usualCfs: 8500,
    kayakLaunch: { x: -420, z: 120 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'POLICE',
      doorTop: 'POLICE',
      doorBottom: 'NATIONALE',
      doorSub: 'PREFECTURE DE PARIS',
      badgeTitle: '75',
      baseColor: 0xf4f6f8,
      stripeColor: 0x002654
    },
    plate: {
      state: 'FRANCE',
      slogan: 'ILE-DE-FRANCE 75',
      sample: 'PR-075-FR',
      bg: '#f4f6f8',
      topBand: '#003399',
      text: '#141414',
      scriptColor: '#003399',
      legacyEvery4: false
    },
    transit: {
      name: 'RATP Bus',
      shortName: 'RATP',
      bodyColor: 0xf4f6f8,
      bandColor: 0x00a88f,
      accentColor: 0x0055a4
    },
    ownCar: {
      kind: 'sports',
      hex: 0x0055a4,
      plateText: 'PR-075-FR',
      state: 'FRANCE'
    },
    areas: [
      [0, 0, 'Musee du Louvre & Tuileries'],
      [-3168, 256, 'Tour Eiffel & Champ de Mars'],
      [907, 845, 'Ile de la Cite & Notre-Dame'],
      [-1200, -490, 'Place de la Concorde'],
      [-3116, -1467, 'Arc de Triomphe & Etoile'],
      [-337, 45, 'Musee d\'Orsay & Saint-Germain'],
      [1240, 220, 'Le Marais & Hotel de Ville'],
      [797, 1590, 'Latin Quarter & Pantheon'],
      [-406, 1701, 'Jardin du Luxembourg'],
      [-150, -1250, 'Opera Garnier & Grands Boulevards']
    ],
    landmarks: [
      { id: 'louvre',      name: 'Musee du Louvre & Glass Pyramid',       short: 'Louvre Pyramid',       x: 0,     z: 0,     heading: -Math.PI / 2 },
      { id: 'eiffel',      name: 'Tour Eiffel & Champ de Mars',           short: 'Eiffel Tower',         x: -3168, z: 256,   heading: 0 },
      { id: 'notredame',   name: 'Cathedrale Notre-Dame de Paris',        short: 'Notre-Dame',           x: 907,   z: 845,   heading: -Math.PI / 2 },
      { id: 'concorde',    name: 'Place de la Concorde & Luxor Obelisk',  short: 'Place de la Concorde', x: -1200, z: -490,  heading: -Math.PI / 2 },
      { id: 'arctriomphe', name: 'Arc de Triomphe & Champs-Elysees',      short: 'Arc de Triomphe',      x: -3116, z: -1467, heading: Math.PI / 2 },
      { id: 'orsay',       name: 'Musee d\'Orsay & Pont Royal',           short: 'Musee d\'Orsay',       x: -337,  z: 45,    heading: 0 },
      { id: 'pantheon',    name: 'Pantheon & Latin Quarter',              short: 'The Pantheon',         x: 797,   z: 1590,  heading: 0 },
      { id: 'luxembourg',  name: 'Jardin du Luxembourg & Palais',         short: 'Luxembourg Gardens',   x: -406,  z: 1701,  heading: 0 }
    ],
    teleportIds: ['eiffel', 'louvre', 'notredame', 'concorde', 'arctriomphe', 'orsay', 'pantheon', 'luxembourg'],
    modelledLandmarks: [
      'Tour Eiffel',
      'Louvre Pyramid',
      'Arc de Triomphe',
      'Cathedrale Notre-Dame de Paris'
    ],
    areaLabels: [
      ['PARIS', -600, 200, 0],
      ['LA SEINE', -800, 120, 1],
      ['LA SEINE', 650, 780, 1],
      ['MUSEE DU LOUVRE \u00b7 TUILERIES', -350, -150, 2],
      ['TOUR EIFFEL \u00b7 CHAMP DE MARS', -3050, 480, 2],
      ['TROCADERO', -3620, -220, 2],
      ['CHAMPS-ELYSEES', -2150, -980, 2],
      ['ARC DE TRIOMPHE', -3116, -1467, 2],
      ['PLACE DE LA CONCORDE', -1200, -490, 2],
      ['ILE DE LA CITE \u00b7 NOTRE-DAME', 907, 845, 2],
      ['SAINT-GERMAIN-DES-PRES', -250, 680, 2],
      ['QUARTIER LATIN \u00b7 PANTHEON', 797, 1590, 2],
      ['JARDIN DU LUXEMBOURG', -406, 1701, 2],
      ['LE MARAIS', 1350, 120, 2],
      ['OPERA \u00b7 VENDOME', -380, -1080, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'eiffelTower',   name: 'Tour Eiffel & Pont d\'Iena',  category: 'scenic', fov: 48 },
      { id: 'louvrePyramid', name: 'Louvre Cour Napoleon',        category: 'scenic', fov: 50 },
      { id: 'notreDame',     name: 'Notre-Dame & Ile de la Cite', category: 'scenic', fov: 48 },
      { id: 'champsElysees', name: 'Champs-Elysees & Arc',        category: 'scenic', fov: 48 },
      { id: 'seineBridges',  name: 'Pont Alexandre III & Seine',  category: 'scenic', fov: 50 },
      { id: 'parisAerial',   name: 'Paris & River Seine Aerial',  category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      eiffelTower:   { pos: [-3360, 18, -20],    look: [-3168, 120, 256],   ampPos: [10, 0.6, 10], ampLook: [5, 3, 5],   freq: 0.10 },
      louvrePyramid: { pos: [-95, 11, -20],      look: [0, 14, 0],          ampPos: [5, 0.3, 5],   ampLook: [3, 0, 3],   freq: 0.13 },
      notreDame:     { pos: [760, 12, 810],      look: [907, 32, 845],      ampPos: [6, 0.3, 6],   ampLook: [4, 1, 4],   freq: 0.12 },
      champsElysees: { pos: [-2720, 14, -1240],  look: [-3116, 36, -1467],  ampPos: [8, 0.4, 8],   ampLook: [4, 1, 4],   freq: 0.11 },
      seineBridges:  { pos: [-1420, 14, -120],   look: [-1420, 16, 280],    ampPos: [8, 0.4, 8],   ampLook: [6, 1, 6],   freq: 0.11 },
      parisAerial:   { pos: [-2450, 195, -420],  look: [-3168, 95, 256],    ampPos: [22, 2.0, 22], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: -3260, z: 120,  heading: 2.5 },
      car:        { x: -1200, z: -490, heading: -Math.PI / 2 },
      cyclist:    { x: -240,  z: 45,   heading: -Math.PI / 2 },
      helicopter: { x: -2650, z: -280, heading: -2.3, above: 175 },
      kayak:      { x: -420,  z: 120,  heading: -Math.PI / 2 }
    },
    archetypes: {
      style: 'haussmann-limestone-zinc-mansard',
      treeCoverage: { canopyCover: 0.11, streetTreeDensity: 0.73, streetTreeSpacing: 30.1, parkTreeDensity: 0.95, foliageScale: 0.93 },
      housingDensity: { form: 'rowhouse', buildingsPerKm2: 3400, footprintCoverage: 0.64, wallEnclosure: 0.83, lotInfill: 0.15, rowhouseAttachment: 0.92, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.32, shrubDensity: 0.45 },
      residential: {
        walls: { clapboard: 0.0, brick: 0.08, stone: 0.64, stucco: 0.28, shake: 0.0 },
        roofs: { flat: 0.12, hip: 0.56, gable: 0.14, gambrel: 0.18 },
        pitch: { hip: 0.44, gable: 0.48, historic: 0.56 },
        stucco: [0xefe8d5, 0xe6dec8, 0xddd3bc, 0xf4eee0, 0xd8ccb4],
        shingles: [0x4c5866, 0x3e4a56, 0x586573, 0x434d59, 0x626f7d]
      },
      midrise: {
        masonry: { stoneColor: 0xe8dec8, trimColor: 0xb8ae98, windowWidth: 2.2, floorHeight: 3.7 },
        historic: { stoneColor: 0xdfd3ba, trimColor: 0x9c927e, windowWidth: 2.1, floorHeight: 3.8 },
        waterTowerProb: 0.0,
        fireEscapes: false
      },
      neighborhoods: {
        le_marais_hotel_de_ville: {
          treeCoverage: { canopyCover: 0.19, streetTreeDensity: 0.86, streetTreeSpacing: 25.6, parkTreeDensity: 1.06, foliageScale: 0.94 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3400, footprintCoverage: 0.64, wallEnclosure: 0.74, lotInfill: 0.15, rowhouseAttachment: 0.92, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.32, shrubDensity: 0.45 },
          style: 'marais-17th-century-hotels-particuliers',
          residential: {
            walls: { clapboard: 0.0, brick: 0.24, stone: 0.56, stucco: 0.20, shake: 0.0 },
            roofs: { flat: 0.06, hip: 0.48, gable: 0.22, gambrel: 0.24 },
            stucco: [0xeadfc8, 0xdfd3ba, 0xd4c5a8],
            bricks: [0xa64836, 0x943e2e]
          },
          midrise: { stoneColor: 0xdfd3ba, trimColor: 0xf4eee0, storefronts: true }
        },
        opera_garnier_grands_boulevards: {
          treeCoverage: { canopyCover: 0.19, streetTreeDensity: 0.86, streetTreeSpacing: 25.6, parkTreeDensity: 1.06, foliageScale: 0.94 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3400, footprintCoverage: 0.57, wallEnclosure: 0.74, lotInfill: 0.15, rowhouseAttachment: 0.92, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.32, shrubDensity: 0.45 },
          style: 'grand-haussmann-boulevard-limestone',
          residential: {
            walls: { clapboard: 0.0, brick: 0.02, stone: 0.82, stucco: 0.16, shake: 0.0 },
            roofs: { flat: 0.06, hip: 0.62, gable: 0.06, gambrel: 0.26 }
          },
          midrise: { stoneColor: 0xefe8d5, trimColor: 0x4c5866, storefronts: true }
        },
        latin_quarter_pantheon: {
          treeCoverage: { canopyCover: 0.19, streetTreeDensity: 0.86, streetTreeSpacing: 25.6, parkTreeDensity: 1.06, foliageScale: 0.94 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3400, footprintCoverage: 0.64, wallEnclosure: 0.74, lotInfill: 0.15, rowhouseAttachment: 0.92, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.32, shrubDensity: 0.45 },
          style: 'rive-gauche-sorbonne-plaster-stone',
          midrise: { stoneColor: 0xe2d6be, trimColor: 0xa89c86, storefronts: true }
        }
      },
      landmarks: {
        'Tour Eiffel': { form: 'lattice_tower', x: -3168, z: 256, w: 125, d: 125, h: 324, wallColor: 0x8b6f4e, trimColor: 0xa88b68 },
        'Louvre Pyramid': { form: 'diagrid_prism', x: 0, z: 0, w: 35, d: 35, h: 22, wallColor: 0xb8d8e8, trimColor: 0xe8dec8 },
        'Arc de Triomphe': { form: 'triumphal_arch', x: -3116, z: -1467, w: 45, d: 22, h: 50, wallColor: 0xe8dec8, trimColor: 0xcabfa8 },
        'Cathedrale Notre-Dame de Paris': { form: 'cathedral_spires', x: 907, z: 845, w: 48, d: 128, h: 69, wallColor: 0xe6dec8, trimColor: 0xb8ae98, roofColor: 0x4c5866 },
        'Pantheon & Latin Quarter': { form: 'dome_palace', x: 797, z: 1590, w: 84, d: 110, h: 83, wallColor: 0xe8dec8, trimColor: 0xcabfa8, roofColor: 0x586573 }
      }
    }
  },

  london: {
    id: 'london',
    title: 'London',
    stateCode: 'UK',
    stateLabel: 'Greater London, UK',
    displayName: 'London, UK',
    icon: 'img/icon-london.svg',
    subtitle: 'Big Ben & Westminster, River Thames, London Eye, Trafalgar Square, Soho & The Shard',
    countyLabel: 'GREATER LONDON',
    cityLabel: 'LONDON',
    searchPlaceholder: 'Street or landmark (Westminster, Big Ben, Trafalgar Square, Thames, St Paul\'s, Soho...)',
    loadingStages: {
      streets: 'Building Westminster, Whitehall, the Strand, Soho and South Bank...',
      outskirts: 'Laying out the River Thames, St James\'s Park and the City of London...',
      landmarks: 'Building Big Ben, Palace of Westminster, London Eye and St Paul\'s...'
    },
    timeZone: 'Europe/London',
    lat: 51.5055,
    lon: -0.1168,
    baseElev: 0.0,
    weatherStation: 'EGLL',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.5,
    usualCfs: 6000,
    kayakLaunch: { x: -80, z: 120 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'MET POLICE',
      doorTop: 'METROPOLITAN',
      doorBottom: 'POLICE',
      doorSub: 'SCOTLAND YARD',
      badgeTitle: 'MET',
      baseColor: 0xf4f7fa,
      stripeColor: 0x003399
    },
    plate: {
      state: 'UNITED KINGDOM',
      slogan: 'GREATER LONDON',
      sample: 'LDN 20A',
      bg: '#f5c400',
      topBand: null,
      text: '#141414',
      scriptColor: '#141414',
      legacyEvery4: false
    },
    transit: {
      name: 'Transport for London',
      shortName: 'LONDON BUSES',
      bodyColor: 0xdc241f,
      bandColor: 0xffffff,
      accentColor: 0x0019a8
    },
    ownCar: {
      kind: 'sports',
      hex: 0x004225,
      plateText: 'LDN 20A',
      state: 'UK'
    },
    areas: [
      [0, 0, 'Waterloo Bridge & Savoy'],
      [-542, 534, 'Westminster & Big Ben'],
      [-156, 200, 'London Eye & South Bank'],
      [-780, -289, 'Trafalgar Square & Whitehall'],
      [-1704, 489, 'Buckingham Palace & St James\'s Park'],
      [-920, -820, 'Soho, Covent Garden & West End'],
      [1273, -934, 'St Paul\'s Cathedral & Fleet Street'],
      [924, -67, 'Tate Modern & Millennium Bridge'],
      [2100, 111, 'London Bridge & The Shard']
    ],
    landmarks: [
      { id: 'bigben',      name: 'Big Ben (Elizabeth Tower) & Westminster', short: 'Big Ben & Parliament', x: -542,  z: 534,   heading: 0 },
      { id: 'londoneye',   name: 'London Eye & South Bank Promenade',       short: 'London Eye',           x: -156,  z: 245,   heading: -Math.PI / 2 },
      { id: 'trafalgar',   name: 'Trafalgar Square & Nelson\'s Column',     short: 'Trafalgar Square',     x: -780,  z: -289,  heading: 0 },
      { id: 'buckingham',  name: 'Buckingham Palace & The Mall',            short: 'Buckingham Palace',    x: -1704, z: 489,   heading: Math.PI / 2 },
      { id: 'stpauls',     name: 'St Paul\'s Cathedral',                    short: 'St Paul\'s Cathedral', x: 1273,  z: -934,  heading: -Math.PI / 2 },
      { id: 'tatemodern',  name: 'Tate Modern & Millennium Bridge',         short: 'Tate Modern',          x: 924,   z: -67,   heading: 0 },
      { id: 'coventgarden',name: 'Covent Garden Piazza & West End',         short: 'Covent Garden',        x: -380,  z: -680,  heading: 0 },
      { id: 'theshard',    name: 'The Shard & London Bridge',               short: 'The Shard',            x: 2100,  z: 111,   heading: 0 }
    ],
    teleportIds: ['bigben', 'londoneye', 'trafalgar', 'buckingham', 'stpauls', 'tatemodern', 'coventgarden', 'theshard'],
    modelledLandmarks: [
      'Elizabeth Tower (Big Ben)',
      'London Eye',
      'St Paul\'s Cathedral',
      'The Shard'
    ],
    areaLabels: [
      ['LONDON', 0, -200, 0],
      ['RIVER THAMES', -240, 150, 1],
      ['RIVER THAMES', 1200, -350, 1],
      ['WESTMINSTER \u00b7 BIG BEN', -542, 534, 2],
      ['SOUTH BANK \u00b7 LONDON EYE', -156, 245, 2],
      ['TRAFALGAR SQUARE', -780, -289, 2],
      ['ST JAMES\'S PARK \u00b7 WHITEHALL', -1100, 280, 2],
      ['BUCKINGHAM PALACE', -1704, 489, 2],
      ['COVENT GARDEN \u00b7 STRAND', -380, -680, 2],
      ['SOHO \u00b7 PICCADILLY', -1150, -780, 2],
      ['CITY OF LONDON \u00b7 ST PAUL\'S', 1273, -934, 2],
      ['BANKSIDE \u00b7 TATE MODERN', 924, -67, 2],
      ['SOUTHWARK \u00b7 THE SHARD', 2100, 111, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'bigBen',          name: 'Big Ben & Westminster Bridge', category: 'scenic', fov: 48 },
      { id: 'londonEye',       name: 'London Eye & River Thames',    category: 'scenic', fov: 50 },
      { id: 'trafalgarSquare', name: 'Trafalgar Square & Whitehall', category: 'scenic', fov: 50 },
      { id: 'stPauls',         name: 'St Paul\'s & Millennium Bridge',category: 'scenic', fov: 48 },
      { id: 'thamesAerial',    name: 'Thames & Westminster Aerial',  category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      bigBen:          { pos: [-320, 14, 520],     look: [-542, 48, 534],     ampPos: [8, 0.4, 8],   ampLook: [4, 2, 4],   freq: 0.11 },
      londonEye:       { pos: [-420, 14, 220],     look: [-156, 52, 245],     ampPos: [8, 0.4, 8],   ampLook: [4, 2, 4],   freq: 0.11 },
      trafalgarSquare: { pos: [-780, 12, -180],    look: [-780, 24, -320],    ampPos: [6, 0.3, 6],   ampLook: [4, 1, 4],   freq: 0.12 },
      stPauls:         { pos: [1080, 16, -420],    look: [1273, 55, -934],    ampPos: [8, 0.4, 8],   ampLook: [4, 2, 4],   freq: 0.11 },
      thamesAerial:    { pos: [140, 175, 680],     look: [-380, 35, 320],     ampPos: [20, 2.0, 20], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: -390, z: 525, heading: -Math.PI / 2 },
      car:        { x: -450, z: 525, heading: -Math.PI / 2 },
      cyclist:    { x: -220, z: 180, heading: 0 },
      helicopter: { x: 80,   z: 560, heading: -1.8, above: 165 },
      kayak:      { x: -80,  z: 120, heading: 0.4 }
    },
    archetypes: {
      style: 'london-georgian-brick-portland-stone',
      treeCoverage: { canopyCover: 0.16, streetTreeDensity: 0.75, streetTreeSpacing: 29.3, parkTreeDensity: 1.09, foliageScale: 0.99 },
      housingDensity: { form: 'rowhouse', buildingsPerKm2: 2750, footprintCoverage: 0.53, wallEnclosure: 0.87, lotInfill: 0.22, rowhouseAttachment: 0.84, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.52, shrubDensity: 0.68 },
      residential: {
        walls: { clapboard: 0.02, brick: 0.68, stone: 0.14, stucco: 0.16, shake: 0.0 },
        roofs: { flat: 0.16, hip: 0.42, gable: 0.36, gambrel: 0.06 },
        pitch: { hip: 0.38, gable: 0.46, historic: 0.54 },
        bricks: [0x8e4232, 0xb89660, 0x7c382a, 0xa88652, 0x9c4c38, 0x6b3a2e],
        stucco: [0xf4f0e6, 0xebe4d4, 0xe2dac6, 0xf7f5ef],
        shingles: [0x383e45, 0x454c54, 0x2e3338, 0x525a63]
      },
      midrise: {
        masonry: { stoneColor: 0xe2dcd0, trimColor: 0xa69f92, windowWidth: 2.3, floorHeight: 3.8 },
        historic: { stoneColor: 0x984634, trimColor: 0xe8e2d5, windowWidth: 2.3, floorHeight: 3.6 },
        waterTowerProb: 0.0,
        fireEscapes: false
      },
      neighborhoods: {
        westminster_big_ben: {
          treeCoverage: { canopyCover: 0.17, streetTreeDensity: 0.76, streetTreeSpacing: 28.9, parkTreeDensity: 1.1, foliageScale: 0.99 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2750, footprintCoverage: 0.59, wallEnclosure: 0.98, lotInfill: 0.22, rowhouseAttachment: 0.84, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.52, shrubDensity: 0.68 },
          style: 'whitehall-portland-stone-imperial',
          residential: {
            walls: { clapboard: 0.0, brick: 0.35, stone: 0.45, stucco: 0.20, shake: 0.0 }
          },
          midrise: { stoneColor: 0xe6e0d4, trimColor: 0xb5afa2, storefronts: false }
        },
        soho_covent_garden_west_end: {
          treeCoverage: { canopyCover: 0.22, streetTreeDensity: 0.83, streetTreeSpacing: 26.5, parkTreeDensity: 1.17, foliageScale: 1.0 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2750, footprintCoverage: 0.54, wallEnclosure: 0.62, lotInfill: 0.22, rowhouseAttachment: 0.84, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.52, shrubDensity: 0.68 },
          style: 'soho-georgian-london-stock-brick',
          residential: {
            walls: { clapboard: 0.0, brick: 0.82, stone: 0.08, stucco: 0.10, shake: 0.0 },
            bricks: [0x8e4232, 0xb89660, 0x7c382a, 0xa88652]
          },
          midrise: { stoneColor: 0x8e4232, trimColor: 0xf4f0e6, storefronts: true }
        },
        buckingham_palace_st_james_s_park: {
          treeCoverage: { canopyCover: 0.41, streetTreeDensity: 1.26, streetTreeSpacing: 17.5, parkTreeDensity: 1.41, foliageScale: 1.05 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2750, footprintCoverage: 0.48, wallEnclosure: 0.62, lotInfill: 0.22, rowhouseAttachment: 0.84, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.52, shrubDensity: 0.78 },
          style: 'belgravia-regency-cream-stucco-terrace',
          residential: {
            walls: { clapboard: 0.0, brick: 0.24, stone: 0.26, stucco: 0.50, shake: 0.0 },
            stucco: [0xf7f5ef, 0xf4f0e6, 0xebe4d4]
          },
          midrise: { stoneColor: 0xf4f0e6, trimColor: 0xd8d0c0, storefronts: false }
        }
      },
      landmarks: {
        'Elizabeth Tower (Big Ben)': { form: 'clock_tower', x: -542, z: 534, w: 15, d: 15, h: 96, wallColor: 0xd8c69e, trimColor: 0xd4af37, roofColor: 0x38424a },
        'London Eye': { form: 'ferris_wheel', x: -156, z: 245, w: 120, d: 24, h: 135, wallColor: 0xf0f4f8, trimColor: 0xdce4ec },
        'St Paul\'s Cathedral': { form: 'dome_palace', x: 1273, z: -934, w: 75, d: 158, h: 111, wallColor: 0xe2dcd0, trimColor: 0xb5afa2, roofColor: 0x454c54 },
        'The Shard': { form: 'diagrid_prism', x: 2100, z: 111, w: 56, d: 56, h: 309, wallColor: 0xc8e0f0, trimColor: 0xeaf2f8 },
        'Buckingham Palace & The Mall': { form: 'dome_palace', x: -1704, z: 489, w: 108, d: 120, h: 24, wallColor: 0xe6e0d4, trimColor: 0xcabfa8, roofColor: 0x383e45 }
      }
    }
  },

  tokyo: {
    id: 'tokyo',
    title: 'Tokyo',
    stateCode: '13',
    stateLabel: 'Tokyo Metropolis',
    displayName: 'Tokyo, Japan',
    icon: 'img/icon-tokyo.svg',
    subtitle: 'Tokyo Tower, Imperial Palace, Ginza, Roppongi Hills, Tokyo Station & Sumida River',
    countyLabel: 'TOKYO METROPOLIS',
    cityLabel: 'TOKYO',
    searchPlaceholder: 'District or landmark (Tokyo Tower, Ginza, Roppongi, Imperial Palace, Tokyo Station...)',
    loadingStages: {
      streets: 'Building Ginza, Marunouchi, Roppongi, Shiba Park and the Imperial Palace moat...',
      outskirts: 'Laying out Minato, Chiyoda, Chuo and Tokyo Bay...',
      landmarks: 'Building Tokyo Tower, Roppongi Hills Mori Tower and Tokyo Station...'
    },
    timeZone: 'Asia/Tokyo',
    lat: 35.6655,
    lon: 139.7514,
    baseElev: 0.0,
    weatherStation: 'RJTT',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.0,
    usualCfs: 900,
    kayakLaunch: { x: 1620, z: -850 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'TMPD',
      doorTop: 'METROPOLITAN',
      doorBottom: 'POLICE',
      doorSub: 'KEISHICHO TOKYO',
      badgeTitle: 'TMPD',
      baseColor: 0xf4f6f8,
      stripeColor: 0x14171c
    },
    plate: {
      state: 'TOKYO',
      slogan: 'SHINAGAWA 300',
      sample: 'TKO 33-88',
      bg: '#f4f6f8',
      topBand: null,
      text: '#145a32',
      scriptColor: '#145a32',
      legacyEvery4: false
    },
    transit: {
      name: 'Toei Bus',
      shortName: 'TOEI BUS',
      bodyColor: 0xf4f6f8,
      bandColor: 0x4ca626,
      accentColor: 0xf39800
    },
    ownCar: {
      kind: 'sports',
      hex: 0xef233c,
      plateText: 'TKO 33-88',
      state: 'TOKYO'
    },
    areas: [
      [0, 0, 'Toranomon & Shimbashi'],
      [-543, 767, 'Tokyo Tower & Shiba Park'],
      [-1991, 567, 'Roppongi Hills & Azabu'],
      [1014, -678, 'Ginza & Yurakucho'],
      [1421, -1867, 'Tokyo Station & Marunouchi'],
      [172, -2289, 'Imperial Palace & Chiyoda'],
      [-652, -834, 'Akasaka & Nagatacho'],
      [750, 950, 'Hamamatsucho & Takeshiba Bayfront']
    ],
    landmarks: [
      { id: 'tokyotower',  name: 'Tokyo Tower & Zojo-ji Temple (Shiba Park)', short: 'Tokyo Tower',       x: -543,  z: 767,   heading: 0 },
      { id: 'ginza',       name: 'Ginza Crossing (Chuo-dori & Harumi-dori)',  short: 'Ginza Crossing',    x: 1014,  z: -678,  heading: 0 },
      { id: 'tokyostation',name: 'Tokyo Station & Marunouchi Plaza',          short: 'Tokyo Station',     x: 1421,  z: -1867, heading: -Math.PI / 2 },
      { id: 'imperial',    name: 'Imperial Palace Outer Gardens & Nijubashi', short: 'Imperial Palace',   x: 480,   z: -1820, heading: -Math.PI / 2 },
      { id: 'roppongi',    name: 'Roppongi Hills Mori Tower',                 short: 'Roppongi Hills',    x: -1991, z: 567,   heading: Math.PI / 2 },
      { id: 'toranomon',   name: 'Toranomon Hills & Atago Shrine',            short: 'Toranomon Hills',   x: 0,     z: 0,     heading: 0 },
      { id: 'akasaka',     name: 'Akasaka & National Diet Building',          short: 'National Diet',     x: -420,  z: -1120, heading: 0 },
      { id: 'hamamatsucho',name: 'Hamarikyu Gardens & Sumida River Mouth',    short: 'Hamarikyu Gardens', x: 980,   z: 320,   heading: 0 }
    ],
    teleportIds: ['tokyotower', 'ginza', 'tokyostation', 'imperial', 'roppongi', 'toranomon', 'akasaka', 'hamamatsucho'],
    modelledLandmarks: [
      'Tokyo Tower',
      'Roppongi Hills Mori Tower',
      'Tokyo Station Marunouchi Building'
    ],
    areaLabels: [
      ['TOKYO', 200, -400, 0],
      ['IMPERIAL PALACE MOAT', 420, -1950, 1],
      ['SUMIDA RIVER \u00b7 TOKYO BAY', 1650, 420, 1],
      ['TOKYO TOWER \u00b7 SHIBA PARK', -543, 767, 2],
      ['TORANOMON \u00b7 SHIMBASHI', 180, 0, 2],
      ['GINZA \u00b7 YURAKUCHO', 1014, -678, 2],
      ['MARUNOUCHI \u00b7 TOKYO STATION', 1421, -1867, 2],
      ['IMPERIAL PALACE (KOKYO)', 172, -2289, 2],
      ['KASUMIGASEKI \u00b7 NAGATACHO', -280, -1120, 2],
      ['AKASAKA', -850, -834, 2],
      ['ROPPONGI \u00b7 AZABU', -1991, 567, 2],
      ['HAMAMATSUCHO \u00b7 SHIODOME', 750, 720, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'tokyoTower',    name: 'Tokyo Tower & Shiba Park',    category: 'scenic', fov: 48 },
      { id: 'ginzaCrossing', name: 'Ginza Chuo-dori Boulevard',   category: 'scenic', fov: 50 },
      { id: 'roppongiHills', name: 'Roppongi View of Tokyo Tower',category: 'scenic', fov: 46 },
      { id: 'imperialMoat',  name: 'Imperial Palace & Marunouchi',category: 'scenic', fov: 48 },
      { id: 'tokyoAerial',   name: 'Minato & Chiyoda Skyline',    category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      tokyoTower:    { pos: [-340, 16, 620],     look: [-543, 120, 767],    ampPos: [8, 0.5, 8],   ampLook: [4, 3, 4],   freq: 0.10 },
      ginzaCrossing: { pos: [980, 12, -580],     look: [1040, 24, -740],    ampPos: [5, 0.3, 5],   ampLook: [3, 1, 3],   freq: 0.13 },
      roppongiHills: { pos: [-1780, 48, 520],    look: [-543, 110, 767],    ampPos: [10, 0.8, 10], ampLook: [6, 2, 6],   freq: 0.09 },
      imperialMoat:  { pos: [780, 14, -1820],    look: [1421, 38, -1867],   ampPos: [8, 0.4, 8],   ampLook: [4, 1, 4],   freq: 0.11 },
      tokyoAerial:   { pos: [180, 195, 1180],    look: [-320, 85, 420],     ampPos: [22, 2.0, 22], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: -380, z: 680,  heading: -2.2 },
      car:        { x: 0,    z: 0,    heading: 0 },
      cyclist:    { x: 1014, z: -678, heading: 0 },
      helicopter: { x: 120,  z: 960,  heading: -0.8, above: 185 },
      kayak:      { x: 1620, z: -850, heading: 0 }
    },
    archetypes: {
      style: 'tokyo-modern-tile-kawara',
      treeCoverage: { canopyCover: 0.16, streetTreeDensity: 0.65, streetTreeSpacing: 33.8, parkTreeDensity: 1.14, foliageScale: 0.84 },
      housingDensity: { form: 'urban', buildingsPerKm2: 3800, footprintCoverage: 0.47, wallEnclosure: 0.48, lotInfill: 0.28, rowhouseAttachment: 0.62, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.38, shrubDensity: 0.54 },
      residential: {
        walls: { clapboard: 0.18, brick: 0.04, stone: 0.06, stucco: 0.62, shake: 0.10 },
        roofs: { flat: 0.38, hip: 0.32, gable: 0.30, gambrel: 0.0 },
        pitch: { hip: 0.28, gable: 0.34, historic: 0.42 },
        stucco: [0xebe8e0, 0xd8d5cc, 0xc4c0b6, 0xf2f0ea, 0x8c887e, 0x52504c],
        shingles: [0x2b2d30, 0x36393d, 0x222428, 0x45484d]
      },
      midrise: {
        masonry: { stoneColor: 0xdfdcd2, trimColor: 0x8a877e, windowWidth: 2.5, floorHeight: 3.5 },
        historic: { stoneColor: 0x9e4838, trimColor: 0xe6e2d8, windowWidth: 2.4, floorHeight: 3.6 },
        waterTowerProb: 0.04,
        fireEscapes: false
      },
      neighborhoods: {
        ginza_yurakucho: {
          treeCoverage: { canopyCover: 0.05, streetTreeDensity: 0.33, streetTreeSpacing: 38.0, parkTreeDensity: 0.93, foliageScale: 0.81 },
          housingDensity: { form: 'urban', buildingsPerKm2: 3800, footprintCoverage: 0.63, wallEnclosure: 0.99, lotInfill: 0.28, rowhouseAttachment: 0.74, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.25, shrubDensity: 0.31 },
          style: 'ginza-curtain-wall-commercial-blocks',
          midrise: { stoneColor: 0xe6e4dc, trimColor: 0x6e7378, storefronts: true }
        },
        tokyo_station_marunouchi: {
          treeCoverage: { canopyCover: 0.09, streetTreeDensity: 0.37, streetTreeSpacing: 38.0, parkTreeDensity: 1.01, foliageScale: 0.81 },
          housingDensity: { form: 'urban', buildingsPerKm2: 3800, footprintCoverage: 0.66, wallEnclosure: 0.69, lotInfill: 0.28, rowhouseAttachment: 0.74, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.25, shrubDensity: 0.31 },
          style: 'marunouchi-red-brick-and-granite-financial',
          midrise: { stoneColor: 0x9e4838, trimColor: 0xebe8e0, storefronts: true }
        },
        tokyo_tower_shiba_park: {
          treeCoverage: { canopyCover: 0.21, streetTreeDensity: 0.86, streetTreeSpacing: 25.6, parkTreeDensity: 1.23, foliageScale: 0.87 },
          housingDensity: { form: 'urban', buildingsPerKm2: 3800, footprintCoverage: 0.45, wallEnclosure: 0.01, lotInfill: 0.28, rowhouseAttachment: 0.62, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.38, shrubDensity: 0.62 },
          style: 'shiba-zojoji-kawara-tile-temple-precinct',
          residential: {
            walls: { clapboard: 0.28, brick: 0.02, stone: 0.08, stucco: 0.44, shake: 0.18 },
            roofs: { flat: 0.18, hip: 0.46, gable: 0.36, gambrel: 0.0 },
            pitch: { hip: 0.36, gable: 0.44, historic: 0.50 },
            shingles: [0x222428, 0x2b2d30, 0x36393d]
          }
        }
      },
      landmarks: {
        'Tokyo Tower': { form: 'lattice_tower', x: -543, z: 767, w: 88, d: 88, h: 333, wallColor: 0xe03c1f, trimColor: 0xf7f7f7 },
        'Roppongi Hills Mori Tower': { form: 'stepped_bundled_tube', x: -1991, z: 567, w: 68, d: 68, h: 238, wallColor: 0x9cb4c4, trimColor: 0xd8e0e6 },
        'Tokyo Station Marunouchi Building': { form: 'dome_palace', x: 1421, z: -1867, w: 45, d: 180, h: 46, wallColor: 0xa64432, trimColor: 0xf2eee4, roofColor: 0x383e45 },
        'Imperial Palace Outer Gardens & Nijubashi': { form: 'torii_temple', x: 480, z: -1820, w: 54, d: 44, h: 26, wallColor: 0xf5f2ea, trimColor: 0x3b352e, roofColor: 0x3e6b5c }
      }
    }
  },

  barcelona: {
    id: 'barcelona',
    title: 'Barcelona',
    stateCode: 'CAT',
    stateLabel: 'Catalonia, Spain',
    displayName: 'Barcelona, Spain',
    icon: 'img/icon-barcelona.svg',
    subtitle: 'Sagrada Familia, Eixample Octagonal Blocks, Passeig de Gracia, Barri Gotic & Barceloneta',
    countyLabel: 'AJUNTAMENT DE BARCELONA',
    cityLabel: 'BARCELONA',
    searchPlaceholder: 'Street or landmark (Sagrada Familia, Passeig de Gracia, La Rambla, Barceloneta...)',
    loadingStages: {
      streets: 'Building Cerda\'s Eixample octagonal grid, Avinguda Diagonal and La Rambla...',
      outskirts: 'Laying out the Mediterranean coast, Port Vell, Barceloneta and Montjuic...',
      landmarks: 'Building La Sagrada Familia, Casa Batllo, Torre Glories and Columbus Monument...'
    },
    timeZone: 'Europe/Madrid',
    lat: 41.3902,
    lon: 2.1699,
    baseElev: 0.0,
    weatherStation: 'LEBL',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.0,
    usualCfs: 180,
    kayakLaunch: { x: 1050, z: 1650 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'MOSSOS',
      doorTop: 'MOSSOS',
      doorBottom: 'D\'ESQUADRA',
      doorSub: 'GUARDIA URBANA BCN',
      badgeTitle: 'BCN',
      baseColor: 0x0b2545,
      stripeColor: 0xd90429
    },
    plate: {
      state: 'ESPANA',
      slogan: 'BARCELONA CAT',
      sample: '0801 BCN',
      bg: '#f4f6f8',
      topBand: '#003399',
      text: '#141414',
      scriptColor: '#003399',
      legacyEvery4: false
    },
    transit: {
      name: 'TMB Barcelona',
      shortName: 'TMB BUS',
      bodyColor: 0xd92626,
      bandColor: 0xffffff,
      accentColor: 0x1b263b
    },
    ownCar: {
      kind: 'sports',
      hex: 0xe07a5f,
      plateText: '0801 BCN',
      state: 'ESPANA'
    },
    areas: [
      [0, 0, 'Placa de Catalunya'],
      [-351, -156, 'Passeig de Gracia & Eixample'],
      [39, -1489, 'Sagrada Familia'],
      [48, 867, 'Barri Gotic & Cathedral'],
      [15, 1601, 'Port Vell & La Rambla'],
      [1688, 1345, 'La Barceloneta & Mediterranean Beach'],
      [1588, -1478, 'Torre Glories & Poblenou (22@)'],
      [961, 300, 'Parc de la Ciutadella & Arc de Triomf'],
      [-1580, 1280, 'Placa d\'Espanya & Montjuic']
    ],
    landmarks: [
      { id: 'catalunya',   name: 'Placa de Catalunya & La Rambla',         short: 'Placa de Catalunya',   x: 0,     z: 0,     heading: 0 },
      { id: 'sagrada',     name: 'Basilica de la Sagrada Familia',         short: 'Sagrada Familia',      x: 39,    z: -1489, heading: 0 },
      { id: 'batllo',      name: 'Casa Batllo & Passeig de Gracia',        short: 'Passeig de Gracia',    x: -351,  z: -245,  heading: 0 },
      { id: 'gotic',       name: 'Barri Gotic & Barcelona Cathedral',      short: 'Barri Gotic',          x: 48,    z: 745,   heading: 0 },
      { id: 'portvell',    name: 'Columbus Monument & Port Vell',          short: 'Port Vell',            x: 68,    z: 1601,  heading: 0 },
      { id: 'barceloneta', name: 'Platja de la Barceloneta & W Hotel',     short: 'Barceloneta Beach',    x: 1688,  z: 1345,  heading: Math.PI / 2 },
      { id: 'glories',     name: 'Torre Glories & Avinguda Diagonal',      short: 'Torre Glories',        x: 1588,  z: -1478, heading: 0 },
      { id: 'ciutadella',  name: 'Parc de la Ciutadella & Arc de Triomf',  short: 'Ciutadella Park',      x: 961,   z: 300,   heading: 0 }
    ],
    teleportIds: ['sagrada', 'catalunya', 'batllo', 'gotic', 'portvell', 'barceloneta', 'glories', 'ciutadella'],
    modelledLandmarks: [
      'Basilica de la Sagrada Familia',
      'Torre Glories',
      'Barcelona Cathedral'
    ],
    areaLabels: [
      ['BARCELONA', 0, -200, 0],
      ['MAR MEDITERRANIA', 2100, 1800, 1],
      ['PORT VELL', 550, 1750, 1],
      ['PLACA DE CATALUNYA', 0, 0, 2],
      ['L\'EIXAMPLE \u00b7 PASSEIG DE GRACIA', -420, -480, 2],
      ['SAGRADA FAMILIA', 39, -1489, 2],
      ['BARRI GOTIC \u00b7 LA RAMBLA', 48, 867, 2],
      ['EL BORN \u00b7 CIUTADELLA', 961, 550, 2],
      ['LA BARCELONETA', 1688, 1345, 2],
      ['EL RAVAL', -480, 920, 2],
      ['GLORIES \u00b7 POBLENOU', 1588, -1478, 2],
      ['SANT ANTONI \u00b7 MONTJUIC', -1200, 1100, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'sagradaFamilia', name: 'Basilica de la Sagrada Familia',category: 'scenic', fov: 48 },
      { id: 'eixampleGrid',   name: 'Passeig de Gracia & Eixample',  category: 'scenic', fov: 50 },
      { id: 'portVell',       name: 'Port Vell & Barceloneta',       category: 'scenic', fov: 48 },
      { id: 'torreGlories',   name: 'Torre Glories & Diagonal',      category: 'scenic', fov: 48 },
      { id: 'barcelonaAerial',name: 'Eixample Octagon Grid Aerial',  category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      sagradaFamilia: { pos: [-110, 18, -1340],   look: [39, 68, -1489],      ampPos: [8, 0.5, 8],   ampLook: [4, 2, 4],   freq: 0.11 },
      eixampleGrid:   { pos: [-280, 14, -120],    look: [-420, 22, -380],     ampPos: [6, 0.3, 6],   ampLook: [4, 1, 4],   freq: 0.12 },
      portVell:       { pos: [420, 16, 1620],     look: [68, 28, 1601],       ampPos: [8, 0.4, 8],   ampLook: [4, 1, 4],   freq: 0.11 },
      torreGlories:   { pos: [1380, 18, -1360],   look: [1588, 65, -1478],    ampPos: [8, 0.5, 8],   ampLook: [4, 2, 4],   freq: 0.11 },
      barcelonaAerial:{ pos: [-180, 185, -820],   look: [39, 45, -1489],      ampPos: [20, 2.0, 20], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: -65,  z: -1380, heading: 0.5 },
      car:        { x: -351, z: -156,  heading: 0 },
      cyclist:    { x: 1580, z: 1345,  heading: 0 },
      helicopter: { x: -240, z: -980,  heading: 0.4, above: 165 },
      kayak:      { x: 1050, z: 1650,  heading: Math.PI / 2 }
    },
    archetypes: {
      style: 'catalan-modernisme-eixample-stone',
      treeCoverage: { canopyCover: 0.14, streetTreeDensity: 0.81, streetTreeSpacing: 27.2, parkTreeDensity: 0.94, foliageScale: 0.94 },
      housingDensity: { form: 'rowhouse', buildingsPerKm2: 3100, footprintCoverage: 0.58, wallEnclosure: 0.94, lotInfill: 0.18, rowhouseAttachment: 0.88, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.35, shrubDensity: 0.48 },
      residential: {
        walls: { clapboard: 0.0, brick: 0.16, stone: 0.36, stucco: 0.48, shake: 0.0 },
        roofs: { flat: 0.64, hip: 0.24, gable: 0.12, gambrel: 0.0 },
        pitch: { hip: 0.24, gable: 0.28, historic: 0.32 },
        stucco: [0xead8be, 0xdfc49e, 0xd49a78, 0xf2e6d2, 0xc98262, 0xe6cdb0],
        shingles: [0xb85234, 0xc45e3e, 0x9e442a, 0xa84c30]
      },
      midrise: {
        masonry: { stoneColor: 0xe2cfb2, trimColor: 0xa89578, windowWidth: 2.4, floorHeight: 3.7 },
        historic: { stoneColor: 0xc97b5b, trimColor: 0xebe0ce, windowWidth: 2.3, floorHeight: 3.8 },
        waterTowerProb: 0.0,
        fireEscapes: false
      },
      neighborhoods: {
        passeig_de_gracia_eixample: {
          treeCoverage: { canopyCover: 0.2, streetTreeDensity: 0.9, streetTreeSpacing: 24.4, parkTreeDensity: 1.01, foliageScale: 0.95 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3100, footprintCoverage: 0.62, wallEnclosure: 0.71, lotInfill: 0.18, rowhouseAttachment: 0.88, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.35, shrubDensity: 0.48 },
          style: 'cerda-eixample-chamfered-modernisme',
          residential: {
            walls: { clapboard: 0.0, brick: 0.08, stone: 0.54, stucco: 0.38, shake: 0.0 },
            roofs: { flat: 0.72, hip: 0.20, gable: 0.08, gambrel: 0.0 },
            stucco: [0xead8be, 0xdfc49e, 0xf2e6d2]
          },
          midrise: { stoneColor: 0xe2cfb2, trimColor: 0xa89578, storefronts: true }
        },
        barri_gotic_cathedral: {
          treeCoverage: { canopyCover: 0.2, streetTreeDensity: 0.9, streetTreeSpacing: 24.4, parkTreeDensity: 1.01, foliageScale: 0.95 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3100, footprintCoverage: 0.62, wallEnclosure: 0.71, lotInfill: 0.18, rowhouseAttachment: 0.88, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.35, shrubDensity: 0.48 },
          style: 'gothic-quarter-montjuic-sandstone-lanes',
          residential: {
            walls: { clapboard: 0.0, brick: 0.18, stone: 0.62, stucco: 0.20, shake: 0.0 },
            stucco: [0xcab89c, 0xbfa888, 0xd8c8ae]
          },
          midrise: { stoneColor: 0xc4b092, trimColor: 0x8a7960, storefronts: true }
        },
        la_barceloneta_mediterranean_beach: {
          treeCoverage: { canopyCover: 0.2, streetTreeDensity: 0.9, streetTreeSpacing: 24.4, parkTreeDensity: 1.01, foliageScale: 0.95 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 3100, footprintCoverage: 0.55, wallEnclosure: 0.71, lotInfill: 0.18, rowhouseAttachment: 0.88, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.35, shrubDensity: 0.48 },
          style: 'barceloneta-maritime-narrow-balcony-blocks',
          residential: {
            walls: { clapboard: 0.0, brick: 0.12, stone: 0.08, stucco: 0.80, shake: 0.0 },
            roofs: { flat: 0.82, hip: 0.12, gable: 0.06, gambrel: 0.0 },
            stucco: [0xf2e6d2, 0xe8be82, 0xd48262, 0xdce8ec]
          },
          midrise: { stoneColor: 0xdfc49e, trimColor: 0xf7f4ec, storefronts: true }
        }
      },
      landmarks: {
        'Basilica de la Sagrada Familia': { form: 'cathedral_spires', x: 39, z: -1489, w: 60, d: 90, h: 138, wallColor: 0xd8c3a5, trimColor: 0xe6d5b8, roofColor: 0xc97b5b },
        'Torre Glories': { form: 'diagrid_prism', x: 1588, z: -1478, w: 38, d: 38, h: 144, wallColor: 0x689ec8, trimColor: 0xc84852 },
        'Barcelona Cathedral': { form: 'cathedral_spires', x: 48, z: 745, w: 42, d: 90, h: 70, wallColor: 0xc4b092, trimColor: 0x9e8c72, roofColor: 0x4a5258 },
        'Parc de la Ciutadella & Arc de Triomf': { form: 'triumphal_arch', x: 961, z: 300, w: 30, d: 15, h: 30, wallColor: 0xb8523b, trimColor: 0xeadbc4 }
      }
    }
  },

  rio: {
    id: 'rio',
    title: 'Rio de Janeiro',
    stateCode: 'RJ',
    stateLabel: 'Rio de Janeiro, Brazil',
    displayName: 'Rio de Janeiro, Brazil',
    icon: 'img/icon-rio.svg',
    subtitle: 'Copacabana Beach, Sugarloaf Mountain, Christ the Redeemer, Ipanema & Lagoa',
    countyLabel: 'CIDADE MARAVILHOSA',
    cityLabel: 'RIO DE JANEIRO',
    searchPlaceholder: 'Beach or landmark (Copacabana, Pao de Acucar, Corcovado, Ipanema, Botafogo...)',
    loadingStages: {
      streets: 'Building Avenida Atlantica, Copacabana, Ipanema and Botafogo...',
      outskirts: 'Laying out Sugarloaf Mountain, Corcovado, Lagoa and Guanabara Bay...',
      landmarks: 'Building Christ the Redeemer, Pao de Acucar Cable Car and Copacabana Palace...'
    },
    timeZone: 'America/Sao_Paulo',
    lat: -22.9619,
    lon: -43.1806,
    baseElev: 0.0,
    weatherStation: 'SBRJ',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.0,
    usualCfs: 320,
    kayakLaunch: { x: 450, z: 920 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'PMERJ',
      doorTop: 'POLICIA',
      doorBottom: 'MILITAR RJ',
      doorSub: 'RIO DE JANEIRO',
      badgeTitle: 'RJ',
      baseColor: 0xf4f6f8,
      stripeColor: 0x004b87
    },
    plate: {
      state: 'BRASIL',
      slogan: 'RIO DE JANEIRO RJ',
      sample: 'RIO 2A21',
      bg: '#f4f6f8',
      topBand: '#003399',
      text: '#141414',
      scriptColor: '#009b3a',
      legacyEvery4: false
    },
    transit: {
      name: 'SPPO Rio Onibus',
      shortName: 'RIO ONIBUS',
      bodyColor: 0xf4f6f8,
      bandColor: 0x009b3a,
      accentColor: 0xfedf00
    },
    ownCar: {
      kind: 'sports',
      hex: 0xffbe0b,
      plateText: 'RIO 2A21',
      state: 'BRASIL'
    },
    areas: [
      [0, 0, 'Copacabana & Avenida Atlantica'],
      [2534, -1256, 'Pao de Acucar (Sugarloaf) & Urca'],
      [-3068, -1123, 'Corcovado & Cristo Redentor'],
      [-2390, 2668, 'Ipanema & Arpoador'],
      [-2842, 1345, 'Lagoa Rodrigo de Freitas'],
      [15, -1556, 'Botafogo Bay'],
      [965, 511, 'Leme Beach'],
      [-1450, -320, 'Humaita & Jardim Botanico']
    ],
    landmarks: [
      { id: 'copacabana',  name: 'Copacabana Beach & Avenida Atlantica',   short: 'Copacabana Beach',     x: 0,     z: 420,   heading: Math.PI / 2 },
      { id: 'sugarloaf',   name: 'Pao de Acucar (Sugarloaf Mountain)',     short: 'Sugarloaf Mountain',   x: 2534,  z: -1256, heading: -Math.PI / 2 },
      { id: 'cristo',      name: 'Cristo Redentor (Corcovado Summit)',     short: 'Christ the Redeemer',  x: -3068, z: -1123, heading: Math.PI / 2 },
      { id: 'ipanema',     name: 'Praia de Ipanema & Posto 9',             short: 'Ipanema Beach',        x: -2390, z: 2668,  heading: 0 },
      { id: 'botafogo',    name: 'Enseada de Botafogo & Marina View',      short: 'Botafogo Bay',         x: 15,    z: -1556, heading: Math.PI / 2 },
      { id: 'lagoa',       name: 'Lagoa Rodrigo de Freitas',               short: 'Lagoa',                x: -2842, z: 1345,  heading: 0 },
      { id: 'arpoador',    name: 'Pedra do Arpoador & Forte de Copacabana',short: 'Arpoador',             x: -1150, z: 2780,  heading: -Math.PI / 2 },
      { id: 'leme',        name: 'Praia do Leme & Morro do Leme',          short: 'Leme Beach',           x: 965,   z: 511,   heading: -Math.PI / 2 }
    ],
    teleportIds: ['copacabana', 'sugarloaf', 'cristo', 'ipanema', 'botafogo', 'lagoa', 'arpoador', 'leme'],
    modelledLandmarks: [
      'Christ the Redeemer',
      'Sugarloaf Cable Car Station',
      'Copacabana Palace'
    ],
    areaLabels: [
      ['RIO DE JANEIRO', -500, 200, 0],
      ['OCEANO ATLANTICO', 600, 1800, 1],
      ['ENSEADA DE BOTAFOGO', 520, -1650, 1],
      ['LAGOA RODRIGO DE FREITAS', -2842, 1345, 1],
      ['COPACABANA', 0, 420, 2],
      ['PAO DE ACUCAR \u00b7 URCA', 2534, -1256, 2],
      ['CORCOVADO \u00b7 CRISTO REDENTOR', -3068, -1123, 2],
      ['IPANEMA \u00b7 ARPOADOR', -2100, 2668, 2],
      ['BOTAFOGO', -120, -1450, 2],
      ['LEME', 965, 511, 2],
      ['HUMAITA \u00b7 JARDIM BOTANICO', -2100, -450, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'copacabana',    name: 'Copacabana Wave Promenade',    category: 'scenic', fov: 50 },
      { id: 'sugarloaf',     name: 'Sugarloaf & Botafogo Bay',     category: 'scenic', fov: 46 },
      { id: 'corcovado',     name: 'Christ the Redeemer Panorama', category: 'scenic', fov: 46 },
      { id: 'ipanemaBeach',  name: 'Ipanema & Two Brothers View',  category: 'scenic', fov: 50 },
      { id: 'rioAerial',     name: 'Guanabara & Atlantic Aerial',  category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      copacabana:   { pos: [120, 14, 580],       look: [-380, 22, 420],      ampPos: [8, 0.4, 8],   ampLook: [6, 1, 6],   freq: 0.11 },
      sugarloaf:    { pos: [420, 18, -1520],     look: [2534, 180, -1256],   ampPos: [10, 0.8, 10], ampLook: [8, 4, 8],   freq: 0.09 },
      corcovado:    { pos: [-2850, 48, -980],    look: [200, 45, 200],       ampPos: [12, 1.0, 12], ampLook: [15, 0, 15], freq: 0.08 },
      ipanemaBeach: { pos: [-1980, 14, 2720],    look: [-2650, 18, 2668],    ampPos: [8, 0.4, 8],   ampLook: [6, 1, 6],   freq: 0.11 },
      rioAerial:    { pos: [950, 215, 1180],     look: [200, 45, -200],      ampPos: [24, 2.0, 24], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: 40,    z: 480,  heading: -Math.PI / 2 },
      car:        { x: 0,     z: 420,  heading: -Math.PI / 2 },
      cyclist:    { x: 80,    z: 495,  heading: -Math.PI / 2 },
      helicopter: { x: 680,   z: 920,  heading: -0.6, above: 195 },
      kayak:      { x: 450,   z: 920,  heading: -Math.PI / 2 }
    },
    archetypes: {
      style: 'carioca-tropical-modernist-stucco',
      treeCoverage: { canopyCover: 0.32, streetTreeDensity: 0.96, streetTreeSpacing: 22.9, parkTreeDensity: 1.38, foliageScale: 1.13 },
      housingDensity: { form: 'urban', buildingsPerKm2: 2250, footprintCoverage: 0.39, wallEnclosure: 0.43, lotInfill: 0.32, rowhouseAttachment: 0.58, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.68, shrubDensity: 1.08 },
      residential: {
        walls: { clapboard: 0.04, brick: 0.14, stone: 0.08, stucco: 0.74, shake: 0.0 },
        roofs: { flat: 0.44, hip: 0.36, gable: 0.20, gambrel: 0.0 },
        pitch: { hip: 0.24, gable: 0.26, historic: 0.30 },
        stucco: [0xf5efe2, 0xf2dfce, 0xe8d5b8, 0xd8ece4, 0xf4e2b0, 0xead2c4],
        shingles: [0xb85234, 0xc45e3e, 0x9e442a, 0x8c422c]
      },
      midrise: {
        masonry: { stoneColor: 0xebe5d8, trimColor: 0xb5afa2, windowWidth: 2.8, floorHeight: 3.5 },
        historic: { stoneColor: 0xdfc9ae, trimColor: 0xf5f0e6, windowWidth: 2.5, floorHeight: 3.6 },
        waterTowerProb: 0.0,
        fireEscapes: false
      },
      neighborhoods: {
        copacabana_avenida_atlantica: {
          treeCoverage: { canopyCover: 0.31, streetTreeDensity: 0.95, streetTreeSpacing: 23.2, parkTreeDensity: 1.37, foliageScale: 1.13 },
          housingDensity: { form: 'urban', buildingsPerKm2: 2250, footprintCoverage: 0.43, wallEnclosure: 0.55, lotInfill: 0.32, rowhouseAttachment: 0.58, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.68, shrubDensity: 1.08 },
          style: 'avenida-atlantica-art-deco-beachfront-wall',
          residential: {
            walls: { clapboard: 0.0, brick: 0.06, stone: 0.10, stucco: 0.84, shake: 0.0 },
            roofs: { flat: 0.78, hip: 0.14, gable: 0.08, gambrel: 0.0 },
            stucco: [0xf7f5ef, 0xf5efe2, 0xeadbc4]
          },
          midrise: { stoneColor: 0xf2ece0, trimColor: 0xb8afa0, storefronts: true }
        },
        ipanema_arpoador: {
          treeCoverage: { canopyCover: 0.33, streetTreeDensity: 0.97, streetTreeSpacing: 22.7, parkTreeDensity: 1.39, foliageScale: 1.14 },
          housingDensity: { form: 'urban', buildingsPerKm2: 2250, footprintCoverage: 0.39, wallEnclosure: 0.11, lotInfill: 0.32, rowhouseAttachment: 0.58, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.68, shrubDensity: 1.08 },
          style: 'ipanema-carioca-modernist-pilotis-blocks',
          midrise: { stoneColor: 0xebe5d8, trimColor: 0x8c98a0, storefronts: true }
        },
        pao_de_acucar_sugarloaf_urca: {
          treeCoverage: { canopyCover: 0.31, streetTreeDensity: 0.95, streetTreeSpacing: 23.2, parkTreeDensity: 1.37, foliageScale: 1.13 },
          housingDensity: { form: 'urban', buildingsPerKm2: 2250, footprintCoverage: 0.43, wallEnclosure: 0.55, lotInfill: 0.32, rowhouseAttachment: 0.58, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.68, shrubDensity: 1.08 },
          style: 'urca-lowrise-spanish-revival-waterfront',
          residential: {
            walls: { clapboard: 0.0, brick: 0.12, stone: 0.08, stucco: 0.80, shake: 0.0 },
            roofs: { flat: 0.18, hip: 0.56, gable: 0.26, gambrel: 0.0 },
            stucco: [0xf5efe2, 0xf4e2b0, 0xf2dfce],
            shingles: [0xb85234, 0xc45e3e]
          }
        }
      },
      landmarks: {
        'Christ the Redeemer': { form: 'mountain_statue', x: -3068, z: -1123, w: 28, d: 18, h: 38, wallColor: 0xebe8e0, trimColor: 0xd4cfc4 },
        'Sugarloaf Cable Car Station': { form: 'observation_needle', x: 2534, z: -1256, w: 34, d: 34, h: 42, wallColor: 0xdfe6ec, trimColor: 0xd92626 },
        'Copacabana Palace': { form: 'dome_palace', x: 180, z: 380, w: 86, d: 42, h: 28, wallColor: 0xfaf8f2, trimColor: 0xe6dfd0, roofColor: 0xb85234 }
      }
    }
  },

  vancouver: {
    id: 'vancouver',
    title: 'Vancouver',
    stateCode: 'BC',
    stateLabel: 'British Columbia, Canada',
    displayName: 'Vancouver, Canada',
    icon: 'img/icon-vancouver.svg',
    subtitle: 'Stanley Park, Lions Gate Bridge, Coal Harbour, Canada Place, False Creek & English Bay',
    countyLabel: 'METRO VANCOUVER',
    cityLabel: 'VANCOUVER',
    searchPlaceholder: 'Street or landmark (Stanley Park, Lions Gate Bridge, Canada Place, Granville Island...)',
    loadingStages: {
      streets: 'Building Robson Street, Stanley Park Seawall, Gastown and Yaletown...',
      outskirts: 'Laying out Burrard Inlet, English Bay, False Creek and North Shore views...',
      landmarks: 'Building Canada Place Sails, Lions Gate Bridge, Harbour Centre and Science World...'
    },
    timeZone: 'America/Vancouver',
    lat: 49.2827,
    lon: -123.1207,
    baseElev: 0.0,
    weatherStation: 'CYVR',
    riverGaugeSite: '12210700',
    riverGaugeBaseFt: 2.5,
    usualCfs: 600,
    kayakLaunch: { x: -420, z: -850 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'VPD',
      doorTop: 'VANCOUVER',
      doorBottom: 'POLICE',
      doorSub: 'BEYOND THE CALL',
      badgeTitle: 'VPD',
      baseColor: 0x14171c,
      stripeColor: 0x1b4d8c
    },
    plate: {
      state: 'BRITISH COLUMBIA',
      slogan: 'BEAUTIFUL BRITISH COLUMBIA',
      sample: 'YVR 604',
      bg: '#f4f7fa',
      topBand: '#0047ab',
      text: '#0047ab',
      scriptColor: '#0047ab',
      legacyEvery4: false
    },
    transit: {
      name: 'TransLink',
      shortName: 'TRANSLINK',
      bodyColor: 0xf4f6f8,
      bandColor: 0x005da6,
      accentColor: 0xfab600
    },
    ownCar: {
      kind: 'sports',
      hex: 0x2a9d8f,
      plateText: 'YVR 604',
      state: 'BC'
    },
    areas: [
      [0, 0, 'Downtown Vancouver & Robson Square'],
      [480, -689, 'Canada Place & Waterfront'],
      [-760, -680, 'Coal Harbour & Seawall'],
      [-2150, -1820, 'Stanley Park'],
      [-2734, -3913, 'Lions Gate Bridge'],
      [-1450, 280, 'West End & English Bay'],
      [982, -200, 'Gastown & Steam Clock'],
      [-996, 2001, 'Granville Island & False Creek'],
      [1309, 1212, 'Science World & Olympic Village']
    ],
    landmarks: [
      { id: 'robson',      name: 'Robson Square & Vancouver Art Gallery',  short: 'Robson Square',        x: 0,     z: 0,     heading: 0 },
      { id: 'canadaplace', name: 'Canada Place Sails & Burrard Waterfront',short: 'Canada Place',         x: 480,   z: -689,  heading: 0 },
      { id: 'stanleypark', name: 'Stanley Park Seawall & Brockton Point',  short: 'Stanley Park',         x: -1820, z: -1680, heading: 0 },
      { id: 'lionsgate',   name: 'Lions Gate Suspension Bridge',           short: 'Lions Gate Bridge',    x: -2734, z: -3400, heading: 0 },
      { id: 'gastown',     name: 'Gastown & Harbour Centre Lookout',       short: 'Gastown & Lookout',    x: 680,   z: -320,  heading: Math.PI / 2 },
      { id: 'granville',   name: 'Granville Island & Burrard Bridge',      short: 'Granville Island',     x: -996,  z: 2001,  heading: 0 },
      { id: 'englishbay',  name: 'English Bay Beach & Inukshuk',           short: 'English Bay',          x: -1620, z: 420,   heading: -Math.PI / 2 },
      { id: 'scienceworld',name: 'Science World & False Creek',            short: 'Science World',        x: 1309,  z: 1212,  heading: -Math.PI / 2 }
    ],
    teleportIds: ['canadaplace', 'robson', 'stanleypark', 'lionsgate', 'gastown', 'granville', 'englishbay', 'scienceworld'],
    modelledLandmarks: [
      'Canada Place',
      'Harbour Centre',
      'Science World',
      'Lions Gate Bridge'
    ],
    areaLabels: [
      ['VANCOUVER', 0, 200, 0],
      ['BURRARD INLET', -400, -1400, 1],
      ['ENGLISH BAY', -2400, 800, 1],
      ['FALSE CREEK', 200, 1650, 1],
      ['DOWNTOWN \u00b7 ROBSON', 0, 0, 2],
      ['CANADA PLACE \u00b7 WATERFRONT', 480, -689, 2],
      ['COAL HARBOUR', -760, -680, 2],
      ['STANLEY PARK', -2150, -1820, 2],
      ['LIONS GATE BRIDGE', -2734, -3600, 2],
      ['WEST END \u00b7 ENGLISH BAY', -1450, 280, 2],
      ['GASTOWN \u00b7 CHINATOWN', 982, -100, 2],
      ['YALETOWN', 80, 950, 2],
      ['GRANVILLE ISLAND \u00b7 KITSILANO', -1200, 2100, 2],
      ['FALSE CREEK \u00b7 SCIENCE WORLD', 1309, 1212, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'canadaPlace',   name: 'Canada Place & Coal Harbour',  category: 'scenic', fov: 48 },
      { id: 'lionsGate',     name: 'Lions Gate Bridge & Narrows',  category: 'scenic', fov: 48 },
      { id: 'stanleyPark',   name: 'Stanley Park Seawall View',    category: 'scenic', fov: 48 },
      { id: 'falseCreek',    name: 'False Creek & Science World',  category: 'scenic', fov: 50 },
      { id: 'vancouverAerial',name: 'Burrard Inlet & Skyline Aerial',category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      canadaPlace:     { pos: [280, 16, -820],     look: [480, 28, -689],     ampPos: [8, 0.4, 8],   ampLook: [4, 1, 4],   freq: 0.11 },
      lionsGate:       { pos: [-2420, 24, -3280],  look: [-2734, 65, -3650],  ampPos: [10, 0.6, 10], ampLook: [6, 2, 6],   freq: 0.10 },
      stanleyPark:     { pos: [-1180, 12, -1240],  look: [120, 55, -380],     ampPos: [8, 0.4, 8],   ampLook: [6, 1, 6],   freq: 0.11 },
      falseCreek:      { pos: [980, 14, 1260],     look: [1309, 32, 1212],    ampPos: [8, 0.4, 8],   ampLook: [4, 1, 4],   freq: 0.11 },
      vancouverAerial: { pos: [-820, 185, -1380],  look: [120, 55, -240],     ampPos: [22, 2.0, 22], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: -12,   z: -45,  heading: 0 },
      car:        { x: 0,     z: 0,    heading: 0 },
      cyclist:    { x: -1180, z: -1180,heading: 1.8 },
      helicopter: { x: -640,  z: -1120,heading: 2.2, above: 165 },
      kayak:      { x: -420,  z: -850, heading: 0.5 }
    },
    archetypes: {
      style: 'vancouverism-cedar-craftsman-glass',
      treeCoverage: { canopyCover: 0.26, streetTreeDensity: 1.06, streetTreeSpacing: 20.8, parkTreeDensity: 1.27, foliageScale: 1.16 },
      housingDensity: { form: 'urban', buildingsPerKm2: 1850, footprintCoverage: 0.37, wallEnclosure: 0.65, lotInfill: 0.26, rowhouseAttachment: 0.32, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.04, shrubDensity: 1.18 },
      residential: {
        walls: { clapboard: 0.46, brick: 0.06, stone: 0.06, stucco: 0.18, shake: 0.24 },
        roofs: { flat: 0.18, hip: 0.34, gable: 0.46, gambrel: 0.02 },
        pitch: { hip: 0.36, gable: 0.44, historic: 0.52 },
        siding: [0xe6e0d2, 0x6c7c74, 0x4d5d53, 0x8b9b90, 0x5a6e7f, 0xd8c8a8, 0x7a6855]
      },
      midrise: {
        masonry: { stoneColor: 0xd4cfc4, trimColor: 0x7d848a, windowWidth: 2.8, floorHeight: 3.7 },
        historic: { stoneColor: 0x964a38, trimColor: 0xd8cfc0, windowWidth: 2.4, floorHeight: 3.6 },
        waterTowerProb: 0.02,
        fireEscapes: true
      },
      neighborhoods: {
        gastown_steam_clock: {
          treeCoverage: { canopyCover: 0.33, streetTreeDensity: 1.15, streetTreeSpacing: 19.1, parkTreeDensity: 1.34, foliageScale: 1.17 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1850, footprintCoverage: 0.32, wallEnclosure: 0.41, lotInfill: 0.26, rowhouseAttachment: 0.32, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.04, shrubDensity: 1.18 },
          style: 'gastown-edwardian-redbrick-cornice-warehouses',
          residential: {
            walls: { clapboard: 0.08, brick: 0.78, stone: 0.08, stucco: 0.06, shake: 0.0 },
            roofs: { flat: 0.82, hip: 0.10, gable: 0.08, gambrel: 0.0 },
            bricks: [0x964a38, 0x843e2e, 0xa8523e]
          },
          midrise: { stoneColor: 0x964a38, trimColor: 0xd8cfc0, storefronts: true, fireEscapes: true }
        },
        west_end_english_bay: {
          treeCoverage: { canopyCover: 0.29, streetTreeDensity: 1.1, streetTreeSpacing: 20.0, parkTreeDensity: 1.3, foliageScale: 1.16 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1850, footprintCoverage: 0.39, wallEnclosure: 0.81, lotInfill: 0.26, rowhouseAttachment: 0.32, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.04, shrubDensity: 1.18 },
          style: 'west-end-craftsman-and-midcentury-point-towers',
          residential: {
            walls: { clapboard: 0.52, brick: 0.06, stone: 0.04, stucco: 0.14, shake: 0.24 },
            siding: [0x6c7c74, 0x4d5d53, 0xe6e0d2, 0x5a6e7f]
          },
          midrise: { stoneColor: 0xdfe4e8, trimColor: 0x6c7c74, storefronts: true }
        },
        granville_island_false_creek: {
          treeCoverage: { canopyCover: 0.33, streetTreeDensity: 1.15, streetTreeSpacing: 19.1, parkTreeDensity: 1.34, foliageScale: 1.17 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1850, footprintCoverage: 0.32, wallEnclosure: 0.41, lotInfill: 0.26, rowhouseAttachment: 0.32, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.04, shrubDensity: 1.18 },
          style: 'granville-industrial-timber-sheds-and-lofts',
          midrise: { stoneColor: 0xb87a4b, trimColor: 0x3b4852, storefronts: true }
        }
      },
      landmarks: {
        'Canada Place': { form: 'opera_sails', x: 480, z: -689, w: 96, d: 210, h: 48, wallColor: 0xf7f9fb, trimColor: 0x4a78a8 },
        'Harbour Centre': { form: 'observation_needle', x: 680, z: -320, w: 42, d: 42, h: 177, wallColor: 0xd8cfc0, trimColor: 0x8ea4b5 },
        'Science World': { form: 'dome_palace', x: 1309, z: 1212, w: 54, d: 54, h: 48, wallColor: 0xe6edf2, trimColor: 0xa8bcc8, roofColor: 0xdce6ed },
        'Lions Gate Bridge': { form: 'suspension_bridge', x: -2734, z: -3400, w: 480, d: 24, h: 111, heading: 0.0, wallColor: 0x467862, trimColor: 0xd8dfd8 }
      }
    }
  },

  capetown: {
    id: 'capetown',
    title: 'Cape Town',
    stateCode: 'WC',
    stateLabel: 'Western Cape, South Africa',
    displayName: 'Cape Town, South Africa',
    icon: 'img/icon-capetown.svg',
    subtitle: 'Table Mountain, V&A Waterfront, Lion\'s Head, Signal Hill, Bo-Kaap & Table Bay',
    countyLabel: 'CITY OF CAPE TOWN',
    cityLabel: 'CAPE TOWN',
    searchPlaceholder: 'Street or landmark (Table Mountain, V&A Waterfront, Bo-Kaap, Long St, Sea Point...)',
    loadingStages: {
      streets: 'Building the City Bowl, Long Street, Bo-Kaap and V&A Waterfront...',
      outskirts: 'Sculpting Table Mountain, Lion\'s Head, Signal Hill and Table Bay...',
      landmarks: 'Building Table Mountain Cableway, Cape Wheel and City Hall...'
    },
    timeZone: 'Africa/Johannesburg',
    lat: -33.9249,
    lon: 18.4241,
    baseElev: 0.0,
    weatherStation: 'FACT',
    riverGaugeSite: '01376520',
    riverGaugeBaseFt: 2.0,
    usualCfs: 180,
    kayakLaunch: { x: -240, z: -2350 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'SAPS',
      doorTop: 'SOUTH AFRICAN',
      doorBottom: 'POLICE SERVICE',
      doorSub: 'CAPE TOWN CENTRAL',
      badgeTitle: 'SAPS',
      baseColor: 0xf4f7fa,
      stripeColor: 0x003882
    },
    plate: {
      state: 'WESTERN CAPE',
      slogan: 'MOTHER CITY',
      sample: 'CA 421-80',
      bg: '#f4f6f8',
      topBand: null,
      text: '#003882',
      scriptColor: '#003882',
      legacyEvery4: false
    },
    transit: {
      name: 'MyCiTi',
      shortName: 'MYCITI',
      bodyColor: 0xd92626,
      bandColor: 0xffffff,
      accentColor: 0x0072ce
    },
    ownCar: {
      kind: 'sports',
      hex: 0x06d6a0,
      plateText: 'CA 421-80',
      state: 'CA'
    },
    areas: [
      [0, 0, 'City Bowl & Greenmarket Square'],
      [-35, -2356, 'V&A Waterfront'],
      [-832, -8, 'Bo-Kaap (Malay Quarter)'],
      [-2033, -722, 'Signal Hill'],
      [-3189, 1189, 'Lion\'s Head'],
      [-1924, 3556, 'Table Mountain Plateau & Cableway'],
      [-289, 622, 'Company\'s Garden & Parliament'],
      [-3650, -950, 'Sea Point & Atlantic Seaboard']
    ],
    landmarks: [
      { id: 'citybowl',    name: 'Cape Town City Hall & Grand Parade',      short: 'City Hall',            x: 156,   z: 20,    heading: 0 },
      { id: 'waterfront',  name: 'Victoria & Alfred (V&A) Waterfront',      short: 'V&A Waterfront',       x: -35,   z: -2156, heading: 0 },
      { id: 'bokaap',      name: 'Bo-Kaap Colourful Terraces (Wale St)',    short: 'Bo-Kaap',              x: -832,  z: -8,    heading: Math.PI / 2 },
      { id: 'tablemtn',    name: 'Table Mountain Upper Cableway Station',   short: 'Table Mountain',       x: -1924, z: 3450,  heading: 0 },
      { id: 'signalhill',  name: 'Signal Hill Noon Gun & Lookout',          short: 'Signal Hill',          x: -2033, z: -722,  heading: Math.PI / 2 },
      { id: 'lionshead',   name: 'Lion\'s Head Summit Trail',               short: 'Lion\'s Head',         x: -3189, z: 1189,  heading: Math.PI / 2 },
      { id: 'gardens',     name: 'Company\'s Garden & Iziko Museum',        short: 'Company\'s Garden',    x: -289,  z: 622,   heading: 0 },
      { id: 'seapoint',    name: 'Sea Point Promenade & Green Point',       short: 'Sea Point',            x: -2450, z: -2100, heading: 0 }
    ],
    teleportIds: ['waterfront', 'citybowl', 'bokaap', 'tablemtn', 'signalhill', 'lionshead', 'gardens', 'seapoint'],
    modelledLandmarks: [
      'Cape Town City Hall',
      'Cape Wheel V&A Waterfront',
      'Table Mountain Cableway'
    ],
    areaLabels: [
      ['CAPE TOWN', 0, 200, 0],
      ['TABLE BAY', 400, -2900, 1],
      ['ATLANTIC OCEAN', -4100, -1800, 1],
      ['CITY BOWL \u00b7 LONG STREET', 0, 0, 2],
      ['V&A WATERFRONT', -35, -2250, 2],
      ['BO-KAAP', -832, -8, 2],
      ['SIGNAL HILL', -2033, -722, 2],
      ['LION\'S HEAD', -3189, 1189, 2],
      ['TABLE MOUNTAIN', -1500, 3556, 2],
      ['GARDENS \u00b7 ORANJEZICHT', -289, 1200, 2],
      ['GREEN POINT \u00b7 SEA POINT', -2450, -2100, 2],
      ['WOODSTOCK \u00b7 FORESHORE', 1450, -350, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'tableMountain',  name: 'City Bowl & Table Mountain',  category: 'scenic', fov: 46 },
      { id: 'vaWaterfront',   name: 'V&A Waterfront & Table Bay',  category: 'scenic', fov: 48 },
      { id: 'boKaap',         name: 'Bo-Kaap Colourful Streets',   category: 'scenic', fov: 50 },
      { id: 'signalHillView', name: 'Signal Hill Sunset Lookout',  category: 'scenic', fov: 48 },
      { id: 'capeTownAerial', name: 'Mother City & Mesa Aerial',   category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      tableMountain:  { pos: [120, 22, -620],      look: [-650, 240, 2800],   ampPos: [10, 0.6, 10], ampLook: [10, 4, 10], freq: 0.09 },
      vaWaterfront:   { pos: [-180, 14, -2280],    look: [-35, 22, -1980],    ampPos: [8, 0.4, 8],   ampLook: [4, 1, 4],   freq: 0.11 },
      boKaap:         { pos: [-740, 14, -40],      look: [-880, 18, 20],      ampPos: [5, 0.3, 5],   ampLook: [3, 0, 3],   freq: 0.13 },
      signalHillView: { pos: [-1880, 38, -680],    look: [100, 35, 400],      ampPos: [10, 0.8, 10], ampLook: [12, 0, 12], freq: 0.09 },
      capeTownAerial: { pos: [420, 215, -1850],    look: [-650, 180, 1800],   ampPos: [24, 2.0, 24], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: -35,  z: -2156, heading: Math.PI },
      car:        { x: 0,    z: 0,     heading: Math.PI },
      cyclist:    { x: -180, z: -2220, heading: Math.PI / 2 },
      helicopter: { x: 240,  z: -1650, heading: 3.0, above: 195 },
      kayak:      { x: -240, z: -2350, heading: 0 }
    },
    archetypes: {
      style: 'cape-dutch-bo-kaap-stucco',
      treeCoverage: { canopyCover: 0.26, streetTreeDensity: 0.84, streetTreeSpacing: 26.2, parkTreeDensity: 1.14, foliageScale: 1.0 },
      housingDensity: { form: 'urban', buildingsPerKm2: 1720, footprintCoverage: 0.35, wallEnclosure: 0.43, lotInfill: 0.34, rowhouseAttachment: 0.48, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.86, shrubDensity: 0.95 },
      residential: {
        walls: { clapboard: 0.04, brick: 0.12, stone: 0.08, stucco: 0.76, shake: 0.0 },
        roofs: { flat: 0.42, hip: 0.28, gable: 0.30, gambrel: 0.0 },
        pitch: { hip: 0.30, gable: 0.42, historic: 0.48 },
        stucco: [0xf7f5ef, 0xf2ebe0, 0xffbe0b, 0xfb5607, 0x06d6a0, 0x3a86ff, 0xe8dec8, 0xf4a261],
        shingles: [0x3b4045, 0x9e3e28, 0x525a63, 0x2e3338]
      },
      midrise: {
        masonry: { stoneColor: 0xebe4d4, trimColor: 0xa69e8e, windowWidth: 2.6, floorHeight: 3.7 },
        historic: { stoneColor: 0xd9c29c, trimColor: 0xf5f2ea, windowWidth: 2.4, floorHeight: 3.8 },
        waterTowerProb: 0.0,
        fireEscapes: false
      },
      neighborhoods: {
        bo_kaap_malay_quarter: {
          treeCoverage: { canopyCover: 0.23, streetTreeDensity: 0.81, streetTreeSpacing: 27.2, parkTreeDensity: 1.11, foliageScale: 1.0 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1720, footprintCoverage: 0.34, wallEnclosure: 0.44, lotInfill: 0.34, rowhouseAttachment: 0.48, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.86, shrubDensity: 0.95 },
          style: 'bo-kaap-bright-polychrome-flat-parapet-terraces',
          residential: {
            walls: { clapboard: 0.0, brick: 0.02, stone: 0.02, stucco: 0.96, shake: 0.0 },
            roofs: { flat: 0.76, hip: 0.14, gable: 0.10, gambrel: 0.0 },
            stucco: [0xffbe0b, 0xfb5607, 0xff006e, 0x06d6a0, 0x3a86ff, 0x8338ec]
          },
          midrise: { stoneColor: 0xffbe0b, trimColor: 0xf7f5ef, storefronts: true }
        },
        v_a_waterfront: {
          treeCoverage: { canopyCover: 0.16, streetTreeDensity: 0.72, streetTreeSpacing: 30.6, parkTreeDensity: 1.03, foliageScale: 0.99 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1720, footprintCoverage: 0.28, wallEnclosure: 0.44, lotInfill: 0.34, rowhouseAttachment: 0.48, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.86, shrubDensity: 0.95 },
          style: 'victorian-harbour-clocktower-warehouses',
          midrise: { stoneColor: 0xb8523b, trimColor: 0xf5f2ea, storefronts: true }
        },
        company_s_garden_parliament: {
          treeCoverage: { canopyCover: 0.23, streetTreeDensity: 0.81, streetTreeSpacing: 27.2, parkTreeDensity: 1.11, foliageScale: 1.0 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1720, footprintCoverage: 0.34, wallEnclosure: 0.44, lotInfill: 0.34, rowhouseAttachment: 0.48, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.86, shrubDensity: 0.95 },
          style: 'cape-dutch-whitewashed-gabled-manor',
          residential: {
            walls: { clapboard: 0.0, brick: 0.08, stone: 0.08, stucco: 0.84, shake: 0.0 },
            roofs: { flat: 0.10, hip: 0.25, gable: 0.65, gambrel: 0.0 },
            pitch: { hip: 0.38, gable: 0.52, historic: 0.58 },
            stucco: [0xfaf8f2, 0xf5f2ea, 0xefeadd]
          }
        }
      },
      landmarks: {
        'Cape Town City Hall': { form: 'clock_tower', x: 156, z: 20, w: 72, d: 48, h: 61, wallColor: 0xdcc59a, trimColor: 0xf2eadc, roofColor: 0x4a5258 },
        'Cape Wheel V&A Waterfront': { form: 'ferris_wheel', x: -35, z: -2156, w: 48, d: 16, h: 50, wallColor: 0xf7f9fb, trimColor: 0x0072ce },
        'Table Mountain Cableway': { form: 'observation_needle', x: -1924, z: 3450, w: 36, d: 28, h: 32, wallColor: 0xcabfa8, trimColor: 0x4a5258 },
        'Bo-Kaap Colourful Terraces (Wale St)': { form: 'historic_row', x: -832, z: -8, w: 68, d: 18, h: 10, wallColor: 0xffbe0b, trimColor: 0x06d6a0, roofColor: 0xfb5607 }
      }
    }
  },

  chicago: {
    id: 'chicago',
    title: 'Chicago',
    stateCode: 'IL',
    stateLabel: 'Illinois',
    displayName: 'Chicago, IL',
    icon: 'img/icon-chicago.svg',
    subtitle: 'The Loop, Willis Tower, Chicago River Bascule Bridges, Millennium Park & Navy Pier',
    countyLabel: 'COOK COUNTY',
    cityLabel: 'CHICAGO',
    searchPlaceholder: 'Street or landmark (Willis Tower, Michigan Ave, Millennium Park, Navy Pier, Wacker Dr...)',
    loadingStages: {
      streets: 'Building the Loop elevated tracks, Wacker Drive, Michigan Ave and Chicago River bridges...',
      outskirts: 'Laying out Lake Michigan, Grant Park, River North and Streeterville...',
      landmarks: 'Building Willis Tower, 875 N Michigan (Hancock), Cloud Gate and Navy Pier...'
    },
    timeZone: 'America/Chicago',
    lat: 41.8827,
    lon: -87.6278,
    baseElev: 179.0,
    weatherStation: 'KORD',
    riverGaugeSite: '05536123',
    riverGaugeBaseFt: 2.2,
    usualCfs: 1800,
    kayakLaunch: { x: 120, z: -480 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'CPD',
      doorTop: 'CHICAGO',
      doorBottom: 'POLICE',
      doorSub: 'WE SERVE AND PROTECT',
      badgeTitle: 'CPD',
      baseColor: 0xf4f7fa,
      stripeColor: 0x1e5aa8
    },
    plate: {
      state: 'ILLINOIS',
      slogan: 'LAND OF LINCOLN',
      sample: 'CHI 312',
      bg: '#f4f6f8',
      topBand: '#1b365d',
      text: '#1b365d',
      scriptColor: '#b8292f',
      legacyEvery4: false
    },
    transit: {
      name: 'CTA',
      shortName: 'CTA BUS',
      bodyColor: 0xf4f6f8,
      bandColor: 0x00a1de,
      accentColor: 0xc60c30
    },
    ownCar: {
      kind: 'sports',
      hex: 0x00a1de,
      plateText: 'CHI 312',
      state: 'ILLINOIS'
    },
    areas: [
      [0, 0, 'The Loop (State & Madison)'],
      [-672, 433, 'Willis Tower & West Loop'],
      [357, 0, 'Millennium Park & Cloud Gate'],
      [340, -645, 'Michigan Ave Bridge & Wrigley Bldg'],
      [-240, -980, 'River North & Merchandise Mart'],
      [1825, -990, 'Navy Pier & Streeterville'],
      [415, -1812, 'Magnificent Mile & 875 N Michigan'],
      [480, 1450, 'Grant Park & Museum Campus']
    ],
    landmarks: [
      { id: 'theloop',     name: 'State & Madison (Heart of The Loop)',     short: 'The Loop',             x: 0,     z: 0,     heading: 0 },
      { id: 'willis',      name: 'Willis (Sears) Tower & Skydeck',          short: 'Willis Tower',         x: -672,  z: 433,   heading: 0 },
      { id: 'millennium',  name: 'Millennium Park & Cloud Gate (The Bean)', short: 'Millennium Park',      x: 357,   z: 0,     heading: -Math.PI / 2 },
      { id: 'michiganbr',  name: 'DuSable (Michigan Ave) Bascule Bridge',   short: 'Michigan Ave Bridge',  x: 340,   z: -645,  heading: 0 },
      { id: 'navypier',    name: 'Navy Pier & Centennial Wheel',            short: 'Navy Pier',            x: 1825,  z: -990,  heading: Math.PI / 2 },
      { id: 'hancock',     name: '875 N Michigan (John Hancock Center)',    short: '875 N Michigan',       x: 415,   z: -1812, heading: Math.PI },
      { id: 'merchmart',   name: 'Merchandise Mart & Riverwalk',            short: 'Riverwalk',            x: -560,  z: -640,  heading: Math.PI / 2 },
      { id: 'grantpark',   name: 'Buckingham Fountain & Grant Park',        short: 'Buckingham Fountain',  x: 740,   z: 780,   heading: 0 }
    ],
    teleportIds: ['willis', 'millennium', 'michiganbr', 'navypier', 'hancock', 'theloop', 'merchmart', 'grantpark'],
    modelledLandmarks: [
      'Willis Tower',
      '875 North Michigan Avenue',
      'Wrigley Building',
      'Cloud Gate'
    ],
    areaLabels: [
      ['CHICAGO', 0, -200, 0],
      ['LAKE MICHIGAN', 2200, 0, 1],
      ['CHICAGO RIVER', -200, -560, 1],
      ['THE LOOP', 0, 120, 2],
      ['WILLIS TOWER', -672, 433, 2],
      ['MILLENNIUM PARK', 450, 0, 2],
      ['GRANT PARK', 620, 920, 2],
      ['MICHIGAN AVE \u00b7 RIVERWALK', 340, -645, 2],
      ['RIVER NORTH', -320, -1100, 2],
      ['STREETERVILLE \u00b7 MAG MILE', 520, -1450, 2],
      ['NAVY PIER', 1825, -990, 2],
      ['WEST LOOP \u00b7 UNION STATION', -1150, 380, 2],
      ['SOUTH LOOP', 80, 1750, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'willisTower',   name: 'Willis Tower & Wacker Dr',    category: 'scenic', fov: 46 },
      { id: 'chicagoRiver',  name: 'Chicago River Canyon & Bridges',category: 'scenic', fov: 48 },
      { id: 'millenniumPark',name: 'Millennium Park & Michigan Ave',category: 'scenic', fov: 50 },
      { id: 'navyPier',      name: 'Navy Pier & Lakefront Skyline',category: 'scenic', fov: 46 },
      { id: 'chicagoAerial', name: 'Loop & Lake Michigan Aerial', category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      willisTower:    { pos: [-880, 22, 220],     look: [-672, 165, 433],    ampPos: [8, 0.5, 8],   ampLook: [4, 4, 4],   freq: 0.10 },
      chicagoRiver:   { pos: [120, 14, -560],     look: [340, 38, -645],     ampPos: [8, 0.4, 8],   ampLook: [4, 1, 4],   freq: 0.11 },
      millenniumPark: { pos: [280, 12, 80],       look: [240, 42, -120],     ampPos: [6, 0.3, 6],   ampLook: [4, 1, 4],   freq: 0.12 },
      navyPier:       { pos: [1680, 22, -920],    look: [340, 85, -420],     ampPos: [10, 0.6, 10], ampLook: [8, 2, 8],   freq: 0.10 },
      chicagoAerial:  { pos: [1350, 215, 480],    look: [-120, 95, -180],    ampPos: [24, 2.0, 24], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: 340,  z: -580, heading: 0 },
      car:        { x: 240,  z: 0,    heading: 0 },
      cyclist:    { x: 920,  z: 120,  heading: 0 },
      helicopter: { x: 1120, z: 320,  heading: -1.8, above: 195 },
      kayak:      { x: 120,  z: -480, heading: Math.PI / 2 }
    },
    archetypes: {
      style: 'chicago-school-brick-greystone-miesian',
      treeCoverage: { canopyCover: 0.19, streetTreeDensity: 0.81, streetTreeSpacing: 27.2, parkTreeDensity: 1.05, foliageScale: 0.96 },
      housingDensity: { form: 'urban', buildingsPerKm2: 2450, footprintCoverage: 0.46, wallEnclosure: 0.63, lotInfill: 0.22, rowhouseAttachment: 0.64, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.78, shrubDensity: 0.72 },
      residential: {
        walls: { clapboard: 0.16, brick: 0.62, stone: 0.18, stucco: 0.02, shake: 0.02 },
        roofs: { flat: 0.64, hip: 0.18, gable: 0.16, gambrel: 0.02 },
        pitch: { hip: 0.34, gable: 0.42, historic: 0.48 },
        bricks: [0x8e4232, 0x9c4e3c, 0x7c382a, 0xb8865c, 0x6b4434, 0xa86448]
      },
      midrise: {
        masonry: { stoneColor: 0xd4cab8, trimColor: 0x8e8676, windowWidth: 2.7, floorHeight: 3.8 },
        historic: { stoneColor: 0x964836, trimColor: 0xcfc2ae, windowWidth: 2.6, floorHeight: 3.7 },
        waterTowerProb: 0.18,
        fireEscapes: true
      },
      neighborhoods: {
        the_loop_state_madison: {
          treeCoverage: { canopyCover: 0.13, streetTreeDensity: 0.5, streetTreeSpacing: 38.0, parkTreeDensity: 0.98, foliageScale: 0.92 },
          housingDensity: { form: 'urban', buildingsPerKm2: 2450, footprintCoverage: 0.55, wallEnclosure: 0.57, lotInfill: 0.22, rowhouseAttachment: 0.74, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.51, shrubDensity: 0.42 },
          style: 'chicago-school-terracotta-bay-window-commercial',
          midrise: { stoneColor: 0x964836, trimColor: 0xd4cab8, storefronts: true, fireEscapes: true, waterTowerProb: 0.24 }
        },
        river_north_merchandise_mart: {
          treeCoverage: { canopyCover: 0.2, streetTreeDensity: 0.83, streetTreeSpacing: 26.5, parkTreeDensity: 1.07, foliageScale: 0.96 },
          housingDensity: { form: 'urban', buildingsPerKm2: 2450, footprintCoverage: 0.44, wallEnclosure: 0.57, lotInfill: 0.22, rowhouseAttachment: 0.64, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.78, shrubDensity: 0.72 },
          style: 'river-north-heavy-timber-brick-lofts',
          residential: {
            walls: { clapboard: 0.04, brick: 0.78, stone: 0.16, stucco: 0.02, shake: 0.0 },
            roofs: { flat: 0.78, hip: 0.12, gable: 0.10, gambrel: 0.0 }
          },
          midrise: { stoneColor: 0x8e4232, trimColor: 0xc8bca8, storefronts: true, fireEscapes: true, waterTowerProb: 0.22 }
        },
        magnificent_mile_875_n_michigan: {
          treeCoverage: { canopyCover: 0.2, streetTreeDensity: 0.83, streetTreeSpacing: 26.5, parkTreeDensity: 1.07, foliageScale: 0.96 },
          housingDensity: { form: 'urban', buildingsPerKm2: 2450, footprintCoverage: 0.44, wallEnclosure: 0.57, lotInfill: 0.22, rowhouseAttachment: 0.64, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 0.78, shrubDensity: 0.72 },
          style: 'michigan-ave-limestone-beaux-arts-and-miesian',
          midrise: { stoneColor: 0xe6dfd0, trimColor: 0x9e9585, storefronts: true }
        }
      },
      landmarks: {
        'Willis Tower': { form: 'stepped_bundled_tube', x: -672, z: 433, w: 68, d: 68, h: 442, wallColor: 0x22262c, trimColor: 0x454c54 },
        '875 North Michigan Avenue': { form: 'diagrid_prism', x: 415, z: -1812, w: 58, d: 46, h: 344, wallColor: 0x262a30, trimColor: 0x525a63 },
        'Wrigley Building': { form: 'clock_tower', x: 340, z: -680, w: 46, d: 42, h: 134, wallColor: 0xf7f5ef, trimColor: 0xe2dcd0, roofColor: 0xd4af37 },
        'Cloud Gate': { form: 'dome_palace', x: 357, z: 0, w: 20, d: 13, h: 10, wallColor: 0xdce4ec, trimColor: 0xf0f4f8, roofColor: 0xe6edf2 },
        'DuSable (Michigan Ave) Bascule Bridge': { form: 'bascule_bridge', x: 340, z: -645, w: 78, d: 28, h: 18, wallColor: 0xd8cfc0, trimColor: 0x7c382a },
        'Navy Pier & Centennial Wheel': { form: 'ferris_wheel', x: 1825, z: -990, w: 60, d: 20, h: 60, wallColor: 0xf7f9fb, trimColor: 0xc60c30 }
      }
    }
  },

  boston: {
    id: 'boston',
    title: 'Boston',
    stateCode: 'MA',
    stateLabel: 'Massachusetts',
    displayName: 'Boston, MA',
    icon: 'img/icon-boston.svg',
    subtitle: 'Boston Common, Back Bay Brownstones, Beacon Hill, Zakim Bridge, Faneuil Hall & Charles River',
    countyLabel: 'SUFFOLK COUNTY',
    cityLabel: 'BOSTON',
    searchPlaceholder: 'Street or landmark (Boston Common, Newbury St, Faneuil Hall, Zakim Bridge, MIT...)',
    loadingStages: {
      streets: 'Building Beacon Hill, Back Bay, the Freedom Trail and Charles River Esplanade...',
      outskirts: 'Laying out Boston Harbor, Charlestown, Seaport and Cambridge...',
      landmarks: 'Building Zakim Bridge, Custom House Tower, Massachusetts State House and Prudential...'
    },
    timeZone: 'America/New_York',
    lat: 42.3584,
    lon: -71.0636,
    baseElev: 0.0,
    weatherStation: 'KBOS',
    riverGaugeSite: '01104500',
    riverGaugeBaseFt: 2.5,
    usualCfs: 420,
    kayakLaunch: { x: -920, z: -220 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'BPD',
      doorTop: 'BOSTON',
      doorBottom: 'POLICE',
      doorSub: 'CITY OF BOSTON',
      badgeTitle: 'BPD',
      baseColor: 0xf4f7fa,
      stripeColor: 0x1b4d8c
    },
    plate: {
      state: 'MASSACHUSETTS',
      slogan: 'THE SPIRIT OF AMERICA',
      sample: 'BOS 617',
      bg: '#f4f6f8',
      topBand: null,
      text: '#9e1b32',
      scriptColor: '#002868',
      legacyEvery4: false
    },
    transit: {
      name: 'MBTA',
      shortName: 'MBTA BUS',
      bodyColor: 0xf4f6f8,
      bandColor: 0xffc72c,
      accentColor: 0x14171c
    },
    ownCar: {
      kind: 'sports',
      hex: 0x9e1b32,
      plateText: 'BOS 617',
      state: 'MASSACHUSETTS'
    },
    areas: [
      [0, 0, 'Boston Common & Massachusetts State House'],
      [-350, 180, 'Public Garden & Beacon Hill'],
      [840, -189, 'Faneuil Hall & Quincy Market'],
      [1046, -18, 'Custom House Tower & Waterfront'],
      [780, -820, 'North End & Paul Revere Mall'],
      [115, -1100, 'Zakim Bridge & TD Garden'],
      [-1038, 667, 'Copley Square & Back Bay'],
      [-1507, 1289, 'Prudential Center'],
      [-1943, -12, 'MIT & Charles River Basin']
    ],
    landmarks: [
      { id: 'common',      name: 'Boston Common & Massachusetts State House', short: 'Boston Common',     x: 0,     z: 0,     heading: 0 },
      { id: 'faneuil',     name: 'Faneuil Hall & Quincy Market',              short: 'Faneuil Hall',      x: 840,   z: -189,  heading: Math.PI / 2 },
      { id: 'customhouse', name: 'Custom House Tower & Long Wharf',           short: 'Custom House Tower',x: 1046,  z: -18,   heading: Math.PI / 2 },
      { id: 'zakim',       name: 'Leonard P. Zakim Bunker Hill Bridge',       short: 'Zakim Bridge',      x: 115,   z: -1100, heading: 0 },
      { id: 'copley',      name: 'Copley Square, Trinity Church & BPL',       short: 'Copley Square',     x: -1038, z: 667,   heading: -Math.PI / 2 },
      { id: 'prudential',  name: 'Prudential Tower & Newbury Street',         short: 'Prudential Tower',  x: -1507, z: 1289,  heading: 0 },
      { id: 'northend',    name: 'North End & Old North Church',              short: 'North End',         x: 880,   z: -860,  heading: 0 },
      { id: 'charles',     name: 'Harvard Bridge & Charles River Esplanade',  short: 'Charles River',     x: -1943, z: 420,   heading: 0 }
    ],
    teleportIds: ['common', 'faneuil', 'customhouse', 'zakim', 'copley', 'prudential', 'northend', 'charles'],
    modelledLandmarks: [
      'Custom House Tower',
      'Leonard P. Zakim Bunker Hill Bridge',
      'Massachusetts State House',
      'Prudential Tower'
    ],
    areaLabels: [
      ['BOSTON', 0, 200, 0],
      ['CHARLES RIVER BASIN', -1400, 120, 1],
      ['BOSTON HARBOR', 1800, -200, 1],
      ['BOSTON COMMON \u00b7 BEACON HILL', -120, -80, 2],
      ['PUBLIC GARDEN', -420, 240, 2],
      ['DOWNTOWN CROSSING \u00b7 FINANCIAL', 580, 240, 2],
      ['FANEUIL HALL \u00b7 WATERFRONT', 920, -120, 2],
      ['NORTH END', 840, -820, 2],
      ['WEST END \u00b7 ZAKIM BRIDGE', 115, -1100, 2],
      ['BACK BAY \u00b7 COPLEY SQUARE', -1038, 667, 2],
      ['PRUDENTIAL \u00b7 SOUTH END', -1350, 1380, 2],
      ['CAMBRIDGE \u00b7 MIT', -1943, -180, 2],
      ['SEAPORT DISTRICT', 1650, 950, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'bostonCommon', name: 'State House & Boston Common',  category: 'scenic', fov: 50 },
      { id: 'zakimBridge',  name: 'Zakim Bunker Hill Bridge',     category: 'scenic', fov: 48 },
      { id: 'customHouse',  name: 'Custom House & Long Wharf',    category: 'scenic', fov: 48 },
      { id: 'backBay',      name: 'Copley Square & Back Bay',     category: 'scenic', fov: 48 },
      { id: 'bostonAerial', name: 'Charles River & Harbor Aerial',category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      bostonCommon: { pos: [-80, 12, 160],       look: [0, 24, -40],         ampPos: [6, 0.3, 6],   ampLook: [4, 1, 4],   freq: 0.12 },
      zakimBridge:  { pos: [-120, 18, -920],     look: [115, 55, -1100],     ampPos: [8, 0.5, 8],   ampLook: [4, 2, 4],   freq: 0.11 },
      customHouse:  { pos: [1280, 16, 40],       look: [1046, 65, -18],      ampPos: [8, 0.4, 8],   ampLook: [4, 2, 4],   freq: 0.11 },
      backBay:      { pos: [-960, 14, 620],      look: [-1350, 85, 1120],    ampPos: [6, 0.4, 6],   ampLook: [6, 2, 6],   freq: 0.11 },
      bostonAerial: { pos: [-1420, 185, 180],    look: [120, 55, 120],       ampPos: [22, 2.0, 22], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: -45,  z: 80,   heading: 0 },
      car:        { x: -180, z: 320,  heading: -Math.PI / 2 },
      cyclist:    { x: -880, z: 120,  heading: -Math.PI / 2 },
      helicopter: { x: -980, z: 240,  heading: 1.5, above: 165 },
      kayak:      { x: -920, z: -220, heading: -Math.PI / 2 }
    },
    archetypes: {
      style: 'boston-beacon-hill-redbrick-triple-decker',
      treeCoverage: { canopyCover: 0.19, streetTreeDensity: 0.83, streetTreeSpacing: 26.5, parkTreeDensity: 1.06, foliageScale: 0.98 },
      housingDensity: { form: 'rowhouse', buildingsPerKm2: 2680, footprintCoverage: 0.44, wallEnclosure: 0.63, lotInfill: 0.2, rowhouseAttachment: 0.76, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.72, shrubDensity: 0.74 },
      residential: {
        walls: { clapboard: 0.42, brick: 0.44, stone: 0.06, stucco: 0.02, shake: 0.06 },
        roofs: { flat: 0.34, hip: 0.24, gable: 0.34, gambrel: 0.08 },
        pitch: { hip: 0.38, gable: 0.48, historic: 0.56 },
        bricks: [0x8e382a, 0x9c4232, 0x7a3024, 0x6e3628, 0xa84c38]
      },
      midrise: {
        masonry: { stoneColor: 0x944030, trimColor: 0xe6dfd0, windowWidth: 2.3, floorHeight: 3.6 },
        historic: { stoneColor: 0xd4cab6, trimColor: 0x8e8676, windowWidth: 2.4, floorHeight: 3.7 },
        waterTowerProb: 0.06,
        fireEscapes: true
      },
      neighborhoods: {
        public_garden_beacon_hill: {
          treeCoverage: { canopyCover: 0.23, streetTreeDensity: 0.89, streetTreeSpacing: 24.7, parkTreeDensity: 1.11, foliageScale: 0.99 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2680, footprintCoverage: 0.52, wallEnclosure: 0.6, lotInfill: 0.2, rowhouseAttachment: 0.76, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.72, shrubDensity: 0.74 },
          style: 'beacon-hill-federal-redbrick-rowhouses',
          residential: {
            walls: { clapboard: 0.04, brick: 0.88, stone: 0.06, stucco: 0.02, shake: 0.0 },
            roofs: { flat: 0.58, hip: 0.22, gable: 0.14, gambrel: 0.06 },
            bricks: [0x8e382a, 0x7a3024, 0x9c4232]
          },
          midrise: { stoneColor: 0x8e382a, trimColor: 0xf2eee4, storefronts: false, fireEscapes: true }
        },
        copley_square_back_bay: {
          treeCoverage: { canopyCover: 0.23, streetTreeDensity: 0.89, streetTreeSpacing: 24.7, parkTreeDensity: 1.11, foliageScale: 0.99 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2680, footprintCoverage: 0.52, wallEnclosure: 0.6, lotInfill: 0.2, rowhouseAttachment: 0.76, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.72, shrubDensity: 0.74 },
          style: 'back-bay-victorian-brownstone-mansard-rows',
          residential: {
            walls: { clapboard: 0.0, brick: 0.52, stone: 0.46, stucco: 0.02, shake: 0.0 },
            roofs: { flat: 0.48, hip: 0.28, gable: 0.08, gambrel: 0.16 },
            bricks: [0x6e3628, 0x7a3024, 0x8e382a]
          },
          midrise: { stoneColor: 0x7a382c, trimColor: 0xd8cfc0, storefronts: true, fireEscapes: true }
        },
        north_end_paul_revere_mall: {
          treeCoverage: { canopyCover: 0.23, streetTreeDensity: 0.89, streetTreeSpacing: 24.7, parkTreeDensity: 1.11, foliageScale: 0.99 },
          housingDensity: { form: 'rowhouse', buildingsPerKm2: 2680, footprintCoverage: 0.52, wallEnclosure: 0.6, lotInfill: 0.2, rowhouseAttachment: 0.76, maxHouseHeight: 12.2, maxHouseFootprint: 310, porchProbScale: 0.72, shrubDensity: 0.74 },
          style: 'north-end-colonial-narrow-brick-tenements',
          residential: {
            walls: { clapboard: 0.14, brick: 0.80, stone: 0.04, stucco: 0.02, shake: 0.0 },
            roofs: { flat: 0.52, hip: 0.18, gable: 0.24, gambrel: 0.06 }
          },
          midrise: { stoneColor: 0x944030, trimColor: 0xe6dfd0, storefronts: true, fireEscapes: true }
        }
      },
      landmarks: {
        'Custom House Tower': { form: 'clock_tower', x: 1046, z: -18, w: 28, d: 28, h: 151, wallColor: 0xd8cfc0, trimColor: 0xb5aba0, roofColor: 0xcabfa8 },
        'Leonard P. Zakim Bunker Hill Bridge': { form: 'cable_stayed_bridge', x: 115, z: -1100, w: 440, d: 34, h: 98, heading: 0.35, wallColor: 0xf2f5f8, trimColor: 0xd8e0e8 },
        'Massachusetts State House': { form: 'dome_palace', x: 0, z: -45, w: 76, d: 46, h: 46, wallColor: 0x944030, trimColor: 0xf7f5ef, roofColor: 0xd4af37 },
        'Prudential Tower': { form: 'stepped_bundled_tube', x: -1507, z: 1289, w: 54, d: 54, h: 228, wallColor: 0x7c8e9e, trimColor: 0xc4d0d8 },
        'Faneuil Hall & Quincy Market': { form: 'historic_row', x: 840, z: -189, w: 96, d: 26, h: 18, wallColor: 0x944030, trimColor: 0xe6dfd0, roofColor: 0x383e45 }
      }
    }
  },

  seattle: {
    id: 'seattle',
    title: 'Seattle',
    stateCode: 'WA',
    stateLabel: 'Washington',
    displayName: 'Seattle, WA',
    icon: 'img/icon-seattle.svg',
    subtitle: 'Space Needle, Pike Place Market, Elliott Bay Waterfront, South Lake Union & Capitol Hill',
    countyLabel: 'KING COUNTY',
    cityLabel: 'SEATTLE',
    searchPlaceholder: 'Street or landmark (Space Needle, Pike Place Market, Alaskan Way, Lake Union...)',
    loadingStages: {
      streets: 'Building Pike Place, 1st Avenue, Alaskan Way Waterfront and Capitol Hill...',
      outskirts: 'Laying out Elliott Bay, Lake Union, Queen Anne and Pioneer Square...',
      landmarks: 'Building the Space Needle, Columbia Center, Smith Tower and Seattle Great Wheel...'
    },
    timeZone: 'America/Los_Angeles',
    lat: 47.6101,
    lon: -122.3421,
    baseElev: 0.0,
    weatherStation: 'KSEA',
    riverGaugeSite: '12113390',
    riverGaugeBaseFt: 2.5,
    usualCfs: 750,
    kayakLaunch: { x: -320, z: 180 },
    defaultSpawn: { x: 0, z: 0 },
    police: {
      name: 'SPD',
      doorTop: 'SEATTLE',
      doorBottom: 'POLICE',
      doorSub: 'SERVICE PRIDE DEDICATION',
      badgeTitle: 'SPD',
      baseColor: 0x141e2e,
      stripeColor: 0x4ca6e8
    },
    plate: {
      state: 'WASHINGTON',
      slogan: 'EVERGREEN STATE',
      sample: 'SEA 206',
      bg: '#e8eff5',
      topBand: '#2b5876',
      text: '#1b365d',
      scriptColor: '#1e5631',
      legacyEvery4: false
    },
    transit: {
      name: 'King County Metro',
      shortName: 'METRO',
      bodyColor: 0xfab600,
      bandColor: 0x006847,
      accentColor: 0x1b365d
    },
    ownCar: {
      kind: 'sports',
      hex: 0x008080,
      plateText: 'SEA 206',
      state: 'WASHINGTON'
    },
    areas: [
      [0, 0, 'Pike Place Market & 1st Ave'],
      [-541, -1156, 'Seattle Center & Space Needle'],
      [-150, 320, 'Elliott Bay Waterfront & Piers'],
      [811, 700, 'Downtown & Columbia Center'],
      [616, 111, 'Westlake & Denny Triangle'],
      [480, -1820, 'South Lake Union'],
      [1502, -456, 'Capitol Hill'],
      [759, 1100, 'Pioneer Square & Lumen Field'],
      [-850, -2100, 'Queen Anne & Kerry Park']
    ],
    landmarks: [
      { id: 'pikeplace',   name: 'Pike Place Market & Public Market Sign', short: 'Pike Place Market',    x: 0,     z: 0,     heading: 0 },
      { id: 'spaceneedle', name: 'Space Needle & Seattle Center',          short: 'Space Needle',         x: -541,  z: -1156, heading: Math.PI },
      { id: 'greatwheel',  name: 'Seattle Great Wheel & Pier 57',          short: 'Waterfront & Pier 57', x: -120,  z: 280,   heading: -Math.PI / 2 },
      { id: 'columbiactr', name: 'Columbia Center & 4th Ave',              short: 'Columbia Center',      x: 811,   z: 700,   heading: 0 },
      { id: 'smithtower',  name: 'Smith Tower & Pioneer Square',           short: 'Pioneer Square',       x: 759,   z: 1050,  heading: 0 },
      { id: 'lakeunion',   name: 'Lake Union Park & MOHAI',                short: 'South Lake Union',     x: 480,   z: -1820, heading: 0 },
      { id: 'capitolhill', name: 'Capitol Hill & Cal Anderson Park',       short: 'Capitol Hill',         x: 1502,  z: -456,  heading: -Math.PI / 2 },
      { id: 'kerrypark',   name: 'Kerry Park Skyline Viewpoint (Queen Anne)', short: 'Kerry Park',        x: -1250, z: -2280, heading: 2.5 }
    ],
    teleportIds: ['spaceneedle', 'pikeplace', 'greatwheel', 'columbiactr', 'smithtower', 'lakeunion', 'capitolhill', 'kerrypark'],
    modelledLandmarks: [
      'Space Needle',
      'Columbia Center',
      'Smith Tower',
      'Seattle Great Wheel'
    ],
    areaLabels: [
      ['SEATTLE', 400, 100, 0],
      ['ELLIOTT BAY (PUGET SOUND)', -950, 400, 1],
      ['LAKE UNION', 480, -2300, 1],
      ['PIKE PLACE MARKET', 0, 0, 2],
      ['SEATTLE CENTER \u00b7 SPACE NEEDLE', -541, -1156, 2],
      ['ALASKAN WAY WATERFRONT', -150, 380, 2],
      ['BELLTOWN', -220, -480, 2],
      ['DOWNTOWN \u00b7 WESTLAKE', 580, 240, 2],
      ['SOUTH LAKE UNION', 480, -1550, 2],
      ['CAPITOL HILL', 1502, -456, 2],
      ['PIONEER SQUARE', 759, 1100, 2],
      ['QUEEN ANNE', -980, -2150, 2]
    ],
    cameraPresets: [
      ...FOLLOW_CAMERAS,
      { id: 'spaceNeedle',   name: 'Space Needle & Seattle Center',category: 'scenic', fov: 48 },
      { id: 'pikePlace',     name: 'Pike Place & 1st Avenue',      category: 'scenic', fov: 50 },
      { id: 'elliottBay',    name: 'Elliott Bay Waterfront & Piers',category: 'scenic', fov: 48 },
      { id: 'kerryParkView', name: 'Kerry Park Skyline Panorama',  category: 'scenic', fov: 46 },
      { id: 'seattleAerial', name: 'Puget Sound & Needle Aerial',  category: 'scenic', fov: 44 },
      DRONE_CAMERA
    ],
    scenicCameras: {
      spaceNeedle:   { pos: [-340, 18, -960],     look: [-541, 115, -1156],   ampPos: [8, 0.5, 8],   ampLook: [4, 3, 4],   freq: 0.10 },
      pikePlace:     { pos: [45, 11, 65],         look: [-10, 14, -40],       ampPos: [5, 0.3, 5],   ampLook: [3, 0, 3],   freq: 0.13 },
      elliottBay:    { pos: [-480, 24, 340],      look: [320, 65, 380],       ampPos: [10, 0.6, 10], ampLook: [6, 2, 6],   freq: 0.10 },
      kerryParkView: { pos: [-1180, 48, -2180],   look: [-200, 85, -400],     ampPos: [10, 0.8, 10], ampLook: [12, 0, 12], freq: 0.09 },
      seattleAerial: { pos: [-820, 195, -480],    look: [120, 65, -240],      ampPos: [22, 2.0, 22], ampLook: [15, 0, 15], freq: 0.08 }
    },
    scenicStarts: {
      person:     { x: 18,   z: 18,    heading: Math.PI },
      car:        { x: 95,   z: 45,    heading: Math.PI },
      cyclist:    { x: -110, z: 240,   heading: 0 },
      helicopter: { x: -640, z: -620,  heading: 2.0, above: 175 },
      kayak:      { x: -320, z: 180,   heading: 0 }
    },
    archetypes: {
      style: 'pnw-craftsman-cedar-timber',
      treeCoverage: { canopyCover: 0.27, streetTreeDensity: 1.07, streetTreeSpacing: 20.6, parkTreeDensity: 1.26, foliageScale: 1.15 },
      housingDensity: { form: 'urban', buildingsPerKm2: 1780, footprintCoverage: 0.36, wallEnclosure: 0.5, lotInfill: 0.25, rowhouseAttachment: 0.28, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.06, shrubDensity: 1.16 },
      residential: {
        walls: { clapboard: 0.48, brick: 0.08, stone: 0.06, stucco: 0.12, shake: 0.26 },
        roofs: { flat: 0.16, hip: 0.32, gable: 0.50, gambrel: 0.02 },
        pitch: { hip: 0.36, gable: 0.46, historic: 0.52 },
        siding: [0x5d6d5e, 0x4a5d6e, 0x8a6d4b, 0xd8cdb8, 0x6b7378, 0x7b8c74, 0xe6dfd0]
      },
      midrise: {
        masonry: { stoneColor: 0x9c4a38, trimColor: 0xd8cfc0, windowWidth: 2.5, floorHeight: 3.7 },
        historic: { stoneColor: 0x8a3e2e, trimColor: 0xcab9a0, windowWidth: 2.4, floorHeight: 3.6 },
        waterTowerProb: 0.04,
        fireEscapes: true
      },
      neighborhoods: {
        pioneer_square_lumen_field: {
          treeCoverage: { canopyCover: 0.32, streetTreeDensity: 1.13, streetTreeSpacing: 19.5, parkTreeDensity: 1.31, foliageScale: 1.16 },
          housingDensity: { form: 'urban', buildingsPerKm2: 1780, footprintCoverage: 0.31, wallEnclosure: 0.4, lotInfill: 0.25, rowhouseAttachment: 0.28, maxHouseHeight: 10.5, maxHouseFootprint: 285, porchProbScale: 1.06, shrubDensity: 1.16 },
          style: 'pioneer-square-romanesque-revival-redbrick',
          residential: {
            walls: { clapboard: 0.06, brick: 0.82, stone: 0.10, stucco: 0.02, shake: 0.0 },
            roofs: { flat: 0.80, hip: 0.12, gable: 0.08, gambrel: 0.0 }
          },
          midrise: { stoneColor: 0x8a3e2e, trimColor: 0xcab9a0, storefronts: true, fireEscapes: true }
        },
        capitol_hill: {
          treeCoverage: { canopyCover: 0.36, streetTreeDensity: 1.38, streetTreeSpacing: 15.9, parkTreeDensity: 1.35, foliageScale: 1.19 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1780, footprintCoverage: 0.31, wallEnclosure: 0.37, lotInfill: 0.25, rowhouseAttachment: 0.18, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.19, shrubDensity: 1.33 },
          style: 'capitol-hill-brick-courtyard-apartments-and-foursquares',
          residential: {
            walls: { clapboard: 0.44, brick: 0.24, stone: 0.04, stucco: 0.06, shake: 0.22 },
            siding: [0x5d6d5e, 0x8a6d4b, 0x4a5d6e, 0xd8cdb8]
          },
          midrise: { stoneColor: 0x9c4a38, trimColor: 0xe6dfd0, storefronts: true, fireEscapes: true }
        },
        queen_anne_kerry_park: {
          treeCoverage: { canopyCover: 0.6, streetTreeDensity: 1.38, streetTreeSpacing: 15.9, parkTreeDensity: 1.55, foliageScale: 1.19 },
          housingDensity: { form: 'suburban', buildingsPerKm2: 1780, footprintCoverage: 0.25, wallEnclosure: 0.12, lotInfill: 0.25, rowhouseAttachment: 0.18, maxHouseHeight: 9.8, maxHouseFootprint: 285, porchProbScale: 1.19, shrubDensity: 1.33 },
          style: 'queen-anne-hillside-shingle-and-craftsman',
          residential: {
            walls: { clapboard: 0.50, brick: 0.08, stone: 0.04, stucco: 0.06, shake: 0.32 },
            roofs: { flat: 0.06, hip: 0.34, gable: 0.58, gambrel: 0.02 },
            pitch: { hip: 0.40, gable: 0.50, historic: 0.58 }
          }
        }
      },
      landmarks: {
        'Space Needle': { form: 'observation_needle', x: -541, z: -1156, w: 42, d: 42, h: 184, wallColor: 0xf7f9fb, trimColor: 0xe06d2b },
        'Columbia Center': { form: 'stepped_bundled_tube', x: 811, z: 700, w: 58, d: 58, h: 284, wallColor: 0x262c34, trimColor: 0x525a63 },
        'Smith Tower': { form: 'clock_tower', x: 759, z: 1050, w: 30, d: 30, h: 148, wallColor: 0xf2eee4, trimColor: 0xd8d0c0, roofColor: 0x4a7c6b },
        'Seattle Great Wheel': { form: 'ferris_wheel', x: -120, z: 280, w: 54, d: 18, h: 53, wallColor: 0xf7f9fb, trimColor: 0x00a88f },
        'Pike Place Market & Public Market Sign': { form: 'historic_row', x: 0, z: 0, w: 88, d: 28, h: 16, wallColor: 0x9c4a38, trimColor: 0xd92626, roofColor: 0x3b4045 }
      }
    }
  }
};

const BUILTIN_CITY_IDS = new Set(Object.keys(CITY_PACKS));

function titleFromSlug(slug) {
  return String(slug || 'localcity')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeCityPack(spec = {}, fallbackId = 'localcity') {
  const id = normalizeCityId(spec.id || fallbackId) || 'localcity';
  const rawName = String(spec.displayName || spec.name || spec.title || titleFromSlug(id)).trim();
  const parts = rawName.split(',').map((s) => s.trim()).filter(Boolean);
  const title = String(spec.title || parts[0] || titleFromSlug(id)).trim();
  const stateCode = String(spec.stateCode || (parts[1] ? parts[1].slice(0, 3).toUpperCase() : 'LOC')).trim();
  const stateLabel = String(spec.stateLabel || parts[1] || stateCode || 'Local Pack').trim();
  const displayName = String(spec.displayName || spec.name || (parts.length > 1 ? rawName : `${title}, ${stateCode}`)).trim();
  const hasExplicitCoords = Number.isFinite(spec.lat) || Number.isFinite(spec.lat0);
  const lat = Number.isFinite(spec.lat) ? Number(spec.lat) : (Number.isFinite(spec.lat0) ? Number(spec.lat0) : 37.7749);
  const lon = Number.isFinite(spec.lon) ? Number(spec.lon) : (Number.isFinite(spec.lon0) ? Number(spec.lon0) : -122.4194);
  const baseElev = Number.isFinite(spec.baseElev)
    ? Number(spec.baseElev)
    : (Number.isFinite(spec.base_elev) ? Number(spec.base_elev) : 10.0);

  const hasExplicitLandmarks = Array.isArray(spec.landmarks) && spec.landmarks.length > 0;
  const landmarks = hasExplicitLandmarks
    ? spec.landmarks.map((l, idx) => ({
        id: String(l.id || `lm_${idx + 1}`).toLowerCase().replace(/[^a-z0-9_]+/g, ''),
        name: String(l.name || l.short || `${title} Landmark ${idx + 1}`),
        short: String(l.short || l.name || `Site ${idx + 1}`).slice(0, 24),
        x: Number(l.x) || 0,
        z: Number(l.z) || 0,
        heading: Number(l.heading) || 0
      }))
    : [
        { id: 'downtown',  name: `Downtown ${title}`,             short: 'Downtown',       x: 0,    z: 0,    heading: 0 },
        { id: 'civic',     name: `${title} Civic Center & Plaza`, short: 'Civic Center',   x: 160,  z: -80,  heading: -Math.PI / 2 },
        { id: 'northside', name: `North ${title} District`,       short: `North ${title}`, x: 0,    z: -620, heading: 0 },
        { id: 'southside', name: `South ${title} District`,       short: `South ${title}`, x: 0,    z: 620,  heading: Math.PI },
        { id: 'eastside',  name: `East ${title} Corridor`,        short: `East ${title}`,  x: 620,  z: 0,    heading: -Math.PI / 2 },
        { id: 'westside',  name: `West ${title} Corridor`,        short: `West ${title}`,  x: -620, z: 0,    heading: Math.PI / 2 }
      ];

  const teleportIds = Array.isArray(spec.teleportIds) && spec.teleportIds.length
    ? spec.teleportIds
    : landmarks.slice(0, 8).map((l) => l.id);

  const areas = Array.isArray(spec.areas) && spec.areas.length
    ? spec.areas
    : landmarks.map((l) => [l.x, l.z, l.short || l.name]);

  const areaLabels = Array.isArray(spec.areaLabels) && spec.areaLabels.length
    ? spec.areaLabels
    : [
        [title.toUpperCase(), 0, -180, 0],
        ...landmarks.slice(0, 6).map((l) => [String(l.short || l.name).toUpperCase(), l.x, l.z, 2])
      ];

  const customCameraPresets = Array.isArray(spec.cameraPresets) && spec.cameraPresets.length
    ? spec.cameraPresets
    : [
        ...FOLLOW_CAMERAS,
        { id: 'downtownView', name: `Downtown ${title}`,  category: 'scenic', fov: 50 },
        { id: 'cityAerial',   name: `${title} Aerial`,    category: 'scenic', fov: 46 },
        DRONE_CAMERA
      ];
  const hasFollow = customCameraPresets.some((c) => c && c.id === 'chase');
  const hasDrone = customCameraPresets.some((c) => c && c.id === 'drone');
  const cameraPresets = [
    ...(hasFollow ? [] : FOLLOW_CAMERAS),
    ...customCameraPresets,
    ...(hasDrone ? [] : [DRONE_CAMERA])
  ];

  const scenicCameras = {
    downtownView: { pos: [24, 11, 78],     look: [0, 8, -24],      ampPos: [5, 0.3, 5],   ampLook: [4, 0, 4],   freq: 0.13 },
    cityAerial:   { pos: [360, 165, 420],  look: [0, 12, 0],       ampPos: [18, 2.0, 18], ampLook: [20, 0, 20], freq: 0.08 },
    ...(spec.scenicCameras || {})
  };

  const defaultSpawn = spec.defaultSpawn || { x: landmarks[0]?.x || 0, z: landmarks[0]?.z || 0 };
  const kayakLaunch = spec.kayakLaunch || { x: 0, z: 0 };
  const samplePlate = String(spec.plate?.sample || `${id.slice(0, 3).toUpperCase()} 100`);
  const stateUpper = stateLabel.toUpperCase();

  const rawArch = spec.archetypes || {};
  const archetypes = {
    style: rawArch.style || 'regional-mixed-urban',
    treeCoverage: {
      canopyCover: 0.25,
      streetTreeDensity: 1.0,
      streetTreeSpacing: 22.0,
      parkTreeDensity: 1.15,
      foliageScale: 1.0,
      ...(rawArch.treeCoverage || {})
    },
    housingDensity: {
      form: 'urban',
      buildingsPerKm2: 1450,
      footprintCoverage: 0.34,
      wallEnclosure: 0.44,
      lotInfill: 0.42,
      rowhouseAttachment: 0.28,
      maxHouseHeight: 9.8,
      maxHouseFootprint: 280,
      porchProbScale: 1.0,
      shrubDensity: 1.0,
      ...(rawArch.housingDensity || {})
    },
    residential: {
      walls: { clapboard: 0.38, brick: 0.32, stone: 0.08, stucco: 0.16, shake: 0.06, ...(rawArch.residential?.walls || {}) },
      roofs: { flat: 0.16, hip: 0.38, gable: 0.42, gambrel: 0.04, ...(rawArch.residential?.roofs || {}) },
      pitch: { hip: 0.36, gable: 0.44, historic: 0.52, ...(rawArch.residential?.pitch || {}) },
      ...(rawArch.residential || {})
    },
    midrise: {
      masonry: { stoneColor: 0xd4c8b4, trimColor: 0x968c7a, windowWidth: 2.5, floorHeight: 3.7, ...(rawArch.midrise?.masonry || {}) },
      historic: { stoneColor: 0x9e523c, trimColor: 0xcab9a0, windowWidth: 2.4, floorHeight: 3.6, ...(rawArch.midrise?.historic || {}) },
      waterTowerProb: rawArch.midrise?.waterTowerProb ?? 0.05,
      fireEscapes: rawArch.midrise?.fireEscapes ?? true
    },
    neighborhoods: { ...(rawArch.neighborhoods || {}) },
    landmarks: { ...(rawArch.landmarks || {}) }
  };

  return {
    ...spec,
    id,
    isLocal: Boolean(spec.isLocal ?? !BUILTIN_CITY_IDS.has(id)),
    _hasDefaultCoords: !hasExplicitCoords,
    _hasDefaultLandmarks: !hasExplicitLandmarks,
    title,
    stateCode,
    stateLabel,
    displayName,
    icon: spec.icon || 'img/icon-royaloak.svg',
    subtitle: spec.subtitle || `Local OpenStreetMap + Terrain City Pack (${displayName})`,
    countyLabel: spec.countyLabel || `${title.toUpperCase()} METRO`,
    cityLabel: spec.cityLabel || title.toUpperCase(),
    searchPlaceholder: spec.searchPlaceholder || `Street or landmark in ${title}...`,
    loadingStages: {
      streets: `Building ${title} streets, blocks and parks...`,
      outskirts: `Laying out ${displayName} terrain and waterways...`,
      landmarks: `Building ${title} landmarks and transit...`,
      ...(spec.loadingStages || {})
    },
    timeZone: spec.timeZone || 'America/New_York',
    lat,
    lon,
    baseElev,
    weatherStation: spec.weatherStation || 'KSFO',
    riverGaugeSite: spec.riverGaugeSite || '01376520',
    riverGaugeBaseFt: Number.isFinite(spec.riverGaugeBaseFt) ? Number(spec.riverGaugeBaseFt) : 2.0,
    usualCfs: Number.isFinite(spec.usualCfs) ? Number(spec.usualCfs) : 250,
    kayakLaunch,
    defaultSpawn,
    police: {
      name: `${id.slice(0, 2).toUpperCase()}PD`,
      doorTop: title.toUpperCase().slice(0, 14),
      doorBottom: 'POLICE',
      doorSub: `${title.toUpperCase()} DEPT`,
      badgeTitle: `${id.slice(0, 2).toUpperCase()}PD`,
      baseColor: 0x16191e,
      stripeColor: 0x2b5fb8,
      ...(spec.police || {})
    },
    plate: {
      state: stateUpper,
      slogan: displayName.toUpperCase(),
      sample: samplePlate,
      bg: '#f4f6f8',
      topBand: '#1d3557',
      text: '#1d3557',
      scriptColor: '#1d3557',
      legacyEvery4: false,
      ...(spec.plate || {})
    },
    transit: {
      name: `${title} Transit`,
      shortName: `${title.slice(0, 8).toUpperCase()} BUS`,
      bodyColor: 0xf4f5f7,
      bandColor: 0x1976d2,
      accentColor: 0xf59e0b,
      ...(spec.transit || {})
    },
    ownCar: {
      kind: 'sports',
      hex: 0xd62828,
      plateText: samplePlate,
      state: stateUpper,
      ...(spec.ownCar || {})
    },
    areas,
    landmarks,
    teleportIds,
    modelledLandmarks: Array.isArray(spec.modelledLandmarks) ? spec.modelledLandmarks : [],
    areaLabels,
    cameraPresets,
    scenicCameras,
    scenicStarts: {
      person:     { x: defaultSpawn.x + 8, z: defaultSpawn.z, heading: 0 },
      car:        { x: defaultSpawn.x,     z: defaultSpawn.z, heading: 0 },
      cyclist:    { x: defaultSpawn.x + 14, z: defaultSpawn.z, heading: 0 },
      helicopter: { x: defaultSpawn.x + 180, z: defaultSpawn.z + 240, heading: Math.PI, above: 150 },
      kayak:      { x: kayakLaunch.x,      z: kayakLaunch.z,  heading: 0 },
      ...(spec.scenicStarts || {})
    },
    archetypes
  };
}

function registerLocalCityPack(id, spec = {}) {
  const normId = normalizeCityId(id || spec.id);
  if (!normId || RESERVED_CITY_KEYS.has(normId)) return null;
  const existing = Object.hasOwn(CITY_PACKS, normId) ? CITY_PACKS[normId] : {};
  const merged = normalizeCityPack({ ...existing, ...spec, id: normId, isLocal: !BUILTIN_CITY_IDS.has(normId) }, normId);
  if (Object.hasOwn(CITY_PACKS, normId)) {
    Object.assign(CITY_PACKS[normId], merged);
  } else {
    CITY_PACKS[normId] = merged;
  }
  CITY_ALIASES[normId] = normId;
  if (Array.isArray(spec.aliases)) {
    for (const alias of spec.aliases) {
      const k = String(alias || '').trim().toLowerCase();
      if (k && !RESERVED_CITY_KEYS.has(k) && /^[a-z0-9][a-z0-9_-]*$/.test(k) && !Object.hasOwn(CITY_ALIASES, k)) {
        CITY_ALIASES[k] = normId;
      }
    }
  }
  return CITY_PACKS[normId];
}

function hydrateLocalCityPackFromGeo(pack, geo) {
  if (!pack || !geo) return pack;
  if (geo.packMeta && typeof geo.packMeta === 'object' && pack.isLocal) {
    registerLocalCityPack(pack.id, { ...geo.packMeta, ...pack, _hasDefaultLandmarks: pack._hasDefaultLandmarks && !geo.packMeta.landmarks });
  }
  if (pack._hasDefaultCoords && geo.frame) {
    if (Number.isFinite(geo.frame.lat0)) pack.lat = Number(geo.frame.lat0);
    if (Number.isFinite(geo.frame.lon0)) pack.lon = Number(geo.frame.lon0);
    pack._hasDefaultCoords = false;
  }
  if (geo.sampledArchetypes && typeof geo.sampledArchetypes === 'object' && pack.isLocal) {
    const sa = geo.sampledArchetypes;
    if (sa.treeCoverage) pack.archetypes.treeCoverage = { ...pack.archetypes.treeCoverage, ...sa.treeCoverage };
    if (sa.housingDensity) pack.archetypes.housingDensity = { ...pack.archetypes.housingDensity, ...sa.housingDensity };
    if (sa.residential) pack.archetypes.residential = { ...pack.archetypes.residential, ...sa.residential };
    if (sa.midrise) pack.archetypes.midrise = { ...pack.archetypes.midrise, ...sa.midrise };
  }
  if (pack.isLocal && pack._hasDefaultLandmarks) {
    const discovered = [];
    const seen = new Set();
    const addSite = (name, x, z) => {
      const clean = String(name || '').trim();
      if (!clean || seen.has(clean.toLowerCase()) || !Number.isFinite(x) || !Number.isFinite(z)) return;
      if (discovered.some((d) => Math.hypot(d.x - x, d.z - z) < 30)) return;
      seen.add(clean.toLowerCase());
      const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || `site${discovered.length + 1}`;
      discovered.push({
        id: seen.has(slug) ? `${slug}_${discovered.length + 1}` : slug,
        name: clean,
        short: clean.length > 22 ? clean.slice(0, 20).trim() : clean,
        x: Math.round(x),
        z: Math.round(z),
        heading: 0
      });
    };
    addSite(`Downtown ${pack.title}`, 0, 0);
    if (Array.isArray(geo.landmarks)) {
      for (const lm of geo.landmarks) addSite(lm.name, lm.x, lm.z);
    } else if (geo.landmarks && typeof geo.landmarks === 'object') {
      for (const [name, lm] of Object.entries(geo.landmarks)) addSite(name, lm.x, lm.z);
    }
    if (Array.isArray(geo.parks)) {
      for (const pk of geo.parks) {
        const ring = pk.rings && pk.rings[0];
        if (pk.name && Array.isArray(ring) && ring.length >= 2) {
          addSite(pk.name, ring[0], ring[1]);
        }
        if (discovered.length >= 8) break;
      }
    }
    if (discovered.length < 8 && geo.places && Array.isArray(geo.places.names) && Array.isArray(geo.places.list)) {
      const { names, list } = geo.places;
      for (let i = 0; i < list.length && discovered.length < 8; i += 4) {
        addSite(names[list[i + 3]], list[i], list[i + 1]);
      }
    }
    if (discovered.length >= 2) {
      pack.landmarks = discovered.slice(0, 8);
      pack.teleportIds = pack.landmarks.map((l) => l.id);
      pack.areas = pack.landmarks.map((l) => [l.x, l.z, l.short || l.name]);
      pack.areaLabels = [
        [pack.title.toUpperCase(), 0, -180, 0],
        ...pack.landmarks.slice(0, 6).map((l) => [String(l.short || l.name).toUpperCase(), l.x, l.z, 2])
      ];
      pack._hasDefaultLandmarks = false;
    }
  }
  return pack;
}

async function readLocalJsonFile(relPath) {
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import('node:fs');
      const pathMod = await import('node:path');
      const urlMod = await import('node:url');
      const rootDir = pathMod.resolve(pathMod.dirname(urlMod.fileURLToPath(import.meta.url)), '..');
      const fullPath = pathMod.join(rootDir, relPath);
      if (fs.existsSync(fullPath)) {
        return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      }
    } catch {
      // Ignore missing or invalid local JSON in Node
    }
    return null;
  }
  if (typeof fetch === 'function') {
    try {
      const res = await fetch(relPath, { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch {
      // Ignore missing local JSON in browser
    }
  }
  return null;
}

let _localManifestLoaded = false;
async function loadLocalCityPacks(targetCityId = null, { fetchManifest = false } = {}) {
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if ((isNode || fetchManifest || (targetCityId && !BUILTIN_CITY_IDS.has(targetCityId))) && !_localManifestLoaded) {
    _localManifestLoaded = true;
    const manifest = await readLocalJsonFile('cities/local-packs.json');
    if (manifest && typeof manifest === 'object') {
      const entries = Array.isArray(manifest.cities)
        ? manifest.cities.map((c) => [c.id, c])
        : Object.entries(manifest.cities || manifest);
      for (const [cid, spec] of entries) {
        if (cid && spec && typeof spec === 'object') {
          registerLocalCityPack(cid, spec);
        }
      }
    }
  }
  if (targetCityId && !BUILTIN_CITY_IDS.has(targetCityId)) {
    const perCity = await readLocalJsonFile(`cities/${targetCityId}/city-pack.json`);
    if (perCity && typeof perCity === 'object') {
      registerLocalCityPack(targetCityId, perCity);
    } else if (!CITY_PACKS[targetCityId]) {
      registerLocalCityPack(targetCityId, { id: targetCityId, isLocal: true });
    }
  }
  return CITY_PACKS;
}

await loadLocalCityPacks(BUILTIN_CITY_IDS.has(ACTIVE_CITY_ID) ? null : ACTIVE_CITY_ID);
if (!CITY_PACKS[ACTIVE_CITY_ID]) {
  registerLocalCityPack(ACTIVE_CITY_ID, { id: ACTIVE_CITY_ID, isLocal: true });
}

const CITY_PACK = CITY_PACKS[ACTIVE_CITY_ID];

export {
  ACTIVE_CITY_ID,
  BUILTIN_CITY_IDS,
  CITY_PACKS,
  CITY_PACK,
  cityAssetPath,
  switchCity,
  normalizeCityId,
  normalizeCityPack,
  registerLocalCityPack,
  hydrateLocalCityPackFromGeo,
  loadLocalCityPacks
};
