(function (root) {
  'use strict';

  /**
   * Cấu hình Firebase chính thức của dự án ntlab-apps
   */
  const firebaseConfig = {
    apiKey: 'AIzaSyBvhlnP4HGz-5gGA5cm1lqdUEn_S0dZcJY',
    authDomain: 'ntlab-apps.firebaseapp.com',
    projectId: 'ntlab-apps',
    storageBucket: 'ntlab-apps.firebasestorage.app',
    messagingSenderId: '70773513791',
    appId: '1:70773513791:web:ed969d09a65870159fa28a',
    measurementId: 'G-1EKQ0PB310'
  };

  /**
   * Tùy chọn: Dán Google Gemini API Key miễn phí (lấy tại https://aistudio.google.com/app/apikey)
   * Nếu để trống, chế độ "✨ AI Tạo Bài Gõ" vẫn hoạt động bình thường nhờ Kho Sinh Bài Thông Minh tích hợp sẵn!
   */
  const geminiConfig = {
    apiKey: '',
    model: 'gemini-2.5-flash'
  };

  function isConfigured(cfg = firebaseConfig) {
    return Boolean(
      cfg &&
      typeof cfg.apiKey === 'string' && cfg.apiKey.trim().length > 10 &&
      typeof cfg.projectId === 'string' && cfg.projectId.trim().length > 2
    );
  }

  const api = { firebaseConfig, geminiConfig, isConfigured };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NTLabFirebaseConfig = api;
})(globalThis);
