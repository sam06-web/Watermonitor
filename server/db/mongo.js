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
  await database.collection('counters').updateOne(
    { _id: 'observation_id' },
    { $setOnInsert: { value: 0 } },
    { upsert: true }
  );

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
    const needle = escapeRegex(q);
    const any = new RegExp(needle, 'i');
    const prefix = new RegExp(`^${needle}`, 'i');

    const candidates = await getMongoDB().collection('rivers')
      .find({
        $or: [
          { name: any },
          { alternate_names: any },
          { state: any },
          { basin: any }
        ]
      })
      .limit(50)
      .toArray();

    const ranked = candidates
      .map(r => ({
        river: r,
        rank: prefix.test(r.name) ? 1 : any.test(r.name) ? 2 : 3
      }))
      .sort((a, b) => a.rank - b.rank || String(a.river.name).localeCompare(String(b.river.name)))
      .slice(0, 10)
      .map(entry => entry.river);

    return ranked;
  },

  async getRiverById(id) {
    return getMongoDB().collection('rivers').findOne({ id });
  },

  async getRiverByName(name) {
    const needle = escapeRegex(name);
    const any = new RegExp(needle, 'i');
    return getMongoDB().collection('rivers').findOne({
      $or: [{ name: any }, { alternate_names: any }]
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
    return getMongoDB().collection('satellite_observations')
      .find({ river_id: riverId })
      .sort({ image_date: -1, id: -1 })
      .limit(1)
      .next();
  },

  async getObservationByScene(riverId, imageDate, satelliteName) {
    return getMongoDB().collection('satellite_observations').findOne({
      river_id: riverId,
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
    return getMongoDB().collection('satellite_observations')
      .find({ river_id: riverId, image_date: { $gte: cutoffStr } })
      .sort({ image_date: 1 })
      .toArray();
  },

  async getStatistics(riverId) {
    const stats = await getMongoDB().collection('satellite_observations').aggregate([
      { $match: { river_id: riverId } },
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
  }
};

export default mongoRiverDB;