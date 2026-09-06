import { MongoClient } from 'mongodb';
import config from '../config/config.js';

/**
 * MongoDB Atlas provider for AquaSense.
 *
 * When MONGODB_URI is set the server persists rivers and satellite observations
 * in Atlas instead of SQLite. Documents mirror the SQLite rows (bbox/geometry
 * kept as JSON strings) so every downstream consumer works unchanged. Numeric
 * observation ids are preserved via a `counters` collection so the existing
 * `updateObservation({ id })` flow keeps working.
 */

import { PRESET_RIVERS, getRiverAliasIds } from './presetRivers.js';

const { uri, dbName } = config.mongodb;

let client = null;
let database = null;
let connected = false;

export function isMongoConfigured() {
  return Boolean(uri);
}

export async function connectMongo() {
  if (connected && database) return database;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  });
  await client.connect();
  database = client.db(dbName);
  connected = true;

  await database.collection('rivers').createIndex({ id: 1 }, { unique: true });
  await database.collection('rivers').createIndex({ name: 1 });
  await database.collection('satellite_observations').createIndex({ river_id: 1, image_date: -1 });
  await database.collection('satellite_observations').createIndex(
    { river_id: 1, image_date: 1, satellite_name: 1 },
    { unique: true }
  );
  await database.collection('sensor_readings').createIndex({ timestamp: -1 });
  await database.collection('sensor_readings').createIndex({ river_id: 1, timestamp: -1 });
  await database.collection('counters').updateOne(
    { _id: 'observation_id' },
    { $setOnInsert: { value: 0 } },
    { upsert: true }
  );

  // Seed / sync preset rivers into MongoDB
  for (const r of PRESET_RIVERS) {
    await database.collection('rivers').replaceOne(
      { id: r.id },
      r,
      { upsert: true }
    );
  }

  await seedSensorHistoryMongo(database);

  return database;
}

export function getMongoDB() {
  if (!database) throw new Error('MongoDB is not connected. Call connectMongo() first.');
  return database;
}

export async function nextObservationId() {
  const counters = getMongoDB().collection('counters');
  const result = await counters.findOneAndUpdate(
    { _id: 'observation_id' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return result.value.value;
}

export async function setObservationCounter(value) {
  await getMongoDB().collection('counters').updateOne(
    { _id: 'observation_id' },
    { $set: { value } },
    { upsert: true }
  );
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const mongoRiverDB = {
  async getAllRivers() {
    return getMongoDB().collection('rivers').find({}).sort({ name: 1 }).toArray();
  },

  async searchRivers(query) {
    const q = String(query).trim();
    if (!q) return [];
    const aliasIds = getRiverAliasIds(q.toLowerCase());
    const needle = escapeRegex(q);
    const any = new RegExp(needle, 'i');
    const prefix = new RegExp(`^${needle}`, 'i');

    const candidates = await getMongoDB().collection('rivers')
      .find({
        $or: [
          { id: { $in: aliasIds } },
          { name: any },
          { alternate_names: any },
          { state: any },
          { basin: any }
        ]
      })
      .limit(50)
      .toArray();

    // Deduplicate by name base
    const seen = new Set();
    const uniqueCandidates = [];
    for (const c of candidates) {
      const key = String(c.name || '').toLowerCase().replace(/ river$/i, '');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCandidates.push(c);
      }
    }

    const ranked = uniqueCandidates
      .map(r => ({
        river: r,
        rank: prefix.test(r.name) || aliasIds.includes(r.id) ? 1 : any.test(r.name) ? 2 : 3
      }))
      .sort((a, b) => a.rank - b.rank || String(a.river.name).localeCompare(String(b.river.name)))
      .slice(0, 10)
      .map(entry => entry.river);

    return ranked;
  },

  async getRiverById(id) {
    const aliasIds = getRiverAliasIds(id);
    return getMongoDB().collection('rivers').findOne({ id: { $in: aliasIds } });
  },

  async getRiverByName(name) {
    const aliasIds = getRiverAliasIds(name);
    const needle = escapeRegex(name);
    const any = new RegExp(needle, 'i');
    return getMongoDB().collection('rivers').findOne({
      $or: [{ id: { $in: aliasIds } }, { name: any }, { alternate_names: any }]
    });
  },

  async insertRiver(river) {
    await getMongoDB().collection('rivers').replaceOne(
      { id: river.id },
      river,
      { upsert: true }
    );
    return river;
  },

  async getLatestObservation(riverId) {
    const aliasIds = getRiverAliasIds(riverId);
    return getMongoDB().collection('satellite_observations')
      .find({ river_id: { $in: aliasIds } })
      .sort({ image_date: -1, id: -1 })
      .limit(1)
      .next();
  },

  async getObservationByScene(riverId, imageDate, satelliteName) {
    const aliasIds = getRiverAliasIds(riverId);
    return getMongoDB().collection('satellite_observations').findOne({
      river_id: { $in: aliasIds },
      image_date: imageDate,
      satellite_name: satelliteName || ''
    });
  },

  async updateObservation(row) {
    const { id, ...fields } = row;
    const update = {};
    for (const key of [
      'temperature', 'flood_status', 'flood_risk_pct', 'health_score',
      'water_availability', 'pollution_risk', 'ai_summary', 'ai_recommendation',
      'raw_metadata'
    ]) {
      if (key in fields) update[key] = fields[key];
    }
    return getMongoDB().collection('satellite_observations').updateOne(
      { id },
      { $set: update }
    );
  },

  async getHistory(riverId, limitDays = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - limitDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const aliasIds = getRiverAliasIds(riverId);
    return getMongoDB().collection('satellite_observations')
      .find({ river_id: { $in: aliasIds }, image_date: { $gte: cutoffStr } })
      .sort({ image_date: 1 })
      .toArray();
  },

  async getStatistics(riverId) {
    const aliasIds = getRiverAliasIds(riverId);
    const stats = await getMongoDB().collection('satellite_observations').aggregate([
      { $match: { river_id: { $in: aliasIds } } },
      {
        $group: {
          _id: null,
          avg_ndwi: { $avg: '$ndwi' },
          max_ndwi: { $max: '$ndwi' },
          min_ndwi: { $min: '$ndwi' },
          avg_water_area: { $avg: '$water_area' },
          max_water_area: { $max: '$water_area' },
          min_water_area: { $min: '$water_area' },
          avg_temp: { $avg: '$temperature' },
          max_temp: { $max: '$temperature' },
          min_temp: { $min: '$temperature' },
          avg_turbidity: { $avg: '$turbidity' },
          max_turbidity: { $max: '$turbidity' },
          min_turbidity: { $min: '$turbidity' },
          avg_width: { $avg: '$river_width' },
          total_observations: { $sum: 1 }
        }
      }
    ]).toArray();

    const group = stats[0] || {};
    const latest = await this.getLatestObservation(riverId);
    return {
      stats: {
        avg_ndwi: group.avg_ndwi ?? null,
        max_ndwi: group.max_ndwi ?? null,
        min_ndwi: group.min_ndwi ?? null,
        avg_water_area: group.avg_water_area ?? null,
        max_water_area: group.max_water_area ?? null,
        min_water_area: group.min_water_area ?? null,
        avg_temp: group.avg_temp ?? null,
        max_temp: group.max_temp ?? null,
        min_temp: group.min_temp ?? null,
        avg_turbidity: group.avg_turbidity ?? null,
        max_turbidity: group.max_turbidity ?? null,
        min_turbidity: group.min_turbidity ?? null,
        avg_width: group.avg_width ?? null,
        total_observations: group.total_observations ?? 0
      },
      latest
    };
  },

  async insertObservation(obs) {
    const doc = { ...obs, id: await nextObservationId() };
    await getMongoDB().collection('satellite_observations').insertOne(doc);
    return doc;
  },

  async insertSensorReading(reading) {
    const ph = Number(reading.ph);
    const tds = Number(reading.tds);
    const turbidity = Number(reading.turbidity);
    const temperature = reading.temperature !== undefined ? Number(reading.temperature) : 24.5;
    
    // Compute simple water quality index (0-100) if not provided
    let wqi = reading.wqi;
    if (wqi === undefined || wqi === null) {
      let phScore = 100 - Math.abs(ph - 7.2) * 25;
      let tdsScore = tds <= 300 ? 100 : Math.max(0, 100 - (tds - 300) * 0.2);
      let turbScore = turbidity <= 3.0 ? 100 : Math.max(0, 100 - (turbidity - 3.0) * 8);
      wqi = Math.max(10, Math.min(100, Math.round((phScore * 0.35) + (tdsScore * 0.35) + (turbScore * 0.30))));
    }

    const doc = {
      river_id: reading.river_id || 'global',
      river_name: reading.river_name || 'Global Water Body',
      ph,
      tds,
      turbidity,
      temperature,
      wqi,
      status: reading.status || (wqi >= 80 ? 'optimal' : wqi >= 60 ? 'warning' : 'critical'),
      source: reading.source || 'sensor_node',
      timestamp: reading.timestamp || new Date().toISOString(),
      created_at: new Date()
    };

    await getMongoDB().collection('sensor_readings').insertOne(doc);
    return doc;
  },

  async getSensorHistory(riverId = null, limit = 100, period = '7d') {
    const query = {};
    if (riverId && riverId !== 'all' && riverId !== 'global') {
      query.river_id = riverId;
    }

    if (period && period !== 'all') {
      const cutoff = new Date();
      if (period === '24h' || period === '1d') cutoff.setHours(cutoff.getHours() - 24);
      else if (period === '7d') cutoff.setDate(cutoff.getDate() - 7);
      else if (period === '30d') cutoff.setDate(cutoff.getDate() - 30);
      else cutoff.setDate(cutoff.getDate() - 7);
      query.timestamp = { $gte: cutoff.toISOString() };
    }

    return getMongoDB().collection('sensor_readings')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit) || 100)
      .toArray();
  },

  async getSensorStats(riverId = null) {
    const match = {};
    if (riverId && riverId !== 'all' && riverId !== 'global') {
      match.river_id = riverId;
    }

    const result = await getMongoDB().collection('sensor_readings').aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          avg_ph: { $avg: '$ph' },
          min_ph: { $min: '$ph' },
          max_ph: { $max: '$ph' },
          avg_tds: { $avg: '$tds' },
          min_tds: { $min: '$tds' },
          max_tds: { $max: '$tds' },
          avg_turbidity: { $avg: '$turbidity' },
          min_turbidity: { $min: '$turbidity' },
          max_turbidity: { $max: '$turbidity' },
          avg_wqi: { $avg: '$wqi' },
          total_readings: { $sum: 1 }
        }
      }
    ]).toArray();

    return result[0] || {
      avg_ph: 7.2,
      min_ph: 6.8,
      max_ph: 7.8,
      avg_tds: 280,
      min_tds: 160,
      max_tds: 420,
      avg_turbidity: 3.2,
      min_turbidity: 1.2,
      max_turbidity: 6.5,
      avg_wqi: 82,
      total_readings: 0
    };
  }
};

async function seedSensorHistoryMongo(db) {
  const coll = db.collection('sensor_readings');
  const count = await coll.countDocuments();
  if (count >= 15) return;

  const sampleRivers = [
    { id: 'cauvery', name: 'Cauvery River', basePh: 7.3, baseTds: 310, baseTurb: 3.8 },
    { id: 'amazon', name: 'Amazon River', basePh: 6.9, baseTds: 120, baseTurb: 6.2 },
    { id: 'nile', name: 'Nile River', basePh: 7.6, baseTds: 240, baseTurb: 4.1 },
    { id: 'ganga', name: 'Ganga River', basePh: 7.8, baseTds: 410, baseTurb: 8.5 },
    { id: 'danube', name: 'Danube River', basePh: 7.4, baseTds: 260, baseTurb: 2.8 },
    { id: 'thames', name: 'Thames River', basePh: 7.5, baseTds: 380, baseTurb: 3.5 },
    { id: 'mississippi', name: 'Mississippi River', basePh: 7.2, baseTds: 290, baseTurb: 7.1 }
  ];

  const now = Date.now();
  const docs = [];

  // Generate 7 days of historical readings every 6 hours
  for (let i = 28; i >= 0; i--) {
    const time = new Date(now - i * 6 * 3600 * 1000).toISOString();
    for (const r of sampleRivers) {
      const phVariation = Math.sin(i + r.basePh) * 0.35 + (Math.random() * 0.1 - 0.05);
      const tdsVariation = Math.cos(i + r.baseTds) * 45 + (Math.random() * 20 - 10);
      const turbVariation = Math.sin(i * 1.5) * 1.8 + (Math.random() * 0.8 - 0.4);

      const ph = Math.round((r.basePh + phVariation) * 100) / 100;
      const tds = Math.round(r.baseTds + tdsVariation);
      const turbidity = Math.max(0.5, Math.round((r.baseTurb + turbVariation) * 10) / 10);
      const temp = Math.round((22 + Math.sin(i) * 3) * 10) / 10;

      let phScore = 100 - Math.abs(ph - 7.2) * 25;
      let tdsScore = tds <= 300 ? 100 : Math.max(0, 100 - (tds - 300) * 0.2);
      let turbScore = turbidity <= 3.0 ? 100 : Math.max(0, 100 - (turbidity - 3.0) * 8);
      const wqi = Math.max(15, Math.min(100, Math.round((phScore * 0.35) + (tdsScore * 0.35) + (turbScore * 0.30))));

      docs.push({
        river_id: r.id,
        river_name: r.name,
        ph,
        tds,
        turbidity,
        temperature: temp,
        wqi,
        status: wqi >= 80 ? 'optimal' : wqi >= 60 ? 'warning' : 'critical',
        source: 'telemetry_node',
        timestamp: time,
        created_at: new Date(time)
      });
    }
  }

  await coll.insertMany(docs);
  console.log(`✅ Seeded ${docs.length} historical sensor readings in MongoDB Atlas.`);
}

export default mongoRiverDB;