import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveOidcAccount } from '../server/oidc-account-links';
const issuer = 'https://auth.example.test/api/better-auth';
const identity = { id: 'farm-auth:approved-sub', email: 'admin@example.test', emailVerified: true, role: 'user' };
const target = { id: 'original-id', email: 'admin@example.test', role: 'superadmin', username: 'Supervan', passwordHash: 'never-return' };
const env = { OIDC_ISSUER: issuer, OIDC_ACCOUNT_LINKS: JSON.stringify([{ subject: 'approved-sub', email: target.email, userId: target.id }]) };
test('explicit link preserves original ID and roles, excludes hashes, reflects demotion', async () => {
  const result = await resolveOidcAccount(identity, issuer, env, async () => target);
  assert.equal(result?.id, target.id); assert.equal(result?.role, 'superadmin'); assert.ok(!('passwordHash' in result!));
  const demoted = await resolveOidcAccount(identity, issuer, env, async () => ({ ...target, role: 'user' })); assert.equal(demoted?.role, 'user');
  assert.equal((await resolveOidcAccount(identity, issuer, env, async () => ({ ...target, role: 'admin' })))?.role, 'admin');
});
test('matching emails alone never grant roles or link identities', async () => {
  const lookup = async () => { throw new Error('Unlinked user must not query legacy account'); };
  assert.deepEqual(await resolveOidcAccount(identity, issuer, {}, lookup), identity);
  const stranger = { ...identity, id: 'farm-auth:another-sub' };
  assert.deepEqual(await resolveOidcAccount(stranger, issuer, env, lookup), stranger);
  assert.equal(await resolveOidcAccount({ ...identity, role: 'superadmin' }, issuer, env, lookup), null);
});
test('mismatched issuer, subject/email, unverified email, removed target and malformed config fail closed', async () => {
  assert.equal(await resolveOidcAccount(identity, issuer + '/other', env, async () => target), null);
  assert.equal(await resolveOidcAccount({ ...identity, emailVerified: false }, issuer, env, async () => target), null);
  assert.equal(await resolveOidcAccount({ ...identity, email: 'other@example.test' }, issuer, env, async () => target), null);
  assert.equal(await resolveOidcAccount(identity, issuer, env, async () => ({ ...target, email: 'changed@example.test' })), null);
  assert.equal(await resolveOidcAccount(identity, issuer, env, async () => null), null);
  for (const config of ['bad', '{}', JSON.stringify([{ subject: 'approved-sub', email: target.email, userId: target.id, role: 'admin' }]), JSON.stringify([JSON.parse(env.OIDC_ACCOUNT_LINKS)[0], JSON.parse(env.OIDC_ACCOUNT_LINKS)[0]])]) assert.equal(await resolveOidcAccount(identity, issuer, { ...env, OIDC_ACCOUNT_LINKS: config }, async () => target), null);
});
