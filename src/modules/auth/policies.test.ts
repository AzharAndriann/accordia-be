import { expect, test } from 'bun:test';
import { consentSchema, isAdult, POLICY_VERSION } from './policies';

test('adult age boundary and valid calendar dates', () => {
  const now = new Date('2026-11-02T00:00:00Z');
  expect(isAdult('2008-11-02', now)).toBe(true);
  expect(isAdult('2008-11-03', now)).toBe(false);
  expect(isAdult('2000-02-30', now)).toBe(false);
  expect(isAdult('2030-01-01', now)).toBe(false);
});
test('all explicit consents and current document versions are required', () => {
  const valid = { birthDate: '2000-01-01', acceptedTerms: true, acceptedPrivacy: true, declaredCapacity: true, termsVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION };
  expect(consentSchema.safeParse(valid).success).toBe(true);
  expect(consentSchema.safeParse({ ...valid, acceptedPrivacy: false }).success).toBe(false);
  expect(consentSchema.safeParse({ ...valid, termsVersion: 'old' }).success).toBe(false);
  expect(consentSchema.safeParse({ ...valid, declaredCapacity: false }).success).toBe(false);
});
