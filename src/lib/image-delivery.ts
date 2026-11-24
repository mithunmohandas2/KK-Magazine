const widths = [96, 160, 256, 384, 640, 828, 1080, 1200, 1600];
const managedImage = /^\/api\/media\/kk_[a-f0-9-]{36}$/;
const publicCloudinaryImage =
  /^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/v\d+\/[\w./%~-]+$/;

export function validImageWidth(value: string | null) {
  const width = Number(value);
  return widths.includes(width) ? width : undefined;
}

export function canResizeImage(src: string) {
  return managedImage.test(src) || publicCloudinaryImage.test(src);
}

export function imageLoader({ src, width }: { src: string; width: number }) {
  const size =
    widths.find((candidate) => candidate >= width) ?? widths[widths.length - 1];
  if (managedImage.test(src)) return `${src}?w=${size}`;
  return src.replace(
    "/image/upload/",
    `/image/upload/c_limit,w_${size}/f_auto,q_auto/`,
  );
}
