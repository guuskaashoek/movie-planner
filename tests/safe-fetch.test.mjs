import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { isPrivateAddress, parsePublicUrl, safeGet, UnsafeUrlError } from "../lib/safe-fetch.ts";

test("private and special addresses are refused", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::7f00:1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("parsePublicUrl refuses bad schemes, credentials and literal private hosts", () => {
  for (const url of ["file:///etc/passwd", "ftp://example.com/a.png", "http://127.0.0.1/a.png", "http://[::1]/a.png", "http://user:pw@example.com/a.png", "not a url"]) {
    assert.throws(() => parsePublicUrl(url), UnsafeUrlError, url);
  }
  assert.equal(parsePublicUrl("https://image.tmdb.org/t/p/w500/x.jpg").hostname, "image.tmdb.org");
});

test("a name that resolves to loopback is refused at connect time", async () => {
  // Stands in for a rebinding host: the name only becomes private when the socket resolves it.
  let hit = false;
  const server = http.createServer((_req, res) => { hit = true; res.end("secret"); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  try {
    await assert.rejects(safeGet(new URL(`http://localhost:${port}/`), { cap: 1024 }), UnsafeUrlError);
    assert.equal(hit, false);
  } finally {
    server.close();
  }
});
