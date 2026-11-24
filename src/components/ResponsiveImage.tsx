import Image, { getImageProps } from "next/image";
import type { ComponentProps } from "react";
import { canResizeImage, imageLoader } from "@/lib/image-delivery";

type Props = Pick<ComponentProps<"img">, "alt" | "className" | "onError"> & {
  src: string;
  alt: string;
  sizes: string;
  fill?: boolean;
  eager?: boolean;
  highPriority?: boolean;
};

export default function ResponsiveImage({
  src,
  alt,
  sizes,
  fill,
  eager,
  highPriority,
  ...attributes
}: Props) {
  const loading = eager || highPriority ? "eager" : "lazy";
  const fetchPriority = highPriority ? "high" : undefined;
  if (!canResizeImage(src)) {
    return (
      <img
        {...attributes}
        src={src}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        style={
          fill
            ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
            : undefined
        }
      />
    );
  }
  const props = {
    ...attributes,
    src,
    alt,
    sizes,
    loader: imageLoader,
    fill: true as const,
  };
  if (fill) {
    // Public cover and thumbnail frames reserve their display size with CSS.
    return (
      <Image
        {...props}
        priority={highPriority}
        loading={highPriority ? undefined : loading}
      />
    );
  }
  // Editorial images keep their intrinsic ratio, which is unknown for older uploads and URLs.
  const {
    props: { style: _style, ...imageProps },
  } = getImageProps({ ...props, loading, fetchPriority });
  return <img {...imageProps} />;
}
