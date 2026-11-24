import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { mongo } from 'mongoose';

function readSqlite() {
  const path = resolve(process.env.KK_DB_PATH || '.kk/legacy.sqlite');
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec('BEGIN');
    const row = db.prepare('SELECT state FROM magazine WHERE id = 1').get();
    if (!row) throw new Error('The SQLite file has no magazine.');
    const state = JSON.parse(row.state);
    const accounts = db.prepare(`
      SELECT id, name, email, role, password, failures, locked_until AS lockedUntil FROM users
    `).all();
    const tableExists = table => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    const payloads = rows => rows.map(row => JSON.parse(row.payload));
    const assets = tableExists('media') ? payloads(db.prepare('SELECT payload FROM media').all()) : [];
    const contacts = tableExists('contact_messages') ? db.prepare(`
      SELECT id, name, email, message, created_at AS createdAt FROM contact_messages
    `).all() : [];
    const revisions = tableExists('page_revisions') ? payloads(db.prepare('SELECT payload FROM page_revisions').all()) : [];
    if (!revisions.length) {
      const publishedAt = new Date().toISOString();
      for (const page of state.pages) {
        if (page.published) {
          revisions.push({ page: page.published, version: page.status === 'Published' ? page.version : 0, publishedAt });
        }
      }
    }
    // Keep existing Cloudinary URLs while bringing local media IDs into the new namespace.
    const assetIds = new Map(assets.map(asset => [asset.id, asset.id.replace(/^[a-z]+_/, 'kk_')]));
    const updateReferences = page => {
      for (const block of page.blocks) {
        if (assetIds.has(block.assetId)) block.assetId = assetIds.get(block.assetId);
      }
    };
    for (const page of state.pages) {
      updateReferences(page);
      if (page.published) updateReferences(page.published);
    }
    for (const revision of revisions) updateReferences(revision.page);
    for (const asset of assets) {
      const id = assetIds.get(asset.id);
      if (id !== asset.id) {
        asset.publicId ??= asset.id;
        asset.id = id;
      }
    }
    return { state, accounts, assets, contacts, revisions };
  } finally {
    db.close();
  }
}

async function migrate() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error('Set MONGODB_URI before migrating.');
  const { state, accounts, assets, contacts, revisions } = readSqlite();
  const client = new mongo.MongoClient(uri, { appName: 'kk migration', serverSelectionTimeoutMS: 5000, ignoreUndefined: true });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE?.trim() || 'kk');
    const rows = {
      kk_pages: state.pages.map((page, position) => ({ _id: page.id, position, page })),
      kk_authors: state.authors.map(value => ({ _id: value.id, value })),
      kk_users: accounts.map(account => ({ ...account, _id: account.id })),
      kk_page_revisions: revisions.map(value => ({ _id: `${value.page.id}:${value.version}`, value })),
      kk_media: assets.map(value => ({ _id: value.id, value })),
      kk_contact_messages: contacts.map(value => ({ _id: value.id, value })),
      kk_sessions: [],
    };
    const metadata = db.collection('kk_metadata');
    await client.withSession(session => session.withTransaction(async () => {
      const options = { session };
      if (await metadata.findOne({}, options)) throw new Error('The target already has magazine data. Use an empty database.');
      // Reserve the magazine ID so a concurrent first request cannot seed this database.
      await metadata.insertOne({
        _id: 'magazine', seeded: true, writeVersion: 1, imported: Boolean(state.imported),
      }, options);
      for (const [name, records] of Object.entries(rows)) {
        const collection = db.collection(name);
        if (await collection.findOne({}, options)) throw new Error('The target already has magazine data. Use an empty database.');
        if (records.length) await collection.insertMany(records, options);
      }
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' }));
    console.log(`Migrated ${state.pages.length} pages, ${state.authors.length} contributors, ${accounts.length} accounts, ${revisions.length} revisions, ${assets.length} media assets, and ${contacts.length} reader messages.`);
  } finally {
    await client.close();
  }
}

try {
  await migrate();
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
}
