import { readOfflineState, subscribeOffline, saveDraft, deleteDraft, retryDraft } from '/offline-store.js?v=2';
const $ = id => document.getElementById(id);
let state;
let snapshot;
let selectedView = 'schedule';
let editing = false;
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
function message(text) { $('message').textContent = text; }
function button(text, action, secondary = false) { const b = el('button', text, secondary ? 'secondary' : ''); b.type = 'button'; b.onclick = () => Promise.resolve().then(action).catch(error => message(error.message)); return b; }
function field(form, label, name, value = '', type = 'text', required = false) {
  const wrapper = el('label', label); const input = el(type === 'textarea' ? 'textarea' : 'input'); input.name = name; input.value = value; input.required = required; if (type !== 'textarea') input.type = type;
  input.maxLength = type === 'textarea' ? 4000 : name === 'name' ? 160 : name === 'address' ? 500 : name === 'mobileNumber' ? 40 : 300;
  wrapper.append(input); form.append(wrapper); return input;
}
function select(form, label, name, options, value) {
  const wrapper = el('label', label); const input = el('select'); input.name = name;
  options.forEach(([v, text]) => { const option = el('option', text); option.value = v; input.append(option); });
  input.value = value; wrapper.append(input); form.append(wrapper); return input;
}
function show(view) {
  if (editing && !confirm('Close this form? Changes not saved as a draft will be lost.')) return;
  editing = false; $('editor').hidden = true; $('editor').replaceChildren(); selectedView = view;
  ['schedule', 'students', 'drafts'].forEach(id => { $(id).hidden = id !== view; });
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
}
function startForm(title) {
  if (editing && !confirm('Replace this form? Unsaved changes will be lost.')) return null;
  editing = true; const box = $('editor'); box.hidden = false; box.replaceChildren(el('h2', title));
  const form = el('form'); box.append(form); box.scrollIntoView({ block: 'start' }); box.focus(); return form;
}
function saveForm(form, kind, label, getPayload, replacesId) {
  const row = el('div', undefined, 'actions'); const submit = el('button', 'Save on this phone'); submit.type = 'submit';
  row.append(submit, button('Cancel', () => show(selectedView), true)); form.append(row);
  form.onsubmit = async event => {
    event.preventDefault(); submit.disabled = true;
    try {
      await saveDraft(snapshot.scope, kind, label(), getPayload(new FormData(form)), replacesId);
      editing = false; show('drafts'); await render(); message('Saved on this phone · Pending sync. Keep this app open when internet returns to upload.');
    } catch (error) { message(error.message); } finally { submit.disabled = false; }
  };
}
function studentForm(draft) {
  const form = startForm(draft ? 'Review student draft' : 'New student draft'); if (!form) return;
  const p = draft?.payload || {};
  field(form, 'Full name', 'name', p.name, 'text', true); field(form, 'Mobile number', 'mobileNumber', p.mobileNumber, 'tel'); field(form, 'Address', 'address', p.address);
  select(form, 'Licence type', 'licenseType', ['G1', 'G2', 'G', 'Other'].map(v => [v, v]), p.licenseType || 'G2'); field(form, 'Notes', 'comments', p.comments, 'textarea');
  form.append(el('p', 'Duplicates are checked on upload. Registration links and messages are not sent from this draft.', 'muted'));
  saveForm(form, 'student', () => form.elements.name.value, data => Object.fromEntries(data), draft?.id);
}
function noteForm(lesson, draft) {
  if (!lesson.canWriteNotes) { message('Only the assigned instructor or administrator can edit these lesson notes.'); return; }
  const form = startForm(`Lesson notes · ${lesson.studentName}`); if (!form) return;
  if (draft) { form.append(el('h3', 'Latest downloaded notes'), el('pre', lesson.notes || 'No saved notes'), el('p', 'Compare with your draft below. Saving will submit these notes against the latest downloaded lesson.', 'warning')); }
  field(form, 'Notes', 'notes', draft?.payload.notes ?? lesson.notes, 'textarea');
  saveForm(form, 'note', () => `Notes · ${lesson.studentName}`, data => ({ lessonId: lesson.id, studentId: lesson.studentId, version: lesson.version, notes: data.get('notes') }), draft?.id);
}
function evaluationForm(lesson, draft) {
  if (!lesson.canEvaluate) { message('Only the assigned instructor or workspace administrator can evaluate this lesson.'); return; }
  const form = startForm(`Practice evaluation · ${lesson.studentName}`); if (!form) return;
  form.append(el('p', 'Practice assessment using the existing maneuver criteria. The full road-test sheet remains available online.', 'muted'));
  const p = draft?.payload || {};
  const type = select(form, 'Test type', 'testType', [['G2', 'G2'], ['G', 'G']], p.testType || 'G2');
  field(form, 'Practice area', 'area', p.area || '');
  const criteria = el('div'); form.append(criteria);
  function drawCriteria() {
    criteria.replaceChildren();
    snapshot.criteria.filter(section => section.testTypes.includes(type.value)).forEach(section => {
      const group = el('fieldset'); group.append(el('legend', section.label));
      section.maneuvers.forEach(item => select(group, item.label, item.id, [['', 'Not assessed'], ['ok', 'OK'], ['minor', 'Minor'], ['major', 'Major']], p.items?.find(i => i.id === item.id)?.status || ''));
      criteria.append(group);
    });
  }
  type.onchange = () => { if (confirm('Change test type and reset maneuver selections?')) drawCriteria(); else type.value = type.value === 'G' ? 'G2' : 'G'; }; drawCriteria();
  field(form, 'Automatic fail reasons (one per line, if any)', 'autofails', p.autofails?.join('\n') || '', 'textarea');
  field(form, 'Evaluation notes', 'notes', p.notes || '', 'textarea');
  saveForm(form, 'evaluation', () => `Evaluation · ${lesson.studentName}`, data => {
    const items = snapshot.criteria.filter(section => section.testTypes.includes(type.value)).flatMap(section => section.maneuvers.filter(item => data.get(item.id)).map(item => ({ id: item.id, name: item.label, category: section.id, status: data.get(item.id), tags: [] })));
    if (!items.length) throw new Error('Assess at least one maneuver before saving.');
    return { lessonId: lesson.id, studentId: lesson.studentId, version: lesson.version, testType: type.value, date: p.date || new Date().toISOString(), area: data.get('area'), notes: data.get('notes'), items, autofails: String(data.get('autofails') || '').split('\n').map(s => s.trim()).filter(Boolean) };
  }, draft?.id);
}
function renderStudents() {
  const query = $('search').value.trim().toLowerCase(); const target = $('student-list'); target.replaceChildren();
  snapshot.students.filter(s => `${s.name} ${s.address}`.toLowerCase().includes(query)).forEach(student => {
    const card = el('article', undefined, 'card'); card.append(el('h3', student.name), el('p', student.address || 'No address'), el('p', student.mobileNumber || 'No phone number', 'muted')); target.append(card);
  });
  if (!target.children.length) target.append(el('p', 'No students match.'));
}
async function render() {
  try {
    state = await readOfflineState(); snapshot = state.config?.active && state.snapshot?.scope === state.config.scope ? state.snapshot : null;
    $('empty').hidden = !!snapshot; $('content').hidden = !snapshot;
    if (!snapshot) { editing = false; $('editor').replaceChildren(); $('lessons').replaceChildren(); $('student-list').replaceChildren(); $('draft-list').replaceChildren(); $('workspace').textContent = ''; $('status').textContent = 'No active offline workspace'; return; }
    $('workspace').textContent = snapshot.workspaceName;
    $('status').textContent = `${navigator.onLine ? 'Saved copy' : 'Offline'} · Downloaded ${new Date(snapshot.downloadedAt).toLocaleString()}`;
    const expired = Date.parse(snapshot.expiresAt) <= Date.now(); $('stale').hidden = !expired;
    const writable = snapshot.canWrite && !expired;
    $('new-student').disabled = !writable;
    $('count').textContent = String(state.drafts.filter(d => d.status !== 'synced').length);
    const lessons = $('lessons'); lessons.replaceChildren();
    // Hide the previous UTC day's safety margin from the displayed seven-day schedule.
    const today = new Date(); today.setHours(0, 0, 0, 0);
    snapshot.lessons.filter(lesson => new Date(lesson.start) >= today).forEach(lesson => {
      const card = el('article', undefined, 'card'); card.append(el('h3', lesson.studentName), el('p', new Date(lesson.start).toLocaleString()), el('p', snapshot.students.find(s => s.id === lesson.studentId)?.address || ''), el('pre', lesson.notes));
      if (writable) { const row = el('div', undefined, 'actions'); if (lesson.canWriteNotes) row.append(button('Lesson notes', () => noteForm(lesson))); if (lesson.canEvaluate) row.append(button('Evaluation', () => evaluationForm(lesson), true)); card.append(row); }
      lessons.append(card);
    });
    if (!lessons.children.length) lessons.append(el('p', 'No lessons in this download for today or the next seven days.'));
    renderStudents();
    const drafts = $('draft-list'); drafts.replaceChildren();
    [...state.drafts].reverse().forEach(draft => {
      const card = el('article', undefined, 'card'); card.append(el('h3', draft.label), el('p', ({ pending: 'Saved on this phone · Pending sync', sending: 'Uploading · Waiting for server confirmation', synced: 'Synced', conflict: 'Needs review · Conflict', blocked: 'Needs attention' })[draft.status], draft.status === 'synced' ? 'synced' : 'pending'));
      if (draft.message) card.append(el('p', draft.message));
      const details = el('details'); details.append(el('summary', 'View saved draft'));
      const p = draft.payload;
      if (draft.kind === 'student') details.append(el('p', p.name), el('p', [p.mobileNumber, p.address, p.licenseType].filter(Boolean).join(' · ')), el('pre', p.comments || 'No notes'));
      else if (draft.kind === 'note') details.append(el('pre', p.notes || 'No notes'));
      else {
        details.append(el('p', `${p.testType} · ${new Date(p.date).toLocaleString()} · ${p.area || ''}`));
        (p.items || []).forEach(item => details.append(el('p', `${item.name}: ${item.status}`)));
        if (p.autofails?.length) details.append(el('p', `Automatic fail: ${p.autofails.join(', ')}`));
        details.append(el('pre', p.notes || 'No notes'));
      }
      card.append(details);
      const row = el('div', undefined, 'actions');
      if (writable && ['conflict', 'blocked'].includes(draft.status)) {
        row.append(button('Review & resubmit', () => {
          if (draft.kind === 'student') return studentForm(draft);
          const lesson = snapshot.lessons.find(l => l.id === draft.payload.lessonId && l.studentId === draft.payload.studentId);
          if (!lesson) { message('Download the latest schedule online. This lesson may be cancelled or no longer assigned to you. Your draft remains here.'); return; }
          if (draft.kind === 'note') noteForm(lesson, draft); else evaluationForm(lesson, draft);
        }));
        row.append(button('Retry unchanged', async () => { await retryDraft(snapshot.scope, draft.id); }, true));
      }
      if (draft.status !== 'sending') row.append(button(draft.status === 'synced' ? 'Remove receipt' : 'Remove draft', async () => {
        if (confirm(draft.status === 'synced' ? 'Remove this local receipt? The uploaded record stays saved.' : 'Remove this draft from your phone? It may not have been uploaded.')) await deleteDraft(snapshot.scope, draft.id);
      }, true));
      card.append(row); drafts.append(card);
    });
    if (!drafts.children.length) drafts.append(el('p', 'No pending drafts.'));
  } catch (error) { message(error.message); $('status').textContent = 'Offline storage could not be opened'; }
}
document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => show(button.dataset.view); });
$('search').oninput = renderStudents; $('new-student').onclick = () => studentForm();
subscribeOffline(() => { void render(); });
window.addEventListener('online', () => { void render(); message('Connection is available. Open Reconnect & sync to upload your pending entries.'); });
window.addEventListener('offline', () => { void render(); });
window.addEventListener('beforeunload', event => { if (editing) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void render(); });
void render();
