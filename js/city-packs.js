// Multi-city registry & active city pack configuration.
// Supports 'royaloak' (default), 'oakland', 'annarbor', and 'newyork'.

const CITY_ALIASES = {
  royaloak: 'royaloak',
  'royal-oak': 'royaloak',
  ro: 'royaloak',
  oakland: 'oakland',
  oak: 'oakland',
  sf: 'oakland',
  annarbor: 'annarbor',
  'ann-arbor': 'annarbor',
  a2: 'annarbor',
  aa: 'annarbor',
  newyork: 'newyork',
  'new-york': 'newyork',
  ny: 'newyork',
  nyc: 'newyork'
};

function resolveActiveCityId() {
  let raw = globalThis.__CITY_ID__ || '';
  if (!raw && typeof globalThis.location?.search === 'string') {
    raw = new URLSearchParams(globalThis.location.search).get('city') || '';
  }
  const key = String(raw).trim().toLowerCase();
  return CITY_ALIASES[key] || 'royaloak';
}

const ACTIVE_CITY_ID = resolveActiveCityId();

function cityAssetPath(relPath) {
  const clean = String(relPath).replace(/^\.?\//, '');
  return `cities/${ACTIVE_CITY_ID}/${clean}`;
}

function switchCity(cityId) {
  const target = CITY_ALIASES[String(cityId || '').trim().toLowerCase()] || 'royaloak';
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
    }
  },

  oakland: {
    id: 'oakland',
    title: 'Oakland',
    stateCode: 'CA',
    stateLabel: 'California',
    displayName: 'Oakland, CA',
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
    }
  },

  annarbor: {
    id: 'annarbor',
    title: 'Ann Arbor',
    stateCode: 'MI',
    stateLabel: 'Michigan',
    displayName: 'Ann Arbor, MI',
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
    }
  },

  newyork: {
    id: 'newyork',
    title: 'New York',
    stateCode: 'NY',
    stateLabel: 'New York',
    displayName: 'New York, NY',
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
    }
  }
};

const CITY_PACK = CITY_PACKS[ACTIVE_CITY_ID];

export {
  ACTIVE_CITY_ID,
  CITY_PACKS,
  CITY_PACK,
  cityAssetPath,
  switchCity
};
