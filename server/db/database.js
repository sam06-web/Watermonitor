import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure db directory exists
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

// Initialize schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      alternate_names TEXT,
      state TEXT,
      country TEXT DEFAULT 'India',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      bbox TEXT NOT NULL,
      length_km REAL,
      basin TEXT,
      geometry TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS satellite_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      river_id TEXT NOT NULL,
      river_name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      bbox TEXT,
      satellite_name TEXT NOT NULL,
      sensor TEXT,
      image_date TEXT NOT NULL,
      image_timestamp TEXT NOT NULL,
      cloud_cover REAL NOT NULL,
      resolution TEXT NOT NULL,
      ndwi REAL NOT NULL,
      ndvi REAL NOT NULL,
      water_area REAL NOT NULL,
      river_width REAL NOT NULL,
      temperature REAL NOT NULL,
      turbidity REAL NOT NULL,
      flood_status TEXT NOT NULL,
      flood_risk_pct REAL NOT NULL,
      water_level REAL,
      health_score INTEGER NOT NULL,
      water_availability TEXT NOT NULL,
      pollution_risk TEXT NOT NULL,
      ai_summary TEXT,
      ai_recommendation TEXT,
      image_url TEXT,
      ndwi_image_url TEXT,
      false_color_image_url TEXT,
      prev_image_url TEXT,
      raw_metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (river_id) REFERENCES rivers (id)
    );

    CREATE INDEX IF NOT EXISTS idx_obs_river_date ON satellite_observations(river_id, image_date DESC);
  `);

  seedDefaultRivers();
  seedHistoricalObservations();
  console.log('✅ SQLite Database initialized and seeded successfully at', config.dbPath);
}

// Seed key rivers with exact coordinates and bounding boxes
function seedDefaultRivers() {
  const count = db.prepare('SELECT count(*) as count FROM rivers').get().count;
  if (count > 0) return;

  const defaultRivers = [
    {
      id: 'cauvery',
      name: 'Cauvery River',
      alternate_names: 'Kaveri, Kaveri River, Ponni',
      state: 'Tamil Nadu & Karnataka',
      country: 'India',
      latitude: 11.137,
      longitude: 78.583,
      bbox: JSON.stringify([75.5, 10.7, 79.9, 12.5]),
      length_km: 805,
      basin: 'Cauvery Basin',
      geometry: JSON.stringify({
        type: 'LineString',
        coordinates: [
          [75.525, 12.385], [75.789, 12.421], [76.012, 12.389], [76.321, 12.445],
          [76.654, 12.418], [77.012, 12.215], [77.458, 12.089], [77.721, 11.834],
          [77.765, 11.458], [78.125, 11.312], [78.583, 11.137], [79.124, 10.954],
          [79.521, 11.089], [79.845, 11.145]
        ]
      }),
      description: 'Sacred lifespring of South India originating at Talakaveri in the Western Ghats of Karnataka and flowing east through Tamil Nadu into the Bay of Bengal.'
    },
    {
      id: 'bhavani',
      name: 'Bhavani River',
      alternate_names: 'Bhavani, Bhavani Aaru',
      state: 'Tamil Nadu & Kerala',
      country: 'India',
      latitude: 11.448,
      longitude: 77.142,
      bbox: JSON.stringify([76.5, 11.1, 77.8, 11.6]),
      length_km: 217,
      basin: 'Cauvery Basin (Major Tributary)',
      geometry: JSON.stringify({
        type: 'LineString',
        coordinates: [
          [76.582, 11.125], [76.712, 11.234], [76.921, 11.312], [77.085, 11.398],
          [77.142, 11.448], [77.345, 11.489], [77.589, 11.445], [77.712, 11.452]
        ]
      }),
      description: 'Second longest river in Tamil Nadu, originating in the Silent Valley of Kerala and the Nilgiri hills, feeding the Bhavanisagar Dam before joining the Cauvery.'
    },
    {
      id: 'noyyal',
      name: 'Noyyal River',
      alternate_names: 'Noyyal, Noyyal Aaru, Kanchi Maanadhi',
      state: 'Tamil Nadu',
      country: 'India',
      latitude: 11.002,
      longitude: 77.291,
      bbox: JSON.stringify([76.7, 10.9, 77.9, 11.2]),
      length_km: 180,
      basin: 'Cauvery Basin (Tributary)',
      geometry: JSON.stringify({
        type: 'LineString',
        coordinates: [
          [76.715, 10.942], [76.925, 10.995], [77.125, 11.012], [77.291, 11.002],
          [77.542, 10.985], [77.745, 11.025], [77.889, 11.054]
        ]
      }),
      description: 'Historic river originating in the Velliangiri Hills of the Western Ghats, flowing through Coimbatore and Tiruppur industrial regions into the Cauvery at Kodumudi.'
    },
    {
      id: 'amaravathi',
      name: 'Amaravathi River',
      alternate_names: 'Amaravathi, Amaravathi Aaru, Pournami',
      state: 'Tamil Nadu & Kerala',
      country: 'India',
      latitude: 10.728,
      longitude: 77.834,
      bbox: JSON.stringify([77.1, 10.2, 78.2, 11.0]),
      length_km: 256,
      basin: 'Cauvery Basin (Southern Tributary)',
      geometry: JSON.stringify({
        type: 'LineString',
        coordinates: [
          [77.165, 10.245], [77.289, 10.412], [77.485, 10.589], [77.685, 10.698],
          [77.834, 10.728], [78.012, 10.845], [78.145, 10.958]
        ]
      }),
      description: 'Originates at the border of Anamalai Hills and Munnar, forming the Amaravathi Reservoir and flowing past Udumalpet, Dharapuram, and Karur before meeting the Cauvery.'
    },
    {
      id: 'ganga',
      name: 'Ganga River',
      alternate_names: 'Ganges, Bhagirathi, Hooghly',
      state: 'Uttarakhand, UP, Bihar, WB',
      country: 'India',
      latitude: 25.317,
      longitude: 83.006,
      bbox: JSON.stringify([78.5, 22.0, 88.5, 31.0]),
      length_km: 2525,
      basin: 'Ganga Basin',
      geometry: JSON.stringify({
        type: 'LineString',
        coordinates: [
          [78.598, 30.145], [78.165, 29.954], [79.458, 27.895], [80.345, 26.465],
          [81.845, 25.435], [83.006, 25.317], [85.125, 25.612], [88.363, 22.572]
        ]
      }),
      description: 'Major trans-boundary river of Asia, flowing through India and Bangladesh, with the largest basin drainage system in the subcontinent.'
    },
    {
      id: 'yamuna',
      name: 'Yamuna River',
      alternate_names: 'Jamuna, Kalindi',
      state: 'Uttarakhand, Haryana, Delhi, UP',
      country: 'India',
      latitude: 28.613,
      longitude: 77.209,
      bbox: JSON.stringify([77.0, 25.0, 82.0, 31.0]),
      length_km: 1376,
      basin: 'Ganga Basin (Major Tributary)',
      geometry: JSON.stringify({
        type: 'LineString',
        coordinates: [
          [78.452, 31.012], [77.345, 30.215], [77.209, 28.613], [77.589, 27.845],
          [78.012, 27.185], [79.012, 26.545], [81.845, 25.435]
        ]
      }),
      description: 'Longest and second-largest tributary of the Ganges in northern India, originating from the Yamunotri Glacier in the Lower Himalayas.'
    },
    {
      id: 'godavari',
      name: 'Godavari River',
      alternate_names: 'Dakshin Ganga, Gautami',
      state: 'Maharashtra, Telangana, Andhra Pradesh',
      country: 'India',
      latitude: 17.000,
      longitude: 81.804,
      bbox: JSON.stringify([73.5, 16.5, 82.5, 20.0]),
      length_km: 1465,
      basin: 'Godavari Basin',
      geometry: JSON.stringify({
        type: 'LineString',
        coordinates: [
          [73.535, 19.995], [75.315, 19.865], [77.125, 19.145], [78.789, 18.954],
          [80.125, 18.452], [81.804, 17.000], [82.245, 16.745]
        ]
      }),
      description: 'Second longest river in India after the Ganga, draining the Deccan plateau through Maharashtra and Andhra Pradesh into the Bay of Bengal.'
    }
  ];

  const insert = db.prepare(`
    INSERT INTO rivers (id, name, alternate_names, state, country, latitude, longitude, bbox, length_km, basin, geometry, description)
    VALUES (@id, @name, @alternate_names, @state, @country, @latitude, @longitude, @bbox, @length_km, @basin, @geometry, @description)
  `);

  const insertMany = db.transaction((rivers) => {
    for (const r of rivers) insert.run(r);
  });

  insertMany(defaultRivers);
}

// Seed realistic, temporally coherent multi-epoch satellite observations
function seedHistoricalObservations() {
  const count = db.prepare('SELECT count(*) as count FROM satellite_observations').get().count;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO satellite_observations (
      river_id, river_name, latitude, longitude, bbox, satellite_name, sensor,
      image_date, image_timestamp, cloud_cover, resolution, ndwi, ndvi,
      water_area, river_width, temperature, turbidity, flood_status, flood_risk_pct,
      water_level, health_score, water_availability, pollution_risk,
      ai_summary, ai_recommendation, image_url, ndwi_image_url, false_color_image_url, prev_image_url, raw_metadata
    ) VALUES (
      @river_id, @river_name, @latitude, @longitude, @bbox, @satellite_name, @sensor,
      @image_date, @image_timestamp, @cloud_cover, @resolution, @ndwi, @ndvi,
      @water_area, @river_width, @temperature, @turbidity, @flood_status, @flood_risk_pct,
      @water_level, @health_score, @water_availability, @pollution_risk,
      @ai_summary, @ai_recommendation, @image_url, @ndwi_image_url, @false_color_image_url, @prev_image_url, @raw_metadata
    )
  `);

  const rivers = db.prepare('SELECT * FROM rivers').all();
  const today = new Date();

  // Baseline calibration per river
  const riverBaselines = {
    cauvery: { width: 145, area: 92.4, temp: 26.8, turbidity: 13.5, ndwi: 0.54, ndvi: 0.62, level: 742.8 },
    bhavani: { width: 78, area: 38.6, temp: 24.2, turbidity: 8.4, ndwi: 0.61, ndvi: 0.74, level: 295.4 },
    noyyal: { width: 42, area: 18.2, temp: 28.5, turbidity: 22.8, ndwi: 0.38, ndvi: 0.48, level: 368.2 },
    amaravathi: { width: 68, area: 29.5, temp: 27.1, turbidity: 11.2, ndwi: 0.49, ndvi: 0.58, level: 312.0 },
    ganga: { width: 480, area: 380.0, temp: 25.4, turbidity: 28.6, ndwi: 0.68, ndvi: 0.52, level: 68.4 },
    yamuna: { width: 220, area: 145.0, temp: 29.2, turbidity: 34.1, ndwi: 0.42, ndvi: 0.44, level: 198.5 },
    godavari: { width: 340, area: 260.0, temp: 27.8, turbidity: 18.5, ndwi: 0.59, ndvi: 0.56, level: 14.2 }
  };

  const satelliteFleet = [
    { name: 'Sentinel-2B MSI', sensor: 'MSI Level-2A (BOA Reflectance)', res: '10m Multispectral' },
    { name: 'Sentinel-2A MSI', sensor: 'MSI Level-2A (BOA Reflectance)', res: '10m Multispectral' },
    { name: 'Landsat-9 OLI-2', sensor: 'OLI-2/TIRS-2 Collection 2 Tier 1', res: '15m Pan / 30m Multi' },
    { name: 'Landsat-8 OLI', sensor: 'OLI/TIRS Collection 2 Tier 1', res: '15m Pan / 30m Multi' },
    { name: 'SWOT KaRIn', sensor: 'Ka-band Radar Interferometer', res: '0.5m Elevation / 10m Vector' },
    { name: 'Sentinel-3A OLCI', sensor: 'Ocean and Land Colour Instrument', res: '300m Full Res' }
  ];

  // Generate 45 historical timestamps covering 1 year
  const daysAgoList = [
    0, 2, 5, 8, 12, 16, 21, 26, 30, 37, 45, 53, 62, 75, 90, 105, 120, 140, 160, 180,
    205, 230, 260, 290, 320, 350, 365
  ];

  const insertObservations = db.transaction(() => {
    for (const river of rivers) {
      const base = riverBaselines[river.id] || { width: 80, area: 40, temp: 26, turbidity: 15, ndwi: 0.5, ndvi: 0.55, level: 250 };

      for (let i = 0; i < daysAgoList.length; i++) {
        const daysAgo = daysAgoList[i];
        const obsDate = new Date(today);
        obsDate.setDate(obsDate.getDate() - daysAgo);

        // Seasonal variation simulation (monsoon vs dry season)
        const dayOfYear = Math.floor((obsDate - new Date(obsDate.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const seasonalFactor = Math.sin((dayOfYear - 150) * (2 * Math.PI / 365)) * 0.18; // peak around monsoon
        const variance = (Math.sin(i * 1.7) * 0.05);

        const currentArea = Number((base.area * (1 + seasonalFactor + variance)).toFixed(2));
        const currentWidth = Number((base.width * (1 + seasonalFactor * 0.7 + variance * 0.5)).toFixed(1));
        const currentNdwi = Number(Math.max(-0.2, Math.min(0.85, base.ndwi + seasonalFactor * 0.4 + variance * 0.2)).toFixed(3));
        const currentNdvi = Number(Math.max(0.1, Math.min(0.9, base.ndvi + seasonalFactor * 0.3 - variance * 0.1)).toFixed(3));
        const currentTemp = Number((base.temp - seasonalFactor * 4 + Math.cos(i) * 1.2).toFixed(1));
        const currentTurbidity = Number(Math.max(3.0, (base.turbidity * (1 + Math.abs(seasonalFactor) * 1.4 + (i % 3 === 0 ? 0.3 : -0.1))).toFixed(1)));
        const cloudCover = Number((Math.abs(Math.sin(i * 2.3 + dayOfYear * 0.05)) * 18.5).toFixed(1));
        const waterLevel = Number((base.level + seasonalFactor * 3.5 + (Math.sin(i) * 0.8)).toFixed(2));

        // Flood Risk & Health Scoring
        let floodRiskPct = Math.round(Math.max(5, Math.min(95, 15 + seasonalFactor * 80 + (currentTurbidity > 25 ? 15 : 0))));
        let floodStatus = 'Low';
        if (floodRiskPct > 70) floodStatus = 'Critical';
        else if (floodRiskPct > 45) floodStatus = 'Moderate';

        let healthScore = Math.round(Math.max(30, Math.min(98, 92 - (currentTurbidity > 20 ? 18 : 0) - (river.id === 'noyyal' ? 14 : 0) - (cloudCover > 50 ? 5 : 0))));
        
        let waterAvailability = 'Stable';
        if (seasonalFactor > 0.1) waterAvailability = 'Abundant';
        else if (seasonalFactor < -0.1) waterAvailability = 'Moderate';

        let pollutionRisk = 'Low';
        if (currentTurbidity > 30 || river.id === 'noyyal') pollutionRisk = currentTurbidity > 35 ? 'Elevated' : 'Moderate';

        const sat = satelliteFleet[i % satelliteFleet.length];
        const dateStr = obsDate.toISOString().split('T')[0];
        const timestampStr = `${dateStr}T10:42:15.000Z`;

        const aiSummary = `Spectral analysis via ${sat.name} shows ${currentArea} km² water surface area (NDWI: ${currentNdwi > 0 ? '+' : ''}${currentNdwi}). Riparian vegetative buffer index (NDVI) is at ${currentNdvi}. Turbidity is ${currentTurbidity} NTU with surface temperature at ${currentTemp}°C. River width measured at ${currentWidth}m across the primary monitoring reach.`;
        
        let aiRecommendation = 'Continue regular satellite monitoring. Hydrological and surface reflectance metrics remain within normal seasonal parameters.';
        if (floodStatus === 'Moderate' || floodStatus === 'Critical') {
          aiRecommendation = 'Elevated catchment inflow detected. Increase automated satellite pass cadence and coordinate with local flood telemetry gates.';
        } else if (pollutionRisk === 'Moderate' || pollutionRisk === 'Elevated') {
          aiRecommendation = 'Turbidity and spectral reflectance indicate upstream suspended particulate loads. Inspect industrial outlet sensors and agricultural runoff buffer.';
        }

        // Real high-resolution imagery links and multi-band representations
        const rgbImg = `/api/satellite/image?river=${river.id}&type=rgb&date=${dateStr}`;
        const ndwiImg = `/api/satellite/image?river=${river.id}&type=ndwi&date=${dateStr}`;
        const falseColorImg = `/api/satellite/image?river=${river.id}&type=false_color&date=${dateStr}`;
        const prevDate = new Date(obsDate);
        prevDate.setDate(prevDate.getDate() - 15);
        const prevImg = `/api/satellite/image?river=${river.id}&type=rgb&date=${prevDate.toISOString().split('T')[0]}`;

        insert.run({
          river_id: river.id,
          river_name: river.name,
          latitude: river.latitude,
          longitude: river.longitude,
          bbox: river.bbox,
          satellite_name: sat.name,
          sensor: sat.sensor,
          image_date: dateStr,
          image_timestamp: timestampStr,
          cloud_cover: cloudCover,
          resolution: sat.res,
          ndwi: currentNdwi,
          ndvi: currentNdvi,
          water_area: currentArea,
          river_width: currentWidth,
          temperature: currentTemp,
          turbidity: currentTurbidity,
          flood_status: floodStatus,
          flood_risk_pct: floodRiskPct,
          water_level: waterLevel,
          health_score: healthScore,
          water_availability: waterAvailability,
          pollution_risk: pollutionRisk,
          ai_summary: aiSummary,
          ai_recommendation: aiRecommendation,
          image_url: rgbImg,
          ndwi_image_url: ndwiImg,
          false_color_image_url: falseColorImg,
          prev_image_url: prevImg,
          raw_metadata: JSON.stringify({
            platform: sat.name.split(' ')[0],
            orbit: 120 + (i * 17) % 143,
            sunElevation: Number((58.4 - Math.sin(i) * 12).toFixed(1)),
            solarAzimuth: 138.2,
            processingLevel: sat.sensor.includes('Level-2A') ? 'L2A BOA' : 'Collection-2 L2',
            crs: 'EPSG:4326 / WGS84',
            tileId: `T43${String.fromCharCode(65 + (i % 6))}NM`
          })
        });
      }
    }
  });

  insertObservations();
  console.log('✅ Seeded historical satellite observations across 7 major river systems.');
}

// Database helper functions
export const RiverDB = {
  getAllRivers() {
    return db.prepare('SELECT * FROM rivers ORDER BY name ASC').all();
  },

  searchRivers(query) {
    const q = `%${query.trim()}%`;
    return db.prepare(`
      SELECT * FROM rivers 
      WHERE name LIKE ? OR alternate_names LIKE ? OR state LIKE ? OR basin LIKE ?
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1
          WHEN name LIKE ? THEN 2
          ELSE 3
        END
      LIMIT 10
    `).all(q, q, q, q, `${query}%`, q);
  },

  getRiverById(id) {
    return db.prepare('SELECT * FROM rivers WHERE id = ?').get(id);
  },

  getRiverByName(name) {
    return db.prepare('SELECT * FROM rivers WHERE name LIKE ? OR alternate_names LIKE ? LIMIT 1').get(`%${name}%`, `%${name}%`);
  },

  insertRiver(river) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO rivers (id, name, alternate_names, state, country, latitude, longitude, bbox, length_km, basin, geometry, description)
      VALUES (@id, @name, @alternate_names, @state, @country, @latitude, @longitude, @bbox, @length_km, @basin, @geometry, @description)
    `);
    return stmt.run(river);
  },

  getLatestObservation(riverId) {
    return db.prepare(`
      SELECT * FROM satellite_observations 
      WHERE river_id = ? 
      ORDER BY image_date DESC, id DESC 
      LIMIT 1
    `).get(riverId);
  },

  getHistory(riverId, limitDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - limitDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return db.prepare(`
      SELECT * FROM satellite_observations 
      WHERE river_id = ? AND image_date >= ?
      ORDER BY image_date ASC
    `).all(riverId, cutoffStr);
  },

  getStatistics(riverId) {
    const stats = db.prepare(`
      SELECT 
        AVG(ndwi) as avg_ndwi,
        MAX(ndwi) as max_ndwi,
        MIN(ndwi) as min_ndwi,
        AVG(water_area) as avg_water_area,
        MAX(water_area) as max_water_area,
        MIN(water_area) as min_water_area,
        AVG(temperature) as avg_temp,
        MAX(temperature) as max_temp,
        MIN(temperature) as min_temp,
        AVG(turbidity) as avg_turbidity,
        MAX(turbidity) as max_turbidity,
        MIN(turbidity) as min_turbidity,
        AVG(river_width) as avg_width,
        COUNT(*) as total_observations
      FROM satellite_observations
      WHERE river_id = ?
    `).get(riverId);

    const latest = this.getLatestObservation(riverId);
    return { stats, latest };
  },

  insertObservation(obs) {
    const stmt = db.prepare(`
      INSERT INTO satellite_observations (
        river_id, river_name, latitude, longitude, bbox, satellite_name, sensor,
        image_date, image_timestamp, cloud_cover, resolution, ndwi, ndvi,
        water_area, river_width, temperature, turbidity, flood_status, flood_risk_pct,
        water_level, health_score, water_availability, pollution_risk,
        ai_summary, ai_recommendation, image_url, ndwi_image_url, false_color_image_url, prev_image_url, raw_metadata
      ) VALUES (
        @river_id, @river_name, @latitude, @longitude, @bbox, @satellite_name, @sensor,
        @image_date, @image_timestamp, @cloud_cover, @resolution, @ndwi, @ndvi,
        @water_area, @river_width, @temperature, @turbidity, @flood_status, @flood_risk_pct,
        @water_level, @health_score, @water_availability, @pollution_risk,
        @ai_summary, @ai_recommendation, @image_url, @ndwi_image_url, @false_color_image_url, @prev_image_url, @raw_metadata
      )
    `);
    return stmt.run(obs);
  }
};

export default RiverDB;
