"use client";

import Image, { type ImageLoaderProps, type ImageProps } from "next/image";

function estateImage({ src, width, quality }: ImageLoaderProps) {
  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 70));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "crop");
  return url.toString();
}

export function EstatePhoto({ alt, ...props }: Omit<ImageProps, "loader">) {
  return (
    <Image
      alt={alt}
      loader={estateImage}
      width={1600}
      height={1000}
      sizes="(max-width: 700px) 100vw, 50vw"
      {...props}
    />
  );
}
