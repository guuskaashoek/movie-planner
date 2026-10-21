import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCappedBody } from '../lib/body-limit.ts';
const req = (body, headers = {}) => new Request('https://x/api/auth/signin', { method: 'POST', body, headers, duplex: 'half' });
const stream = (n, size) => new ReadableStream({ start(c) { for (let i = 0; i < n; i++) c.enqueue(new Uint8Array(size)); c.close(); } });
test('small bodies come back intact', async () => {
  const body = await readCappedBody(req('csrfToken=abc&callbackUrl=%2Fboard'), 1024);
  assert.equal(new TextDecoder().decode(body), 'csrfToken=abc&callbackUrl=%2Fboard');
});
test('a declared length over the cap is refused without reading', async () => {
  assert.equal(await readCappedBody(req('a', { 'content-length': '999999' }), 1024), null);
});
test('a chunked body without length is cut off past the cap', async () => {
  assert.equal(await readCappedBody(req(stream(10, 512)), 1024), null);
  assert.equal((await readCappedBody(req(stream(2, 512)), 1024)).byteLength, 1024);
});
test('an empty body is fine', async () => {
  assert.equal((await readCappedBody(new Request('https://x/', { method: 'POST' }), 1024)).byteLength, 0);
});
