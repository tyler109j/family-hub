const SUPABASE_URL = 'https://yaridrmtmfxkfcdvnqnl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-wgggIdtKIqPvDN4WY0EfA_48__9QvJ';
const ALLOWED_EMAILS = new Set([
  'tyler109j@gmail.com',
  'kaylajilljoyce@gmail.com',
]);

const plannerDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
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
const authMessage = document.querySelector('#authMessage');
const authStatus = document.querySelector('#authStatus');
const googleSignIn = document.querySelector('#googleSignIn');
const signOutButton = document.querySelector('#signOut');
const signedInAs = document.querySelector('#signedInAs');
const liveStatus = document.querySelector('#liveStatus');
const liveDot = document.querySelector('#liveDot');
const toast = document.querySelector('#toast');
const calendarView = document.querySelector('#calendarView');
const calendarClose = document.querySelector('#calendarClose');
const calendarToday = document.querySelector('#calendarToday');
const calendarPrevious = document.querySelector('#calendarPrevious');
const calendarNext = document.querySelector('#calendarNext');
const calendarMonthLabel = document.querySelector('#calendarMonthLabel');
const calendarMonthGrid = document.querySelector('#calendarMonthGrid');
const calendarSelectedDate = document.querySelector('#calendarSelectedDate');
const calendarDayItems = document.querySelector('#calendarDayItems');
const calendarEventForm = document.querySelector('#calendarEventForm');
const calendarEventDate = document.querySelector('#calendarEventDate');
const calendarEventTime = document.querySelector('#calendarEventTime');

let currentUser = null;
let plannerItems = [];
let activityItems = [];
let liveChannel = null;
let reloadTimer = null;
let toastTimer = null;
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedCalendarDate = localDateKey(new Date());
let calendarWasOpen = false;

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const isAllowed = email => ALLOWED_EMAILS.has(normalizeEmail(email));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

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

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function calendarDateForItem(item) {
  if (item.item_type === 'calendar' && item.starts_at) return localDateKey(item.starts_at);
  if (item.item_type === 'task' && item.due_at) return localDateKey(item.due_at);
  if (item.item_type === 'meal' && item.planned_for) return item.planned_for;
  return '';
}

function calendarItemsByDate() {
  return plannerItems
    .map(item => ({ ...item, calendar_date: calendarDateForItem(item) }))
    .filter(item => item.calendar_date)
    .sort((left, right) => {
      const leftTime = left.starts_at || left.due_at || `${left.calendar_date}T23:59:00`;
      const rightTime = right.starts_at || right.due_at || `${right.calendar_date}T23:59:00`;
      return new Date(leftTime) - new Date(rightTime);
    });
}

function calendarItemLabel(item) {
  if (item.item_type === 'calendar') return formatTime(item.starts_at);
  if (item.item_type === 'task') return formatTime(item.due_at);
  return 'Meal';
}

function calendarItemMeta(item) {
  const parts = [];
  if (item.item_type === 'calendar') parts.push(`Event at ${formatTime(item.starts_at)}`);
  if (item.item_type === 'task') parts.push(`Task due ${formatTime(item.due_at)}`);
  if (item.item_type === 'meal') parts.push('Meal plan');
  if (item.assignee) parts.push(item.assignee);
  return parts.join(' - ');
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

function renderCalendarDayPanel(calendarItems) {
  const selectedDate = dateFromKey(selectedCalendarDate);
  calendarSelectedDate.textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(selectedDate);

  const dayItems = calendarItems.filter(item => item.calendar_date === selectedCalendarDate);
  calendarDayItems.innerHTML = dayItems.length ? dayItems.map(item => {
    const itemType = item.item_type === 'calendar' ? 'Event' : item.item_type === 'task' ? 'Task' : 'Meal';
    const action = item.item_type === 'task'
      ? `<button class="calendar-entry-action" type="button" data-calendar-action="${item.status === 'completed' ? 'reopen' : 'complete'}" data-id="${item.id}">${item.status === 'completed' ? 'Reopen' : 'Done'}</button>`
      : item.item_type === 'calendar'
      ? `<button class="calendar-entry-action remove" type="button" data-calendar-action="remove" data-id="${item.id}">Remove</button>`
      : '';
    const body = itemBody(item);

    return `
      <article class="calendar-day-entry ${item.status === 'completed' ? 'is-complete' : ''}">
        <div class="calendar-day-entry-topline">
          <span class="calendar-type-badge ${item.item_type}">${itemType}</span>
          ${action}
        </div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(calendarItemMeta(item))}</small>
        ${body ? `<p>${escapeHtml(body)}</p>` : ''}
      </article>`;
  }).join('') : '<p class="calendar-day-empty">Nothing planned yet. Add an event below.</p>';
}

function renderCalendarView() {
  if (!currentUser || calendarView.hidden) return;

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1, 12);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay(), 12);
  const todayKey = localDateKey(new Date());
  const calendarItems = calendarItemsByDate();
  const itemsByDate = calendarItems.reduce((grouped, item) => {
    if (!grouped.has(item.calendar_date)) grouped.set(item.calendar_date, []);
    grouped.get(item.calendar_date).push(item);
    return grouped;
  }, new Map());

  calendarMonthLabel.textContent = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(firstOfMonth);

  const cells = [];
  for (let offset = 0; offset < 42; offset += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + offset);
    const dateKey = localDateKey(date);
    const dayItems = itemsByDate.get(dateKey) || [];
    const outsideMonth = date.getMonth() !== month;
    const selected = dateKey === selectedCalendarDate;
    const isToday = dateKey === todayKey;
    const dateLabel = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);

    const visibleItems = dayItems.slice(0, 3);
    const extraCount = dayItems.length - visibleItems.length;
    cells.push(`
      <div class="calendar-day ${outsideMonth ? 'outside-month' : ''} ${selected ? 'selected' : ''} ${isToday ? 'today' : ''}"
           role="gridcell"
           aria-selected="${selected}"
           data-calendar-date="${dateKey}">
        <button class="calendar-day-number" type="button" data-calendar-date="${dateKey}" aria-label="Select ${escapeHtml(dateLabel)}">
          <span>${date.getDate()}</span>
          ${isToday ? '<small>Today</small>' : ''}
        </button>
        <div class="calendar-day-chips">
          ${visibleItems.map(item => `
            <button class="calendar-chip ${item.item_type} ${item.status === 'completed' ? 'is-complete' : ''}"
                    type="button"
                    data-calendar-date="${dateKey}"
                    data-calendar-item-id="${item.id}"
                    title="${escapeHtml(item.title)}">
              <span>${escapeHtml(calendarItemLabel(item))}</span>
              <strong>${escapeHtml(item.title)}</strong>
            </button>`).join('')}
          ${extraCount > 0 ? `<button class="calendar-more" type="button" data-calendar-date="${dateKey}">+${extraCount} more</button>` : ''}
        </div>
      </div>`);
  }

  calendarMonthGrid.innerHTML = cells.join('');
  calendarEventDate.value = selectedCalendarDate;
  renderCalendarDayPanel(calendarItems);
}

function syncCalendarRoute() {
  const open = location.hash === '#calendar' && Boolean(currentUser);
  calendarView.hidden = !open;
  document.body.classList.toggle('calendar-open', open);

  if (open) {
    renderCalendarView();
    if (!calendarWasOpen) requestAnimationFrame(() => calendarClose.focus());
  }
  calendarWasOpen = open;
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
            <h3>${config.key === 'calendar'
              ? `<a class="calendar-title-link" href="#calendar">${escapeHtml(config.title)}<span>Open full calendar</span></a>`
              : escapeHtml(config.title)}</h3>
          </div>
          <span class="card-count">${items.length}</span>
        </div>
        ${renderForm(config)}
        <div class="item-list">
          ${items.length ? items.map(renderItem).join('') : '<p class="empty-state">Nothing here yet.</p>'}
        </div>
      </article>`;
  }).join('') + renderActivity();
  if (!calendarView.hidden) renderCalendarView();
}

async function loadPlanner({ quiet = false } = {}) {
  if (!currentUser) return;
  const [itemsResult, activityResult] = await Promise.all([
    plannerDb
      .from('planner_items')
      .select('*')
      .neq('status', 'cancelled')
      .order('updated_at', { ascending: false }),
    plannerDb
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
  if (liveChannel) plannerDb.removeChannel(liveChannel);
  liveChannel = plannerDb
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
    await plannerDb.auth.signOut();
    currentUser = null;
    dashboard.hidden = true;
    googleSignIn.hidden = false;
    signOutButton.hidden = true;
    authStatus.textContent = 'Access restricted';
    authMessage.textContent = 'This planner is limited to Tyler and Kayla.';
    syncCalendarRoute();
    return;
  }

  currentUser = user;
  googleSignIn.hidden = true;
  signOutButton.hidden = false;
  dashboard.hidden = false;
  authStatus.textContent = 'Signed in';
  authMessage.textContent = `Connected as ${user.email}`;
  signedInAs.textContent = `Shared securely between Tyler and Kayla · signed in as ${user.email}`;
  await loadPlanner();
  subscribeToPlanner();
  syncCalendarRoute();
}

googleSignIn.addEventListener('click', async () => {
  authMessage.textContent = 'Opening Google sign-in…';
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await plannerDb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) {
    authMessage.textContent = error.message;
    showToast('Google sign-in is not available yet.', true);
  }
});

signOutButton.addEventListener('click', async () => {
  if (liveChannel) await plannerDb.removeChannel(liveChannel);
  await plannerDb.auth.signOut();
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
  const { error } = await plannerDb.from('planner_items').insert(row);
  submitButton.disabled = false;

  if (error) {
    showToast('That item could not be saved.', true);
    return;
  }
  form.reset();
  showToast('Added to the shared family planner.');
  await loadPlanner({ quiet: true });
});

async function updatePlannerItem(action, id, button) {
  if (!currentUser) return;
  const mutation = action === 'complete'
    ? { status: 'completed', updated_via: 'website' }
    : action === 'reopen'
    ? { status: 'active', updated_via: 'website' }
    : { status: 'cancelled', updated_via: 'website' };

  button.disabled = true;
  const { error } = await plannerDb.from('planner_items').update(mutation).eq('id', id);
  button.disabled = false;
  if (error) {
    showToast('That change could not be saved.', true);
    return;
  }
  showToast(action === 'remove' ? 'Removed from the planner.' : 'Planner updated.');
  await loadPlanner({ quiet: true });
}

plannerGrid.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  await updatePlannerItem(button.dataset.action, button.dataset.id, button);
});

calendarMonthGrid.addEventListener('click', event => {
  const target = event.target.closest('[data-calendar-date]');
  if (!target) return;
  selectedCalendarDate = target.dataset.calendarDate;
  const selected = dateFromKey(selectedCalendarDate);
  if (selected.getMonth() !== calendarCursor.getMonth() || selected.getFullYear() !== calendarCursor.getFullYear()) {
    calendarCursor = new Date(selected.getFullYear(), selected.getMonth(), 1);
  }
  renderCalendarView();
});

calendarDayItems.addEventListener('click', async event => {
  const button = event.target.closest('button[data-calendar-action]');
  if (!button) return;
  await updatePlannerItem(button.dataset.calendarAction, button.dataset.id, button);
});

calendarEventForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;

  const formData = new FormData(calendarEventForm);
  const date = String(formData.get('date') || '').trim();
  const time = String(formData.get('time') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const startsAt = cleanDateTime(`${date}T${time}`);
  if (!title || !startsAt) {
    showToast('Add an event name, date, and time.', true);
    return;
  }

  const submitButton = calendarEventForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  const { error } = await plannerDb.from('planner_items').insert({
    item_type: 'calendar',
    title,
    starts_at: startsAt,
    details: { notes: String(formData.get('notes') || '').trim() },
    created_via: 'website',
    updated_via: 'website',
  });
  submitButton.disabled = false;

  if (error) {
    showToast('That event could not be saved.', true);
    return;
  }

  selectedCalendarDate = date;
  const selected = dateFromKey(date);
  calendarCursor = new Date(selected.getFullYear(), selected.getMonth(), 1);
  calendarEventForm.reset();
  calendarEventDate.value = date;
  calendarEventTime.value = '09:00';
  showToast('Added to the family calendar.');
  await loadPlanner({ quiet: true });
});

calendarPrevious.addEventListener('click', () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderCalendarView();
});

calendarNext.addEventListener('click', () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderCalendarView();
});

calendarToday.addEventListener('click', () => {
  const today = new Date();
  selectedCalendarDate = localDateKey(today);
  calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
  renderCalendarView();
});

function closeCalendarView() {
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  syncCalendarRoute();
  requestAnimationFrame(() => document.querySelector('.calendar-title-link')?.focus());
}

calendarClose.addEventListener('click', closeCalendarView);

window.addEventListener('hashchange', syncCalendarRoute);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !calendarView.hidden) closeCalendarView();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentUser) loadPlanner({ quiet: true });
});

plannerDb.auth.onAuthStateChange((_event, session) => {
  if (session?.user && session.user.id !== currentUser?.id) {
    setTimeout(() => acceptSession(session.user), 0);
  }
});

plannerDb.auth.getSession().then(({ data }) => {
  if (data.session?.user) acceptSession(data.session.user);
});
