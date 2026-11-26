export type Author = {
  id: string;
  name: string;
  nameMalayalam?: string;
  role: string;
  bio: string;
  photo: string;
  photoAssetId?: string;
  email?: string;
  accountId?: string;
};
export const contributorNameLanguages = ["en", "ml"] as const;
export type ContributorNameLanguage = (typeof contributorNameLanguages)[number];

export function contributorName(
  { name, nameMalayalam }: Pick<Author, "name" | "nameMalayalam">,
  language: ContributorNameLanguage = "en",
) {
  const english = name?.trim() ?? "";
  const malayalam = nameMalayalam?.trim() ?? "";
  return language === "ml" ? malayalam || english : english || malayalam;
}

export type Block = {
  id: string;
  type: "heading" | "paragraph" | "image" | "video" | "quote";
  text: string;
  src?: string;
  assetId?: string;
};
export type MediaKind = "image" | "video";
export type MediaPurpose = "contributor" | "profile";
export type MediaAsset = {
  id: string;
  publicId?: string;
  kind: MediaKind;
  purpose?: MediaPurpose;
  ownerId?: string;
  contributorId?: string;
  deletion?: "pending" | "done";
  replacedPhoto?: boolean;
  name: string;
  format: string;
  version: number;
  bytes: number;
  createdAt: string;
};
export function mediaUrl(id: string) {
  return `/api/media/${encodeURIComponent(id)}`;
}

export function nameInitial(name: string) {
  const letter = name.match(/\p{L}\p{M}*/u)?.[0];
  return letter?.toUpperCase().match(/^\p{L}\p{M}*/u)?.[0] ?? "?";
}

export function blockSource({ assetId, src }: Pick<Block, "assetId" | "src">) {
  return assetId ? mediaUrl(assetId) : src;
}
export const templates = [
  "Cover",
  "Feature",
  "Editorial",
  "Gallery",
  "Minimal",
] as const;
export type PageContent = {
  id: string;
  title: string;
  template: (typeof templates)[number];
  authors: string[];
  contributorNameLanguage?: ContributorNameLanguage;
  backgroundColor?: string;
  backgroundImage?: Pick<Block, "src" | "assetId">;
  textColor?: string;
  backgroundClass?: string;
  blocks: Block[];
};
export function pageContributorNames(
  page: Pick<PageContent, "authors" | "contributorNameLanguage">,
  authorsById: ReadonlyMap<string, Pick<Author, "name" | "nameMalayalam">>,
) {
  return page.authors
    .map((id) => {
      const author = authorsById.get(id);
      return author && contributorName(author, page.contributorNameLanguage);
    })
    .filter(Boolean)
    .join(", ");
}
export type PageStatus = "Draft" | "In review" | "Approved" | "Published";
export type Page = PageContent & { status: PageStatus };
export type Magazine = {
  title: string;
  description: string;
  cover: string;
  pages: PageContent[];
};
export type ReaderPageSummary = Pick<PageContent, "id" | "title"> & {
  thumbnail?: string;
  authorNames?: string;
  status?: PageStatus;
};
export type ReaderMagazine = Pick<Magazine, "title" | "cover"> & {
  pages: ReaderPageSummary[];
};
type AuthorThumbnail = { photoThumbnail?: string };
export type ReaderAuthor = Pick<
  Author,
  "id" | "name" | "nameMalayalam" | "role" | "photo" | "photoAssetId"
> & AuthorThumbnail;
export type ReaderPage = {
  page: PageContent;
  authors: ReaderAuthor[];
};
export const magazineName = "മൊഴി";
export const defaultCoverHeading = "കരിയാത്തൻ കാവിൽ മാസിക";
export function magazineCoverId(pages: readonly PageContent[]) {
  const first = pages[0];
  if (first && (first.template === "Cover" || first.id === "p1"))
    return first.id;
}
export type EditorialPage = Page & { version: number; reviewNote?: string };
export const roles = ["Admin", "Editor", "Reviewer", "Publisher"] as const;
export const minimumPasswordLength = 8;
export type Role = (typeof roles)[number];
export type UserProfile = {
  credit: string;
  bio: string;
  photo: string;
  photoAssetId?: string;
};
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  profile?: UserProfile;
  contributorId?: string;
};
export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: number;
};

export const permissions = {
  edit: (role: Role) => role === "Admin" || role === "Editor",
  uploadMedia: (role: Role, purpose?: MediaPurpose) =>
    purpose === "profile" || role === "Admin" || role === "Editor",
  editPage: (role: Role, cover: boolean) =>
    role === "Admin" || (role === "Editor" && !cover),
  review: (role: Role) => role === "Admin" || role === "Reviewer",
  publish: (role: Role) => role === "Admin" || role === "Publisher",
  manageUsers: (role: Role) => role === "Admin",
};

export type Workspace = {
  user: User;
  pages: EditorialPage[];
  authors: (Author & AuthorThumbnail)[];
  users: User[];
  browserDraftsImported: boolean;
  media: MediaAsset[];
  uploadsEnabled: boolean;
};

export const initialAuthors: Author[] = [];
export const initialMagazine: Magazine = {
  title: magazineName,
  description:
    "A collection of thoughtful stories on culture, travel, design and the beautiful details of everyday life.",
  cover:
    "https://res.cloudinary.com/wv3nteri/image/upload/v1795453645/1000720859.jpg",
  pages: [],
};
