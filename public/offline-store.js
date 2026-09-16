// Shared by the online sync controller and the independently cached offline workspace.
const DB_NAME = 'instructoros-offline-v1';
const CHANGE = 'instructoros-offline-change';
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('This browser could not open offline storage. Nothing was saved.'));
    request.onblocked = () => reject(new Error('Close other InstructorOS tabs and try again.'));
  });
}
function announce() {
  window.dispatchEvent(new Event(CHANGE));
  if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel(CHANGE); channel.postMessage('changed'); channel.close(); }
}
async function stateTransaction(change) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('state', change ? 'readwrite' : 'readonly');
      const store = tx.objectStore('state');
      const request = store.get('current');
      let state;
      let failure;
      request.onsuccess = () => {
        state = request.result || { config: null, snapshot: null, drafts: [] };
        if (change) {
          try { change(state); store.put(state, 'current'); } catch (error) { failure = error; tx.abort(); }
        }
      };
      tx.oncomplete = () => { if (change) announce(); resolve(state); };
      tx.onabort = tx.onerror = () => reject(failure || new Error('Offline storage is unavailable or full. Nothing was saved.'));
    });
  } finally { db.close(); }
}
export function readOfflineState() { return stateTransaction(); }
export function subscribeOffline(callback) {
  window.addEventListener(CHANGE, callback);
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANGE) : null;
  if (channel) channel.onmessage = callback;
  return () => { window.removeEventListener(CHANGE, callback); channel?.close(); };
}
export async function enableOffline(scope) {
  await stateTransaction(state => {
    if (state.config?.scope !== scope) {
      if (state.drafts.some(draft => draft.status !== 'synced')) throw new Error('Sync or remove pending drafts in the previous workspace before changing the offline workspace.');
      state.snapshot = null; state.drafts = [];
    }
    state.config = { scope, active: true };
  });
}
export async function activateOffline(scope) {
  const current = await readOfflineState();
  if (current.config && current.config.active !== (current.config.scope === scope)) await stateTransaction(state => { if (state.config) state.config.active = state.config.scope === scope; });
}
export async function clearOffline() { await stateTransaction(state => { state.config = null; state.snapshot = null; state.drafts = []; }); }
export async function saveSnapshot(snapshot) {
  await stateTransaction(state => {
    if (!state.config?.active || state.config.scope !== snapshot.scope) throw new Error('Your offline workspace changed. Download again in the correct workspace.');
    state.snapshot = snapshot;
  });
}
export async function saveDraft(scope, kind, label, payload, replacesId) {
  const id = crypto.randomUUID();
  await stateTransaction(state => {
    if (!state.config?.active || state.config.scope !== scope || state.snapshot?.scope !== scope) throw new Error('Download this workspace on your trusted phone first.');
    if (!state.snapshot.canWrite || Date.parse(state.snapshot.expiresAt) <= Date.now()) throw new Error('Reconnect and refresh your offline access before saving new drafts.');
    if (state.drafts.filter(draft => draft.status !== 'synced').length >= 200) throw new Error('200 drafts are pending. Sync these before adding more.');
    if (kind !== 'student' && !state.snapshot.lessons.some(lesson => lesson.id === payload.lessonId && lesson.studentId === payload.studentId)) throw new Error('This lesson is not in your downloaded workspace.');
    if (replacesId) {
      const original = state.drafts.find(draft => draft.id === replacesId && draft.scope === scope);
      if (!original || !['conflict', 'blocked'].includes(original.status)) throw new Error('This draft cannot be replaced while uploading.');
      state.drafts = state.drafts.filter(draft => draft.id !== replacesId);
    }
    state.drafts = state.drafts.filter(draft => draft.status !== 'synced').concat(state.drafts.filter(draft => draft.status === 'synced').slice(-19));
    state.drafts.push({ id, scope, kind, label, payload, createdAt: new Date().toISOString(), status: 'pending' });
  });
  return id;
}
export async function setDraftResult(scope, id, status, message, recordId) {
  await stateTransaction(state => {
    if (state.config?.scope !== scope) return;
    const draft = state.drafts.find(item => item.id === id && item.scope === scope);
    if (draft?.status === 'synced' && status !== 'synced') return;
    if (draft) { draft.status = status; draft.message = message; if (recordId) draft.recordId = recordId; }
  });
}
export async function deleteDraft(scope, id) {
  await stateTransaction(state => {
    if (!state.config?.active || state.config.scope !== scope) throw new Error('Select the correct workspace first.');
    if (state.drafts.some(item => item.id === id && item.status === 'sending')) throw new Error('This draft is uploading. Wait for the result before removing it.');
    state.drafts = state.drafts.filter(item => item.id !== id);
  });
}
export async function retryDraft(scope, id) {
  await stateTransaction(state => {
    if (!state.config?.active || state.config.scope !== scope) throw new Error('Select the correct workspace first.');
    const draft = state.drafts.find(item => item.id === id && item.scope === scope);
    if (draft && ['blocked', 'conflict'].includes(draft.status)) { draft.status = 'pending'; draft.message = ''; }
  });
}

export async function claimNextDraft(scope) {
  let claimed = null;
  await stateTransaction(state => {
    if (!state.config?.active || state.config.scope !== scope) return;
    const draft = state.drafts.find(item => item.scope === scope && (item.status === 'pending' || (item.status === 'sending' && (item.sendingAt || 0) < Date.now() - 60000)));
    if (draft) { draft.status = 'sending'; draft.sendingAt = Date.now(); claimed = structuredClone(draft); }
  });
  return claimed;
}
export async function suspendOffline(scope) {
  await stateTransaction(state => { if (state.config?.scope === scope) { state.config.active = false; state.snapshot = null; } });
}
