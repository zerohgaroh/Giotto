"use client";

import Image from "next/image";
import clsx from "clsx";

type Props = {
  size?: number;
  className?: string;
  priority?: boolean;
  src?: string;
  alt?: string;
};

export function GiottoLogo({
  size = 100,
  className,
  priority = false,
  src = "/brand/giotto-logo.png",
  alt = "Giotto",
}: Props) {
  return (
    <span
      className={clsx(
        "relative inline-block shrink-0 overflow-hidden rounded-full bg-giotto-navy shadow-lift ring-2 ring-giotto-gold/35 ring-offset-2 ring-offset-giotto-paper",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="object-contain"
        sizes={`${size}px`}
        priority={priority}
      />
    </span>
  );
}
