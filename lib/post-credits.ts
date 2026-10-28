/**
 * Post-credit scenes on a film.
 *
 * Status is unknown until someone checks, none when there is no tag, and yes
 * when at least one scene plays during or after the credits. Counts only
 * apply to yes. The note is a short free-text remark in whatever language
 * the group writes it.
 *
 * This module is pure so the rules can be tested without a database.
 */

export const POST_CREDIT_STATUSES = ["unknown", "none", "yes"] as const;
export type PostCreditStatus = (typeof POST_CREDIT_STATUSES)[number];

export const POST_CREDIT_COUNT_MAX = 20;
export const POST_CREDIT_NOTE_MAX = 280;

export type PostCreditRecord = {
  postCreditStatus: PostCreditStatus;
  midCreditCount: number | null;
  endCreditCount: number | null;
  postCreditNote: string | null;
};

/** Fields a caller may send. Undefined means "leave this alone". */
export type PostCreditPatch = {
  postCreditStatus?: string | null;
  midCreditCount?: number | string | null;
  endCreditCount?: number | string | null;
  postCreditNote?: string | null;
};

/** Anything that might carry the stored fields, including a film view. */
export type PostCreditSource = {
  postCreditStatus?: string | null;
  midCreditCount?: number | null;
  endCreditCount?: number | null;
  postCreditNote?: string | null;
};

export const DEFAULT_POST_CREDIT: PostCreditRecord = {
  postCreditStatus: "unknown",
  midCreditCount: null,
  endCreditCount: null,
  postCreditNote: null,
};

export class PostCreditError extends Error {}

export function isPostCreditStatus(value: string): value is PostCreditStatus {
  return (POST_CREDIT_STATUSES as readonly string[]).includes(value);
}

/**
 * Apply a partial update onto the current record.
 * An empty string or "unknown" resets the status to unknown.
 * An empty string, null, or "unknown" clears a count or the note.
 * Counts are stored only while the status is yes; sending a count for any
 * other status is rejected instead of being dropped quietly.
 */
export function applyPostCreditPatch(
  current: PostCreditRecord,
  patch: PostCreditPatch
): PostCreditRecord {
  const next: PostCreditRecord = { ...current };

  if (patch.postCreditStatus !== undefined) {
    next.postCreditStatus = parseStatus(patch.postCreditStatus);
  }
  if (patch.midCreditCount !== undefined) {
    next.midCreditCount = parseCount(patch.midCreditCount, "midCreditCount");
  }
  if (patch.endCreditCount !== undefined) {
    next.endCreditCount = parseCount(patch.endCreditCount, "endCreditCount");
  }
  if (patch.postCreditNote !== undefined) {
    next.postCreditNote = parseNote(patch.postCreditNote);
  }

  if (next.postCreditStatus !== "yes") {
    const sentCount =
      (patch.midCreditCount !== undefined && next.midCreditCount !== null) ||
      (patch.endCreditCount !== undefined && next.endCreditCount !== null);
    if (sentCount) {
      throw new PostCreditError(
        'midCreditCount and endCreditCount only apply when postCreditStatus is "yes"'
      );
    }
    next.midCreditCount = null;
    next.endCreditCount = null;
  }

  return next;
}

export type PostCreditBadge = {
  tone: "unknown" | "none" | "yes";
  label: string;
  title: string;
};

/** Label shown on the board and the film page. Unknown stays a quiet "Post-credit ?". */
export function postCreditBadge(source: PostCreditSource | null | undefined): PostCreditBadge {
  const status = coerceStatus(source?.postCreditStatus);
  const note = source?.postCreditNote?.trim() || null;

  if (status === "unknown") {
    return {
      tone: "unknown",
      label: "Post-credit ?",
      title: note ? `Post-credit unknown. ${note}` : "Post-credit unknown",
    };
  }

  if (status === "none") {
    return {
      tone: "none",
      label: "No post-credit",
      title: note ? `No post-credit. ${note}` : "No post-credit scene",
    };
  }

  const parts: string[] = [];
  if (source?.midCreditCount) parts.push(`${source.midCreditCount} mid`);
  if (source?.endCreditCount) parts.push(`${source.endCreditCount} end`);
  const label = parts.length > 0 ? `Post-credit: ${parts.join(" + ")}` : "Post-credit";
  return { tone: "yes", label, title: note ? `${label}. ${note}` : label };
}

function parseStatus(value: string | null): PostCreditStatus {
  if (value == null) return "unknown";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "" || trimmed === "unknown") return "unknown";
  if (trimmed === "none" || trimmed === "yes") return trimmed;
  throw new PostCreditError('postCreditStatus must be "unknown", "none", or "yes"');
}

function parseCount(value: number | string | null, field: string): number | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.toLowerCase() === "unknown") return null;
    if (!/^\d+$/.test(trimmed)) {
      throw new PostCreditError(countMessage(field));
    }
    return checkRange(Number(trimmed), field);
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return checkRange(value, field);
  }
  throw new PostCreditError(countMessage(field));
}

function checkRange(value: number, field: string): number {
  if (value < 0 || value > POST_CREDIT_COUNT_MAX) {
    throw new PostCreditError(countMessage(field));
  }
  return value;
}

function countMessage(field: string): string {
  return `${field} must be a whole number from 0 to ${POST_CREDIT_COUNT_MAX}, or empty to clear`;
}

function parseNote(value: string | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "unknown") return null;
  if (trimmed.length > POST_CREDIT_NOTE_MAX) {
    throw new PostCreditError(
      `postCreditNote may be at most ${POST_CREDIT_NOTE_MAX} characters`
    );
  }
  return trimmed;
}

function coerceStatus(value: string | null | undefined): PostCreditStatus {
  if (value == null) return "unknown";
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "yes" || trimmed === "none") return trimmed;
  return "unknown";
}
