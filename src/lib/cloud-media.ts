import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { z } from 'zod';
import type { uploadCommand } from './commands';
import type { MediaAsset, MediaKind, MediaPurpose } from './data';
import { RequestError } from './errors';
import { mediaRules } from './media-spec';

const resourceData = z.object({
  public_id: z.string(),
  resource_type: z.enum(['image', 'video']),
  type: z.literal('authenticated'),
  format: z.string(),
  version: z.number().int().positive(),
  bytes: z.number().int().positive(),
  created_at: z.iso.datetime({ offset: true }),
});

type Completion = Extract<z.infer<typeof uploadCommand>, { action: 'complete' }>;
const ticketLifetime = 60 * 60;
const imageFolder = 'KK-Magazine';

function settings() {
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
  };
}

export function cloudinaryConfigured() {
  const { cloud_name, api_key, api_secret } = settings();
  return Boolean(cloud_name && api_key && api_secret);
}

function configure() {
  const { cloud_name, api_key, api_secret } = settings();
  if (!cloud_name || !api_key || !api_secret) throw new RequestError(503, 'Cloudinary uploads are unavailable.');
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return { cloudName: cloud_name, apiKey: api_key, secret: api_secret };
}

function ticketFor(secret: string, userId: string, id: string, kind: MediaKind, timestamp: number, purpose?: MediaPurpose,
  contributorId?: string,
) {
  const fields = [userId, id, kind, timestamp];
  if (purpose) fields.push(purpose);
  if (contributorId) fields.push(contributorId);
  return createHmac('sha256', secret).update(JSON.stringify(fields)).digest();
}

function folderFor(kind: MediaKind, purpose?: MediaPurpose) {
  if (purpose === 'profile') return `${imageFolder}/Profiles`;
  return purpose === 'contributor' ? `${imageFolder}/Contributors` : kind === 'image' ? imageFolder : undefined;
}

export function signMediaUpload(userId: string, kind: MediaKind, bytes: number, purpose?: MediaPurpose, contributorId?: string) {
  const { formats, maxBytes } = mediaRules[kind];
  if (bytes > maxBytes) throw new RequestError(400, `This ${kind} exceeds the ${maxBytes / 1024 ** 2} MB upload limit.`);
  const { cloudName, apiKey, secret } = configure();
  const id = `kk_${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = folderFor(kind, purpose);
  const params = {
    allowed_formats: formats.join(','),
    ...(folder ? { folder } : {}),
    overwrite: 'false',
    public_id: id,
    timestamp: String(timestamp),
    type: 'authenticated',
  };
  return {
    id,
    timestamp,
    ticket: ticketFor(secret, userId, id, kind, timestamp, purpose, contributorId).toString('hex'),
    endpoint: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${kind}/upload`,
    fields: { ...params, api_key: apiKey, signature: cloudinary.utils.api_sign_request(params, secret) },
  };
}

export async function confirmMediaUpload(userId: string, upload: Completion): Promise<MediaAsset> {
  const { id, kind, name, timestamp, ticket, purpose, contributorId } = upload;
  const { secret } = configure();
  const age = Math.floor(Date.now() / 1000) - timestamp;
  if (age < 0 || age >= ticketLifetime || !timingSafeEqual(ticketFor(secret, userId, id, kind, timestamp, purpose, contributorId), Buffer.from(ticket, 'hex'))) {
    throw new RequestError(403, 'The upload ticket is invalid or expired. Upload the file again.');
  }
  let resource: unknown;
  const folder = folderFor(kind, purpose);
  const publicId = folder ? `${folder}/${id}` : id;
  try {
    resource = await cloudinary.api.resource(publicId, { resource_type: kind, type: 'authenticated', timeout: 8000 });
  } catch (error) {
    const failure = error as { http_code?: number; error?: { http_code?: number } };
    if ((failure.http_code ?? failure.error?.http_code) === 404) {
      throw new RequestError(422, 'Cloudinary could not locate the uploaded file.');
    }
    throw new RequestError(502, 'Cloudinary could not verify the uploaded file. Try again.');
  }
  const checked = resourceData.safeParse(resource);
  const { formats, maxBytes } = mediaRules[kind];
  if (!checked.success || checked.data.public_id !== publicId || checked.data.resource_type !== kind ||
      !formats.includes(checked.data.format) || checked.data.bytes > maxBytes) {
    throw new RequestError(422, 'The uploaded asset does not match the supported file types or size limit.');
  }
  const { format, version, bytes, created_at: createdAt } = checked.data;
  return {
    id, publicId, kind, purpose, contributorId, ownerId: purpose === 'profile' || contributorId ? userId : undefined,
    name, format, version, bytes, createdAt,
  };
}

export function mediaDeliveryUrl(asset: MediaAsset) {
  configure();
  return cloudinary.url(asset.publicId ?? asset.id, {
    secure: true, resource_type: asset.kind, type: 'authenticated',
    sign_url: true, version: asset.version, format: asset.format,
  });
}

export async function destroyMedia(asset: MediaAsset) {
  configure();
  const failure = () => new RequestError(502, 'Cloudinary could not confirm deletion. Try again.');
  let result: { result?: string };
  const options = { resource_type: asset.kind, type: 'authenticated' as const, invalidate: true, timeout: 8000 };
  try {
    result = await cloudinary.uploader.destroy(asset.publicId ?? asset.id, options);
  } catch {
    throw failure();
  }
  if (result.result !== 'ok' && result.result !== 'not found') throw failure();
}
