import { test } from "node:test";
import assert from "node:assert/strict";
import { isStorageUrl } from "../lib/storage-url.ts";

test("our Wasabi URLs count as storage", () => {
  assert.equal(isStorageUrl("https://s3.eu-central-1.wasabisys.com/bucket/abc.jpg"), true);
  assert.equal(isStorageUrl("https://bucket.s3.eu-central-1.wasabisys.com/abc.jpg?X-Amz-Signature=1"), true);
  assert.equal(isStorageUrl("https://cdn.example.com/posters/abc.jpg", "https://cdn.example.com/posters/"), true);
});

test("a URL that only mentions wasabisys.com is not storage", () => {
  assert.equal(isStorageUrl("https://evil.example/wasabisys.com/abc.jpg"), false);
  assert.equal(isStorageUrl("https://evil.example/?u=s3.wasabisys.com"), false);
  assert.equal(isStorageUrl("https://wasabisys.com.evil.example/abc.jpg"), false);
  assert.equal(isStorageUrl("https://x@evil.example#.wasabisys.com"), false);
  assert.equal(isStorageUrl("http://s3.eu-central-1.wasabisys.com/bucket/abc.jpg"), false);
  assert.equal(isStorageUrl("https://cdn.example.com/postersX/abc.jpg", "https://cdn.example.com/posters"), false);
  assert.equal(isStorageUrl("not a url"), false);
  assert.equal(isStorageUrl(null), false);
});
