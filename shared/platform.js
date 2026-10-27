(function (root) {
  'use strict';

  const PLATFORM_STORAGE_KEY = 'ntlab:platform:v1';
  const SCOPE_BY_PREFIX = {
    ALL: 'all-access',
    GM: 'go-may',
    MD: 'man-hinh-desktop',
    DN: 'doc-nhanh'
  };
  const PREFIX_BY_SCOPE = {
    'all-access': 'ALL',
    'go-may': 'GM',
    'man-hinh-desktop': 'MD',
    'doc-nhanh': 'DN'
  };

  function computeChecksum(prefix, payload) {
    const input = `NTLAB-SUITE-V1:${prefix}:${payload}`;
    let h1 = 0x811c9dc5;
    let h2 = 5381;
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      h1 ^= code;
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = ((h2 << 5) + h2 + code) >>> 0;
    }
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let out = '';
    let combined = (h1 ^ h2) >>> 0;
    for (let i = 0; i < 4; i++) {
      out += alphabet[combined % alphabet.length];
      combined = (Math.floor(combined / alphabet.length) ^ (h1 >>> (i * 4))) >>> 0;
    }
    return out;
  }

  function generateLicenseKey(scopeOrPrefix = 'ALL', seed = '') {
    const upper = String(scopeOrPrefix).toUpperCase();
    const prefix = SCOPE_BY_PREFIX[upper] ? upper : (PREFIX_BY_SCOPE[scopeOrPrefix] || 'ALL');
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let payload = String(seed).toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '').slice(0, 6);
    while (payload.length < 6) {
      const rand = Math.floor(Math.random() * alphabet.length);
      payload += alphabet[rand];
    }
    const check = computeChecksum(prefix, payload);
    return `${prefix}-${payload}-${check}`;
  }

  function verifyLicenseKey(rawCode) {
    if (typeof rawCode !== 'string') return { valid: false, reason: 'Mã không hợp lệ.' };
    const cleaned = rawCode.trim().toUpperCase().replace(/\s+/g, '');
    const match = /^(ALL|GM|MD|DN)-([2-9A-HJ-NP-Z]{6})-([2-9A-HJ-NP-Z]{4})$/.exec(cleaned);
    if (!match) {
      return { valid: false, reason: 'Định dạng mã cần theo mẫu: GM-XXXXXX-XXXX hoặc ALL-XXXXXX-XXXX.' };
    }
    const [, prefix, payload, check] = match;
    const expected = computeChecksum(prefix, payload);
    if (check !== expected) {
      return { valid: false, reason: 'Mã kích hoạt không đúng. Vui lòng kiểm tra lại các ký tự.' };
    }
    return {
      valid: true,
      code: cleaned,
      prefix,
      scope: SCOPE_BY_PREFIX[prefix]
    };
  }

  function defaultPlatformState() {
    return {
      previews: { 'all-access': false, 'go-may': false, 'man-hinh-desktop': false },
      licenses: []
    };
  }

  function readPlatformState(storage) {
    const fallback = defaultPlatformState();
    if (!storage) return fallback;
    try {
      const raw = JSON.parse(storage.getItem(PLATFORM_STORAGE_KEY));
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        if (raw.previews && typeof raw.previews === 'object') {
          for (const key of Object.keys(raw.previews)) {
            if (typeof raw.previews[key] === 'boolean') fallback.previews[key] = raw.previews[key];
          }
        }
        if (Array.isArray(raw.licenses)) {
          fallback.licenses = raw.licenses.filter(item => {
            if (!item || typeof item.code !== 'string') return false;
            return verifyLicenseKey(item.code).valid;
          }).slice(-50);
        }
      }
      // Đồng bộ trạng thái xem thử cũ từ go-may:v1 nếu có
      const legacyGoMay = storage.getItem('go-may:v1');
      if (legacyGoMay) {
        const parsed = JSON.parse(legacyGoMay);
        if (parsed && parsed.plusPreview === true && !raw) {
          fallback.previews['go-may'] = true;
        }
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  function savePlatformState(storage, state) {
    if (!storage) return false;
    try {
      storage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function isAppUnlocked(state, appId) {
    if (!state) return false;
    const hasLicense = Array.isArray(state.licenses) && state.licenses.some(
      item => item.scope === 'all-access' || item.scope === appId
    );
    if (hasLicense) return true;
    const previews = state.previews || {};
    return Boolean(previews['all-access'] || previews[appId]);
  }

  function getUnlockMode(state, appId) {
    if (!state) return 'free';
    if (Array.isArray(state.licenses)) {
      if (state.licenses.some(item => item.scope === 'all-access')) return 'license-bundle';
      if (state.licenses.some(item => item.scope === appId)) return 'license-single';
    }
    if (state.previews?.['all-access']) return 'preview-bundle';
    if (state.previews?.[appId]) return 'preview-single';
    return 'free';
  }

  function createClient(storage) {
    if (storage === undefined) {
      try { storage = root.localStorage; } catch { storage = null; }
    }
    const state = readPlatformState(storage);

    return {
      state,
      save() {
        return savePlatformState(storage, state);
      },
      reload() {
        const fresh = readPlatformState(storage);
        state.previews = fresh.previews;
        state.licenses = fresh.licenses;
        return state;
      },
      hasAccess(appId, tier = 'plus') {
        if (tier === 'free') return true;
        return isAppUnlocked(state, appId);
      },
      unlockStatus(appId) {
        return getUnlockMode(state, appId);
      },
      setPreview(scope, enabled) {
        state.previews[scope] = Boolean(enabled);
        return this.save();
      },
      activateLicense(rawCode) {
        const result = verifyLicenseKey(rawCode);
        if (!result.valid) return result;
        const exists = state.licenses.some(item => item.code === result.code);
        if (!exists) {
          state.licenses.push({
            code: result.code,
            scope: result.scope,
            activatedAt: new Date().toISOString()
          });
          this.save();
        }
        return { ...result, alreadyActivated: exists };
      },
      removeLicense(code) {
        state.licenses = state.licenses.filter(item => item.code !== code);
        return this.save();
      }
    };
  }

  const api = {
    PLATFORM_STORAGE_KEY,
    generateLicenseKey,
    verifyLicenseKey,
    readPlatformState,
    savePlatformState,
    isAppUnlocked,
    getUnlockMode,
    createClient
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NTLabPlatform = api;
})(globalThis);
