(function (root) {
  'use strict';

  const CATALOG_CACHE_KEY = 'ntlab:catalog_config:v1';

  const paymentConfig = {
    bankId: 'MB',              // Mã ngân hàng nhận tiền VietQR: 'MB', 'VCB', 'TCB', 'ACB', 'BIDV', 'VPB', 'TPB', 'CTG'...
    accountNo: '',             // Số tài khoản nhận tiền (Admin tuanngocpt@gmail.com cấu hình trên bảng Quản trị)
    accountName: '',           // Tên chủ tài khoản
    template: 'compact2',
    transferPrefix: 'NTLAB'    // Tiền tố nội dung chuyển khoản tự động
  };

  const bundle = {
    id: 'all-access',
    codePrefix: 'ALL',
    name: 'Gói Trọn Bộ Kho Phần Mềm (All-Access VIP)',
    shortName: 'Trọn bộ NTLab VIP',
    price: 99000,
    originalPrice: 299000,
    durationDays: 365,         // Thời hạn gói VIP (ngày) — 0 = Vĩnh viễn, 365 = 1 năm
    trialDays: 3,              // Số ngày dùng thử tiêu chuẩn
    badge: 'TIẾT KIỆM 65% · KHUYÊN DÙNG',
    summary: 'Mở khóa toàn bộ phần mềm hiện có (/go-may, /man-hinh-desktop) và miễn phí mọi công cụ mới ra mắt.',
    perks: [
      'Mở khóa 100% tính năng Pro của Tập Gõ Máy Tính (15 ngày luyện 10 ngón, AI tạo bài gõ, âm phím cơ)',
      'Mở khóa 100% tính năng Plus của Màn Hình Desktop (Pomodoro nâng cao, âm thanh trắng, phím tắt)',
      'Tự động mở khóa các phần mềm tiếp theo trên trang chủ không cần mua lại',
      'Một mã kích hoạt VIP duy nhất đồng bộ trực tiếp với tài khoản Google Cloud'
    ]
  };

  const apps = [
    {
      id: 'go-may',
      slug: 'go-may',
      path: '/go-may/',
      codePrefix: 'GM',
      name: 'Tập Gõ Máy Tính',
      tagline: 'Gõ 10 ngón trong 15 ngày — Luyện gõ tiếng Việt, AI tạo bài gõ & âm phím cơ',
      category: 'Kỹ năng số · Cho bé & Đi làm',
      status: 'ready',
      price: 39000,
      originalPrice: 199000,
      durationDays: 365,
      trialDays: 3,
      freeSummary: 'Dùng thử miễn phí bài Test bắt bệnh Mổ Cò 20 giây & trọn vẹn Ngày 1 đến Ngày 3',
      plusSummary: 'Mở khóa VIP Ngày 4 đến Ngày 15 (48 bài luyện), AI Tạo Bài Gõ không giới hạn, âm phím cơ Blue/Thocky',
      highlights: [
        'Bắt bệnh mổ cò trong 20 giây, hướng dẫn từng ngón tay trực quan trên bàn phím & 2 bàn tay SVG',
        'Luyện gõ Telex tiếng Việt có dấu kết hợp AI tạo bài gõ & âm thanh bàn phím cơ Blue Switch / Thocky',
        'Đồng bộ quyền VIP, thời hạn gói và tiến độ học tập qua Google Cloud Firestore'
      ]
    },
    {
      id: 'man-hinh-desktop',
      slug: 'man-hinh-desktop',
      path: '/man-hinh-desktop/',
      codePrefix: 'MD',
      name: 'Màn Hình Desktop',
      tagline: 'Không gian tập trung, đồng hồ Pomodoro & sổ tay phím tắt',
      category: 'Năng suất · Làm việc sâu',
      status: 'ready',
      price: 39000,
      originalPrice: 120000,
      durationDays: 365,
      trialDays: 3,
      freeSummary: 'Dùng thử miễn phí đồng hồ bàn làm việc, Pomodoro 25 phút, 3 việc ưu tiên & âm thanh Mưa nhẹ',
      plusSummary: 'Chu kỳ Deep Work 50/90 phút, bộ trộn âm thanh tập trung, kho phím tắt Windows/Mac & thống kê phiên',
      highlights: [
        'Biến màn hình phụ hoặc tab trình duyệt thành góc làm việc tối giản',
        'Bộ đếm Pomodoro chống xao nhãng kèm nhật ký hoàn thành trong ngày',
        'Tạo âm thanh nền (Mưa rơi, Sóng biển, Gió đồi thông) bằng Web Audio thuần không tốn băng thông'
      ]
    },
    {
      id: 'doc-nhanh',
      slug: 'doc-nhanh',
      path: '/doc-nhanh/',
      codePrefix: 'DN',
      name: 'Đọc Nhanh Tiếng Việt',
      tagline: 'Luyện mắt đọc lướt & mở rộng trường nhìn không đọc thầm',
      category: 'Kỹ năng học tập · Sắp ra mắt',
      status: 'coming-soon',
      price: 39000,
      originalPrice: 120000,
      durationDays: 365,
      trialDays: 3,
      freeSummary: 'Đã bao gồm sẵn trong Gói Trọn Bộ VIP khi phát hành',
      plusSummary: 'Các bài luyện RSVP và dẫn mắt theo cụm từ tiếng Việt',
      highlights: [
        'Đo tốc độ đọc WPM và mức độ hiểu bài tiếng Việt',
        'Tự động mở khóa cho khách hàng sở hữu mã Trọn Bộ (ALL)'
      ]
    }
  ];

  function getApp(idOrSlug) {
    return apps.find(app => app.id === idOrSlug || app.slug === idOrSlug) || null;
  }

  function getScopeConfig(scope) {
    if (!scope || scope === 'all-access' || scope === 'ALL') return bundle;
    const byId = getApp(scope);
    if (byId) return byId;
    const upper = String(scope).toUpperCase();
    return apps.find(a => a.codePrefix === upper) || bundle;
  }

  function formatCurrency(amount) {
    return `${Number(amount || 0).toLocaleString('vi-VN')}đ`;
  }

  function formatDuration(days) {
    const n = Number(days);
    if (!Number.isFinite(n) || n <= 0) return 'Vĩnh viễn';
    if (n === 365) return '365 ngày (1 năm)';
    if (n === 180) return '180 ngày (6 tháng)';
    if (n === 90) return '90 ngày (3 tháng)';
    if (n === 30) return '30 ngày (1 tháng)';
    return `${n} ngày`;
  }

  function buildVietQrUrl(amount, reference) {
    if (!paymentConfig.bankId || !paymentConfig.accountNo) return null;
    const base = `https://img.vietqr.io/image/${encodeURIComponent(paymentConfig.bankId.trim())}-${encodeURIComponent(paymentConfig.accountNo.trim())}-${encodeURIComponent(paymentConfig.template || 'compact2')}.png`;
    const params = new URLSearchParams({
      amount: String(Math.max(0, Number(amount) || 0)),
      addInfo: String(reference || '').trim(),
      accountName: String(paymentConfig.accountName || '').trim()
    });
    return `${base}?${params.toString()}`;
  }

  function applyRemoteConfig(remote, persistCache = true) {
    if (!remote || typeof remote !== 'object') return false;
    if (remote.paymentConfig && typeof remote.paymentConfig === 'object') {
      if (typeof remote.paymentConfig.bankId === 'string') paymentConfig.bankId = remote.paymentConfig.bankId.trim();
      if (typeof remote.paymentConfig.accountNo === 'string') paymentConfig.accountNo = remote.paymentConfig.accountNo.trim();
      if (typeof remote.paymentConfig.accountName === 'string') paymentConfig.accountName = remote.paymentConfig.accountName.trim();
      if (typeof remote.paymentConfig.template === 'string' && remote.paymentConfig.template.trim()) {
        paymentConfig.template = remote.paymentConfig.template.trim();
      }
      if (typeof remote.paymentConfig.transferPrefix === 'string' && remote.paymentConfig.transferPrefix.trim()) {
        paymentConfig.transferPrefix = remote.paymentConfig.transferPrefix.trim().toUpperCase();
      }
    }

    if (remote.bundle && typeof remote.bundle === 'object') {
      if (Number(remote.bundle.price) >= 0) bundle.price = Number(remote.bundle.price);
      if (Number(remote.bundle.originalPrice) >= 0) bundle.originalPrice = Number(remote.bundle.originalPrice);
      if (remote.bundle.durationDays !== undefined && Number(remote.bundle.durationDays) >= 0) {
        bundle.durationDays = Number(remote.bundle.durationDays);
      }
      if (remote.bundle.trialDays !== undefined && Number(remote.bundle.trialDays) >= 0) {
        bundle.trialDays = Number(remote.bundle.trialDays);
      }
      if (typeof remote.bundle.name === 'string' && remote.bundle.name.trim()) {
        bundle.name = remote.bundle.name.trim();
      }
      if (typeof remote.bundle.shortName === 'string' && remote.bundle.shortName.trim()) {
        bundle.shortName = remote.bundle.shortName.trim();
      }
    }

    if (remote.apps && typeof remote.apps === 'object') {
      const entries = Array.isArray(remote.apps)
        ? remote.apps
        : Object.entries(remote.apps).map(([id, cfg]) => ({ id, ...(cfg || {}) }));

      for (const item of entries) {
        if (!item || !item.id) continue;
        const target = getApp(item.id);
        if (!target) continue;
        if (Number(item.price) >= 0) target.price = Number(item.price);
        if (Number(item.originalPrice) >= 0) target.originalPrice = Number(item.originalPrice);
        if (item.durationDays !== undefined && Number(item.durationDays) >= 0) {
          target.durationDays = Number(item.durationDays);
        }
        if (item.trialDays !== undefined && Number(item.trialDays) >= 0) {
          target.trialDays = Number(item.trialDays);
        }
        if (typeof item.name === 'string' && item.name.trim()) target.name = item.name.trim();
        if (item.status === 'ready' || item.status === 'coming-soon') target.status = item.status;
      }
    }

    if (persistCache && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(exportConfig()));
      } catch { /* ignore storage quota */ }
    }
    return true;
  }

  function exportConfig() {
    const appsMap = {};
    for (const app of apps) {
      appsMap[app.id] = {
        id: app.id,
        name: app.name,
        price: app.price,
        originalPrice: app.originalPrice,
        durationDays: app.durationDays,
        trialDays: app.trialDays,
        status: app.status
      };
    }
    return {
      paymentConfig: { ...paymentConfig },
      bundle: {
        id: bundle.id,
        name: bundle.name,
        shortName: bundle.shortName,
        price: bundle.price,
        originalPrice: bundle.originalPrice,
        durationDays: bundle.durationDays,
        trialDays: bundle.trialDays
      },
      apps: appsMap
    };
  }

  // Khôi phục cấu hình bảng giá đã đồng bộ từ Cloud trước đó (nếu có)
  if (typeof localStorage !== 'undefined') {
    try {
      const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY));
      if (cached) applyRemoteConfig(cached, false);
    } catch { /* ignore */ }
  }

  const api = {
    CATALOG_CACHE_KEY,
    paymentConfig,
    bundle,
    apps,
    getApp,
    getScopeConfig,
    formatCurrency,
    formatDuration,
    buildVietQrUrl,
    applyRemoteConfig,
    exportConfig
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NTLabCatalog = api;
})(globalThis);
