import {
  blockSource,
  magazineName,
  mediaUrl,
  type Block,
  type PageContent,
  type ReaderAuthor,
} from "@/lib/data";
import type { ReactNode } from "react";
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
        {creditedAuthors.map(({ id, name, role, photo, photoAssetId }) => {
          const src = photoAssetId ? mediaUrl(photoAssetId) : photo?.trim();
          const credit = role?.trim();
          return (
            <li key={id} className="byline-author">
              {src && (
                <ResponsiveImage
                  src={src}
                  alt=""
                  className="byline-photo"
                  sizes="48px"
                />
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

  const coverSource = (coverImage && blockSource(coverImage)) || cover;
  if (page.template === "Cover" && coverSource) {
    const title = heading?.text || page.title;
    return (
      <article className="magazine-cover">
        <ResponsiveImage
          className="cover-image"
          src={coverSource}
          alt={coverImage?.text || ""}
          fill
          eager
          sizes={reader ? "100vw" : "(max-width: 630px) 95vw, 560px"}
          highPriority={prioritizeHero}
        />
        <ImageMaximize
          src={coverSource}
          description={coverImage?.text.trim() || "cover image"}
        />
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
      <article className={`${templateClass} magazine-with-feature`}>
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
      <article className={templateClass}>
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
    <article className={templateClass}>
      {fallbackTitle}
      {renderBlocks(page.blocks)}
      {byline}
    </article>
  );
}
