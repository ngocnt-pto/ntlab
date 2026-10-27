const { test } = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../shared/catalog.js');
const platform = require('../shared/platform.js');
const cloud = require('../shared/firebase-cloud.js');
const fbConfig = require('../shared/firebase-config.js');

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); }
  };
}

test('catalog defines storefront apps (/go-may/, /man-hinh-desktop/), all-access bundle, and dynamic pricing/duration', () => {
  const goMay = catalog.getApp('go-may');
  const desktop = catalog.getApp('man-hinh-desktop');
  assert.equal(goMay.path, '/go-may/');
  assert.equal(desktop.path, '/man-hinh-desktop/');
  assert.equal(catalog.bundle.id, 'all-access');
  assert.ok(catalog.bundle.price > goMay.price);

  // Admin dynamic pricing & VIP duration update
  catalog.applyRemoteConfig({
    bundle: { price: 129000, durationDays: 180 },
    apps: { 'go-may': { id: 'go-may', price: 49000, durationDays: 90 } },
    paymentConfig: { bankId: 'VCB', accountNo: '0123456789', accountName: 'TUAN NGOC' }
  }, false);

  assert.equal(catalog.bundle.price, 129000);
  assert.equal(catalog.bundle.durationDays, 180);
  assert.equal(catalog.getApp('go-may').price, 49000);
  assert.equal(catalog.getApp('go-may').durationDays, 90);
  assert.match(catalog.buildVietQrUrl(49000, 'NTLAB-GM-234567'), /VCB-0123456789/);

  // Restore defaults
  catalog.applyRemoteConfig({
    bundle: { price: 99000, durationDays: 365 },
    apps: { 'go-may': { id: 'go-may', price: 39000, durationDays: 365 } }
  }, false);
});

test('fake local VIP simulation (setPreview) is disabled in production mode', () => {
  const storage = createMemoryStorage();
  const client = platform.createClient(storage);

  assert.equal(client.setPreview('go-may', true), false);
  assert.equal(client.hasAccess('go-may'), false);
  assert.equal(client.hasAccess('all-access'), false);
});

test('single-app license key unlocks only that specific app and tracks VIP duration', () => {
  const storage = createMemoryStorage();
  const client = platform.createClient(storage);

  const gmKey = platform.generateLicenseKey('GM', 'ABCDEF');
  assert.match(gmKey, /^GM-ABCDEF-[2-9A-HJ-NP-Z]{4}$/);

  const res = client.activateLicense(gmKey, { durationDays: 30 });
  assert.equal(res.valid, true);
  assert.equal(res.scope, 'go-may');
  assert.equal(res.durationDays, 30);
  assert.ok(res.expiresAt);

  assert.equal(client.hasAccess('go-may'), true);
  assert.equal(client.hasAccess('man-hinh-desktop'), false);
  assert.equal(client.hasAccess('all-access'), false);
  assert.match(client.licenseDetails('go-may').remainingText, /Còn 30 ngày/);
});

test('expired or revoked VIP licenses automatically lose access and report expired status', () => {
  const storage = createMemoryStorage();
  const client = platform.createClient(storage);

  const gmKey = platform.generateLicenseKey('GM', 'EXP234');
  const pastIso = new Date(Date.now() - 10 * 86400000).toISOString();
  const expiredIso = new Date(Date.now() - 1 * 86400000).toISOString();

  client.activateLicense(gmKey, {
    activatedAt: pastIso,
    durationDays: 7,
    expiresAt: expiredIso
  });

  assert.equal(client.hasAccess('go-may'), false);
  assert.equal(client.unlockStatus('go-may'), 'expired');
  assert.equal(client.licenseDetails('go-may').remainingText, 'Đã hết hạn');
});

test('all-access bundle license key unlocks every app across the ecosystem', () => {
  const storage = createMemoryStorage();
  const client = platform.createClient(storage);

  const bundleKey = platform.generateLicenseKey('ALL', 'VIP999');
  const res = client.activateLicense(bundleKey, { durationDays: 0 }); // 0 = Vĩnh viễn
  assert.equal(res.valid, true);
  assert.equal(res.scope, 'all-access');
  assert.equal(res.expiresAt, null);

  assert.equal(client.hasAccess('go-may'), true);
  assert.equal(client.hasAccess('man-hinh-desktop'), true);
  assert.equal(client.hasAccess('doc-nhanh'), true);
  assert.equal(client.unlockStatus('go-may'), 'license-bundle');
  assert.equal(client.licenseDetails('go-may').remainingText, 'Vĩnh viễn');
});

test('forged or mistyped license keys are rejected cleanly and order codes match Firestore rules', () => {
  const validKey = platform.generateLicenseKey('GM', '234567');
  const forgedKey = validKey.slice(0, -1) + (validKey.endsWith('2') ? '3' : '2');
  assert.equal(platform.verifyLicenseKey(forgedKey).valid, false);
  assert.equal(platform.verifyLicenseKey('INVALID-KEY').valid, false);

  const orderCode = platform.generateOrderCode('ALL');
  assert.match(orderCode, /^NTLAB-(ALL|GM|MD|DN)-[2-9A-HJ-NP-Z]{6}$/);
});

test('admin authorization strictly allows only tuanngocpt@gmail.com', () => {
  assert.equal(cloud.isAdminUser({ email: 'tuanngocpt@gmail.com', emailVerified: true }), true);
  assert.equal(cloud.isAdminUser({ email: 'TUANNGOCPT@GMAIL.COM', emailVerified: true }), true);
  assert.equal(cloud.isAdminUser({ email: 'tuanngocpt@gmail.com', emailVerified: false }), false);
  assert.equal(cloud.isAdminUser({ email: 'otheruser@gmail.com', emailVerified: true }), false);
  assert.equal(cloud.isAdminUser(null), false);
});

test('shared storage persists entitlements across reloads on the same origin', () => {
  const storage = createMemoryStorage();
  const client1 = platform.createClient(storage);
  const mdKey = platform.generateLicenseKey('MD');
  client1.activateLicense(mdKey);

  const client2 = platform.createClient(storage);
  assert.equal(client2.hasAccess('man-hinh-desktop'), true);
  assert.equal(client2.hasAccess('go-may'), false);
});

test('Firebase cloud merges history across devices without duplicates', () => {
  const localHistory = [
    { lessonId: 'day-1-1', at: '2026-10-26T08:00:00.000Z', wpm: 45, accuracy: 96, seconds: 30 },
    { lessonId: 'day-1-2', at: '2026-10-26T08:10:00.000Z', wpm: 50, accuracy: 98, seconds: 35 }
  ];
  const cloudHistory = [
    { lessonId: 'day-1-1', at: '2026-10-26T08:00:00.000Z', wpm: 45, accuracy: 96, seconds: 30 },
    { lessonId: 'quick-test', at: '2026-10-26T07:50:00.000Z', wpm: 40, accuracy: 95, seconds: 25 }
  ];
  const merged = cloud.mergeHistoryRecords(localHistory, cloudHistory, 200);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map(x => x.lessonId), ['quick-test', 'day-1-1', 'day-1-2']);
});

test('Firestore license transaction locks 1 key to 1 Google account and blocks sharing', async () => {
  const licensesDb = new Map();
  const usersDb = new Map();

  const mockAdapter = {
    async runLicenseClaimTransaction({ uid, email, code, scope, durationDays, now }) {
      const existing = licensesDb.get(code);
      if (existing && existing.claimedBy && existing.claimedBy !== uid) {
        return { valid: false, reason: 'Mã kích hoạt này đã được sử dụng trên một tài khoản Google khác.' };
      }
      const expiresAt = platform.computeExpiresAt(now, durationDays);
      licensesDb.set(code, { code, scope, claimedBy: uid, claimedEmail: email, claimedAt: now, durationDays, expiresAt });
      const userDoc = usersDb.get(uid) || { entitlements: {}, activatedCodes: [] };
      userDoc.entitlements[scope] = true;
      userDoc.vipDurationDays = durationDays;
      userDoc.vipExpiresAt = expiresAt;
      if (!userDoc.activatedCodes.includes(code)) userDoc.activatedCodes.push(code);
      usersDb.set(uid, userDoc);
      return { valid: true, code, scope, durationDays, expiresAt, syncedToCloud: true };
    }
  };

  const rawKey = platform.generateLicenseKey('ALL', 'CLOUD9');
  const verified = platform.verifyLicenseKey(rawKey);

  // User A claims the key -> succeeds
  const claimA = await cloud.redeemLicenseTransaction(mockAdapter, { uid: 'user-A', email: 'a@gmail.com' }, verified, { durationDays: 365 });
  assert.equal(claimA.valid, true);
  assert.equal(usersDb.get('user-A').entitlements['all-access'], true);
  assert.equal(usersDb.get('user-A').vipDurationDays, 365);

  // User A re-claims on a 2nd laptop -> succeeds
  const claimA2 = await cloud.redeemLicenseTransaction(mockAdapter, { uid: 'user-A', email: 'a@gmail.com' }, verified);
  assert.equal(claimA2.valid, true);

  // User B tries to use User A's key -> rejected!
  const claimB = await cloud.redeemLicenseTransaction(mockAdapter, { uid: 'user-B', email: 'b@gmail.com' }, verified);
  assert.equal(claimB.valid, false);
  assert.match(claimB.reason, /tài khoản Google khác/);
});

test('firebaseConfig defaults to unconfigured local mode until credentials are added', () => {
  assert.equal(fbConfig.isConfigured({ apiKey: '', projectId: '' }), false);
  assert.equal(fbConfig.isConfigured({ apiKey: 'AIzaSyDummyKey123456', projectId: 'ntlab-prod' }), true);
});
