(function (root) {
  'use strict';

  const PLATFORM_STORAGE_KEY = 'ntlab:platform:v1';
  const VISITOR_STORAGE_KEY = 'ntlab:visitor_id:v1';
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

  function generateOrderCode(scopeOrPrefix = 'ALL') {
    const upper = String(scopeOrPrefix).toUpperCase();
    const prefix = SCOPE_BY_PREFIX[upper] ? upper : (PREFIX_BY_SCOPE[scopeOrPrefix] || 'ALL');
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `NTLAB-${prefix}-${code}`;
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

  function computeExpiresAt(activatedAtIso, durationDays) {
    const days = Number(durationDays);
    if (!Number.isFinite(days) || days <= 0) return null;
    const baseMs = activatedAtIso ? Date.parse(activatedAtIso) : Date.now();
    const validBase = Number.isFinite(baseMs) ? baseMs : Date.now();
    return new Date(validBase + days * 86400000).toISOString();
  }

  function isLicenseActive(item, nowMs = Date.now()) {
    if (!item || typeof item.code !== 'string') return false;
    if (item.revoked === true) return false;
    const v = verifyLicenseKey(item.code);
    if (!v.valid) return false;
    if (item.expiresAt) {
      const expMs = Date.parse(item.expiresAt);
      if (Number.isFinite(expMs) && expMs <= nowMs) return false;
    }
    return true;
  }

  function formatRemainingTime(expiresAt, nowMs = Date.now()) {
    if (!expiresAt) return 'Vĩnh viễn';
    const expMs = Date.parse(expiresAt);
    if (!Number.isFinite(expMs)) return 'Vĩnh viễn';
    const diffMs = expMs - nowMs;
    if (diffMs <= 0) return 'Đã hết hạn';
    const days = Math.ceil(diffMs / 86400000);
    const dateStr = new Date(expMs).toLocaleDateString('vi-VN');
    return `Còn ${days} ngày (đến ${dateStr})`;
  }

  function defaultPlatformState() {
    return {
      previews: { 'all-access': false, 'go-may': false, 'man-hinh-desktop': false },
      licenses: [],
      trialStartedAt: null,
      downloadsCount: 0
    };
  }

  function readPlatformState(storage) {
    const fallback = defaultPlatformState();
    if (!storage) return fallback;
    try {
      const raw = JSON.parse(storage.getItem(PLATFORM_STORAGE_KEY));
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        if (typeof raw.trialStartedAt === 'string') fallback.trialStartedAt = raw.trialStartedAt;
        if (Number(raw.downloadsCount) > 0) fallback.downloadsCount = Number(raw.downloadsCount);
        if (Array.isArray(raw.licenses)) {
          fallback.licenses = raw.licenses.filter(item => {
            if (!item || typeof item.code !== 'string') return false;
            return verifyLicenseKey(item.code).valid;
          }).map(item => {
            const v = verifyLicenseKey(item.code);
            const activatedAt = item.activatedAt || new Date().toISOString();
            const durationDays = item.durationDays !== undefined ? Number(item.durationDays) : 365;
            const expiresAt = item.expiresAt !== undefined
              ? item.expiresAt
              : computeExpiresAt(activatedAt, durationDays);
            return {
              code: v.code,
              scope: v.scope,
              activatedAt,
              durationDays,
              expiresAt,
              revoked: Boolean(item.revoked)
            };
          }).slice(-50);
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

  function getOrCreateVisitorId(storage) {
    if (!storage && typeof localStorage !== 'undefined') {
      try { storage = localStorage; } catch { storage = null; }
    }
    const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
    if (storage) {
      try {
        const existing = storage.getItem(VISITOR_STORAGE_KEY);
        if (existing && /^v-[a-zA-Z0-9_-]{8,40}$/.test(existing)) return existing;
      } catch { /* ignore */ }
    }
    let id = 'v-';
    for (let i = 0; i < 16; i++) {
      id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (storage) {
      try { storage.setItem(VISITOR_STORAGE_KEY, id); } catch { /* ignore */ }
    }
    return id;
  }

  function isAppUnlocked(state, appId, nowMs = Date.now()) {
    if (!state || !Array.isArray(state.licenses)) return false;
    return state.licenses.some(item => {
      if (!isLicenseActive(item, nowMs)) return false;
      return item.scope === 'all-access' || item.scope === appId || appId === 'all-access' && item.scope === 'all-access';
    });
  }

  function getUnlockMode(state, appId, nowMs = Date.now()) {
    if (!state || !Array.isArray(state.licenses)) return 'free';
    const matching = state.licenses.filter(item => item.scope === 'all-access' || item.scope === appId);
    const activeBundle = matching.find(item => item.scope === 'all-access' && isLicenseActive(item, nowMs));
    if (activeBundle) return 'license-bundle';
    const activeSingle = matching.find(item => item.scope === appId && isLicenseActive(item, nowMs));
    if (activeSingle) return 'license-single';
    if (matching.length > 0) return 'expired';
    return 'free';
  }

  function getLicenseDetails(state, appId = 'all-access', nowMs = Date.now()) {
    const mode = getUnlockMode(state, appId, nowMs);
    const licenses = Array.isArray(state?.licenses) ? state.licenses : [];
    const active = licenses.find(item => (item.scope === 'all-access' || item.scope === appId) && isLicenseActive(item, nowMs))
      || licenses.find(item => isLicenseActive(item, nowMs))
      || null;
    const latestExpired = !active
      ? (licenses.find(item => item.scope === 'all-access' || item.scope === appId) || licenses[licenses.length - 1] || null)
      : null;
    const target = active || latestExpired;
    return {
      unlocked: Boolean(active && (active.scope === 'all-access' || active.scope === appId)),
      mode,
      license: target,
      expiresAt: target ? target.expiresAt : null,
      durationDays: target ? target.durationDays : null,
      remainingText: target ? formatRemainingTime(target.expiresAt, nowMs) : 'Chưa kích hoạt'
    };
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
        state.trialStartedAt = fresh.trialStartedAt;
        state.downloadsCount = fresh.downloadsCount;
        return state;
      },
      hasAccess(appId, tier = 'plus') {
        if (tier === 'free') return true;
        return isAppUnlocked(state, appId);
      },
      unlockStatus(appId) {
        return getUnlockMode(state, appId);
      },
      licenseDetails(appId) {
        return getLicenseDetails(state, appId);
      },
      setPreview() {
        // Đã tắt hoàn toàn chế độ giả lập VIP local để sử dụng thực tế
        return false;
      },
      markTrialStarted() {
        if (!state.trialStartedAt) {
          state.trialStartedAt = new Date().toISOString();
          this.save();
        }
        return state.trialStartedAt;
      },
      incrementDownload() {
        state.downloadsCount = (Number(state.downloadsCount) || 0) + 1;
        this.save();
        return state.downloadsCount;
      },
      activateLicense(rawCode, meta = {}) {
        const result = verifyLicenseKey(rawCode);
        if (!result.valid) return result;
        const catalogCfg = root.NTLabCatalog ? root.NTLabCatalog.getScopeConfig(result.scope) : null;
        const defaultDays = catalogCfg && catalogCfg.durationDays !== undefined ? Number(catalogCfg.durationDays) : 365;
        const durationDays = meta.durationDays !== undefined ? Number(meta.durationDays) : defaultDays;
        const activatedAt = meta.activatedAt || new Date().toISOString();
        const expiresAt = meta.expiresAt !== undefined
          ? meta.expiresAt
          : computeExpiresAt(activatedAt, durationDays);

        const existingIdx = state.licenses.findIndex(item => item.code === result.code);
        const entry = {
          code: result.code,
          scope: result.scope,
          activatedAt,
          durationDays,
          expiresAt,
          revoked: Boolean(meta.revoked)
        };

        if (existingIdx >= 0) {
          state.licenses[existingIdx] = { ...state.licenses[existingIdx], ...entry };
        } else {
          state.licenses.push(entry);
        }
        this.save();
        return {
          ...result,
          durationDays,
          expiresAt,
          remainingText: formatRemainingTime(expiresAt),
          alreadyActivated: existingIdx >= 0
        };
      },
      removeLicense(code) {
        state.licenses = state.licenses.filter(item => item.code !== code);
        return this.save();
      }
    };
  }

  const api = {
    PLATFORM_STORAGE_KEY,
    VISITOR_STORAGE_KEY,
    generateLicenseKey,
    generateOrderCode,
    verifyLicenseKey,
    computeExpiresAt,
    isLicenseActive,
    formatRemainingTime,
    getOrCreateVisitorId,
    readPlatformState,
    savePlatformState,
    isAppUnlocked,
    getUnlockMode,
    getLicenseDetails,
    createClient
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NTLabPlatform = api;
})(globalThis);
