/* Local + Firebase Cloud adapter connected to NTLabPlatform & NTLabCloud. */
(function (root) {
  const defaults = { history: [], plusPreview: false, settings: { sound: true, soundProfile: 'thock', audience: 'office', keyboard: true } };
  let storage;
  try { storage = root.localStorage; } catch { storage = null; }
  const platform = root.NTLabPlatform ? root.NTLabPlatform.createClient(storage) : null;
  const cloud = root.NTLabCloud || null;
  const state = root.GoMayCore.readState(storage, defaults);
  state.plusPreview = platform ? platform.hasAccess('go-may') : false;

  async function pullAndMergeCloud() {
    if (!cloud) return state;
    const merged = await cloud.syncAppState('go-may', state);
    if (merged && Array.isArray(merged.history)) {
      state.history = merged.history;
      if (merged.settings && typeof merged.settings === 'object') {
        state.settings = { ...state.settings, ...merged.settings };
      }
      root.GoMayCore.saveState(storage, state);
    }
    return state;
  }

  if (cloud) {
    cloud.onChange(status => {
      if (status.user) {
        pullAndMergeCloud();
      }
    });
  }

  root.GoMayServices = {
    state,
    platform,
    cloud,
    pullAndMergeCloud,
    syncPlatform() {
      if (!platform) return state.plusPreview;
      platform.reload();
      state.plusPreview = platform.hasAccess('go-may');
      return state.plusPreview;
    },
    save() {
      const ok = root.GoMayCore.saveState(storage, state);
      if (cloud && cloud.getStatus().user) {
        cloud.syncAppState('go-may', state).catch(() => {});
      }
      return ok;
    },
    access(lesson) {
      const unlocked = platform ? platform.hasAccess('go-may') : false;
      state.plusPreview = unlocked;
      return root.GoMayCore.canAccess(lesson, unlocked);
    },
    addResult(result) {
      state.history.push(result);
      state.history = state.history.slice(-200);
      if (cloud) {
        cloud.recordVisitorTelemetry({ action: 'trial', appId: 'go-may' }).catch(() => {});
      }
      return this.save();
    },
    setPreview() {
      // Đã tắt chế độ giả lập VIP local; chỉ mở khóa qua mã VIP thực tế
      return this.syncPlatform();
    }
  };
})(globalThis);
