import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverFilms, goingTo, ticketState } from '../lib/board-discovery.ts';
const now = new Date('2026-09-09T08:00:00Z'); // 10:00 in Amsterdam
const person = id => ({ id, name: `Person ${id}`, image: null });
const film = (id, patch = {}) => ({ id, date: '2026-09-20', releaseDate: null, endTime: null, isMajorRelease: false, ticketsOnSaleDate: null, ticketsOnSaleTime: null, goingUsers: [], interestedUsers: [], poll: null, ...patch });
test('major release wins over a popular film; past major releases never win', () => {
  const crowd = film(1, { goingUsers: [person(1), person(2), person(3)] });
  const major = film(2, { isMajorRelease: true });
  const past = film(3, { isMajorRelease: true, date: '2026-09-08' });
  assert.equal(discoverFilms([crowd, major, past], now).featured.id, 2);
  assert.equal(discoverFilms([crowd, past], now).featured.id, 1);
});
test('poll attendance uses only unique voters for the winning option', () => {
  const poll = film(1, { goingUsers: [person(8), person(9)], poll: { options: [{ isWinning: false, voters: [person(1), person(2)] }, { isWinning: true, voters: [person(3), person(3)] }] } });
  assert.deepEqual(goingTo(poll).map(p => p.id), [3]);
  assert.equal(discoverFilms([poll], now).withFriends.length, 0);
});
test('two people going outrank interest alone and appear in the crew rail', () => {
  const interested = film(1, { interestedUsers: Array.from({length:10}, (_, i) => person(i)) });
  const crew = film(2, { goingUsers: [person(1), person(2)] });
  const result = discoverFilms([interested, crew], now);
  assert.equal(result.featured.id, 2);
  assert.deepEqual(result.withFriends.map(f => f.id), [2]);
});
test('ticket times use Amsterdam and a missing time never claims sales started today', () => {
  assert.equal(ticketState(film(1), now), 'unknown');
  assert.equal(ticketState(film(1, { ticketsOnSaleDate:'2026-09-09' }), now), 'scheduled');
  assert.equal(ticketState(film(1, { ticketsOnSaleDate:'2026-09-09', ticketsOnSaleTime:'10:01' }), now), 'scheduled');
  assert.equal(ticketState(film(1, { ticketsOnSaleDate:'2026-09-09', ticketsOnSaleTime:'10:00' }), now), 'open');
  const winter = new Date('2026-12-09T08:00:00Z');
  assert.equal(ticketState(film(1, { ticketsOnSaleDate:'2026-12-09', ticketsOnSaleTime:'09:30' }), winter), 'scheduled');
});
test('empty, already ended today, and released without a future screening', () => {
  assert.equal(discoverFilms([], now).featured, null);
  assert.equal(discoverFilms([film(1, { date:'2026-09-09', endTime:'09:59' }), film(2, { date:null, releaseDate:'2026-09-01' })], now).featured, null);
  assert.equal(discoverFilms([film(3, { date:null, releaseDate:null })], now).featured.id, 3);
});
test('ticket rail puts the next scheduled sale before previous sale dates and excludes past films', () => {
  const list = [film(1, { ticketsOnSaleDate:'2026-09-07' }), film(2, { ticketsOnSaleDate:'2026-09-12' }), film(3, { ticketsOnSaleDate:'2026-09-10' }), film(4, { date:'2026-09-08', ticketsOnSaleDate:'2026-09-10' })];
  assert.deepEqual(discoverFilms(list, now).tickets.map(f => f.id), [3,2,1]);
});
