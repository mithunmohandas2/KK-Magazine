import {
  initialAuthors,
  initialMagazine,
  type Author,
  type Block,
  type ContactMessage,
  type EditorialPage,
  type MediaAsset,
  type PageContent,
  type Role,
  type User,
} from "./data";

export type StoredPage = EditorialPage & { published?: PageContent };
export type MagazineState = {
  pages: StoredPage[];
  authors: Author[];
  imported?: boolean;
};
export type Revision = {
  page: PageContent;
  version: number;
  publishedAt: string;
  publishedBy?: string;
};
export type Account = User & {
  password: string;
  failures: number;
  lockedUntil: number;
};
export type Session = { token: string; userId: string; expires: number };
export type PageIndexEntry = Pick<
  PageContent,
  | "id"
  | "title"
  | "template"
  | "authors"
  | "contributorNameLanguage"
  | "backgroundColor"
  | "backgroundImage"
  | "backgroundClass"
> & { image?: Pick<Block, "src" | "assetId">; status?: EditorialPage["status"] };
export type MagazineChanges = {
  pages: { position: number; page: StoredPage }[];
  authors: Author[];
  markImported: boolean;
  revision?: Revision;
};

export interface Repository {
  magazine(): Promise<MagazineState>;
  pageIndex(edition: "public" | "preview"): Promise<PageIndexEntry[]>;
  publishedPage(id?: string): Promise<PageContent | undefined>;
  editorialPage(id: string): Promise<PageContent | undefined>;
  authors(ids?: string[]): Promise<Author[]>;
  authorByAccount(id: string): Promise<Author | undefined>;
  authorUsesPhoto(id: string): Promise<boolean>;
  authorPhotoIsPublished(id: string): Promise<boolean>;
  updateAuthor(author: Author): Promise<void>;
  deleteAuthor(id: string): Promise<void>;
  saveMagazine(state: MagazineState, changes: MagazineChanges): Promise<void>;
  setPagePositions(pages: { id: string; position: number }[]): Promise<void>;
  deletePage(id: string): Promise<void>;
  accountByEmail(email: string): Promise<Account | undefined>;
  accountById(id: string): Promise<Account | undefined>;
  hasAccounts(): Promise<boolean>;
  listAccounts(): Promise<User[]>;
  addAccount(account: Account): Promise<void>;
  updateAccountIdentity(
    id: string,
    identity: Pick<User, "name"> & Partial<Pick<User, "email" | "profile">>,
  ): Promise<void>;
  changePassword(
    id: string,
    password: string,
    currentSession?: string,
  ): Promise<void>;
  changeRole(id: string, role: Role): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  setFailures(id: string, failures: number, lockedUntil: number): Promise<void>;
  sessionUser(token: string, now: number): Promise<User | undefined>;
  addSession(session: Session, now: number): Promise<void>;
  removeSession(token: string): Promise<void>;
  listMedia(): Promise<MediaAsset[]>;
  mediaByIds(ids: string[]): Promise<MediaAsset[]>;
  media(id: string): Promise<MediaAsset | undefined>;
  addMedia(asset: MediaAsset): Promise<void>;
  assignMediaContributor(id: string, contributorId: string): Promise<void>;
  contributorPhotos(
    contributorId: string,
    ownerId?: string,
  ): Promise<MediaAsset[]>;
  mediaIsInUse(id: string): Promise<boolean>;
  markMediaDeleting(id: string, replacedPhoto?: boolean): Promise<void>;
  pendingPhotoDeletions(): Promise<MediaAsset[]>;
  markMediaDeleted(id: string): Promise<void>;
  mediaIsPublished(id: string): Promise<boolean>;
  countRecentContacts(since: number, email?: string): Promise<number>;
  addContact(message: ContactMessage): Promise<void>;
  deleteContact(id: string): Promise<void>;
  listContacts(offset: number, limit: number): Promise<ContactMessage[]>;
}

export const initialState: MagazineState = {
  authors: initialAuthors,
  pages: initialMagazine.pages.map((page) => ({
    ...page,
    status: "Published",
    version: 1,
    published: page,
  })),
};

export function initialRevisions(state: MagazineState): Revision[] {
  const publishedAt = new Date().toISOString();
  return state.pages.flatMap((page) =>
    page.published
      ? [
          {
            page: page.published,
            version: page.status === "Published" ? page.version : 0,
            publishedAt,
          },
        ]
      : [],
  );
}

export function publicUser({ id, name, email, role, profile }: User): User {
  return { id, name, email, role, profile };
}
