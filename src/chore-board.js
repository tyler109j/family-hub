const SUPABASE_URL = 'https://yaridrmtmfxkfcdvnqnl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-wgggIdtKIqPvDN4WY0EfA_48__9QvJ';
const ALLOWED_EMAILS = new Set(['tyler109j@gmail.com', 'kaylajilljoyce@gmail.com']);
const familyTime = globalThis.FamilyTime;

if (!familyTime) throw new Error('Family timezone helpers did not load.');

const plannerDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    persistSession: true,
  },
});

const authPanel = document.querySelector('#authPanel');
const boardPanel = document.querySelector('#boardPanel');
const signInButton = document.querySelector('#signInButton');
const authMessage = document.querySelector('#authMessage');
const boardMessage = document.querySelector('#boardMessage');
const refreshButton = document.querySelector('#refreshButton');
const choreList = document.querySelector('#choreList');
const dateLabel = document.querySelector('#dateLabel');
const progressLabel = document.querySelector('#progressLabel');
const progressCount = document.querySelector('#progressCount');
const progressBar = document.querySelector('#progressBar');

let currentUser = null;
let chores = [];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

function localDateKey(value = new Date()) {
  return familyTime.dateKey(value);
}

function dateFromKey(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function routineSteps(item) {
  return Array.isArray(item.details?.steps) ? item.details.steps : [];
}

function routineComplete(item, dateKey) {
  const steps = routineSteps(item);
  const completed = new Set(item.details?.step_completions?.[dateKey] || []);
  return Boolean(item.details?.completed_dates?.includes(dateKey) || (steps.length && completed.size >= steps.length));
}

function occursToday(item, dateKey) {
  if (item.status === 'cancelled' || item.details?.paused) return false;
  if (item.details?.skipped_dates?.includes(dateKey)) return false;

  const baseKey = item.planned_for || localDateKey(item.starts_at || item.due_at) || dateKey;
  if (dateKey < baseKey || (item.details?.end_date && dateKey > item.details.end_date)) return false;

  const recurrence = item.details?.recurrence || '';
  if (!recurrence) return dateKey === baseKey;

  const date = dateFromKey(dateKey);
  const base = dateFromKey(baseKey);
  const dayDifference = Math.round((date - base) / 86400000);

  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') return date.getDay() >= 1 && date.getDay() <= 5;
  if (recurrence === 'weekly') return dayDifference % 7 === 0;
  if (recurrence === 'monthly') return date.getDate() === base.getDate();
  if (recurrence === 'quarterly') {
    const monthDifference = (date.getFullYear() - base.getFullYear()) * 12 + date.getMonth() - base.getMonth();
    return monthDifference >= 0 && monthDifference % 3 === 0 && date.getDate() === base.getDate();
  }
  if (recurrence === 'yearly') return date.getMonth() === base.getMonth() && date.getDate() === base.getDate();
  return dateKey === baseKey;
}

function render() {
  const doneCount = chores.filter(item => item.done).length;
  const total = chores.length;
  const remaining = total - doneCount;

  dateLabel.textContent = familyTime.formatDateKey(localDateKey(), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  progressCount.textContent = total ? `${doneCount} / ${total} complete` : '';
  progressBar.style.width = total ? `${Math.round((doneCount / total) * 100)}%` : '0%';
  progressLabel.textContent = total && remaining === 0
    ? 'All done for today'
    : doneCount
      ? `${remaining} left`
      : 'Ready when you are';

  if (!total) {
    choreList.innerHTML = '<div class="empty-board"><strong>Nothing scheduled</strong><span>There are no chores for today.</span></div>';
    return;
  }

  choreList.innerHTML = chores.map((item, index) => `
    <article class="chore-card ${item.item_type} ${item.done ? 'complete' : ''}">
      <div class="chore-icon" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
      <div>
        <p class="chore-kind">${item.item_type === 'routine' ? 'Routine' : 'Chore'}</p>
        <h2 class="chore-name">${escapeHtml(item.title)}</h2>
        ${item.item_type === 'routine' && routineSteps(item).length
          ? `<p class="chore-detail">${routineSteps(item).length} step${routineSteps(item).length === 1 ? '' : 's'}</p>`
          : ''}
      </div>
      <button class="done-button" type="button" data-chore-id="${item.id}" aria-pressed="${item.done}">${item.done ? 'Done' : 'Mark done'}</button>
    </article>`).join('');
}

async function loadChores() {
  if (!currentUser) return;
  boardMessage.textContent = 'Loading today\'s chores...';

  const { data, error } = await plannerDb
    .from('planner_items')
    .select('*')
    .in('item_type', ['task', 'routine'])
    .neq('status', 'cancelled')
    .order('updated_at', { ascending: false });

  if (error) {
    boardMessage.textContent = 'The chore board could not load. Please try again.';
    boardMessage.classList.add('error');
    return;
  }

  const dateKey = localDateKey();
  chores = (data || [])
    .filter(item => occursToday(item, dateKey))
    .map(item => ({ ...item, done: item.item_type === 'routine' ? routineComplete(item, dateKey) : item.status === 'completed' }));

  boardMessage.textContent = '';
  boardMessage.classList.remove('error');
  render();
}

async function markDone(id) {
  const item = chores.find(candidate => candidate.id === id);
  if (!item || !currentUser) return;

  const dateKey = localDateKey();
  const button = document.querySelector(`[data-chore-id="${CSS.escape(id)}"]`);
  if (button) button.disabled = true;

  let mutation;
  if (item.item_type === 'routine') {
    const details = { ...(item.details || {}) };
    const dates = new Set(details.completed_dates || []);
    if (item.done) dates.delete(dateKey);
    else dates.add(dateKey);
    mutation = { details: { ...details, completed_dates: [...dates] }, updated_via: 'website' };
  } else {
    mutation = { status: item.done ? 'active' : 'completed', updated_via: 'website' };
  }

  const { data, error } = await plannerDb
    .from('planner_items')
    .update(mutation)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    boardMessage.textContent = 'That change could not be saved. Please try again.';
    boardMessage.classList.add('error');
    if (button) button.disabled = false;
    return;
  }

  await loadChores();
}

async function signIn() {
  authMessage.textContent = 'Opening Google sign-in...';
  const { error } = await plannerDb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}${location.pathname}` },
  });
  if (error) authMessage.textContent = error.message;
}

async function updateUser(user) {
  currentUser = user && ALLOWED_EMAILS.has(String(user.email || '').toLowerCase()) ? user : null;
  if (!currentUser) {
    authPanel.hidden = false;
    boardPanel.hidden = true;
    if (user) authMessage.textContent = 'This board is limited to the Tyler and Kayla family accounts.';
    return;
  }

  authPanel.hidden = true;
  boardPanel.hidden = false;
  await loadChores();
}

signInButton.addEventListener('click', signIn);
refreshButton.addEventListener('click', loadChores);
choreList.addEventListener('click', event => {
  const button = event.target.closest('[data-chore-id]');
  if (button) markDone(button.dataset.choreId);
});
plannerDb.auth.onAuthStateChange((_event, session) => updateUser(session?.user || null));
plannerDb.auth.getSession().then(({ data }) => updateUser(data.session?.user || null));
