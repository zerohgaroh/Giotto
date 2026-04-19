import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { imageSize } from "image-size";
import path from "path";
import sharp from "sharp";
import { ApiError } from "./projections";
import type { MenuImageUploadResponse } from "./types";

const MAX_MENU_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MENU_IMAGE_WIDTH = 1600;
const MAX_MENU_IMAGE_HEIGHT = 1600;
const MENU_IMAGE_QUALITY = 78;
const MIN_VARIANT_WIDTH = 160;
const MAX_VARIANT_WIDTH = 1600;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const EXTENSION_BY_MIME: Record<string, keyof typeof MIME_BY_EXTENSION> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function resolveUploadsRoot() {
  const configured = process.env.GIOTTO_UPLOADS_DIR?.trim();
  return path.resolve(process.cwd(), configured && configured.length > 0 ? configured : ".runtime/uploads");
}

function resolveMenuUploadsDir() {
  return path.join(resolveUploadsRoot(), "menu");
}

function resolveMenuVariantsDir() {
  return path.join(resolveMenuUploadsDir(), ".variants");
}

function inferMimeType(file: File) {
  const fromType = file.type?.trim().toLowerCase();
  if (fromType && EXTENSION_BY_MIME[fromType]) return fromType;

  const fileName = file.name.toLowerCase();
  const extension = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  const normalized = extension === "jpeg" ? "jpg" : extension;
  return MIME_BY_EXTENSION[normalized] ?? "";
}

function inferExtension(mimeType: string) {
  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) {
    throw new ApiError(400, "Unsupported image type");
  }
  return extension;
}

function getPublicBaseUrl(request: Request) {
  const configured = process.env.GIOTTO_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return new URL(request.url).origin.replace(/\/$/, "");
}

function getContentTypeByFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase().replace(/^\./, "");
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

function sanitizeRequestedWidth(width?: number | null) {
  if (!Number.isFinite(width) || !width) return null;
  const normalized = Math.round(width);
  if (normalized < MIN_VARIANT_WIDTH) return MIN_VARIANT_WIDTH;
  if (normalized > MAX_VARIANT_WIDTH) return MAX_VARIANT_WIDTH;
  return normalized;
}

async function optimizeMenuImage(bytes: Buffer) {
  const transformed = await sharp(bytes)
    .rotate()
    .resize({
      width: MAX_MENU_IMAGE_WIDTH,
      height: MAX_MENU_IMAGE_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: MENU_IMAGE_QUALITY, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    body: transformed.data,
    width: transformed.info.width,
    height: transformed.info.height,
    mimeType: "image/webp",
  };
}

export async function saveManagerMenuImage(file: File, request: Request): Promise<MenuImageUploadResponse> {
  const mimeType = inferMimeType(file);
  if (!mimeType) {
    throw new ApiError(400, "Unsupported image type");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    throw new ApiError(400, "Image file is empty");
  }
  if (bytes.length > MAX_MENU_IMAGE_BYTES) {
    throw new ApiError(413, "Image file is too large");
  }

  const optimized = await optimizeMenuImage(bytes);
  if (!optimized.width || !optimized.height) {
    throw new ApiError(400, "Unable to read image dimensions");
  }

  const filename = `${Date.now()}-${randomUUID()}.webp`;
  const uploadDir = resolveMenuUploadsDir();
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), optimized.body);

  return {
    url: `${getPublicBaseUrl(request)}/api/uploads/menu/${filename}`,
    width: optimized.width,
    height: optimized.height,
    mimeType: optimized.mimeType,
    sizeBytes: optimized.body.length,
  };
}

export async function readManagerMenuImage(filename: string, options?: { width?: number | null }) {
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    throw new ApiError(404, "Image not found");
  }

  const filePath = path.join(resolveMenuUploadsDir(), filename);
  const resolvedPath = path.resolve(filePath);
  const rootPath = path.resolve(resolveMenuUploadsDir());
  if (resolvedPath !== filePath && !resolvedPath.startsWith(`${rootPath}${path.sep}`)) {
    throw new ApiError(404, "Image not found");
  }

  try {
    const requestedWidth = sanitizeRequestedWidth(options?.width);
    if (requestedWidth) {
      const variantDir = path.join(resolveMenuVariantsDir(), filename);
      const variantPath = path.join(variantDir, `w${requestedWidth}.webp`);

      try {
        const body = await fs.readFile(variantPath);
        return {
          body,
          mimeType: "image/webp",
        };
      } catch {
        const body = await fs.readFile(filePath);
        const metadata = imageSize(body);
        if (!metadata.width || metadata.width > requestedWidth) {
          await fs.mkdir(variantDir, { recursive: true });
          const variantBody = await sharp(body)
            .rotate()
            .resize({
              width: requestedWidth,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: MENU_IMAGE_QUALITY, effort: 4 })
            .toBuffer();
          await fs.writeFile(variantPath, variantBody);
          return {
            body: variantBody,
            mimeType: "image/webp",
          };
        }
      }
    }

    const body = await fs.readFile(filePath);
    return {
      body,
      mimeType: getContentTypeByFilename(filename),
    };
  } catch {
    throw new ApiError(404, "Image not found");
  }
}
