import { mongo } from 'mongoose';
import type { Author, ContactMessage, MediaAsset, PageContent } from './data';
import {
  initialRevisions, initialState, publicUser,
  type Account, type Repository, type Revision, type StoredPage,
} from './repository';

type Metadata = { _id: string; seeded: boolean; imported?: boolean; writeVersion: number };
type PageRecord = { _id: string; position: number; page: StoredPage };
type SessionRecord = { _id: string; userId: string; expires: Date };
type NamedRecord<T> = { _id: string; value: T };

const globals = globalThis as typeof globalThis & {
  kkMongo?: Promise<{ client: mongo.MongoClient; db: mongo.Db }>;
};

const magazineId = 'magazine';
const transactionOptions: mongo.TransactionOptions = {
  readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary',
};

function collections(db: mongo.Db) {
  return {
    metadata: db.collection<Metadata>('kk_metadata'),
    pages: db.collection<PageRecord>('kk_pages'),
    authors: db.collection<NamedRecord<Author>>('kk_authors'),
    revisions: db.collection<NamedRecord<Revision>>('kk_page_revisions'),
    accounts: db.collection<Account & { _id: string }>('kk_users'),
    sessions: db.collection<SessionRecord>('kk_sessions'),
    assets: db.collection<NamedRecord<MediaAsset>>('kk_media'),
    contacts: db.collection<NamedRecord<ContactMessage>>('kk_contact_messages'),
  };
}

async function connect(uri: string) {
  const client = new mongo.MongoClient(uri, {
    appName: 'kk', maxPoolSize: 10, serverSelectionTimeoutMS: 5000, ignoreUndefined: true,
  });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE?.trim() || 'kk');
    const data = collections(db);
    await Promise.all([
      data.pages.createIndex({ position: 1 }),
      data.pages.createIndex({ 'page.published.blocks.assetId': 1 }, { sparse: true }),
      data.authors.createIndex({ 'value.name': 1 }),
      data.revisions.createIndex({ 'value.page.id': 1, 'value.version': 1 }, { unique: true }),
      data.accounts.createIndex({ email: 1 }, { unique: true }),
      data.sessions.createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
      data.sessions.createIndex({ userId: 1 }),
      data.assets.createIndex({ 'value.createdAt': -1 }),
      data.assets.createIndex({ 'value.contributorId': 1 }, { sparse: true }),
      data.contacts.createIndex({ 'value.createdAt': -1, _id: -1 }),
      data.contacts.createIndex({ 'value.email': 1, 'value.createdAt': -1 }),
    ]);

    const existing = await data.metadata.findOne({ _id: magazineId });
    if (!existing?.seeded) {
      try {
        await data.metadata.updateOne({ _id: magazineId }, {
          $setOnInsert: { seeded: false, writeVersion: 0 },
        }, { upsert: true });
      } catch (error) {
        if (!(error instanceof mongo.MongoServerError) || error.code !== 11000) throw error;
      }
      await client.withSession(session => session.withTransaction(async () => {
        // Take the magazine write lock before reading to serialize bootstrap across instances.
        const metadata = await data.metadata.findOneAndUpdate(
          { _id: magazineId }, { $inc: { writeVersion: 1 } }, { session },
        );
        if (metadata?.seeded) return;
        const pages = initialState.pages.map((page, position) => ({ _id: page.id, position, page }));
        const authors = initialState.authors.map(author => ({ _id: author.id, value: author }));
        const revisions = initialRevisions(initialState).map(value => ({
          _id: `${value.page.id}:${value.version}`, value,
        }));
        if (pages.length) await data.pages.insertMany(pages, { session });
        if (authors.length) await data.authors.insertMany(authors, { session });
        if (revisions.length) await data.revisions.insertMany(revisions, { session });
        await data.metadata.updateOne({ _id: magazineId }, { $set: { seeded: true } }, { session });
      }, transactionOptions));
    }
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}

function repository(data: ReturnType<typeof collections>, session?: mongo.ClientSession): Repository {
  const options = { session };
  async function authors(ids?: string[]) {
    const match = ids ? { _id: { $in: ids } } : {};
    const rows = await data.authors.find(match, options).sort({ 'value.name': 1 }).toArray();
    return rows.map(row => row.value);
  }
  async function authorUsesPhoto(id: string) {
    return Boolean(await data.authors.findOne({ 'value.photoAssetId': id }, { ...options, projection: { _id: 1 } }));
  }
  return {
    async magazine() {
      const metadata = await data.metadata.findOne({ _id: magazineId }, options);
      const pages = await data.pages.find({}, options).sort({ position: 1 }).toArray();
      return { pages: pages.map(row => row.page), authors: await authors(), imported: metadata?.imported };
    },
    async publishedPages() {
      const rows = await data.pages
        .find({ 'page.published': { $exists: true } }, options)
        .sort({ position: 1 }).project<{ page: { published: PageContent } }>({ 'page.published': 1, _id: 0 })
        .toArray();
      return rows.map(row => row.page.published);
    },
    authors,
    authorUsesPhoto,
    async authorByAccount(id) {
      return (await data.authors.findOne({ 'value.accountId': id }, options))?.value;
    },
    async updateAuthor(author) {
      await data.authors.updateOne({ _id: author.id }, { $set: { value: author } }, options);
    },
    async saveMagazine(_state, changes) {
      if (changes.pages.length) {
        await data.pages.bulkWrite(changes.pages.map(({ page, position }) => ({
          replaceOne: {
            filter: { _id: page.id },
            replacement: { position, page },
            upsert: true,
          },
        })), options);
      }
      if (changes.authors.length) {
        await data.authors.insertMany(changes.authors.map(author => ({ _id: author.id, value: author })), options);
      }
      if (changes.markImported) {
        await data.metadata.updateOne({ _id: magazineId }, { $set: { imported: true } }, options);
      }
      const { revision } = changes;
      if (revision) {
        await data.revisions.insertOne({ _id: `${revision.page.id}:${revision.version}`, value: revision }, options);
      }
    },
    async setPagePositions(pages) {
      if (!pages.length) return;
      await data.pages.bulkWrite(pages.map(({ id, position }) => ({
        updateOne: { filter: { _id: id }, update: { $set: { position } } },
      })), options);
    },
    async deletePage(id) {
      await data.pages.deleteOne({ _id: id }, options);
      await data.revisions.deleteMany({ 'value.page.id': id }, options);
    },
    async accountByEmail(email) {
      return await data.accounts.findOne({ email }, options) ?? undefined;
    },
    async accountById(id) {
      return await data.accounts.findOne({ _id: id }, options) ?? undefined;
    },
    async hasAccounts() {
      return Boolean(await data.accounts.findOne({}, { ...options, projection: { _id: 1 } }));
    },
    async listAccounts() {
      const rows = await data.accounts.find({}, options).sort({ name: 1, email: 1 }).toArray();
      return rows.map(publicUser);
    },
    async addAccount(account) {
      await data.accounts.insertOne({ ...account, _id: account.id }, options);
    },
    async updateAccountIdentity(id, identity) {
      await data.accounts.updateOne({ _id: id }, { $set: identity }, options);
    },
    async changePassword(id, password, currentSession) {
      await data.accounts.updateOne({ _id: id }, { $set: { password, failures: 0, lockedUntil: 0 } }, options);
      await data.sessions.deleteMany({
        userId: id, ...(currentSession && { _id: { $ne: currentSession } }),
      }, options);
    },
    async changeRole(id, role) {
      await data.accounts.updateOne({ _id: id }, { $set: { role } }, options);
    },
    async deleteAccount(id) {
      await data.sessions.deleteMany({ userId: id }, options);
      await data.authors.updateMany({ 'value.accountId': id }, { $unset: { 'value.accountId': '' } }, options);
      await data.accounts.deleteOne({ _id: id }, options);
    },
    async setFailures(id, failures, lockedUntil) {
      await data.accounts.updateOne({ _id: id }, { $set: { failures, lockedUntil } }, options);
    },
    async sessionUser(token, now) {
      const active = await data.sessions.findOne({ _id: token, expires: { $gt: new Date(now) } }, options);
      const account = active && await data.accounts.findOne({ _id: active.userId }, options);
      return account ? publicUser(account) : undefined;
    },
    async addSession(value) {
      await data.sessions.insertOne({ _id: value.token, userId: value.userId, expires: new Date(value.expires) }, options);
    },
    async removeSession(token) {
      await data.sessions.deleteOne({ _id: token }, options);
    },
    async listMedia() {
      const rows = await data.assets.find({ 'value.deletion': { $ne: 'done' } }, options)
        .sort({ 'value.createdAt': -1 }).toArray();
      return rows.map(row => row.value);
    },
    async media(id) {
      return (await data.assets.findOne({ _id: id }, options))?.value;
    },
    async addMedia(asset) {
      await data.assets.insertOne({ _id: asset.id, value: asset }, options);
    },
    async assignMediaContributor(id, contributorId) {
      await data.assets.updateOne({ _id: id, 'value.contributorId': { $exists: false } },
        { $set: { 'value.contributorId': contributorId } }, options);
    },
    async contributorPhotos(contributorId, ownerId) {
      const rows = await data.assets.find({
        'value.contributorId': contributorId,
        'value.kind': 'image',
        'value.deletion': { $exists: false },
        ...(ownerId && { 'value.ownerId': ownerId }),
      }, options).toArray();
      return rows.map(row => row.value);
    },
    async mediaIsInUse(id) {
      const projection = { ...options, projection: { _id: 1 } };
      const page = await data.pages.findOne({
        $or: [{ 'page.blocks.assetId': id }, { 'page.published.blocks.assetId': id }],
      }, projection);
      return Boolean(page) || await authorUsesPhoto(id)
        || Boolean(await data.accounts.findOne({ 'profile.photoAssetId': id }, projection));
    },
    async markMediaDeleting(id, replacedPhoto) {
      await data.assets.updateOne({ _id: id }, {
        $set: { 'value.deletion': 'pending', ...(replacedPhoto && { 'value.replacedPhoto': true }) },
      }, options);
    },
    async pendingPhotoDeletions() {
      const rows = await data.assets.find({ 'value.deletion': 'pending', 'value.replacedPhoto': true }, options)
        .limit(3).toArray();
      return rows.map(row => row.value);
    },
    async markMediaDeleted(id) {
      await data.assets.updateOne({ _id: id }, { $set: { 'value.deletion': 'done' } }, options);
    },
    async mediaIsPublished(id) {
      return Boolean(await data.pages.findOne({ 'page.published.blocks.assetId': id }, { ...options, projection: { _id: 1 } }));
    },
    async countRecentContacts(since, email) {
      return data.contacts.countDocuments({
        'value.createdAt': { $gte: since },
        ...(email && { 'value.email': email }),
      }, options);
    },
    async addContact(message) {
      await data.contacts.insertOne({ _id: message.id, value: message }, options);
    },
    async listContacts(offset, limit) {
      const rows = await data.contacts.find({}, options).sort({ 'value.createdAt': -1, _id: -1 })
        .skip(offset).limit(limit).toArray();
      return rows.map(row => row.value);
    },
  };
}

export async function useMongo<T>(uri: string, write: boolean, operation: (db: Repository) => Promise<T>): Promise<T> {
  globals.kkMongo ??= connect(uri).catch(error => {
    delete globals.kkMongo;
    throw error;
  });
  const { client, db } = await globals.kkMongo;
  const data = collections(db);
  if (!write) return operation(repository(data));
  return client.withSession(session => session.withTransaction(async () => {
    // Acquiring this lock first keeps role changes and page/revision writes ordered with one another.
    await data.metadata.updateOne({ _id: magazineId }, { $inc: { writeVersion: 1 } }, { session });
    return operation(repository(data, session));
  }, transactionOptions));
}
