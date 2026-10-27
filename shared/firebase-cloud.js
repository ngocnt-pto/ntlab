(function (root) {
  'use strict';

  const FIREBASE_CDN_BASE = 'https://www.gstatic.com/firebasejs/10.14.1';
  const ADMIN_EMAIL = 'tuanngocpt@gmail.com';

  function isAdminUser(user) {
    if (!user || typeof user.email !== 'string') return false;
    return user.email.trim().toLowerCase() === ADMIN_EMAIL && user.emailVerified !== false;
  }

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
   * Ensures 1 License Key = 1 Google Account (anti-sharing) and tracks VIP duration / expiration.
   */
  async function redeemLicenseTransaction(dbAdapter, user, verifiedKey, options = {}) {
    if (!user || !user.uid) {
      return { valid: false, reason: 'Vui lòng đăng nhập Google trước khi kích hoạt mã trên Cloud.' };
    }
    const { code, scope } = verifiedKey;
    const defaultDuration = root.NTLabCatalog
      ? Number(root.NTLabCatalog.getScopeConfig(scope)?.durationDays ?? 365)
      : 365;
    const durationDays = options.durationDays !== undefined ? Number(options.durationDays) : defaultDuration;
    return dbAdapter.runLicenseClaimTransaction({
      uid: user.uid,
      email: user.email || '',
      code,
      scope,
      durationDays,
      now: options.now || new Date().toISOString()
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
    const isAdmin = isAdminUser(currentUser);
    return {
      configured,
      sdkReady,
      sdkError,
      lastSyncAt,
      isAdmin,
      adminEmail: ADMIN_EMAIL,
      user: currentUser ? {
        uid: currentUser.uid,
        email: currentUser.email || '',
        emailVerified: currentUser.emailVerified !== false,
         isAdmin,
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

      // 1. Tải cấu hình bảng giá & thời hạn VIP mới nhất từ Firestore (settings/catalog)
      await loadCatalogFromCloud().catch(() => {});

      // 2. Ghi nhận thiết bị truy cập & trạng thái dùng thử
      recordVisitorTelemetry({ action: 'visit' }).catch(() => {});

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

  async function loadCatalogFromCloud() {
    if (!fb || !root.NTLabCatalog) return null;
    try {
      const { db, storeMod } = fb;
      const ref = storeMod.doc(db, 'settings', 'catalog');
      const snap = await storeMod.getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        root.NTLabCatalog.applyRemoteConfig(data, true);
        notify();
        return data;
      }
    } catch { /* ignore offline */ }
    return null;
  }

  async function saveCatalogToCloud(newConfig) {
    const ok = await initBrowserFirebase();
    if (!ok || !fb) {
      return { ok: false, reason: 'Chưa kết nối được với Firebase Cloud.' };
    }
    if (!isAdminUser(currentUser)) {
      return { ok: false, reason: `Từ chối truy cập: Chỉ tài khoản Admin (${ADMIN_EMAIL}) mới có quyền thay đổi bảng giá & cấu hình.` };
    }
    try {
      const { db, storeMod } = fb;
      root.NTLabCatalog.applyRemoteConfig(newConfig, true);
      const exported = root.NTLabCatalog.exportConfig();
      const payload = {
        ...exported,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
      };
      await storeMod.setDoc(storeMod.doc(db, 'settings', 'catalog'), payload, { merge: true });
      notify();
      return { ok: true, config: payload };
    } catch (err) {
      return { ok: false, reason: err?.message || 'Không thể lưu cấu hình lên Firestore.' };
    }
  }

  async function recordVisitorTelemetry(opts = {}) {
    if (!root.NTLabPlatform) return false;
    const client = root.NTLabPlatform.createClient();
    const visitorId = root.NTLabPlatform.getOrCreateVisitorId();
    const nowIso = new Date().toISOString();

    if (opts.action === 'trial' || opts.action === 'visit') {
      client.markTrialStarted();
    }
    if (opts.action === 'download') {
      client.incrementDownload();
    }

    const ok = await initBrowserFirebase();
    if (!ok || !fb) return false;

    try {
      const { db, storeMod } = fb;
      const vRef = storeMod.doc(db, 'visitors', visitorId);
      const vSnap = await storeMod.getDoc(vRef);
      const prev = vSnap.exists() ? vSnap.data() : {};

      const details = client.licenseDetails('all-access');
      const activeLic = client.state.licenses.find(l => root.NTLabPlatform.isLicenseActive(l)) || null;
      const isVip = Boolean(activeLic);
      const downloadCount = opts.action === 'download'
        ? Math.max((Number(prev.downloadCount) || 0) + 1, Number(client.state.downloadsCount) || 1)
        : Math.max(Number(prev.downloadCount) || 0, Number(client.state.downloadsCount) || 0);

      const appsUsed = Array.isArray(prev.appsUsed) ? [...prev.appsUsed] : [];
      if (opts.appId && !appsUsed.includes(opts.appId)) appsUsed.push(opts.appId);

      const visitorData = {
        visitorId,
        uid: currentUser?.uid || prev.uid || '',
        email: currentUser?.email || prev.email || '',
        displayName: currentUser?.displayName || prev.displayName || 'Khách dùng thử',
        firstSeenAt: prev.firstSeenAt || client.state.trialStartedAt || nowIso,
        lastActiveAt: nowIso,
        isTrial: !isVip,
        trialStartedAt: prev.trialStartedAt || client.state.trialStartedAt || nowIso,
        appsUsed,
        downloadCount,
        lastDownloadApp: opts.action === 'download' ? (opts.appId || 'ntlab-suite') : (prev.lastDownloadApp || ''),
        isVip,
        vipScope: activeLic ? activeLic.scope : (prev.vipScope || ''),
        vipActivatedAt: activeLic ? activeLic.activatedAt : (prev.vipActivatedAt || null),
        vipExpiresAt: activeLic ? activeLic.expiresAt : (prev.vipExpiresAt || null),
        vipDurationDays: activeLic ? activeLic.durationDays : (prev.vipDurationDays ?? null),
        licenseCode: activeLic ? activeLic.code : (prev.licenseCode || '')
      };

      await storeMod.setDoc(vRef, visitorData, { merge: true });

      if (currentUser?.uid) {
        const uRef = storeMod.doc(db, 'users', currentUser.uid);
        await storeMod.setDoc(uRef, {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || '',
          visitorId,
          lastActiveAt: nowIso,
          updatedAt: nowIso,
          isTrial: !isVip,
          trialStartedAt: visitorData.trialStartedAt,
          downloadCount
        }, { merge: true });
      }
      return true;
    } catch {
      return false;
    }
  }

  async function trackSoftwareDownload(appId = 'go-may', label = 'offline-app') {
    await recordVisitorTelemetry({ action: 'download', appId, label });
    return true;
  }

  function createFirestoreAdapter() {
    if (!fb) return null;
    const { db, storeMod } = fb;
    return {
      async runLicenseClaimTransaction({ uid, email, code, scope, durationDays, now }) {
        const licenseRef = storeMod.doc(db, 'licenses', code);
        const userRef = storeMod.doc(db, 'users', uid);

        return storeMod.runTransaction(db, async tx => {
          const licSnap = await tx.get(licenseRef);
          let effectiveDuration = durationDays !== undefined ? Number(durationDays) : 365;
          let claimedAt = now;
          let expiresAt = null;

          if (licSnap.exists()) {
            const data = licSnap.data();
            if (data.revoked === true) {
              return {
                valid: false,
                reason: 'Mã kích hoạt này đã bị thu hồi bởi Quản trị viên.'
              };
            }
            if (data.claimedBy && data.claimedBy !== uid) {
              return {
                valid: false,
                reason: 'Mã kích hoạt này đã được sử dụng trên một tài khoản Google khác.'
              };
            }
            if (data.durationDays !== undefined) {
              effectiveDuration = Number(data.durationDays);
            }
            if (data.claimedAt) {
              claimedAt = data.claimedAt;
            }
            if (data.expiresAt !== undefined) {
              expiresAt = data.expiresAt;
            }
          }

          if (expiresAt === null && effectiveDuration > 0 && root.NTLabPlatform) {
            expiresAt = root.NTLabPlatform.computeExpiresAt(claimedAt, effectiveDuration);
          }

          if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
            return {
              valid: false,
              reason: `Mã kích hoạt này đã hết hạn vào ngày ${new Date(expiresAt).toLocaleDateString('vi-VN')}.`
            };
          }

          const userSnap = await tx.get(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {};
          const prevEntitlements = userData.entitlements || {};
          const prevCodes = Array.isArray(userData.activatedCodes) ? userData.activatedCodes : [];
          const prevLicenses = Array.isArray(userData.licenses) ? userData.licenses : [];

          tx.set(licenseRef, {
            code,
            scope,
            claimedBy: uid,
            claimedEmail: email,
            claimedAt,
            durationDays: effectiveDuration,
            expiresAt,
            revoked: false
          }, { merge: true });

          const updatedCodes = prevCodes.includes(code) ? prevCodes : [...prevCodes, code];
          const filteredLicenses = prevLicenses.filter(l => l && l.code !== code);
          filteredLicenses.push({
            code,
            scope,
            activatedAt: claimedAt,
            durationDays: effectiveDuration,
            expiresAt,
            revoked: false
          });

          tx.set(userRef, {
            uid,
            email,
            updatedAt: now,
            lastActiveAt: now,
            isTrial: false,
            vipStatus: 'active',
            vipScope: prevEntitlements['all-access'] || scope === 'all-access' ? 'all-access' : scope,
            vipActivatedAt: claimedAt,
            vipDurationDays: effectiveDuration,
            vipExpiresAt: expiresAt,
            entitlements: { ...prevEntitlements, [scope]: true },
            activatedCodes: updatedCodes,
            licenses: filteredLicenses
          }, { merge: true });

          return {
            valid: true,
            code,
            scope,
            activatedAt: claimedAt,
            durationDays: effectiveDuration,
            expiresAt,
            syncedToCloud: true
          };
        });
      }
    };
  }

  async function syncUserEntitlementsOnLogin() {
    if (!fb || !currentUser || !root.NTLabPlatform) return;
    const client = root.NTLabPlatform.createClient();
    const { db, storeMod } = fb;

    try {
      // 1. Nếu máy local có mã hợp lệ chưa đồng bộ, đẩy lên tài khoản Google
      const adapter = createFirestoreAdapter();
      for (const item of client.state.licenses) {
        const verified = root.NTLabPlatform.verifyLicenseKey(item.code);
        if (verified.valid && adapter && !item.revoked) {
          await redeemLicenseTransaction(adapter, currentUser, verified, {
            durationDays: item.durationDays
          }).catch(() => {});
        }
      }

      // 2. Tải quyền & thời hạn VIP từ Firestore users/{uid} về máy hiện tại
      const userRef = storeMod.doc(db, 'users', currentUser.uid);
      const snap = await storeMod.getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        let changed = false;

        if (data.vipStatus === 'revoked') {
          client.state.licenses = [];
          client.save();
        } else {
          const cloudLicenses = Array.isArray(data.licenses) ? data.licenses : [];
          if (cloudLicenses.length > 0) {
            for (const lic of cloudLicenses) {
              if (!lic || !lic.code) continue;
              const res = client.activateLicense(lic.code, {
                activatedAt: lic.activatedAt || data.vipActivatedAt || data.updatedAt,
                durationDays: lic.durationDays !== undefined ? lic.durationDays : data.vipDurationDays,
                expiresAt: lic.expiresAt !== undefined ? lic.expiresAt : data.vipExpiresAt,
                revoked: Boolean(lic.revoked)
              });
              if (res.valid) changed = true;
            }
          } else if (Array.isArray(data.activatedCodes)) {
            for (const c of data.activatedCodes) {
              const res = client.activateLicense(c, {
                activatedAt: data.vipActivatedAt || data.updatedAt,
                durationDays: data.vipDurationDays !== undefined ? data.vipDurationDays : 365,
                expiresAt: data.vipExpiresAt
              });
              if (res.valid) changed = true;
            }
          }
        }
        if (changed) client.save();
      } else {
        // Khởi tạo hồ sơ user lần đầu đăng nhập (Ghi nhận trạng thái dùng thử)
        const nowIso = new Date().toISOString();
        await storeMod.setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || '',
          visitorId: root.NTLabPlatform.getOrCreateVisitorId(),
          createdAt: nowIso,
          updatedAt: nowIso,
          lastActiveAt: nowIso,
          isTrial: client.state.licenses.length === 0,
          trialStartedAt: client.state.trialStartedAt || nowIso,
          downloadCount: Number(client.state.downloadsCount) || 0,
          vipStatus: client.state.licenses.length > 0 ? 'active' : 'trial'
        }, { merge: true });
      }

      // 3. Đồng bộ bảng统计 visitor với tài khoản Google vừa đăng nhập
      await recordVisitorTelemetry({ action: 'login' });

      // 4. Đồng bộ lịch sử luyện tập go-may từ Firestore về localStorage
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

  async function activateLicense(rawCode, meta = {}) {
    if (!root.NTLabPlatform) return { valid: false, reason: 'Thiếu module NTLabPlatform.' };
    const verified = root.NTLabPlatform.verifyLicenseKey(rawCode);
    if (!verified.valid) return verified;

    const client = root.NTLabPlatform.createClient();
    let activationMeta = { ...meta };

    await initBrowserFirebase();

    // Nếu đã kết nối Firebase và đã đăng nhập Google -> Kiểm tra & khóa mã + thời hạn VIP trên Firestore
    if (fb && currentUser) {
      try {
        const adapter = createFirestoreAdapter();
        const cloudRes = await redeemLicenseTransaction(adapter, currentUser, verified, activationMeta);
        if (!cloudRes.valid) return cloudRes;
        activationMeta = {
          activatedAt: cloudRes.activatedAt,
          durationDays: cloudRes.durationDays,
          expiresAt: cloudRes.expiresAt
        };
      } catch {
        /* nếu lỗi mạng tạm thời, vẫn cho lưu local và đồng bộ sau */
      }
    } else if (fb) {
      // Ngay cả khi chưa đăng nhập, nếu mã đã được tạo trên Cloud thì lấy đúng thời hạn VIP của mã đó
      try {
        const { db, storeMod } = fb;
        const licSnap = await storeMod.getDoc(storeMod.doc(db, 'licenses', verified.code));
        if (licSnap.exists()) {
          const licData = licSnap.data();
          if (licData.revoked === true) {
            return { valid: false, reason: 'Mã kích hoạt này đã bị thu hồi.' };
          }
          if (licData.claimedBy) {
            return { valid: false, reason: 'Mã này đã gắn với một tài khoản Google. Vui lòng đăng nhập đúng Gmail để sử dụng.' };
          }
          if (licData.durationDays !== undefined) activationMeta.durationDays = Number(licData.durationDays);
          if (licData.expiresAt !== undefined) activationMeta.expiresAt = licData.expiresAt;
        }
      } catch { /* ignore */ }
    }

    const localRes = client.activateLicense(rawCode, activationMeta);
    if (localRes.valid) {
      recordVisitorTelemetry({ action: 'activate-vip' }).catch(() => {});
      notify();
    }
    return localRes;
  }

  /**
   * Tạo đơn hàng chờ thanh toán tự động qua VietQR và lắng nghe trạng thái realtime trên Firestore
   */
  async function createAndWatchPaymentOrder(scope = 'all-access', onOrderPaid) {
    if (!root.NTLabCatalog || !root.NTLabPlatform) return null;
    const scopeCfg = root.NTLabCatalog.getScopeConfig(scope);
    const orderCode = root.NTLabPlatform.generateOrderCode(scopeCfg.codePrefix || 'ALL');
    const amount = Number(scopeCfg.price) || 39000;
    const durationDays = scopeCfg.durationDays !== undefined ? Number(scopeCfg.durationDays) : 365;
    const visitorId = root.NTLabPlatform.getOrCreateVisitorId();
    const nowIso = new Date().toISOString();

    const orderPayload = {
      orderCode,
      scope: scope === 'all-access' ? 'all-access' : scopeCfg.id,
      codePrefix: scopeCfg.codePrefix || 'ALL',
      planName: scopeCfg.name || 'Gói VIP NTLab',
      amount,
      durationDays,
      status: 'pending',
      licenseCode: null,
      uid: currentUser?.uid || '',
      email: currentUser?.email || '',
      visitorId,
      createdAt: nowIso
    };

    let unsubscribe = () => {};

    const ok = await initBrowserFirebase();
    if (ok && fb) {
      try {
        const { db, storeMod } = fb;
        const orderRef = storeMod.doc(db, 'orders', orderCode);
        await storeMod.setDoc(orderRef, orderPayload);

        unsubscribe = storeMod.onSnapshot(orderRef, async snap => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (data.status === 'paid' && data.licenseCode) {
            const actRes = await activateLicense(data.licenseCode, {
              activatedAt: data.paidAt || new Date().toISOString(),
              durationDays: data.durationDays !== undefined ? Number(data.durationDays) : durationDays,
              expiresAt: data.expiresAt
            });
            if (typeof onOrderPaid === 'function') {
              onOrderPaid({ order: data, activation: actRes });
            }
          }
        });
      } catch { /* ignore offline */ }
    }

    return {
      ...orderPayload,
      unsubscribe,
      async checkStatusNow() {
        if (!fb) return { paid: false, reason: 'Chưa kết nối Firebase Cloud.' };
        try {
          const { db, storeMod } = fb;
          const snap = await storeMod.getDoc(storeMod.doc(db, 'orders', orderCode));
          if (!snap.exists()) return { paid: false, reason: 'Đơn hàng đang khởi tạo, vui lòng chờ vài giây.' };
          const data = snap.data();
          if (data.status === 'paid' && data.licenseCode) {
            const actRes = await activateLicense(data.licenseCode, {
              activatedAt: data.paidAt || new Date().toISOString(),
              durationDays: data.durationDays !== undefined ? Number(data.durationDays) : durationDays,
              expiresAt: data.expiresAt
            });
            if (typeof onOrderPaid === 'function') {
              onOrderPaid({ order: data, activation: actRes });
            }
            return { paid: true, licenseCode: data.licenseCode, activation: actRes };
          }
          return {
            paid: false,
            reason: 'Hệ thống đang chờ nhận giao dịch chuyển khoản từ ngân hàng (thường mất 5–20 giây sau khi chuyển).'
          };
        } catch (err) {
          return { paid: false, reason: err?.message || 'Lỗi kiểm tra trạng thái đơn hàng.' };
        }
      }
    };
  }

  /**
   * API QUẢN TRỊ DÀNH RIÊNG CHO ADMIN: tuanngocpt@gmail.com
   * Được bảo vệ kép ở cả tầng giao diện và tầng Backend (firestore.rules)
   */
  async function fetchAdminDashboardData() {
    const ok = await initBrowserFirebase();
    if (!ok || !fb) {
      return { ok: false, reason: 'Chưa kết nối Firebase Cloud.' };
    }
    if (!isAdminUser(currentUser)) {
      return { ok: false, reason: `Từ chối truy cập: Chỉ tài khoản ${ADMIN_EMAIL} mới có quyền xem thống kê quản trị.` };
    }

    try {
      const { db, storeMod } = fb;
      const [usersSnap, visitorsSnap, licensesSnap, ordersSnap] = await Promise.all([
        storeMod.getDocs(storeMod.collection(db, 'users')),
        storeMod.getDocs(storeMod.collection(db, 'visitors')),
        storeMod.getDocs(storeMod.collection(db, 'licenses')),
        storeMod.getDocs(storeMod.collection(db, 'orders'))
      ]);

      const usersMap = new Map();
      const linkedVisitorIds = new Set();

      usersSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.visitorId) linkedVisitorIds.add(d.visitorId);
        usersMap.set(docSnap.id, {
          id: docSnap.id,
          uid: docSnap.id,
          visitorId: d.visitorId || '',
          email: d.email || 'Chưa có email',
          displayName: d.displayName || d.email || 'Người dùng Google',
          accountType: 'google',
          downloadCount: Number(d.downloadCount) || 0,
          trialStartedAt: d.trialStartedAt || d.createdAt || null,
          lastActiveAt: d.lastActiveAt || d.updatedAt || null,
          vipStatus: d.vipStatus || 'trial',
          vipScope: d.vipScope || '',
          vipActivatedAt: d.vipActivatedAt || null,
          vipDurationDays: d.vipDurationDays !== undefined ? Number(d.vipDurationDays) : null,
          vipExpiresAt: d.vipExpiresAt || null,
          activatedCodes: Array.isArray(d.activatedCodes) ? d.activatedCodes : [],
          licenses: Array.isArray(d.licenses) ? d.licenses : []
        });
      });

      visitorsSnap.forEach(docSnap => {
        const v = docSnap.data();
        if (v.uid && usersMap.has(v.uid)) {
          const existing = usersMap.get(v.uid);
          existing.downloadCount = Math.max(existing.downloadCount, Number(v.downloadCount) || 0);
          if (!existing.lastActiveAt || (v.lastActiveAt && v.lastActiveAt > existing.lastActiveAt)) {
            existing.lastActiveAt = v.lastActiveAt;
          }
          return;
        }
        if (linkedVisitorIds.has(docSnap.id)) return;
        usersMap.set(docSnap.id, {
          id: docSnap.id,
          uid: '',
          visitorId: docSnap.id,
          email: v.email || `Khách (${docSnap.id.slice(0, 10)})`,
          displayName: v.displayName || 'Khách vãng lai / Dùng thử',
          accountType: 'visitor',
          downloadCount: Number(v.downloadCount) || 0,
          trialStartedAt: v.trialStartedAt || v.firstSeenAt || null,
          lastActiveAt: v.lastActiveAt || v.firstSeenAt || null,
          vipStatus: v.isVip ? 'active' : 'trial',
          vipScope: v.vipScope || '',
          vipActivatedAt: v.vipActivatedAt || null,
          vipDurationDays: v.vipDurationDays !== undefined ? Number(v.vipDurationDays) : null,
          vipExpiresAt: v.vipExpiresAt || null,
          activatedCodes: v.licenseCode ? [v.licenseCode] : [],
          licenses: []
        });
      });

      const nowMs = Date.now();
      let totalUsers = 0;
      let totalDownloads = 0;
      let downloadUsersCount = 0;
      let trialUsers = 0;
      let activeVipUsers = 0;
      let expiredVipUsers = 0;

      const usersList = Array.from(usersMap.values()).map(u => {
        totalUsers++;
        totalDownloads += u.downloadCount;
        if (u.downloadCount > 0) downloadUsersCount++;

        const hasVipHistory = u.vipStatus === 'active' || u.activatedCodes.length > 0 || Boolean(u.vipScope);
        let computedStatus = 'trial';
        if (u.vipStatus === 'revoked') {
          computedStatus = 'revoked';
        } else if (hasVipHistory) {
          if (u.vipExpiresAt && Date.parse(u.vipExpiresAt) <= nowMs) {
            computedStatus = 'vip-expired';
            expiredVipUsers++;
          } else {
            computedStatus = 'vip-active';
            activeVipUsers++;
          }
        } else {
          trialUsers++;
        }

        const remainingText = computedStatus === 'vip-active'
          ? (root.NTLabPlatform ? root.NTLabPlatform.formatRemainingTime(u.vipExpiresAt, nowMs) : 'Đang hoạt động')
          : computedStatus === 'vip-expired'
            ? `Đã hết hạn (${u.vipExpiresAt ? new Date(u.vipExpiresAt).toLocaleDateString('vi-VN') : ''})`
            : computedStatus === 'revoked'
              ? 'Đã thu hồi'
              : 'Đang dùng thử miễn phí';

        return {
          ...u,
          computedStatus,
          remainingText
        };
      }).sort((a, b) => Date.parse(b.lastActiveAt || 0) - Date.parse(a.lastActiveAt || 0));

      const licensesList = [];
      licensesSnap.forEach(docSnap => {
        const d = docSnap.data();
        licensesList.push({
          code: docSnap.id,
          ...d,
          remainingText: d.revoked
            ? 'Đã thu hồi'
            : (root.NTLabPlatform ? root.NTLabPlatform.formatRemainingTime(d.expiresAt, nowMs) : 'Vĩnh viễn')
        });
      });
      licensesList.sort((a, b) => Date.parse(b.claimedAt || b.createdAt || 0) - Date.parse(a.claimedAt || a.createdAt || 0));

      const ordersList = [];
      let paidRevenue = 0;
      ordersSnap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.status === 'paid') paidRevenue += Number(d.amount) || 0;
        ordersList.push({ orderCode: docSnap.id, ...d });
      });
      ordersList.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

      return {
        ok: true,
        stats: {
          totalUsers,
          totalDownloads,
          downloadUsersCount,
          trialUsers,
          vipUsers: activeVipUsers + expiredVipUsers,
          activeVipUsers,
          expiredVipUsers,
          paidRevenue,
          totalLicenses: licensesList.length,
          totalOrders: ordersList.length
        },
        usersList,
        licensesList,
        ordersList
      };
    } catch (err) {
      return { ok: false, reason: err?.message || 'Không thể tải dữ liệu quản trị từ Firestore.' };
    }
  }

  async function adminSetUserVip({ uid, visitorId, scope = 'all-access', durationDays = 365, action = 'grant' }) {
    const ok = await initBrowserFirebase();
    if (!ok || !fb) return { ok: false, reason: 'Chưa kết nối Firebase.' };
    if (!isAdminUser(currentUser)) {
      return { ok: false, reason: `Từ chối truy cập: Chỉ ${ADMIN_EMAIL} mới được chỉnh sửa gói VIP.` };
    }

    try {
      const { db, storeMod } = fb;
      const nowIso = new Date().toISOString();

      if (action === 'revoke') {
        if (uid) {
          await storeMod.setDoc(storeMod.doc(db, 'users', uid), {
            vipStatus: 'revoked',
            isTrial: true,
            vipExpiresAt: nowIso,
            entitlements: {},
            licenses: [],
            updatedAt: nowIso
          }, { merge: true });
        }
        if (visitorId) {
          await storeMod.setDoc(storeMod.doc(db, 'visitors', visitorId), {
            isVip: false,
            isTrial: true,
            vipExpiresAt: nowIso
          }, { merge: true });
        }
        return { ok: true, message: 'Đã thu hồi gói VIP của người dùng.' };
      }

      const days = Number(durationDays);
      const expiresAt = root.NTLabPlatform.computeExpiresAt(nowIso, days);
      const generatedCode = root.NTLabPlatform.generateLicenseKey(scope);

      await storeMod.setDoc(storeMod.doc(db, 'licenses', generatedCode), {
        code: generatedCode,
        scope,
        claimedBy: uid || visitorId || 'admin-granted',
        claimedAt: nowIso,
        durationDays: days,
        expiresAt,
        createdBy: currentUser.email,
        revoked: false
      }, { merge: true });

      if (uid) {
        await storeMod.setDoc(storeMod.doc(db, 'users', uid), {
          isTrial: false,
          vipStatus: 'active',
          vipScope: scope,
          vipActivatedAt: nowIso,
          vipDurationDays: days,
          vipExpiresAt: expiresAt,
          adminGranted: true,
          entitlements: { [scope]: true },
          activatedCodes: [generatedCode],
          licenses: [{
            code: generatedCode,
            scope,
            activatedAt: nowIso,
            durationDays: days,
            expiresAt,
            revoked: false
          }],
          updatedAt: nowIso
        }, { merge: true });
      }

      if (visitorId) {
        await storeMod.setDoc(storeMod.doc(db, 'visitors', visitorId), {
          isVip: true,
          isTrial: false,
          vipScope: scope,
          vipActivatedAt: nowIso,
          vipDurationDays: days,
          vipExpiresAt: expiresAt,
          licenseCode: generatedCode
        }, { merge: true });
      }

      return {
        ok: true,
        code: generatedCode,
        expiresAt,
        message: `Đã cấp/gia hạn gói VIP (${scope}) thời hạn ${days > 0 ? days + ' ngày' : 'Vĩnh viễn'}!`
      };
    } catch (err) {
      return { ok: false, reason: err?.message || 'Lỗi cập nhật thời hạn VIP.' };
    }
  }

  async function adminCreateCloudLicenses({ scope = 'all-access', durationDays = 365, count = 1, note = '' }) {
    const ok = await initBrowserFirebase();
    if (!ok || !fb) return { ok: false, reason: 'Chưa kết nối Firebase.' };
    if (!isAdminUser(currentUser)) {
      return { ok: false, reason: `Chỉ ${ADMIN_EMAIL} mới được phép tạo mã kích hoạt trên Cloud.` };
    }

    try {
      const { db, storeMod } = fb;
      const nowIso = new Date().toISOString();
      const qty = Math.max(1, Math.min(50, Number(count) || 1));
      const days = Number(durationDays);
      const codes = [];

      for (let i = 0; i < qty; i++) {
        const code = root.NTLabPlatform.generateLicenseKey(scope);
        await storeMod.setDoc(storeMod.doc(db, 'licenses', code), {
          code,
          scope: scope === 'ALL' ? 'all-access' : scope,
          durationDays: days,
          expiresAt: null, // Sẽ bắt đầu tính từ thời điểm khách nhập mã kích hoạt
          claimedBy: null,
          claimedEmail: null,
          claimedAt: null,
          createdAt: nowIso,
          createdBy: currentUser.email,
          note: String(note || '').trim(),
          revoked: false
        });
        codes.push(code);
      }
      return { ok: true, codes, durationDays: days };
    } catch (err) {
      return { ok: false, reason: err?.message || 'Không thể tạo mã trên Cloud.' };
    }
  }

  async function adminApproveOrder(orderCode) {
    const ok = await initBrowserFirebase();
    if (!ok || !fb) return { ok: false, reason: 'Chưa kết nối Firebase.' };
    if (!isAdminUser(currentUser)) {
      return { ok: false, reason: `Chỉ ${ADMIN_EMAIL} mới được phép duyệt đơn hàng.` };
    }

    try {
      const { db, storeMod } = fb;
      const orderRef = storeMod.doc(db, 'orders', orderCode);
      const snap = await storeMod.getDoc(orderRef);
      if (!snap.exists()) return { ok: false, reason: 'Không tìm thấy đơn hàng.' };

      const order = snap.data();
      const scope = order.scope || 'all-access';
      const durationDays = order.durationDays !== undefined ? Number(order.durationDays) : 365;
      const nowIso = new Date().toISOString();
      const expiresAt = root.NTLabPlatform.computeExpiresAt(nowIso, durationDays);
      const licenseCode = order.licenseCode || root.NTLabPlatform.generateLicenseKey(scope);

      await storeMod.setDoc(storeMod.doc(db, 'licenses', licenseCode), {
        code: licenseCode,
        scope,
        durationDays,
        expiresAt,
        claimedBy: order.uid || null,
        claimedEmail: order.email || null,
        claimedAt: nowIso,
        createdAt: nowIso,
        createdBy: currentUser.email,
        orderCode,
        revoked: false
      }, { merge: true });

      await storeMod.setDoc(orderRef, {
        status: 'paid',
        licenseCode,
        paidAt: nowIso,
        expiresAt,
        approvedBy: currentUser.email
      }, { merge: true });

      if (order.uid) {
        await storeMod.setDoc(storeMod.doc(db, 'users', order.uid), {
          isTrial: false,
          vipStatus: 'active',
          vipScope: scope,
          vipActivatedAt: nowIso,
          vipDurationDays: durationDays,
          vipExpiresAt: expiresAt,
          entitlements: { [scope]: true },
          activatedCodes: [licenseCode],
          licenses: [{
            code: licenseCode,
            scope,
            activatedAt: nowIso,
            durationDays,
            expiresAt,
            revoked: false
          }],
          updatedAt: nowIso
        }, { merge: true });
      }

      return { ok: true, licenseCode, expiresAt };
    } catch (err) {
      return { ok: false, reason: err?.message || 'Không thể duyệt đơn hàng.' };
    }
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
    ADMIN_EMAIL,
    isAdminUser,
    mergeHistoryRecords,
    mergeDesktopState,
    redeemLicenseTransaction,
    getStatus,
    initBrowserFirebase,
    loadCatalogFromCloud,
    saveCatalogToCloud,
    recordVisitorTelemetry,
    trackSoftwareDownload,
    signInWithGoogle,
    signOut,
    activateLicense,
    createAndWatchPaymentOrder,
    fetchAdminDashboardData,
    adminSetUserVip,
    adminCreateCloudLicenses,
    adminApproveOrder,
    syncAppState,
    onChange
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NTLabCloud = api;
})(globalThis);
