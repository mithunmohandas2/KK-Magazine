import {
  blockSource,
  magazineName,
  type Author,
  type Block,
  type PageContent,
} from "@/lib/data";
import ResponsiveImage from "./ResponsiveImage";

const pageImageSizes =
  "(max-width: 750px) 90vw, (max-width: 1100px) 640px, 84vw";
const featureImageSizes =
  "(max-width: 750px) 90vw, (max-width: 1100px) 640px, 46vw";

function contentLanguage(text: string) {
  return /^\P{L}*\p{Script=Malayalam}/u.test(text) ? "ml" : undefined;
}

function ContentBlock({
  block,
  firstHeading,
  sizes = pageImageSizes,
  highPriority,
}: {
  block: Block;
  firstHeading?: boolean;
  sizes?: string;
  highPriority?: boolean;
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
          <ResponsiveImage
            src={src}
            alt={block.text}
            sizes={sizes}
            highPriority={highPriority}
          />
          {block.text && <figcaption>{block.text}</figcaption>}
        </figure>
      ) : null;
    case "video":
      return src ? (
        <figure lang={lang}>
          <video
            src={src}
            controls
            preload="none"
            aria-label={block.text || "Magazine video"}
          />
          {block.text && <figcaption>{block.text}</figcaption>}
        </figure>
      ) : null;
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
  authors: Pick<Author, "id" | "name">[];
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
  const byline = page.authors
    .map((id) => authors.find((author) => author.id === id)?.name)
    .filter(Boolean)
    .join(" & ");

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
        <div className="cover-content">
          <div className="cover-wordmark" lang="ml">
            {magazineName}
          </div>
          <div>
            <h1 lang={contentLanguage(title)}>{title}</h1>
            {page.blocks
              .filter((block) => block !== heading && block !== coverImage)
              .map((block) => (
                <ContentBlock key={block.id} block={block} />
              ))}
            {byline && <p>By {byline}</p>}
          </div>
        </div>
      </article>
    );
  }

  const media = page.blocks.filter(isMedia);
  const hero = prioritizeHero && media.find((block) => block.type === "image");
  const sizes = reader ? pageImageSizes : "(max-width: 650px) 90vw, 720px";
  const renderBlocks = (blocks: Block[]) =>
    blocks.map((block) => (
      <ContentBlock
        key={block.id}
        block={block}
        firstHeading={block === heading}
        sizes={sizes}
        highPriority={block === hero}
      />
    ));
  const fallbackTitle = !heading && (
    <h1 lang={contentLanguage(page.title)}>{page.title}</h1>
  );
  const credit = byline && <div className="byline">By {byline}</div>;
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
          />
        </div>
        <div className="magazine-feature-tail">
          {renderBlocks(page.blocks.slice(position + 1))}
        </div>
        {credit}
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
        {credit}
      </article>
    );
  }

  return (
    <article className={templateClass}>
      {fallbackTitle}
      {renderBlocks(page.blocks)}
      {credit}
    </article>
  );
}
