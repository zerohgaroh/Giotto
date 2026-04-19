import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { imageSize } from "image-size";
import path from "path";
import { ApiError } from "./projections";
import type { MenuImageUploadResponse } from "./types";

const MAX_MENU_IMAGE_BYTES = 5 * 1024 * 1024;

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

  const dimensions = imageSize(bytes);
  if (!dimensions.width || !dimensions.height) {
    throw new ApiError(400, "Unable to read image dimensions");
  }

  const filename = `${Date.now()}-${randomUUID()}.${inferExtension(mimeType)}`;
  const uploadDir = resolveMenuUploadsDir();
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), bytes);

  return {
    url: `${getPublicBaseUrl(request)}/api/uploads/menu/${filename}`,
    width: dimensions.width,
    height: dimensions.height,
    mimeType,
    sizeBytes: bytes.length,
  };
}

export async function readManagerMenuImage(filename: string) {
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
    const body = await fs.readFile(filePath);
    return {
      body,
      mimeType: getContentTypeByFilename(filename),
    };
  } catch {
    throw new ApiError(404, "Image not found");
  }
}
