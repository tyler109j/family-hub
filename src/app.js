const SUPABASE_URL = 'https://yaridrmtmfxkfcdvnqnl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-wgggIdtKIqPvDN4WY0EfA_48__9QvJ';
const ALLOWED_EMAILS = new Set([
  'tyler109j@gmail.com',
  'kaylajilljoyce@gmail.com',
]);

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    persistSession: true,
  },
});

const sectionConfigs = [
  {
    key: 'calendar',
    title: 'Calendar',
    eyebrow: 'Where we need to be',
    fields: [
      { name: 'title', label: 'Event', placeholder: 'Dentist appointment', required: true },
      { name: 'starts_at', label: 'Date & time', type: 'datetime-local', required: true },
      { name: 'notes', label: 'Notes', placeholder: 'Address, what to bring…', textarea: true },
    ],
  },
  {
    key: 'task',
    title: 'Tasks & chores',
    eyebrow: 'What needs doing',
    fields: [
      { name: 'title', label: 'Task', placeholder: 'Pack school lunches', required: true },
      { name: 'assignee', label: 'Who', placeholder: 'Tyler, Kayla, or both' },
      { name: 'due_at', label: 'Due', type: 'datetime-local' },
    ],
  },
  {
    key: 'shopping',
    title: 'Shopping list',
    eyebrow: 'What we need',
    fields: [
      { name: 'title', label: 'Item', placeholder: 'Bananas', required: true },
      { name: 'category', label: 'Category', placeholder: 'Produce' },
      { name: 'quantity', label: 'Quantity', placeholder: '1 bunch' },
    ],
  },
  {
    key: 'meal',
    title: 'Meal plan',
    eyebrow: 'What we’re eating',
    fields: [
      { name: 'title', label: 'Meal', placeholder: 'Taco bowls', required: true },
      { name: 'planned_for', label: 'Day', type: 'date' },
      { name: 'notes', label: 'Notes', placeholder: 'Prep or ingredient notes…', textarea: true },
    ],
  },
  {
    key: 'note',
    title: 'Family notes',
    eyebrow: 'Worth remembering',
    fields: [
      { name: 'title', label: 'Title', placeholder: 'School information', required: true },
      { name: 'text', label: 'Details', placeholder: 'Write the note here…', textarea: true },
    ],
  },
];

const dashboard = document.querySelector('#dashboard');
const plannerGrid = document.querySelector('#plannerGrid');
const summary = document.querySelector('#summary');
const authForm = document.querySelector('#authForm');
const authMessage = document.querySelector('#authMessage');
const authStatus = document.querySelector('#authStatus');
const googleSignIn = document.querySelector('#googleSignIn');
const passwordAccess = document.querySelector('#passwordAccess');
const signOutButton = document.querySelector('#signOut');
const signedInAs = document.querySelector('#signedInAs');
const liveStatus = document.querySelector('#liveStatus');
const liveDot = document.querySelector('#liveDot');
const toast = document.querySelector('#toast');

let currentUser = null;
let plannerItems = [];
let activityItems = [];
let liveChannel = null;
let reloadTimer = null;
let toastTimer = null;

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const isAllowed = email => ALLOWED_EMAILS.has(normalizeEmail(email));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

function cleanDateTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
  }).format(new Date(year, month - 1, day));
}

function renderForm(config) {
  return `
    <form class="form item-form" data-item-type="${config.key}">
      ${config.fields.map(field => `
        <label>
          <span>${escapeHtml(field.label)}</span>
          ${field.textarea
            ? `<textarea name="${field.name}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}></textarea>`
            : `<input name="${field.name}" type="${field.type || 'text'}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>`}
        </label>`).join('')}
      <button type="submit">Add to ${escapeHtml(config.title.toLowerCase())}</button>
    </form>`;
}

function itemDetails(item) {
  const parts = [];
  if (item.item_type === 'calendar' && item.starts_at) parts.push(formatDateTime(item.starts_at));
  if (item.item_type === 'task' && item.due_at) parts.push(`Due ${formatDateTime(item.due_at)}`);
  if (item.item_type === 'meal' && item.planned_for) parts.push(formatDate(item.planned_for));
  if (item.assignee) parts.push(item.assignee);
  if (item.details?.category) parts.push(item.details.category);
  if (item.details?.quantity) parts.push(item.details.quantity);
  return parts;
}

function itemBody(item) {
  return item.details?.notes || item.details?.text || '';
}

function renderItem(item) {
  const completable = item.item_type === 'task' || item.item_type === 'shopping';
  const completed = item.status === 'completed';
  const sourceLabel = item.created_via === 'chatgpt' || item.updated_via === 'chatgpt'
    ? '<span class="source-badge">Assistant</span>'
    : '';
  const details = itemDetails(item);
  const body = itemBody(item);

  return `
    <div class="item ${completed ? 'is-complete' : ''}">
      <div class="item-copy">
        <div class="item-title-line">
          <strong>${escapeHtml(item.title)}</strong>
          ${sourceLabel}
        </div>
        ${details.length ? `<small>${details.map(escapeHtml).join(' · ')}</small>` : ''}
        ${body ? `<p>${escapeHtml(body)}</p>` : ''}
      </div>
      <div class="item-actions">
        ${completable
          ? `<button class="mini-button" type="button" data-action="${completed ? 'reopen' : 'complete'}" data-id="${item.id}">${completed ? 'Reopen' : 'Done'}</button>`
          : ''}
        <button class="text-button" type="button" data-action="remove" data-id="${item.id}">Remove</button>
      </div>
    </div>`;
}

function renderActivity() {
  const rows = activityItems.slice(0, 8);
  return `
    <article class="card activity-card">
      <div class="card-heading">
        <div>
          <p class="card-eyebrow">Who changed what</p>
          <h3>Recent activity</h3>
        </div>
        <span class="card-count">${activityItems.length}</span>
      </div>
      <div class="activity-list">
        ${rows.length ? rows.map(activity => {
          const name = normalizeEmail(activity.actor_email) === 'kaylajilljoyce@gmail.com' ? 'Kayla' : 'Tyler';
          const source = activity.source === 'chatgpt' ? ' via Family Assistant' : '';
          return `
            <div class="activity-item">
              <span class="activity-initial">${name[0]}</span>
              <div>
                <strong>${escapeHtml(activity.summary)}</strong>
                <small>${name}${source} · ${formatDateTime(activity.created_at)}</small>
              </div>
            </div>`;
        }).join('') : '<p class="empty-state">New changes will appear here.</p>'}
      </div>
    </article>`;
}

function renderSummary() {
  const active = plannerItems.filter(item => item.status === 'active');
  const counts = [
    ['Upcoming', active.filter(item => item.item_type === 'calendar').length],
    ['Open tasks', active.filter(item => item.item_type === 'task').length],
    ['To buy', active.filter(item => item.item_type === 'shopping').length],
    ['Meals planned', active.filter(item => item.item_type === 'meal').length],
  ];
  summary.innerHTML = counts.map(([label, count]) => `
    <div class="summary-card">
      <strong>${count}</strong>
      <span>${label}</span>
    </div>`).join('');
}

function renderPlanner() {
  renderSummary();
  plannerGrid.innerHTML = sectionConfigs.map(config => {
    const items = plannerItems.filter(item => item.item_type === config.key);
    return `
      <article class="card">
        <div class="card-heading">
          <div>
            <p class="card-eyebrow">${escapeHtml(config.eyebrow)}</p>
            <h3>${escapeHtml(config.title)}</h3>
          </div>
          <span class="card-count">${items.length}</span>
        </div>
        ${renderForm(config)}
        <div class="item-list">
          ${items.length ? items.map(renderItem).join('') : '<p class="empty-state">Nothing here yet.</p>'}
        </div>
      </article>`;
  }).join('') + renderActivity();
}

async function loadPlanner({ quiet = false } = {}) {
  if (!currentUser) return;
  const [itemsResult, activityResult] = await Promise.all([
    supabase
      .from('planner_items')
      .select('*')
      .neq('status', 'cancelled')
      .order('updated_at', { ascending: false }),
    supabase
      .from('agent_activity_log')
      .select('id,item_id,actor_email,operation,source,summary,created_at')
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  if (itemsResult.error || activityResult.error) {
    if (!quiet) showToast('The shared planner could not be loaded.', true);
    return;
  }

  plannerItems = itemsResult.data || [];
  activityItems = activityResult.data || [];
  renderPlanner();
}

function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => loadPlanner({ quiet: true }), 300);
}

function subscribeToPlanner() {
  if (liveChannel) supabase.removeChannel(liveChannel);
  liveChannel = supabase
    .channel('family-planner-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'planner_items' },
      scheduleReload,
    )
    .subscribe(status => {
      const connected = status === 'SUBSCRIBED';
      liveDot.classList.toggle('connected', connected);
      liveStatus.textContent = connected ? 'Live updates on' : 'Connecting live updates…';
    });
}

async function acceptSession(user) {
  if (!user || !isAllowed(user.email)) {
    await supabase.auth.signOut();
    currentUser = null;
    dashboard.hidden = true;
    googleSignIn.hidden = false;
    passwordAccess.hidden = false;
    signOutButton.hidden = true;
    authStatus.textContent = 'Access restricted';
    authMessage.textContent = 'This planner is limited to Tyler and Kayla.';
    return;
  }

  currentUser = user;
  googleSignIn.hidden = true;
  passwordAccess.hidden = true;
  signOutButton.hidden = false;
  dashboard.hidden = false;
  authStatus.textContent = 'Signed in';
  authMessage.textContent = `Connected as ${user.email}`;
  signedInAs.textContent = `Shared securely between Tyler and Kayla · signed in as ${user.email}`;
  await loadPlanner();
  subscribeToPlanner();
}

googleSignIn.addEventListener('click', async () => {
  authMessage.textContent = 'Opening Google sign-in…';
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) {
    authMessage.textContent = error.message;
    showToast('Google sign-in is not available yet.', true);
  }
});

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = normalizeEmail(document.querySelector('#email').value);
  const password = document.querySelector('#password').value;
  const action = event.submitter?.value || 'signin';

  if (!isAllowed(email)) {
    authMessage.textContent = 'That email is not approved for this private planner.';
    return;
  }

  authMessage.textContent = action === 'signup' ? 'Creating your account…' : 'Signing in…';
  const result = action === 'signup'
    ? await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}${location.pathname}` },
      })
    : await supabase.auth.signInWithPassword({ email, password });

  if (result.error) {
    authMessage.textContent = result.error.message;
    return;
  }
  if (!result.data.session) {
    authMessage.textContent = 'Check your email to confirm the account, then sign in.';
    return;
  }
  await acceptSession(result.data.user);
});

signOutButton.addEventListener('click', async () => {
  if (liveChannel) await supabase.removeChannel(liveChannel);
  await supabase.auth.signOut();
  location.reload();
});

plannerGrid.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;
  const form = event.target.closest('.item-form');
  if (!form) return;

  const formData = new FormData(form);
  const itemType = form.dataset.itemType;
  const row = {
    item_type: itemType,
    title: String(formData.get('title') || '').trim(),
    details: {},
    created_via: 'website',
    updated_via: 'website',
  };

  if (itemType === 'calendar') {
    row.starts_at = cleanDateTime(formData.get('starts_at'));
    row.details = { notes: String(formData.get('notes') || '').trim() };
  } else if (itemType === 'task') {
    row.assignee = String(formData.get('assignee') || '').trim() || null;
    row.due_at = cleanDateTime(formData.get('due_at'));
  } else if (itemType === 'shopping') {
    row.details = {
      category: String(formData.get('category') || '').trim(),
      quantity: String(formData.get('quantity') || '').trim(),
    };
  } else if (itemType === 'meal') {
    row.planned_for = String(formData.get('planned_for') || '').trim() || null;
    row.details = { notes: String(formData.get('notes') || '').trim() };
  } else if (itemType === 'note') {
    row.details = { text: String(formData.get('text') || '').trim() };
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  const { error } = await supabase.from('planner_items').insert(row);
  submitButton.disabled = false;

  if (error) {
    showToast('That item could not be saved.', true);
    return;
  }
  form.reset();
  showToast('Added to the shared family planner.');
  await loadPlanner({ quiet: true });
});

plannerGrid.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button || !currentUser) return;

  const action = button.dataset.action;
  const id = button.dataset.id;
  const mutation = action === 'complete'
    ? { status: 'completed', updated_via: 'website' }
    : action === 'reopen'
    ? { status: 'active', updated_via: 'website' }
    : { status: 'cancelled', updated_via: 'website' };

  button.disabled = true;
  const { error } = await supabase.from('planner_items').update(mutation).eq('id', id);
  button.disabled = false;
  if (error) {
    showToast('That change could not be saved.', true);
    return;
  }
  showToast(action === 'remove' ? 'Removed from the planner.' : 'Planner updated.');
  await loadPlanner({ quiet: true });
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentUser) loadPlanner({ quiet: true });
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user && session.user.id !== currentUser?.id) {
    setTimeout(() => acceptSession(session.user), 0);
  }
});

supabase.auth.getSession().then(({ data }) => {
  if (data.session?.user) acceptSession(data.session.user);
});
