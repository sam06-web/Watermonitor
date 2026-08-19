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
  purgeSyntheticObservations();
  dedupeObservations();
  console.log('✅ SQLite Database initialized successfully at', config.dbPath);
}

// Remove any observations that were not produced by the real Sentinel-2
// processor (rows inserted by the old synthetic seeder lack the source marker).
function purgeSyntheticObservations() {
  const removed = db.prepare(`
    DELETE FROM satellite_observations
    WHERE raw_metadata IS NULL OR raw_metadata NOT LIKE '%"source":"real"%'
  `).run();
  if (removed.changes > 0) {
    console.log(`🧹 Purged ${removed.changes} synthetic satellite observations.`);
  }
}

// Collapse duplicate scenes: keep only the newest row per (river, image_date, satellite).
function dedupeObservations() {
  const removed = db.prepare(`
    DELETE FROM satellite_observations
    WHERE id NOT IN (
      SELECT MAX(id) FROM satellite_observations
      GROUP BY river_id, image_date, satellite_name
    )
  `).run();
  if (removed.changes > 0) {
    console.log(`🧹 Deduplicated ${removed.changes} repeated satellite observations.`);
  }
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

  getObservationByScene(riverId, imageDate, satelliteName) {
    return db.prepare(`
      SELECT * FROM satellite_observations
      WHERE river_id = ? AND image_date = ? AND satellite_name = ?
      LIMIT 1
    `).get(riverId, imageDate, satelliteName || '');
  },

  updateObservation(row) {
    return db.prepare(`
      UPDATE satellite_observations SET
        temperature = @temperature,
        flood_status = @flood_status,
        flood_risk_pct = @flood_risk_pct,
        health_score = @health_score,
        water_availability = @water_availability,
        pollution_risk = @pollution_risk,
        ai_summary = @ai_summary,
        ai_recommendation = @ai_recommendation,
        raw_metadata = @raw_metadata
      WHERE id = @id
    `).run(row);
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
