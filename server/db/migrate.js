import Database from 'better-sqlite3';
import { MongoClient } from 'mongodb';
import config from '../config/config.js';

/**
 * One-time migration: SQLite -> MongoDB Atlas.
 *
 * Copies every river and satellite observation from the local SQLite database
 * into the configured Atlas cluster. Safe to re-run: rivers are upserted by
 * their `id` and observations by their numeric `id`, so rows already migrated
 * are replaced in place. The observation id counter is synced to the max id so
 * subsequent inserts continue from where SQLite left off.
 *
 * Usage: node server/db/migrate.js
 */

const sqliteDb = new Database(config.dbPath, { readonly: true });

if (!config.mongodb.uri) {
  console.error('❌ MONGODB_URI is not set. Add it to .env and try again.');
  process.exit(1);
}

async function main() {
  console.log(`Migrating ${config.dbPath} -> MongoDB Atlas...`);

  const rivers = sqliteDb.prepare('SELECT * FROM rivers ORDER BY id').all();
  const observations = sqliteDb
    .prepare('SELECT * FROM satellite_observations ORDER BY id')
    .all();

  const client = new MongoClient(config.mongodb.uri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000
  });
  await client.connect();
  const db = client.db(config.mongodb.dbName);

  const riverColl = db.collection('rivers');
  const obsColl = db.collection('satellite_observations');

  await riverColl.createIndex({ id: 1 }, { unique: true });
  await obsColl.createIndex({ river_id: 1, image_date: -1 });
  await obsColl.createIndex(
    { river_id: 1, image_date: 1, satellite_name: 1 },
    { unique: true }
  );

  if (rivers.length > 0) {
    await riverColl.bulkWrite(
      rivers.map(r => ({ replaceOne: { filter: { id: r.id }, replacement: r, upsert: true } })),
      { ordered: false }
    );
  }

  if (observations.length > 0) {
    await obsColl.bulkWrite(
      observations.map(o => ({ replaceOne: { filter: { id: o.id }, replacement: o, upsert: true } })),
      { ordered: false }
    );
    const maxId = Math.max(...observations.map(o => o.id));
    await db.collection('counters').updateOne(
      { _id: 'observation_id' },
      { $set: { value: maxId } },
      { upsert: true }
    );
  }

  const riverCount = await riverColl.countDocuments({});
  const obsCount = await obsColl.countDocuments({});
  console.log(`✅ Migrated ${rivers.length} rivers and ${observations.length} observations.`);
  console.log(`   Atlas now holds: ${riverCount} rivers, ${obsCount} observations in "${config.mongodb.dbName}".`);

  await client.close();
  sqliteDb.close();
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});