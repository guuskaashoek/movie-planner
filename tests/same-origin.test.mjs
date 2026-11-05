import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCrossOriginWrite } from '../lib/same-origin.ts';
const req = (method, headers = {}) => new Request('https://movie.guuss.com/api/films/1', { method, headers: { host: 'movie.guuss.com', ...headers } });
test('reads are never blocked', () => {
  assert.equal(isCrossOriginWrite(req('GET', { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' })), false);
});
test('same-origin browser writes pass', () => {
  assert.equal(isCrossOriginWrite(req('PUT', { origin: 'https://movie.guuss.com', 'sec-fetch-site': 'same-origin' })), false);
  assert.equal(isCrossOriginWrite(req('POST', { origin: 'https://movie.guuss.com' })), false);
});
test('clients without browser headers pass', () => {
  assert.equal(isCrossOriginWrite(req('DELETE')), false);
});
test('sibling apps on guuss.com are refused', () => {
  assert.equal(isCrossOriginWrite(req('POST', { origin: 'https://math.guuss.com', 'sec-fetch-site': 'same-site' })), true);
  assert.equal(isCrossOriginWrite(req('POST', { origin: 'https://game.guuss.com' })), true);
  assert.equal(isCrossOriginWrite(req('DELETE', { 'sec-fetch-site': 'cross-site' })), true);
});
test('null or broken origins are refused', () => {
  assert.equal(isCrossOriginWrite(req('POST', { origin: 'null' })), true);
  assert.equal(isCrossOriginWrite(req('POST', { origin: 'http://movie.guuss.com:8080' })), true);
});
