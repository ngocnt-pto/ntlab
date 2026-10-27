(function (root) {
  'use strict';

  const paymentConfig = {
    bankId: '',        // Ví dụ: 'MB', 'VCB', 'TCB', 'ACB' (để trống sẽ hiển thị chế độ QR minh họa)
    accountNo: '',     // Số tài khoản nhận tiền VietQR
    accountName: '',   // Tên chủ tài khoản
    template: 'compact2'
  };

  const bundle = {
    id: 'all-access',
    codePrefix: 'ALL',
    name: 'Gói Trọn Bộ Kho Phần Mềm (All-Access)',
    shortName: 'Trọn bộ NTLab',
    price: 99000,
    originalPrice: 299000,
    badge: 'TIẾT KIỆM 65% · KHUYÊN DÙNG',
    summary: 'Mở khóa toàn bộ phần mềm hiện có (/go-may, /man-hinh-desktop) và miễn phí mọi công cụ mới ra mắt.',
    perks: [
      'Mở khóa 100% tính năng Pro của Tập Gõ Máy Tính (15 ngày luyện 10 ngón, âm phím cơ)',
      'Mở khóa 100% tính năng Plus của Màn Hình Desktop (Pomodoro nâng cao, âm thanh trắng, phím tắt)',
      'Tự động mở khóa các phần mềm tiếp theo trên trang chủ không cần mua lại',
      'Một mã kích hoạt duy nhất dùng chung trên toàn bộ hệ sinh thái'
    ]
  };

  const apps = [
    {
      id: 'go-may',
      slug: 'go-may',
      path: '/go-may/',
      codePrefix: 'GM',
      name: 'Tập Gõ Máy Tính',
      tagline: 'Gõ 10 ngón trong 15 ngày — Luyện gõ tiếng Việt & âm thanh phím cơ',
      category: 'Kỹ năng số · Cho bé & Đi làm',
      status: 'ready',
      price: 39000,
      originalPrice: 199000,
      freeSummary: 'Miễn phí bài Test bắt bệnh Mổ Cò 20 giây & trọn vẹn Ngày 1 đến Ngày 3',
      plusSummary: 'Mở khóa Ngày 4 đến Ngày 15 (60 bài luyện), chế độ Truyện thiếu nhi & Email công sở, âm phím cơ Blue/Thocky',
      highlights: [
        'Bắt bệnh mổ cò trong 20 giây, hướng dẫn từng ngón tay trực quan trên bàn phím & 2 bàn tay SVG',
        'Luyện gõ Telex tiếng Việt có dấu kết hợp âm thanh bàn phím cơ Blue Switch & Thocky cực cuốn',
        'Đồng bộ quyền mở khóa Pro và tiến độ học tập qua Google Cloud Firestore'
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
      freeSummary: 'Miễn phí đồng hồ bàn làm việc, Pomodoro 25 phút, 3 việc ưu tiên & âm thanh Mưa nhẹ',
      plusSummary: 'Chu kỳ Deep Work 50/90 phút, bộ trộn 4 âm thanh tập trung, kho phím tắt Windows/Mac & thống kê phiên',
      highlights: [
        'Biến màn hình phụ hoặc tab trình duyệt thành góc làm việc tối giản',
        'Bộ đếm Pomodoro chống xao nhãng kèm nhật ký hoàn thành trong ngày',
        'Tạo âm thanh nền (Mưa rơi, Quán cà phê, Sóng biển) bằng Web Audio thuần không tốn băng thông'
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
      freeSummary: 'Đã bao gồm sẵn trong Gói Trọn Bộ 99k khi phát hành',
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

  function formatCurrency(amount) {
    return `${Number(amount || 0).toLocaleString('vi-VN')}đ`;
  }

  function buildVietQrUrl(amount, reference) {
    if (!paymentConfig.bankId || !paymentConfig.accountNo) return null;
    const base = `https://img.vietqr.io/image/${encodeURIComponent(paymentConfig.bankId)}-${encodeURIComponent(paymentConfig.accountNo)}-${encodeURIComponent(paymentConfig.template || 'compact2')}.png`;
    const params = new URLSearchParams({
      amount: String(amount),
      addInfo: reference,
      accountName: paymentConfig.accountName || ''
    });
    return `${base}?${params.toString()}`;
  }

  const api = { paymentConfig, bundle, apps, getApp, formatCurrency, buildVietQrUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NTLabCatalog = api;
})(globalThis);
