import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cloudinaryConfigured, destroyMedia } from "./cloud-media";
import {
  newContributorId,
  newUserInput,
  type ProfileCommand,
  type Transition,
  type WorkspaceCommand,
} from "./commands";
import { RequestError } from "./errors";
import {
  blockSource,
  defaultCoverHeading,
  initialMagazine,
  magazineCoverId,
  permissions,
  type Author,
  type ContactMessage,
  type MediaAsset,
  type PageContent,
  type ReaderMagazine,
  type ReaderPage,
  type User,
  type Workspace,
} from "./data";
import { useMongo } from "./mongo";
import type { Account, MagazineState, Repository } from "./repository";

export { RequestError };
export const sessionLifetime = 60 * 60 * 12;
export const sessionCookie = "kk_session";

function access<T>(
  write: boolean,
  operation: (db: Repository) => Promise<T>,
): Promise<T> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri)
    throw new Error(
      "MONGODB_URI is required. Set it in the server environment and restart the app.",
    );
  return useMongo(uri, write, operation);
}

function withCurrentCoverHeading<T extends PageContent>(page: T): T {
  if (page.id !== "p1" || page.template !== "Cover" || page.title !== "Cover")
    return page;
  const heading = page.blocks.find(
    (block) => block.id === "b1" && block.type === "heading",
  );
  if (heading?.text.toLowerCase() !== "the art of living") return page;

  // Update the starter title for existing installs while keeping stored publication history intact.
  return {
    ...page,
    blocks: page.blocks.map((block) =>
      block === heading ? { ...block, text: defaultCoverHeading } : block,
    ),
  };
}

export function publicMagazine() {
  return access(false, async (db) => {
    const [index, first] = await Promise.all([
      db.publishedIndex(),
      db.publishedPage(),
    ]);
    const { title, cover } = initialMagazine;
    const magazine: ReaderMagazine = {
      title,
      cover,
      pages: index.map(({ id, title, template, image }) => ({
        id,
        title,
        thumbnail:
          (image && blockSource(image)) ||
          (template === "Cover" ? cover : undefined),
      })),
    };
    const firstId = index[0]?.id;
    const page =
      firstId &&
      (first?.id === firstId ? first : await db.publishedPage(firstId));
    return { magazine, initialPage: page ? await readerPage(db, page) : null };
  });
}

async function readerPage(
  db: Repository,
  page: PageContent,
): Promise<ReaderPage> {
  const authors = page.authors.length ? await db.authors(page.authors) : [];
  return {
    page: withCurrentCoverHeading(page),
    authors: authors.map(({ id, name }) => ({ id, name })),
  };
}

export function publicReaderPage(id: string) {
  return access(false, async (db) => {
    const page = await db.publishedPage(id);
    return page ? readerPage(db, page) : null;
  });
}

function publicAuthor({
  email: _email,
  accountId: _accountId,
  ...author
}: Author) {
  return author;
}

function passwordHash(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function matchesPassword(password: string, stored: string) {
  const actual = passwordHash(password, stored.split(":")[0]);
  return timingSafeEqual(Buffer.from(stored), Buffer.from(actual));
}

function recordPasswordFailure(db: Repository, account: Account, now: number) {
  const failures = account.failures + 1;
  return db.setFailures(
    account.id,
    failures >= 8 ? 0 : failures,
    failures >= 8 ? now + 5 * 60_000 : 0,
  );
}

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function newAccount({
  password,
  ...account
}: Omit<Account, "id" | "failures" | "lockedUntil">): Account {
  return {
    ...account,
    id: randomUUID(),
    password: passwordHash(password),
    failures: 0,
    lockedUntil: 0,
  };
}

async function bootstrapAdmin(db: Repository) {
  if (await db.hasAccounts()) return;
  const admin = newUserInput.safeParse({
    name: process.env.KK_ADMIN_NAME || "Administrator",
    email: process.env.KK_ADMIN_EMAIL,
    password: process.env.KK_ADMIN_PASSWORD,
    role: "Admin",
  });
  if (admin.success) await db.addAccount(newAccount(admin.data));
}

export function login(email: string, password: string) {
  return access(true, async (db) => {
    await bootstrapAdmin(db);
    const user = await db.accountByEmail(email);
    const now = Date.now();
    if (user && user.lockedUntil > now) return null;
    const stored =
      user?.password ?? `00000000000000000000000000000000:${"0".repeat(128)}`;
    if (!matchesPassword(password, stored) || !user) {
      if (user) await recordPasswordFailure(db, user, now);
      return null;
    }
    const token = randomBytes(32).toString("hex");
    if (user.failures || user.lockedUntil) await db.setFailures(user.id, 0, 0);
    await db.addSession(
      {
        token: tokenHash(token),
        userId: user.id,
        expires: now + sessionLifetime * 1000,
      },
      now,
    );
    return token;
  });
}

async function findSession(token: string | undefined, db: Repository) {
  if (!token) return;
  return db.sessionUser(tokenHash(token), Date.now());
}

export async function sessionUser(token?: string) {
  if (token) return access(false, (db) => findSession(token, db));
}

export async function endSession(token?: string) {
  if (token) await access(true, (db) => db.removeSession(tokenHash(token)));
}

function withContributorProfile(user: User, contributor?: Author): User {
  if (!contributor) return user;
  const { id, role, bio, photo, photoAssetId } = contributor;
  return {
    ...user,
    contributorId: id,
    profile: { credit: role, bio, photo, photoAssetId },
  };
}

export async function updateProfile(
  token: string | undefined,
  command: ProfileCommand,
): Promise<User> {
  if (!token)
    throw new RequestError(401, "Your session expired. Log in again.");
  const result = await access(true, async (db) => {
    const user = await findSession(token, db);
    if (!user)
      throw new RequestError(401, "Your session expired. Log in again.");
    const contributor = await db.authorByAccount(user.id);
    const current = withContributorProfile(user, contributor);
    if (command.action === "rename") {
      await db.updateAccountIdentity(user.id, { name: command.name });
      return { user: { ...current, name: command.name } };
    }
    if (command.action === "updateDetails") {
      const { name, credit, bio, photo, photoAssetId } = command;
      await validateAuthorPhoto(
        db,
        command,
        current.profile?.photoAssetId,
        user.id,
      );
      const profile = { credit, bio, photo, photoAssetId };
      await db.updateAccountIdentity(user.id, { name, profile });
      if (contributor) {
        await db.updateAuthor({
          ...contributor,
          name: name === user.name ? contributor.name : name,
          role: credit,
          bio,
          photo,
          photoAssetId,
        });
      }
      const cleanup = await reserveReplacedPhotos(db, {
        selectedId: photoAssetId,
        contributorId: contributor?.id,
        previousContributorPhoto: contributor?.photoAssetId,
        previousIds: [user.profile?.photoAssetId, contributor?.photoAssetId],
      });
      return { user: { ...current, name, profile }, cleanup };
    }

    const account = await db.accountById(user.id);
    if (!account)
      throw new RequestError(401, "Your session expired. Log in again.");
    const now = Date.now();
    if (account.lockedUntil > now)
      throw new RequestError(
        429,
        "Too many attempts. Try again in a few minutes.",
      );
    if (!matchesPassword(command.currentPassword, account.password)) {
      await recordPasswordFailure(db, account, now);
      // Return the error so the transaction commits the failed attempt.
      return new RequestError(400, "Current password is incorrect.");
    }
    await db.changePassword(
      user.id,
      passwordHash(command.newPassword),
      tokenHash(token),
    );
    return { user: current };
  });
  if (result instanceof RequestError) throw result;
  if (result.cleanup) await cleanReplacedPhotos(result.cleanup);
  return result.user;
}

async function readWorkspace(user: User, db: Repository): Promise<Workspace> {
  const state = await db.magazine();
  const contributorPhotos = new Set(
    state.authors.map((author) => author.photoAssetId),
  );
  return {
    user: withContributorProfile(
      user,
      state.authors.find((author) => author.accountId === user.id),
    ),
    authors: permissions.manageUsers(user.role)
      ? state.authors
      : state.authors.map(publicAuthor),
    pages: state.pages.map(({ published: _published, ...page }) =>
      withCurrentCoverHeading(page),
    ),
    browserDraftsImported: Boolean(state.imported),
    users: permissions.manageUsers(user.role) ? await db.listAccounts() : [],
    media: (await db.listMedia()).filter(
      (asset) =>
        !asset.purpose &&
        !asset.replacedPhoto &&
        !contributorPhotos.has(asset.id),
    ),
    uploadsEnabled: cloudinaryConfigured(),
  };
}

export function workspace(user: User) {
  return access(false, (db) => readWorkspace(user, db));
}

function requirePermission(allowed: boolean) {
  if (!allowed)
    throw new RequestError(403, "Your role cannot perform this action.");
}

function pageAtVersion(state: MagazineState, id: string, version: number) {
  const page = state.pages.find((page) => page.id === id);
  if (!page) throw new RequestError(404, "Page not found.");
  if (page.version !== version) {
    throw new RequestError(
      409,
      "This page changed in another session. Return to the page list to reload it.",
    );
  }
  return page;
}

const transitions = {
  revise: { from: "Published", to: "Draft", permission: "edit" },
  submit: { from: "Draft", to: "In review", permission: "edit" },
  return: { from: "In review", to: "Draft", permission: "review" },
  approve: { from: "In review", to: "Approved", permission: "review" },
  publish: { from: "Approved", to: "Published", permission: "publish" },
} as const satisfies Record<
  Transition,
  { from: string; to: string; permission: keyof typeof permissions }
>;

function applyMagazineCommand(
  state: MagazineState,
  user: User,
  command: Exclude<
    WorkspaceCommand,
    {
      action:
        | "createUser"
        | "changeRole"
        | "deleteUser"
        | "editAuthor"
        | "movePage"
        | "deletePage";
    }
  >,
) {
  switch (command.action) {
    case "createPage":
      requirePermission(permissions.edit(user.role));
      if (state.pages.some((page) => page.id === command.page.id))
        throw new RequestError(409, "That page already exists.");
      state.pages.push({ ...command.page, status: "Draft", version: 1 });
      break;
    case "savePage": {
      requirePermission(permissions.edit(user.role));
      const page = pageAtVersion(state, command.page.id, command.version);
      const cover = page.id === magazineCoverId(state.pages);
      requirePermission(permissions.editPage(user.role, cover));
      if (page.status !== "Draft")
        throw new RequestError(409, "Only drafts can be edited.");
      if (cover && command.page.template !== "Cover") {
        throw new RequestError(409, "The cover must use the Cover template.");
      }
      Object.assign(page, command.page, { version: page.version + 1 });
      break;
    }
    case "transition": {
      const transition = transitions[command.step];
      requirePermission(permissions[transition.permission](user.role));
      const page = pageAtVersion(state, command.id, command.version);
      const cover = page.id === magazineCoverId(state.pages);
      if (transition.permission === "edit")
        requirePermission(permissions.editPage(user.role, cover));
      const reopenCover =
        cover &&
        command.step === "revise" &&
        (page.status === "In review" || page.status === "Approved");
      if (page.status !== transition.from && !reopenCover)
        throw new RequestError(
          409,
          "This action is unavailable for the current page status.",
        );
      if (command.step === "return" && !command.note)
        throw new RequestError(
          400,
          "Add a note explaining the changes needed.",
        );
      if (command.step === "publish") {
        const { id, title, template, authors, blocks } =
          withCurrentCoverHeading(page);
        page.published = { id, title, template, authors, blocks };
      }
      page.status = transition.to;
      page.version += 1;
      page.reviewNote = command.step === "return" ? command.note : undefined;
      break;
    }
    case "addAuthor":
      requirePermission(permissions.edit(user.role));
      if (command.author.email)
        requirePermission(permissions.manageUsers(user.role));
      if (state.authors.some((author) => author.id === command.id)) {
        throw new RequestError(409, "This contributor already exists.");
      }
      state.authors.push({ ...command.author, id: command.id ?? randomUUID() });
      break;
    case "importDrafts": {
      requirePermission(permissions.manageUsers(user.role));
      if (state.imported)
        throw new RequestError(
          409,
          "Browser drafts have already been imported.",
        );
      for (const author of command.authors) {
        if (!state.authors.some((existing) => existing.id === author.id))
          state.authors.push(author);
      }
      for (const savedPage of command.pages) {
        const page = withCurrentCoverHeading(savedPage);
        const seed = initialMagazine.pages.find(
          (existing) => existing.id === page.id,
        );
        if (seed && JSON.stringify(seed) === JSON.stringify(page)) continue;
        const id = state.pages.some((existing) => existing.id === page.id)
          ? randomUUID()
          : page.id;
        state.pages.push({ ...page, id, status: "Draft", version: 1 });
      }
      state.imported = true;
      break;
    }
  }
}

async function validateMedia(db: Repository, pages: PageContent[]) {
  const references = new Map<string, string>();
  for (const { blocks } of pages) {
    for (const block of blocks) {
      if (!block.assetId) continue;
      if (block.src || (block.type !== "image" && block.type !== "video")) {
        throw new RequestError(
          400,
          "Attach a library asset to a matching image or video block.",
        );
      }
      const otherType = references.get(block.assetId);
      if (otherType && otherType !== block.type) {
        throw new RequestError(
          400,
          "Attach a library asset to a matching image or video block.",
        );
      }
      references.set(block.assetId, block.type);
    }
  }
  for (const [id, type] of references) {
    const asset = await db.media(id);
    if (asset?.kind !== type || asset.purpose || asset.deletion)
      throw new RequestError(
        400,
        "That media asset is unavailable for this block.",
      );
  }
}

async function validateAuthorPhoto(
  db: Repository,
  { photo, photoAssetId }: Pick<Author, "photo" | "photoAssetId">,
  existingId?: string,
  ownerId?: string,
) {
  if (!photoAssetId) return;
  const asset = await db.media(photoAssetId);
  if (photo || asset?.kind !== "image" || asset.deletion) {
    throw new RequestError(
      400,
      "Choose a photo URL or an available uploaded image.",
    );
  }
  if (photoAssetId === existingId) return asset;
  const allowed = ownerId
    ? asset.purpose === "profile" && asset.ownerId === ownerId
    : asset.purpose !== "profile";
  if (!allowed)
    throw new RequestError(
      400,
      "Choose one of your uploaded profile photos or a photo URL.",
    );
  return asset;
}

export async function runCommand(
  token: string | undefined,
  command: WorkspaceCommand,
) {
  const result = await access(true, async (db) => {
    const user = await findSession(token, db);
    if (!user)
      throw new RequestError(401, "Your session expired. Log in again.");
    let cleanup: MediaAsset[] | undefined;
    if (command.action === "createUser") {
      requirePermission(permissions.manageUsers(user.role));
      const account = command.user;
      if (await db.accountByEmail(account.email)) {
        throw new RequestError(
          409,
          "An account with this email already exists.",
        );
      }
      await db.addAccount(newAccount(account));
    } else if (command.action === "deleteUser") {
      requirePermission(permissions.manageUsers(user.role));
      const account = await db.accountById(command.id);
      if (!account) throw new RequestError(404, "Account not found.");
      if (account.role === "Admin")
        throw new RequestError(
          403,
          "Administrator accounts are protected from deletion.",
        );
      await db.deleteAccount(account.id);
    } else if (command.action === "changeRole") {
      requirePermission(permissions.manageUsers(user.role));
      const account = await db.accountById(command.id);
      if (!account) throw new RequestError(404, "Account not found.");
      if (account.role === "Admin" && command.role !== "Admin") {
        const admins = (await db.listAccounts()).filter(
          (account) => account.role === "Admin",
        );
        if (admins.length === 1)
          throw new RequestError(409, "Keep at least one administrator.");
      }
      await db.changeRole(command.id, command.role);
      if (command.id === user.id) user.role = command.role;
    } else if (command.action === "editAuthor") {
      requirePermission(permissions.manageUsers(user.role));
      const { id, author, accountId, newPassword } = command;
      const [existing] = await db.authors([id]);
      if (!existing) throw new RequestError(404, "Contributor not found.");
      await validateAuthorPhoto(db, author, existing.photoAssetId);
      if (accountId) {
        if (!author.email)
          throw new RequestError(400, "Enter an email for the linked login.");
        const account = await db.accountById(accountId);
        if (!account) throw new RequestError(404, "Linked account not found.");
        if (
          (await db.authors()).some(
            (author) => author.id !== id && author.accountId === accountId,
          )
        ) {
          throw new RequestError(
            409,
            "That login is already linked to another contributor.",
          );
        }
        const owner = await db.accountByEmail(author.email);
        if (owner && owner.id !== accountId)
          throw new RequestError(
            409,
            "An account with this email already exists.",
          );
        const name = author.name === existing.name ? account.name : author.name;
        const profile = account.profile;
        const replacesSharedPhoto =
          existing.accountId === accountId &&
          profile?.photoAssetId &&
          profile.photoAssetId === existing.photoAssetId &&
          author.photoAssetId !== existing.photoAssetId;
        await db.updateAccountIdentity(accountId, {
          name,
          email: author.email,
          ...(profile &&
            replacesSharedPhoto && {
              profile: {
                ...profile,
                photo: author.photo,
                photoAssetId: author.photoAssetId,
              },
            }),
        });
        if (newPassword) {
          const currentSession =
            accountId === user.id && token ? tokenHash(token) : undefined;
          await db.changePassword(
            accountId,
            passwordHash(newPassword),
            currentSession,
          );
        }
        if (accountId === user.id) {
          user.name = name;
          user.email = author.email;
        }
      } else if (newPassword) {
        throw new RequestError(
          400,
          "Link a login account to reset its password.",
        );
      }
      await db.updateAuthor({
        ...author,
        id,
        accountId: accountId ?? undefined,
      });
      cleanup = await reserveReplacedPhotos(db, {
        selectedId: author.photoAssetId,
        contributorId: id,
        previousContributorPhoto: existing.photoAssetId,
        previousIds: [existing.photoAssetId],
      });
    } else if (command.action === "movePage") {
      requirePermission(permissions.edit(user.role));
      const { id, targetId, placement } = command;
      const { pages } = await db.magazine();
      const positions = new Map(
        pages.map((page, position) => [page.id, position]),
      );
      if (!positions.has(id) || !positions.has(targetId))
        throw new RequestError(404, "Page not found.");
      if (id !== targetId) {
        const cover = magazineCoverId(pages);
        if (id === cover || (targetId === cover && placement === "before")) {
          throw new RequestError(409, "The cover must stay first.");
        }
        const order = pages
          .map((page) => page.id)
          .filter((pageId) => pageId !== id);
        order.splice(
          order.indexOf(targetId) + (placement === "after" ? 1 : 0),
          0,
          id,
        );
        await db.setPagePositions(
          order
            .map((id, position) => ({ id, position }))
            .filter(({ id, position }) => positions.get(id) !== position),
        );
      }
    } else if (command.action === "deletePage") {
      requirePermission(permissions.edit(user.role));
      const state = await db.magazine();
      const page = pageAtVersion(state, command.id, command.version);
      if (page.id === magazineCoverId(state.pages))
        throw new RequestError(
          409,
          "The magazine cover must stay in the magazine.",
        );
      const index = state.pages.indexOf(page);
      await db.deletePage(page.id);
      await db.setPagePositions(
        state.pages
          .slice(index + 1)
          .map(({ id }, offset) => ({ id, position: index + offset })),
      );
    } else {
      const state = await db.magazine();
      const versions = new Map(
        state.pages.map((page) => [page.id, page.version]),
      );
      const authorCount = state.authors.length;
      applyMagazineCommand(state, user, command);
      const pages = state.pages
        .map((page, position) => ({ page, position }))
        .filter(({ page }) => versions.get(page.id) !== page.version);
      await validateMedia(
        db,
        pages.map(({ page }) => page),
      );
      const authors = state.authors.slice(authorCount);
      for (const author of authors) {
        const asset = await validateAuthorPhoto(db, author);
        if (
          command.action === "addAuthor" &&
          asset?.purpose === "contributor" &&
          asset.contributorId &&
          (asset.contributorId !== author.id || asset.ownerId !== user.id)
        ) {
          throw new RequestError(
            400,
            "Choose a photo uploaded for this contributor.",
          );
        }
      }
      const published =
        command.action === "transition" && command.step === "publish"
          ? pages[0]?.page
          : undefined;
      await db.saveMagazine(state, {
        pages,
        authors,
        markImported: command.action === "importDrafts",
        revision: published?.published && {
          page: published.published,
          version: published.version,
          publishedAt: new Date().toISOString(),
          publishedBy: user.id,
        },
      });
      if (command.action === "addAuthor") {
        const [author] = authors;
        cleanup = await reserveReplacedPhotos(db, {
          selectedId: author.photoAssetId,
          contributorId: author.id,
          ownerId: user.id,
        });
      }
    }
    return { workspace: await readWorkspace(user, db), cleanup };
  });
  if (result.cleanup) await cleanReplacedPhotos(result.cleanup);
  return result.workspace;
}

async function checkContributorPhoto(
  db: Repository,
  user: User,
  contributorId: string,
) {
  if ((await db.authors([contributorId])).length) {
    requirePermission(permissions.manageUsers(user.role));
  } else if (!newContributorId.safeParse(contributorId).success) {
    throw new RequestError(404, "Contributor not found.");
  }
}

export function authorizeContributorPhoto(user: User, contributorId: string) {
  return access(false, (db) => checkContributorPhoto(db, user, contributorId));
}

export function registerMedia(token: string | undefined, asset: MediaAsset) {
  return access(true, async (db) => {
    const user = await findSession(token, db);
    if (!user)
      throw new RequestError(401, "Your session expired. Log in again.");
    requirePermission(permissions.uploadMedia(user.role, asset.purpose));
    const existing = await db.media(asset.id);
    if (existing?.deletion)
      throw new RequestError(409, "This asset was marked for deletion.");
    if (existing) return existing;
    if (asset.contributorId)
      await checkContributorPhoto(db, user, asset.contributorId);
    const contributor =
      asset.purpose === "profile"
        ? await db.authorByAccount(user.id)
        : undefined;
    const registered = contributor
      ? { ...asset, contributorId: contributor.id }
      : asset;
    await db.addMedia(registered);
    return registered;
  });
}

export async function deleteLibraryImage(
  token: string | undefined,
  id: string,
) {
  const asset = await access(true, async (db) => {
    const user = await findSession(token, db);
    if (!user)
      throw new RequestError(401, "Your session expired. Log in again.");
    requirePermission(permissions.manageUsers(user.role));
    const asset = await db.media(id);
    if (!asset || asset.deletion === "done") return;
    if (asset.kind !== "image" || asset.purpose)
      throw new RequestError(404, "Library image not found.");
    if (await db.mediaIsInUse(id)) {
      throw new RequestError(
        409,
        "This image is still used by a page, profile, or contributor.",
      );
    }
    // Block new references while the remote deletion is in progress.
    await db.markMediaDeleting(id);
    return asset;
  });
  if (asset) await finishMediaDeletion(asset);
}

async function reserveReplacedPhotos(
  db: Repository,
  {
    selectedId,
    contributorId,
    ownerId,
    previousContributorPhoto,
    previousIds = [],
  }: {
    selectedId?: string;
    contributorId?: string;
    ownerId?: string;
    previousContributorPhoto?: string;
    previousIds?: (string | undefined)[];
  },
) {
  const candidates = new Set(previousIds);
  if (contributorId) {
    if (selectedId) await db.assignMediaContributor(selectedId, contributorId);
    if (previousContributorPhoto && previousContributorPhoto !== selectedId) {
      await db.assignMediaContributor(previousContributorPhoto, contributorId);
    }
    for (const photo of await db.contributorPhotos(contributorId, ownerId))
      candidates.add(photo.id);
  }
  const cleanup = new Map<string, MediaAsset>();
  for (const id of candidates) {
    if (!id || id === selectedId) continue;
    const asset = await db.media(id);
    if (
      asset?.kind !== "image" ||
      asset.deletion ||
      (await db.mediaIsInUse(id))
    )
      continue;
    await db.markMediaDeleting(id, true);
    cleanup.set(id, asset);
  }
  for (const asset of await db.pendingPhotoDeletions())
    cleanup.set(asset.id, asset);
  return [...cleanup.values()];
}

async function cleanReplacedPhotos(assets: MediaAsset[]) {
  await Promise.all(
    assets.map(async (asset) => {
      try {
        await finishMediaDeletion(asset);
      } catch {
        // Leave the cleanup pending so the next profile or contributor save can retry.
        console.error("Could not remove replaced Cloudinary photo:", asset.id);
      }
    }),
  );
}

async function finishMediaDeletion(asset: MediaAsset) {
  await destroyMedia(asset);
  // Keep the completed marker so an earlier upload confirmation cannot recreate the record.
  await access(true, (db) => db.markMediaDeleted(asset.id));
}

export function deliverableMedia(id: string, token?: string) {
  return access(false, async (db) => {
    const asset = await db.media(id);
    if (!asset || asset.deletion === "done" || asset.replacedPhoto) return;
    if (asset.purpose === "profile") {
      const user = await findSession(token, db);
      if (user && (asset.ownerId === user.id || (await db.authorUsesPhoto(id))))
        return asset;
      return;
    }
    if ((await db.mediaIsPublished(id)) || (await findSession(token, db)))
      return asset;
  });
}

export function submitContact(input: Omit<ContactMessage, "id" | "createdAt">) {
  return access(true, async (db) => {
    const createdAt = Date.now();
    const recent = createdAt - 10 * 60 * 1000;
    if (
      (await db.countRecentContacts(recent, input.email)) >= 3 ||
      (await db.countRecentContacts(recent)) >= 60
    ) {
      throw new RequestError(
        429,
        "Too many messages. Try again in a few minutes.",
      );
    }
    await db.addContact({ ...input, id: randomUUID(), createdAt });
  });
}

export function contactInbox(token: string | undefined, page: number) {
  return access(false, async (db) => {
    const user = await findSession(token, db);
    if (!user) throw new RequestError(401, "Log in to view reader messages.");
    requirePermission(permissions.manageUsers(user.role));
    const limit = 20;
    const messages = await db.listContacts(page * limit, limit + 1);
    return {
      messages: messages.slice(0, limit),
      hasMore: messages.length > limit,
    };
  });
}
