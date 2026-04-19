import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);

const PREFIX = "scrypt";
const KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  return `${PREFIX}:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [prefix, salt, digest] = encoded.split(":");
  if (prefix !== PREFIX || !salt || !digest) return false;

  const actual = (await scrypt(password, salt, KEY_LEN)) as Buffer;
  const expected = Buffer.from(digest, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
