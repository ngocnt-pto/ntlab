(function (root) {
  'use strict';

  const FIREBASE_CDN_BASE = 'https://www.gstatic.com/firebasejs/10.14.1';

  function mergeHistoryRecords(localHistory = [], cloudHistory = [], limit = 200) {
    const map = new Map();
    const all = [...(Array.isArray(cloudHistory) ? cloudHistory : []), ...(Array.isArray(localHistory) ? localHistory : [])];
    for (const item of all) {
      if (!item || typeof item.lessonId !== 'string' || typeof item.at !== 'string') continue;
      const key = `${item.lessonId}|${item.at}`;
      if (!map.has(key)) map.set(key, item);
    }
    return Array.from(map.values())
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .slice(-limit);
  }

  function mergeDesktopState(localState = {}, cloudState = {}) {
    return {
      completedSessions: Math.max(Number(localState.completedSessions) || 0, Number(cloudState.completedSessions) || 0),
      focusMinutes: Math.max(Number(localState.focusMinutes) || 0, Number(cloudState.focusMinutes) || 0),
      todos: Array.isArray(localState.todos) && localState.todos.length === 3
        ? localState.todos
        : (Array.isArray(cloudState.todos) && cloudState.todos.length === 3 ? cloudState.todos : [])
    };
  }

  /**
   * Pure transaction logic that can run against real Firestore or an in-memory test mock.
   * Ensures 1 License Key = 1 Google Account (anti-sharing).
   */
  async function redeemLicenseTransaction(dbAdapter, user, verifiedKey) {
    if (!user || !user.uid) {
      return { valid: false, reason: 'Vui lòng đăng nhập Google trước khi kích hoạt mã trên Cloud.' };
    }
    const { code, scope } = verifiedKey;
    return dbAdapter.runLicenseClaimTransaction({
      uid: user.uid,
      email: user.email || '',
      code,
      scope,
      now: new Date().toISOString()
    });
  }

  // Browser runtime controller
  const listeners = new Set();
  let currentUser = null;
  let sdkReady = false;
  let sdkError = null;
  let lastSyncAt = null;
  let fb = null; // Holds modular firebase references once loaded

  function notify() {
    const snapshot = getStatus();
    listeners.forEach(fn => {
      try { fn(snapshot); } catch { /* ignore listener error */ }
    });
  }

  function getStatus() {
    const cfgMod = root.NTLabFirebaseConfig;
    const configured = cfgMod ? cfgMod.isConfigured() : false;
    return {
      configured,
      sdkReady,
      sdkError,
      lastSyncAt,
      user: currentUser ? {
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || currentUser.email || 'Người dùng Google',
        photoURL: currentUser.photoURL || ''
      } : null
    };
  }

  async function initBrowserFirebase() {
    const cfgMod = root.NTLabFirebaseConfig;
    if (!cfgMod || !cfgMod.isConfigured() || typeof window === 'undefined') {
      notify();
      return false;
    }
    if (fb) return true;

    try {
      const [appMod, authMod, storeMod] = await Promise.all([
        import(`${FIREBASE_CDN_BASE}/firebase-app.js`),
        import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
        import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)
      ]);

      const app = appMod.initializeApp(cfgMod.firebaseConfig);
      const auth = authMod.getAuth(app);
      const db = storeMod.getFirestore(app);
      const provider = new authMod.GoogleAuthProvider();

      fb = { app, auth, db, provider, authMod, storeMod };
      sdkReady = true;

      authMod.onAuthStateChanged(auth, async user => {
        currentUser = user || null;
        if (currentUser) {
          await syncUserEntitlementsOnLogin();
        }
        notify();
      });

      return true;
    } catch (err) {
      sdkError = err?.message || 'Không thể tải Firebase SDK.';
      notify();
      return false;
    }
  }

  function createFirestoreAdapter() {
    if (!fb) return null;
    const { db, storeMod } = fb;
    return {
      async runLicenseClaimTransaction({ uid, email, code, scope, now }) {
        const licenseRef = storeMod.doc(db, 'licenses', code);
        const userRef = storeMod.doc(db, 'users', uid);

        return storeMod.runTransaction(db, async tx => {
          const licSnap = await tx.get(licenseRef);
          if (licSnap.exists()) {
            const data = licSnap.data();
            if (data.claimedBy && data.claimedBy !== uid) {
              return {
                valid: false,
                reason: 'Mã kích hoạt này đã được sử dụng trên một tài khoản Google khác.'
              };
            }
          }
          const userSnap = await tx.get(userRef);
          const prevEntitlements = userSnap.exists() ? (userSnap.data().entitlements || {}) : {};
          const prevCodes = userSnap.exists() && Array.isArray(userSnap.data().activatedCodes)
            ? userSnap.data().activatedCodes
            : [];

          tx.set(licenseRef, {
            code,
            scope,
            claimedBy: uid,
            claimedEmail: email,
            claimedAt: licSnap.exists() ? (licSnap.data().claimedAt || now) : now
          }, { merge: true });

          const updatedCodes = prevCodes.includes(code) ? prevCodes : [...prevCodes, code];
          tx.set(userRef, {
            uid,
            email,
            updatedAt: now,
            entitlements: { ...prevEntitlements, [scope]: true },
            activatedCodes: updatedCodes
          }, { merge: true });

          return { valid: true, code, scope, syncedToCloud: true };
        });
      }
    };
  }

  async function syncUserEntitlementsOnLogin() {
    if (!fb || !currentUser || !root.NTLabPlatform) return;
    const client = root.NTLabPlatform.createClient();
    const { db, storeMod } = fb;

    try {
      // 1. Nếu máy local đã nhập mã trước khi đăng nhập, tự động gắn mã đó lên tài khoản Google
      const adapter = createFirestoreAdapter();
      for (const item of client.state.licenses) {
        const verified = root.NTLabPlatform.verifyLicenseKey(item.code);
        if (verified.valid && adapter) {
          await redeemLicenseTransaction(adapter, currentUser, verified).catch(() => {});
        }
      }

      // 2. Tải quyền từ Firestore users/{uid} về máy hiện tại
      const userRef = storeMod.doc(db, 'users', currentUser.uid);
      const snap = await storeMod.getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        const codes = Array.isArray(data.activatedCodes) ? data.activatedCodes : [];
        let changed = false;
        for (const c of codes) {
          const v = root.NTLabPlatform.verifyLicenseKey(c);
          if (v.valid && !client.state.licenses.some(l => l.code === v.code)) {
            client.state.licenses.push({ code: v.code, scope: v.scope, activatedAt: data.updatedAt || new Date().toISOString() });
            changed = true;
          }
        }
        if (changed) client.save();
      }

      // 3. Đồng bộ lịch sử luyện tập go-may từ Firestore về localStorage ngay khi đăng nhập
      if (typeof localStorage !== 'undefined') {
        try {
          const localRaw = JSON.parse(localStorage.getItem('go-may:v1') || '{"history":[]}');
          const mergedGoMay = await syncAppState('go-may', localRaw);
          localStorage.setItem('go-may:v1', JSON.stringify(mergedGoMay));
        } catch { /* ignore */ }
      }
      lastSyncAt = new Date().toISOString();
    } catch {
      /* giữ nguyên quyền local nếu mất mạng tạm thời */
    }
  }

  async function signInWithGoogle() {
    const ok = await initBrowserFirebase();
    if (!ok || !fb) {
      return {
        ok: false,
        reason: 'Chưa cấu hình Firebase. Hãy điền firebaseConfig vào file shared/firebase-config.js.'
      };
    }
    try {
      const res = await fb.authMod.signInWithPopup(fb.auth, fb.provider);
      currentUser = res.user;
      await syncUserEntitlementsOnLogin();
      notify();
      return { ok: true, user: getStatus().user };
    } catch (err) {
      return { ok: false, reason: err?.message || 'Đăng nhập Google bị hủy hoặc gặp lỗi.' };
    }
  }

  async function signOut() {
    if (!fb) return;
    await fb.authMod.signOut(fb.auth);
    currentUser = null;
    notify();
  }

  async function activateLicense(rawCode) {
    if (!root.NTLabPlatform) return { valid: false, reason: 'Thiếu module NTLabPlatform.' };
    const verified = root.NTLabPlatform.verifyLicenseKey(rawCode);
    if (!verified.valid) return verified;

    const client = root.NTLabPlatform.createClient();

    // Nếu đã cấu hình Firebase và đã đăng nhập Google -> Kiểm tra & khóa mã trên Firestore
    if (fb && currentUser) {
      try {
        const adapter = createFirestoreAdapter();
        const cloudRes = await redeemLicenseTransaction(adapter, currentUser, verified);
        if (!cloudRes.valid) return cloudRes;
      } catch {
        /* nếu lỗi mạng tạm thời, vẫn cho lưu local và đồng bộ sau */
      }
    }

    return client.activateLicense(rawCode);
  }

  async function syncAppState(appId, localState) {
    if (!fb || !currentUser || !appId) return localState;
    const { db, storeMod } = fb;
    try {
      const docRef = storeMod.doc(db, 'users', currentUser.uid, 'apps', appId);
      const snap = await storeMod.getDoc(docRef);
      const cloudData = snap.exists() ? snap.data() : {};

      let merged = { ...localState };
      if (appId === 'go-may') {
        merged.history = mergeHistoryRecords(localState.history, cloudData.history, 200);
        merged.settings = { ...(cloudData.settings || {}), ...(localState.settings || {}) };
        const localDays = localState.dailySecondsMap || {};
        const cloudDays = cloudData.dailySecondsMap || {};
        const mergedDays = { ...cloudDays };
        for (const [k, v] of Object.entries(localDays)) {
          mergedDays[k] = Math.max(Number(mergedDays[k]) || 0, Number(v) || 0);
        }
        merged.dailySecondsMap = mergedDays;
      } else if (appId === 'man-hinh-desktop') {
        merged = mergeDesktopState(localState, cloudData);
      }

      const nowIso = new Date().toISOString();
      await storeMod.setDoc(docRef, {
        ...merged,
        updatedAt: nowIso
      }, { merge: true });

      lastSyncAt = nowIso;
      notify();
      return merged;
    } catch {
      return localState;
    }
  }

  function onChange(callback) {
    if (typeof callback === 'function') listeners.add(callback);
    return () => listeners.delete(callback);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      initBrowserFirebase();
    });
  }

  const api = {
    mergeHistoryRecords,
    mergeDesktopState,
    redeemLicenseTransaction,
    getStatus,
    initBrowserFirebase,
    signInWithGoogle,
    signOut,
    activateLicense,
    syncAppState,
    onChange
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NTLabCloud = api;
})(globalThis);
