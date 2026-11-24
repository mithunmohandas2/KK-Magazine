import { z } from 'zod';
import { minimumPasswordLength, roles, templates } from './data';

const id = z.string().min(1).max(100);
export const newContributorId = z.uuid();
const title = z.string().trim().min(1).max(200);
const imageUrl = z.url({ protocol: /^https?$/ }).max(2048);
export const mediaId = z.string().regex(/^kk_[a-f0-9-]{36}$/);
const block = z.object({
  id,
  type: z.enum(['heading', 'paragraph', 'image', 'video', 'quote']),
  text: z.string().max(20000),
  src: z.union([imageUrl, z.literal('')]).optional(),
  assetId: mediaId.optional(),
});
const page = z.object({
  id,
  title,
  template: z.enum(templates),
  authors: z.array(id).max(100),
  blocks: z.array(block).max(100),
});
const email = z.email().trim().max(254).toLowerCase();
const author = z.object({
  name: title,
  role: z.string().trim().max(200),
  bio: z.string().trim().max(2000),
  photo: z.union([imageUrl, z.literal('')]),
  photoAssetId: mediaId.optional(),
  email: z.union([email, z.literal('')]).optional(),
});
const version = z.number().int().min(1);
const password = z.string().min(minimumPasswordLength).max(128);

export const signInInput = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const newUserInput = z.object({ name: title, email, password, role: z.enum(roles) });

export const profileCommand = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('rename'), name: title }),
  z.strictObject({
    action: z.literal('updateDetails'), name: title,
    credit: author.shape.role, bio: author.shape.bio,
    photo: author.shape.photo, photoAssetId: author.shape.photoAssetId,
  }),
  z.strictObject({ action: z.literal('changePassword'), currentPassword: signInInput.shape.password, newPassword: password }),
]);
export type ProfileCommand = z.infer<typeof profileCommand>;

const uploadKind = z.enum(['image', 'video']);
const purpose = z.enum(['contributor', 'profile']).optional();
const contributorId = id.optional();
export const uploadCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sign'), kind: uploadKind, purpose, contributorId, bytes: z.number().int().positive() }),
  z.object({
    action: z.literal('complete'), kind: uploadKind, purpose, contributorId, id: mediaId, name: title,
    timestamp: z.number().int().positive(), ticket: z.string().regex(/^[a-f0-9]{64}$/),
  }),
]).refine(upload => (!upload.purpose || upload.kind === 'image') &&
  (!upload.contributorId || upload.purpose === 'contributor'));

export const workspaceCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('createPage'), page }),
  z.object({ action: z.literal('savePage'), page, version }),
  z.object({ action: z.literal('deletePage'), id, version }),
  z.object({ action: z.literal('movePage'), id, targetId: id, placement: z.enum(['before', 'after']) }),
  z.object({
    action: z.literal('transition'),
    id,
    version,
    step: z.enum(['revise', 'submit', 'return', 'approve', 'publish']),
    note: z.string().trim().max(2000).optional(),
  }),
  z.object({ action: z.literal('addAuthor'), author, id: newContributorId.optional() }),
  z.object({
    action: z.literal('editAuthor'), id, author,
    accountId: id.nullable(), newPassword: password.optional(),
  }),
  z.object({ action: z.literal('createUser'), user: newUserInput }),
  z.object({ action: z.literal('changeRole'), id, role: z.enum(roles) }),
  z.object({ action: z.literal('deleteUser'), id }),
  z.object({
    action: z.literal('importDrafts'),
    pages: z.array(page).max(250),
    authors: z.array(author.extend({ id })).max(250),
  }),
]);

export type WorkspaceCommand = z.infer<typeof workspaceCommand>;
export type Transition = Extract<WorkspaceCommand, { action: 'transition' }>['step'];
