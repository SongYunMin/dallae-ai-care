import assert from 'node:assert/strict';
import { pickThankYouHero } from './thank-you-hero';

const heroes = ['hero-1', 'hero-2', 'hero-3'] as const;

assert.equal(pickThankYouHero(heroes, () => 0), 'hero-1');
assert.equal(pickThankYouHero(heroes, () => 0.34), 'hero-2');
assert.equal(pickThankYouHero(heroes, () => 0.99), 'hero-3');
assert.equal(pickThankYouHero([], () => 0), undefined);
