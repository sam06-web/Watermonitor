import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import config from '../config/config.js';
import { connectMongo, getMongoDB, isMongoConfigured } from './mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When MONGODB_URI is set the server persists to MongoDB Atlas; otherwise it
// falls back to the local SQLite database. Both providers expose the same
// RiverDB API (all async) so callers never need to know which is active.
export const USE_MONGO = isMongoConfigured();

let db = null;
if (!USE_MONGO) {
  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
}

export function isMongo() {
  return USE_MONGO;
}

export async function initDatabase() {
  if (USE_MONGO) {
    await connectMongo();
    await purgeSyntheticObservationsMongo();
    await dedupeObservationsMongo();
    const maskedUri = String(config.mongodb.uri).replace(/\/\/[^@/]+@/, '//***@');
    console.log('✅ MongoDB initialized successfully at', maskedUri);
    return;
  }

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

async function purgeSyntheticObservationsMongo() {
  const result = await getMongoDB().collection('satellite_observations').deleteMany({
    $or: [
      { raw_metadata: null },
      { raw_metadata: { $not: { $regex: '"source":"real"' } } }
    ]
  });
  if (result.deletedCount > 0) {
    console.log(`🧹 Purged ${result.deletedCount} synthetic satellite observations.`);
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

async function dedupeObservationsMongo() {
  const coll = getMongoDB().collection('satellite_observations');
  const duplicates = await coll.aggregate([
    {
      $group: {
        _id: { river_id: '$river_id', image_date: '$image_date', satellite_name: '$satellite_name' },
        maxId: { $max: '$id' },
        ids: { $push: '$id' }
      }
    },
    { $match: { $expr: { $gt: [{ $size: '$ids' }, 1] } } }
  ]).toArray();

  let removed = 0;
  for (const group of duplicates) {
    const stale = group.ids.filter(id => id !== group.maxId);
    const result = await coll.deleteMany({ id: { $in: stale } });
    removed += result.deletedCount;
  }
  if (removed > 0) {
    console.log(`🧹 Deduplicated ${removed} repeated satellite observations.`);
  }
}


const sqliteRiverDB = {
  async getAllRivers() {
    return db.prepare('SELECT * FROM rivers ORDER BY name ASC').all();
  },

  async searchRivers(query) {
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

  async getRiverById(id) {
    return db.prepare('SELECT * FROM rivers WHERE id = ?').get(id);
  },

  async getRiverByName(name) {
    return db.prepare('SELECT * FROM rivers WHERE name LIKE ? OR alternate_names LIKE ? LIMIT 1').get(`%${name}%`, `%${name}%`);
  },

  async insertRiver(river) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO rivers (id, name, alternate_names, state, country, latitude, longitude, bbox, length_km, basin, geometry, description)
      VALUES (@id, @name, @alternate_names, @state, @country, @latitude, @longitude, @bbox, @length_km, @basin, @geometry, @description)
    `);
    return stmt.run(river);
  },

  async getLatestObservation(riverId) {
    return db.prepare(`
      SELECT * FROM satellite_observations 
      WHERE river_id = ? 
      ORDER BY image_date DESC, id DESC 
      LIMIT 1
    `).get(riverId);
  },

  async getObservationByScene(riverId, imageDate, satelliteName) {
    return db.prepare(`
      SELECT * FROM satellite_observations
      WHERE river_id = ? AND image_date = ? AND satellite_name = ?
      LIMIT 1
    `).get(riverId, imageDate, satelliteName || '');
  },

  async updateObservation(row) {
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

  async getHistory(riverId, limitDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - limitDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return db.prepare(`
      SELECT * FROM satellite_observations 
      WHERE river_id = ? AND image_date >= ?
      ORDER BY image_date ASC
    `).all(riverId, cutoffStr);
  },

  async getStatistics(riverId) {
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

    const latest = await this.getLatestObservation(riverId);
    return { stats, latest };
  },

  async insertObservation(obs) {
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

export const RiverDB = USE_MONGO ? (await import('./mongo.js')).mongoRiverDB : sqliteRiverDB;

export default RiverDB;