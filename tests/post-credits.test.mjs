import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POST_CREDIT,
  PostCreditError,
  applyPostCreditPatch,
  postCreditBadge,
} from "../lib/post-credits.ts";

const yes = {
  postCreditStatus: "yes",
  midCreditCount: 1,
  endCreditCount: 2,
  postCreditNote: "stay seated",
};

test("a new film starts as unknown with no detail", () => {
  assert.deepEqual(applyPostCreditPatch(DEFAULT_POST_CREDIT, {}), DEFAULT_POST_CREDIT);
  assert.deepEqual(postCreditBadge(DEFAULT_POST_CREDIT), {
    tone: "unknown",
    label: "Post-credit ?",
    title: "Post-credit unknown",
  });
});

test("yes stores mid and end counts and a note", () => {
  assert.deepEqual(
    applyPostCreditPatch(DEFAULT_POST_CREDIT, {
      postCreditStatus: "yes",
      midCreditCount: "1",
      endCreditCount: 1,
      postCreditNote: "  na de aftiteling kort grapje  ",
    }),
    {
      postCreditStatus: "yes",
      midCreditCount: 1,
      endCreditCount: 1,
      postCreditNote: "na de aftiteling kort grapje",
    }
  );
  assert.deepEqual(
    postCreditBadge({
      postCreditStatus: "yes",
      midCreditCount: 1,
      endCreditCount: 1,
      postCreditNote: "na de aftiteling kort grapje",
    }),
    {
      tone: "yes",
      label: "Post-credit: 1 mid + 1 end",
      title: "Post-credit: 1 mid + 1 end. na de aftiteling kort grapje",
    }
  );
});

test("a single count is labelled on its own and zero counts are omitted", () => {
  assert.equal(
    postCreditBadge({ postCreditStatus: "yes", midCreditCount: 2, endCreditCount: null }).label,
    "Post-credit: 2 mid"
  );
  assert.equal(
    postCreditBadge({ postCreditStatus: "yes", midCreditCount: 0, endCreditCount: 1 }).label,
    "Post-credit: 1 end"
  );
  assert.equal(
    postCreditBadge({ postCreditStatus: "yes", midCreditCount: 0, endCreditCount: 0 }).label,
    "Post-credit"
  );
  assert.equal(postCreditBadge({ postCreditStatus: "yes" }).label, "Post-credit");
});

test("none clears stored counts and reads as No post-credit", () => {
  assert.deepEqual(
    applyPostCreditPatch(yes, { postCreditStatus: "none" }),
    {
      postCreditStatus: "none",
      midCreditCount: null,
      endCreditCount: null,
      postCreditNote: "stay seated",
    }
  );
  assert.equal(postCreditBadge({ postCreditStatus: "none" }).label, "No post-credit");
  assert.equal(
    postCreditBadge({ postCreditStatus: "none", postCreditNote: "checked the credits" }).title,
    "No post-credit. checked the credits"
  );
});

test("empty or unknown resets the status and clears counts", () => {
  for (const postCreditStatus of ["", "unknown", "  UNKNOWN  ", null]) {
    assert.deepEqual(
      applyPostCreditPatch(yes, { postCreditStatus }),
      {
        postCreditStatus: "unknown",
        midCreditCount: null,
        endCreditCount: null,
        postCreditNote: "stay seated",
      }
    );
  }
});

test("empty, null, or unknown clears one count or the note without touching the rest", () => {
  assert.deepEqual(
    applyPostCreditPatch(yes, { midCreditCount: "", endCreditCount: null, postCreditNote: "unknown" }),
    {
      postCreditStatus: "yes",
      midCreditCount: null,
      endCreditCount: null,
      postCreditNote: null,
    }
  );
  assert.equal(applyPostCreditPatch(yes, { postCreditNote: "   " }).postCreditNote, null);
});

test("a partial update keeps fields that were not sent", () => {
  assert.deepEqual(applyPostCreditPatch(yes, { postCreditNote: "new note" }), {
    ...yes,
    postCreditNote: "new note",
  });
  assert.equal(applyPostCreditPatch(yes, { endCreditCount: 4 }).endCreditCount, 4);
  assert.equal(applyPostCreditPatch(yes, { endCreditCount: 4 }).midCreditCount, 1);
});

test("counts are rejected unless the resulting status is yes", () => {
  assert.throws(
    () => applyPostCreditPatch(DEFAULT_POST_CREDIT, { midCreditCount: 1 }),
    PostCreditError
  );
  assert.throws(
    () => applyPostCreditPatch(yes, { postCreditStatus: "none", endCreditCount: 1 }),
    /only apply when postCreditStatus is "yes"/
  );
  assert.deepEqual(applyPostCreditPatch(yes, { postCreditStatus: "none", midCreditCount: "" }), {
    postCreditStatus: "none",
    midCreditCount: null,
    endCreditCount: null,
    postCreditNote: "stay seated",
  });
});

test("status, counts, and notes are validated", () => {
  assert.throws(() => applyPostCreditPatch(DEFAULT_POST_CREDIT, { postCreditStatus: "maybe" }), /unknown/);
  assert.throws(() => applyPostCreditPatch(yes, { midCreditCount: -1 }), /midCreditCount/);
  assert.throws(() => applyPostCreditPatch(yes, { endCreditCount: 1.5 }), /endCreditCount/);
  assert.throws(() => applyPostCreditPatch(yes, { endCreditCount: 21 }), /endCreditCount/);
  assert.throws(() => applyPostCreditPatch(yes, { midCreditCount: "two" }), /midCreditCount/);
  assert.throws(
    () => applyPostCreditPatch(yes, { postCreditNote: "x".repeat(281) }),
    /280/
  );
  assert.equal(applyPostCreditPatch(yes, { midCreditCount: 0 }).midCreditCount, 0);
  assert.equal(applyPostCreditPatch(yes, { endCreditCount: "20" }).endCreditCount, 20);
});

test("a missing or unexpected status still renders as unknown", () => {
  assert.equal(postCreditBadge(null).tone, "unknown");
  assert.equal(postCreditBadge({ postCreditStatus: "maybe" }).label, "Post-credit ?");
  assert.equal(postCreditBadge({}).title, "Post-credit unknown");
});
