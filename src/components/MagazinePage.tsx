import {
  blockSource,
  contributorName,
  magazineName,
  mediaUrl,
  type Block,
  type PageContent,
  type ReaderAuthor,
} from "@/lib/data";
import type { CSSProperties, ReactNode } from "react";
import { backgroundClassTokens, isBackgroundClass } from "@/lib/page-background";
import ImageMaximize from "./ImageMaximize";
import ResponsiveImage from "./ResponsiveImage";
import YouTubePlayer from "./YouTubePlayer";

const pageImageSizes =
  "(max-width: 750px) 90vw, (max-width: 1100px) 640px, 84vw";
const featureImageSizes =
  "(max-width: 750px) 90vw, (max-width: 1100px) 640px, 46vw";

function contentLanguage(text: string) {
  return /^\P{L}*\p{Script=Malayalam}/u.test(text) ? "ml" : undefined;
}

function backgroundInk(color: string | undefined) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return;
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.179 ? "#111" : "#fff";
}

function youtubeVideoId(block: Block) {
  if (block.type !== "video" || block.assetId || !block.src) return;
  let url: URL;
  try {
    url = new URL(block.src);
  } catch {
    return;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return;

  const [, path, segment] = url.pathname.split("/");
  const host = url.hostname;
  let id: string | null | undefined;
  if (host === "youtu.be") {
    id = path;
  } else if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
  ) {
    if (path === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live"].includes(path)) id = segment;
  } else if (
    ["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host) &&
    path === "embed"
  ) {
    id = segment;
  }
  if (id && /^[\w-]{11}$/.test(id)) return id;
}

function ContentBlock({
  block,
  firstHeading,
  sizes = pageImageSizes,
  highPriority,
  autoplay,
}: {
  block: Block;
  firstHeading?: boolean;
  sizes?: string;
  highPriority?: boolean;
  autoplay?: boolean;
}) {
  const src = blockSource(block);
  const lang = contentLanguage(block.text);
  switch (block.type) {
    case "heading":
      return firstHeading ? (
        <h1 lang={lang}>{block.text}</h1>
      ) : (
        <h2 lang={lang}>{block.text}</h2>
      );
    case "image":
      return src ? (
        <figure lang={lang}>
          <div className="content-image">
            <ResponsiveImage
              src={src}
              alt={block.text}
              sizes={sizes}
              highPriority={highPriority}
            />
            <ImageMaximize src={src} description={block.text.trim() || "image"} />
          </div>
          {block.text && <figcaption>{block.text}</figcaption>}
        </figure>
      ) : null;
    case "video": {
      const videoId = youtubeVideoId(block);
      const title = block.text || "Magazine video";
      return src ? (
        <figure lang={lang}>
          {videoId ? (
            <YouTubePlayer
              key={videoId}
              videoId={videoId}
              title={title}
              autoplay={Boolean(autoplay)}
            />
          ) : (
            <video src={src} controls preload="none" aria-label={title} />
          )}
          {block.text && <figcaption>{block.text}</figcaption>}
        </figure>
      ) : null;
    }
    case "quote":
      return <blockquote lang={lang}>{block.text}</blockquote>;
    default:
      return <p lang={lang}>{block.text}</p>;
  }
}

function isMedia(block: Block) {
  return (
    (block.type === "image" || block.type === "video") &&
    Boolean(blockSource(block))
  );
}

export default function MagazinePage({
  page,
  authors,
  cover,
  reader,
  prioritizeHero,
}: {
  page: PageContent;
  authors: ReaderAuthor[];
  cover?: string;
  reader?: boolean;
  prioritizeHero?: boolean;
}) {
  const heading = page.blocks.find(
    (block) => block.type === "heading" && block.text.trim(),
  );
  const coverImage = page.blocks.find(
    (block) => block.type === "image" && blockSource(block),
  );
  const autoplayVideo = page.blocks.find(youtubeVideoId);
  const creditedAuthors = page.authors
    .map((id) => authors.find((author) => author.id === id))
    .filter((author) => author !== undefined);
  const byline = creditedAuthors.length > 0 && (
    <footer className="byline" aria-label="Authors">
      <ul className="byline-authors" role="list">
        {creditedAuthors.map((author) => {
          const { id, role, photo, photoAssetId, photoThumbnail } = author;
          const name = contributorName(author, page.contributorNameLanguage);
          const src = photoAssetId ? mediaUrl(photoAssetId) : photo?.trim();
          const credit = role?.trim();
          return (
            <li key={id} className="byline-author">
              {src && (
                <ImageMaximize
                  src={src}
                  className="byline-photo"
                  description={`photo of ${name}`}
                >
                  <ResponsiveImage
                    src={photoThumbnail || src}
                    alt=""
                    sizes="48px"
                  />
                </ImageMaximize>
              )}
              <div>
                <span className="byline-name" lang={contentLanguage(name)}>
                  {name}
                </span>
                {credit && <span lang={contentLanguage(credit)}>{credit}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </footer>
  );

  const sizes = reader ? pageImageSizes : "(max-width: 650px) 90vw, 720px";
  const hero = prioritizeHero && coverImage;
  const renderBlocks = (blocks: Block[]) => {
    const content: ReactNode[] = [];
    for (let index = 0; index < blocks.length; ) {
      const block = blocks[index];
      let end = index + 1;
      if (block.type === "image" && blockSource(block)) {
        while (
          end < blocks.length &&
          blocks[end].type === "image" &&
          blockSource(blocks[end])
        ) {
          end++;
        }
      }
      if (end > index + 1) {
        const images = blocks.slice(index, end);
        const tileSizes =
          reader && page.template !== "Cover"
            ? images.length % 3 === 0
              ? "(max-width: 1100px) 45vw, 28vw"
              : "45vw"
            : "(max-width: 650px) 45vw, 520px";
        content.push(
          <div className="image-collage" key={block.id}>
            {images.map((image) => (
              <ContentBlock
                key={image.id}
                block={image}
                sizes={tileSizes}
                highPriority={image === hero}
              />
            ))}
          </div>,
        );
      } else {
        content.push(
          <ContentBlock
            key={block.id}
            block={block}
            firstHeading={block === heading}
            sizes={sizes}
            highPriority={block === hero}
            autoplay={block === autoplayVideo}
          />,
        );
      }
      index = end;
    }
    return content;
  };

  const backgroundClass = backgroundClassTokens(page.backgroundClass)
    .filter(isBackgroundClass)
    .join(" ");
  const backgroundSource =
    page.backgroundImage && blockSource(page.backgroundImage);
  const customized = Boolean(
    page.backgroundColor || backgroundSource || page.textColor || backgroundClass,
  );
  const coverSource =
    backgroundSource ||
    (!page.backgroundColor &&
      !backgroundClass &&
      ((coverImage && blockSource(coverImage)) || cover));
  const isCover = page.template === "Cover" && (Boolean(coverSource) || customized);
  const customStyle = customized
    ? ({
        "--page-background-color": page.backgroundColor,
        "--page-background-ink":
          page.textColor ||
          (isCover && coverSource
            ? "#fffbef"
            : backgroundInk(page.backgroundColor) ?? (isCover ? "#fffbef" : undefined)),
      } as CSSProperties)
    : undefined;
  const appearance = {
    style: customStyle,
    "data-customized": customized || undefined,
    "data-background-class": Boolean(backgroundClass) || undefined,
  };
  const decoration = backgroundClass && (
    <div className={`page-background-decoration ${backgroundClass}`} aria-hidden="true" />
  );
  if (isCover) {
    const title = heading?.text || page.title;
    return (
      <article
        className="magazine-cover"
        {...appearance}
        data-cover-image={Boolean(coverSource) || undefined}
      >
        {coverSource && (
          <>
            <ResponsiveImage
              className="cover-image"
              src={coverSource}
              alt={backgroundSource ? "" : coverImage?.text || ""}
              fill
              eager
              sizes={reader ? "100vw" : "(max-width: 630px) 95vw, 560px"}
              highPriority={prioritizeHero}
            />
            <ImageMaximize
              src={coverSource}
              description={
                (!backgroundSource && coverImage?.text.trim()) || "cover image"
              }
            />
          </>
        )}
        {decoration}
        <div className="cover-content">
          <div className="cover-wordmark" lang="ml">
            {magazineName}
          </div>
          <div>
            <h1 lang={contentLanguage(title)}>{title}</h1>
            {renderBlocks(
              page.blocks.filter(
                (block) => block !== heading && block !== coverImage,
              ),
            )}
            {byline}
          </div>
        </div>
      </article>
    );
  }

  const media = page.blocks.filter(isMedia);
  const fallbackTitle = !heading && (
    <h1 lang={contentLanguage(page.title)}>{page.title}</h1>
  );
  const templateClass = `magazine-paper template-${page.template.toLowerCase()}`;
  const paperAttributes = {
    ...appearance,
    "data-background-image": Boolean(backgroundSource) || undefined,
  };
  const paperBackground = backgroundSource && (
    <ResponsiveImage
      className="paper-background-image"
      src={backgroundSource}
      alt=""
      fill
      sizes={reader ? pageImageSizes : sizes}
    />
  );

  if (
    media.length === 1 &&
    page.blocks.some(
      (block) =>
        block.type === "heading" ||
        block.type === "paragraph" ||
        block.type === "quote",
    )
  ) {
    const featured = media[0];
    const position = page.blocks.indexOf(featured);
    return (
      <article
        className={`${templateClass} magazine-with-feature`}
        {...paperAttributes}
      >
        {paperBackground}
        {decoration}
        <div className="magazine-feature-lead">
          {fallbackTitle}
          {renderBlocks(page.blocks.slice(0, position))}
        </div>
        <div className="magazine-feature-media">
          <ContentBlock
            block={featured}
            sizes={reader ? featureImageSizes : sizes}
            highPriority={featured === hero}
            autoplay={featured === autoplayVideo}
          />
        </div>
        <div className="magazine-feature-tail">
          {renderBlocks(page.blocks.slice(position + 1))}
        </div>
        {byline}
      </article>
    );
  }

  if (!media.length) {
    const leadHeading =
      heading && heading === page.blocks[0] ? heading : undefined;
    return (
      <article className={templateClass} {...paperAttributes}>
        {paperBackground}
        {decoration}
        {leadHeading ? (
          <ContentBlock block={leadHeading} firstHeading />
        ) : (
          fallbackTitle
        )}
        <div className="magazine-prose-flow">
          {renderBlocks(leadHeading ? page.blocks.slice(1) : page.blocks)}
        </div>
        {byline}
      </article>
    );
  }

  return (
    <article className={templateClass} {...paperAttributes}>
      {paperBackground}
      {decoration}
      {fallbackTitle}
      {renderBlocks(page.blocks)}
      {byline}
    </article>
  );
}
