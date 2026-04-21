const DEFAULT_REVIEW_PROMPT_TTL_SEC = 300;
const DEFAULT_REVIEW_PROMPT_SUBMIT_GRACE_SEC = 180;

function readPositiveSeconds(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getReviewPromptTtlMs() {
  const ttlSec = readPositiveSeconds(process.env.GIOTTO_REVIEW_PROMPT_TTL_SEC, DEFAULT_REVIEW_PROMPT_TTL_SEC);
  return Math.floor(ttlSec * 1000);
}

export function getReviewPromptSubmitGraceMs() {
  const graceSec = readPositiveSeconds(
    process.env.GIOTTO_REVIEW_PROMPT_SUBMIT_GRACE_SEC,
    DEFAULT_REVIEW_PROMPT_SUBMIT_GRACE_SEC,
  );
  return Math.floor(graceSec * 1000);
}
