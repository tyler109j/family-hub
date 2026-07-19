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
      { name: 'notes', label: 'Notes', placeholder: 'Address, what to bringâ€¦', textarea: true },
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
    eyebrow: 'What weâ€™re eating',
    fields: [
      { name: 'title', label: 'Meal', placeholder: 'Taco bowls', required: true },
      { name: 'planned_for', label: 'Day', type: 'date' },
      { name: 'notes', label: 'Notes', placeholder: 'Prep or ingredient notesâ€¦', textarea: true },
    ],
  },
  {
    key: 'note',
    title: 'Family notes',
    eyebrow: 'Worth remembering',
    fields: [
      { name: 'title', label: 'Title', placeholder: 'School information', required: true },
      { name: 'text', label: 'Details', placeholder: 'Write the note hereâ€¦', textarea: true },
    ],
  },
];

function recurrenceOptions(defaultValue = '') {
  return [
    ['', 'Does not repeat'],
    ['daily', 'Every day'],
    ['weekdays', 'Weekdays'],
    ['weekly', 'Every week'],
    ['monthly', 'Every month'],
    ['quarterly', 'Every 3 months'],
    ['yearly', 'Every year'],
  ].map(([value, label]) => [value, label, value === defaultValue]);
}

const expandedSectionConfigs = [
  {
    key: 'calendar', title: 'Calendar', eyebrow: 'Where we need to be',
    fields: [
      { name: 'title', label: 'Event', placeholder: 'Dentist appointment', required: true },
      { name: 'starts_at', label: 'Date & time', type: 'datetime-local', required: true },
      { name: 'recurrence', label: 'Repeats', type: 'select', options: recurrenceOptions() },
      { name: 'notes', label: 'Notes', placeholder: 'Address, what to bring...', textarea: true },
    ],
  },
  {
    key: 'task', title: 'Tasks & chores', eyebrow: 'What needs doing',
    fields: [
      { name: 'title', label: 'Task', placeholder: 'Pack school lunches', required: true },
      { name: 'assignee', label: 'Who', placeholder: 'Tyler, Kayla, or both' },
      { name: 'due_at', label: 'Due', type: 'datetime-local' },
      { name: 'recurrence', label: 'Repeats', type: 'select', options: recurrenceOptions() },
    ],
  },
  {
    key: 'routine', title: 'Routines', eyebrow: 'What keeps us on track',
    fields: [
      { name: 'title', label: 'Routine', placeholder: 'Nighttime routine', required: true },
      { name: 'assignee', label: 'Who', placeholder: 'Tyler, Kayla, or both' },
      { name: 'time', label: 'Time', type: 'time', value: '21:00' },
      { name: 'recurrence', label: 'Repeats', type: 'select', options: recurrenceOptions('daily') },
      { name: 'steps', label: 'Checklist', placeholder: 'Brush teeth\nSet alarm\nLay out clothes', textarea: true, required: true },
    ],
  },
  {
    key: 'reminder', title: 'Reminders', eyebrow: 'Do not let us forget',
    fields: [
      { name: 'title', label: 'Reminder', placeholder: 'Call the pediatrician', required: true },
      { name: 'due_at', label: 'When', type: 'datetime-local', required: true },
      { name: 'assignee', label: 'Who', placeholder: 'Tyler, Kayla, or both' },
      { name: 'notes', label: 'Notes', placeholder: 'Anything useful...', textarea: true },
    ],
  },
  {
    key: 'appointment', title: 'Appointments', eyebrow: 'Health and personal appointments',
    fields: [
      { name: 'title', label: 'Appointment', placeholder: 'Dentist', required: true },
      { name: 'starts_at', label: 'Date & time', type: 'datetime-local', required: true },
      { name: 'location', label: 'Location', placeholder: 'Office or address' },
      { name: 'assignee', label: 'Who is going', placeholder: 'Tyler, Kayla, or both' },
      { name: 'recurrence', label: 'Repeats', type: 'select', options: recurrenceOptions() },
    ],
  },
  ...sectionConfigs.filter(config => ['shopping', 'meal'].includes(config.key)),
  {
    key: 'maintenance', title: 'Home & vehicles', eyebrow: 'Maintenance and repairs',
    fields: [
      { name: 'title', label: 'Job', placeholder: 'Replace HVAC filter', required: true },
      { name: 'due_at', label: 'Due', type: 'datetime-local' },
      { name: 'assignee', label: 'Who', placeholder: 'Tyler, Kayla, or both' },
      { name: 'recurrence', label: 'Repeats', type: 'select', options: recurrenceOptions() },
      { name: 'notes', label: 'Notes', placeholder: 'Part number, service company...', textarea: true },
    ],
  },
  {
    key: 'bill', title: 'Bills & subscriptions', eyebrow: 'What is coming due',
    fields: [
      { name: 'title', label: 'Bill', placeholder: 'Electric bill', required: true },
      { name: 'due_at', label: 'Due', type: 'datetime-local', required: true },
      { name: 'amount', label: 'Amount', type: 'number', step: '0.01', placeholder: '0.00' },
      { name: 'autopay', label: 'Payment', type: 'select', options: [['', 'Not specified'], ['yes', 'Autopay'], ['no', 'Pay manually']] },
      { name: 'recurrence', label: 'Repeats', type: 'select', options: recurrenceOptions('monthly') },
    ],
  },
  {
    key: 'activity', title: 'Family activities', eyebrow: 'School, sports, and plans',
    fields: [
      { name: 'title', label: 'Activity', placeholder: 'Soccer practice', required: true },
      { name: 'starts_at', label: 'Date & time', type: 'datetime-local', required: true },
      { name: 'assignee', label: 'Who', placeholder: 'Tyler, Kayla, or both' },
      { name: 'location', label: 'Location', placeholder: 'Field, school, or address' },
      { name: 'recurrence', label: 'Repeats', type: 'select', options: recurrenceOptions() },
    ],
  },
  {
    key: 'list', title: 'Shared lists', eyebrow: 'Packing, projects, and wishes',
    fields: [
      { name: 'title', label: 'List name', placeholder: 'Weekend packing list', required: true },
      { name: 'items', label: 'Items', placeholder: 'Chargers\nSnacks\nSwimsuits', textarea: true, required: true },
    ],
  },
  ...sectionConfigs.filter(config => config.key === 'note'),
];

const dashboard = document.querySelector('#dashboard');
const plannerGrid = document.querySelector('#plannerGrid');
const todayPanel = document.querySelector('#todayPanel');
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

const scheduledTypes = new Set(['calendar', 'task', 'meal', 'routine', 'reminder', 'appointment', 'maintenance', 'bill', 'activity']);

function itemBaseDate(item) {
  if (item.planned_for) return item.planned_for;
  if (item.starts_at) return localDateKey(item.starts_at);
  if (item.due_at) return localDateKey(item.due_at);
  if (item.item_type === 'routine') return item.details?.start_date || localDateKey(new Date());
  return '';
}

function itemTime(item) {
  if (item.starts_at) return formatTime(item.starts_at);
  if (item.due_at) return formatTime(item.due_at);
  if (item.details?.time) {
    const [hour, minute] = String(item.details.time).split(':').map(Number);
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
      .format(new Date(2000, 0, 1, hour || 0, minute || 0));
  }
  return '';
}

function itemOccursOnDate(item, dateKey) {
  if (!scheduledTypes.has(item.item_type) || item.status === 'cancelled' || item.details?.paused) return false;
  const baseKey = itemBaseDate(item);
  if (!baseKey || dateKey < baseKey) return false;
  if ((item.details?.skipped_dates || []).includes(dateKey)) return false;
  if ((item.details?.completed_dates || []).includes(dateKey)) return false;
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
    const months = (date.getFullYear() - base.getFullYear()) * 12 + date.getMonth() - base.getMonth();
    return months >= 0 && months % 3 === 0 && date.getDate() === base.getDate();
  }
  if (recurrence === 'yearly') return date.getMonth() === base.getMonth() && date.getDate() === base.getDate();
  return dateKey === baseKey;
}

function calendarItemsByDate() {
  const firstOfMonth = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1, 12);
  const gridStart = new Date(firstOfMonth.getFullYear(), firstOfMonth.getMonth(), 1 - firstOfMonth.getDay(), 12);
  const occurrences = [];
  for (let offset = 0; offset < 42; offset += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + offset);
    const dateKey = localDateKey(date);
    plannerItems.forEach(item => {
      if (itemOccursOnDate(item, dateKey)) occurrences.push({ ...item, calendar_date: dateKey });
    });
  }
  return occurrences.sort((left, right) => itemTime(left).localeCompare(itemTime(right)));
}

function itemTypeLabel(item) {
  return ({
    calendar: 'Event', task: 'Task', meal: 'Meal', routine: 'Routine', reminder: 'Reminder',
    appointment: 'Appointment', maintenance: 'Maintenance', bill: 'Bill', activity: 'Activity',
  })[item.item_type] || 'Plan';
}

function calendarItemLabel(item) {
  return itemTime(item) || itemTypeLabel(item);
}

function calendarItemMeta(item) {
  const parts = [itemTypeLabel(item)];
  if (itemTime(item)) parts.push(itemTime(item));
  if (item.assignee) parts.push(item.assignee);
  if (item.details?.location) parts.push(item.details.location);
  if (item.details?.recurrence) parts.push(`Repeats ${item.details.recurrence}`);
  return parts.join(' - ');
}

function renderForm(config) {
  return `
    <form class="form item-form" data-item-type="${config.key}">
      ${config.fields.map(field => `
        <label>
          <span>${escapeHtml(field.label)}</span>
          ${field.type === 'select'
            ? `<select name="${field.name}" ${field.required ? 'required' : ''}>${field.options.map(([value, label, selected]) => `<option value="${escapeHtml(value)}" ${selected ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}</select>`
            : field.textarea
            ? `<textarea name="${field.name}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}></textarea>`
            : `<input name="${field.name}" type="${field.type || 'text'}" placeholder="${escapeHtml(field.placeholder || '')}" value="${escapeHtml(field.value || '')}" ${field.step ? `step="${escapeHtml(field.step)}"` : ''} ${field.required ? 'required' : ''}>`}
        </label>`).join('')}
      <button type="submit">Add to ${escapeHtml(config.title.toLowerCase())}</button>
    </form>`;
}

function itemDetails(item) {
  const parts = [];
  if (item.starts_at) parts.push(formatDateTime(item.starts_at));
  if (item.due_at) parts.push(`Due ${formatDateTime(item.due_at)}`);
  if (item.item_type === 'meal' && item.planned_for) parts.push(formatDate(item.planned_for));
  if (item.assignee) parts.push(item.assignee);
  if (item.details?.category) parts.push(item.details.category);
  if (item.details?.quantity) parts.push(item.details.quantity);
  if (item.details?.location) parts.push(item.details.location);
  if (item.details?.amount) parts.push(`$${Number(item.details.amount).toFixed(2)}`);
  if (item.details?.autopay === 'yes') parts.push('Autopay');
  if (item.details?.autopay === 'no') parts.push('Pay manually');
  if (item.details?.recurrence) parts.push(`Repeats ${item.details.recurrence}`);
  if (item.details?.paused) parts.push('Paused');
  return parts;
}

function itemBody(item) {
  return item.details?.notes || item.details?.text || '';
}

function normalizedListItems(item) {
  return (item.details?.items || []).map(entry => typeof entry === 'string'
    ? { text: entry, done: false }
    : { text: String(entry.text || ''), done: Boolean(entry.done) });
}

function routineSteps(item) {
  return (item.details?.steps || []).map(step => String(step)).filter(Boolean);
}

function completedRoutineSteps(item, dateKey = localDateKey(new Date())) {
  return new Set((item.details?.step_completions?.[dateKey] || []).map(Number));
}

function routineIsComplete(item, dateKey = localDateKey(new Date())) {
  const steps = routineSteps(item);
  return (item.details?.completed_dates || []).includes(dateKey) ||
    (steps.length > 0 && completedRoutineSteps(item, dateKey).size >= steps.length);
}

function renderSpecialBody(item) {
  if (item.item_type === 'routine') {
    const completed = completedRoutineSteps(item);
    return `<div class="checklist">${routineSteps(item).map((step, index) => `
      <button type="button" class="checklist-row ${completed.has(index) ? 'checked' : ''}" data-routine-step="${index}" data-id="${item.id}">
        <span aria-hidden="true">${completed.has(index) ? 'âœ“' : ''}</span><strong>${escapeHtml(step)}</strong>
      </button>`).join('')}</div>`;
  }
  if (item.item_type === 'list') {
    return `<div class="checklist">${normalizedListItems(item).map((entry, index) => `
      <button type="button" class="checklist-row ${entry.done ? 'checked' : ''}" data-list-index="${index}" data-id="${item.id}">
        <span aria-hidden="true">${entry.done ? 'âœ“' : ''}</span><strong>${escapeHtml(entry.text)}</strong>
      </button>`).join('')}</div>`;
  }
  return '';
}

function renderItem(item) {
  const completable = ['task', 'shopping', 'reminder', 'maintenance', 'bill'].includes(item.item_type);
  const completed = item.status === 'completed';
  const sourceLabel = item.created_via === 'chatgpt' || item.updated_via === 'chatgpt'
    ? '<span class="source-badge">Assistant</span>'
    : '';
  const details = itemDetails(item);
  const body = itemBody(item);
  const specialBody = renderSpecialBody(item);

  return `
    <div class="item ${completed ? 'is-complete' : ''}">
      <div class="item-copy">
        <div class="item-title-line">
          <strong>${escapeHtml(item.title)}</strong>
          ${sourceLabel}
        </div>
        ${details.length ? `<small>${details.map(escapeHtml).join(' Â· ')}</small>` : ''}
        ${body ? `<p>${escapeHtml(body)}</p>` : ''}
        ${specialBody}
      </div>
      <div class="item-actions">
        ${completable
          ? `<button class="mini-button" type="button" data-action="${completed ? 'reopen' : 'complete'}" data-id="${item.id}">${completed ? 'Reopen' : 'Done'}</button>`
          : ''}
        ${item.item_type === 'routine'
          ? `<button class="mini-button" type="button" data-action="${item.details?.paused ? 'resume-routine' : 'pause-routine'}" data-id="${item.id}">${item.details?.paused ? 'Resume' : 'Pause'}</button>
             <button class="text-button" type="button" data-action="skip-routine" data-id="${item.id}">Skip today</button>`
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
        <div class="activity-tools">
          <span class="card-count">${activityItems.length}</span>
          <button class="undo-button" type="button" data-undo-latest>Undo my last change</button>
        </div>
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
                <small>${name}${source} Â· ${formatDateTime(activity.created_at)}</small>
              </div>
            </div>`;
        }).join('') : '<p class="empty-state">New changes will appear here.</p>'}
      </div>
    </article>`;
}

function renderTodayPanel() {
  const todayKey = localDateKey(new Date());
  const now = new Date();
  const todaysItems = plannerItems.filter(item => itemOccursOnDate(item, todayKey));
  const overdue = plannerItems.filter(item =>
    item.status === 'active' && item.due_at && new Date(item.due_at) < now && !todaysItems.some(today => today.id === item.id));
  const visible = [...overdue, ...todaysItems].sort((left, right) => {
    const leftTime = left.starts_at || left.due_at || `${todayKey}T${left.details?.time || '23:59'}`;
    const rightTime = right.starts_at || right.due_at || `${todayKey}T${right.details?.time || '23:59'}`;
    return new Date(leftTime) - new Date(rightTime);
  });

  todayPanel.innerHTML = `
    <div class="today-heading">
      <div><p class="card-eyebrow">Today</p><h3>${new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(now)}</h3></div>
      <span>${visible.length} item${visible.length === 1 ? '' : 's'}</span>
    </div>
    <div class="today-list">
      ${visible.length ? visible.map(item => {
        const isOverdue = item.due_at && new Date(item.due_at) < now && localDateKey(item.due_at) !== todayKey;
        const routineDone = item.item_type === 'routine' && routineIsComplete(item, todayKey);
        return `<article class="today-item ${isOverdue ? 'overdue' : ''} ${routineDone ? 'done' : ''}">
          <div class="today-item-topline">
            <span class="calendar-type-badge ${item.item_type}">${escapeHtml(itemTypeLabel(item))}</span>
            <small>${isOverdue ? 'Overdue Â· ' : ''}${escapeHtml(itemTime(item) || 'Any time')}</small>
          </div>
          <strong>${escapeHtml(item.title)}</strong>
          ${item.assignee ? `<small>${escapeHtml(item.assignee)}</small>` : ''}
          ${item.item_type === 'routine' ? renderSpecialBody(item) : ''}
          ${['task', 'reminder', 'maintenance', 'bill'].includes(item.item_type)
            ? `<button class="mini-button today-done" type="button" data-action="${item.status === 'completed' ? 'reopen' : 'complete'}" data-id="${item.id}">${item.status === 'completed' ? 'Reopen' : 'Mark done'}</button>`
            : ''}
        </article>`;
      }).join('') : '<p class="today-empty">Nothing is scheduled for today. Enjoy the breathing room.</p>'}
    </div>`;
}

function renderSummary() {
  const active = plannerItems.filter(item => item.status === 'active');
  const counts = [
    ['Today', active.filter(item => itemOccursOnDate(item, localDateKey(new Date()))).length],
    ['Open tasks', active.filter(item => item.item_type === 'task').length],
    ['To buy', active.filter(item => item.item_type === 'shopping').length],
    ['Active routines', active.filter(item => item.item_type === 'routine' && !item.details?.paused).length],
    ['Reminders', active.filter(item => item.item_type === 'reminder').length],
    ['Bills due', active.filter(item => item.item_type === 'bill').length],
  ];
  summary.innerHTML = counts.map(([label, count]) => `
    <div class="summary-card">
      <strong>${count}</strong>
      <span>${label}</span>
    </div>`).join('');
  renderTodayPanel();
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
    const itemType = itemTypeLabel(item);
    const action = ['task', 'reminder', 'maintenance', 'bill'].includes(item.item_type)
      ? `<button class="calendar-entry-action" type="button" data-calendar-action="${item.status === 'completed' ? 'reopen' : 'complete'}" data-id="${item.id}">${item.status === 'completed' ? 'Reopen' : 'Done'}</button>`
      : ['calendar', 'appointment', 'activity'].includes(item.item_type)
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
  plannerGrid.innerHTML = expandedSectionConfigs.map(config => {
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
      .select('id,item_id,actor_email,actor_user_id,operation,source,summary,before_state,after_state,created_at')
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
      liveStatus.textContent = connected ? 'Live updates on' : 'Connecting live updatesâ€¦';
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
  signedInAs.textContent = `Shared securely between Tyler and Kayla Â· signed in as ${user.email}`;
  await loadPlanner();
  subscribeToPlanner();
  syncCalendarRoute();
}

googleSignIn.addEventListener('click', async () => {
  authMessage.textContent = 'Opening Google sign-inâ€¦';
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

  const value = name => String(formData.get(name) || '').trim();
  const recurrence = value('recurrence');

  if (itemType === 'calendar') {
    row.starts_at = cleanDateTime(formData.get('starts_at'));
    row.details = { notes: value('notes'), recurrence };
  } else if (itemType === 'task') {
    row.assignee = value('assignee') || null;
    row.due_at = cleanDateTime(formData.get('due_at'));
    row.details = { recurrence };
  } else if (itemType === 'routine') {
    row.assignee = value('assignee') || null;
    row.planned_for = localDateKey(new Date());
    row.details = {
      time: value('time') || '21:00',
      recurrence: recurrence || 'daily',
      steps: value('steps').split(/\r?\n/).map(step => step.trim()).filter(Boolean),
      step_completions: {}, completed_dates: [], skipped_dates: [], paused: false,
    };
  } else if (itemType === 'reminder') {
    row.due_at = cleanDateTime(formData.get('due_at'));
    row.assignee = value('assignee') || null;
    row.details = { notes: value('notes') };
  } else if (itemType === 'appointment') {
    row.starts_at = cleanDateTime(formData.get('starts_at'));
    row.assignee = value('assignee') || null;
    row.details = { location: value('location'), recurrence };
  } else if (itemType === 'shopping') {
    row.details = {
      category: value('category'),
      quantity: value('quantity'),
    };
  } else if (itemType === 'meal') {
    row.planned_for = value('planned_for') || null;
    row.details = { notes: value('notes') };
  } else if (itemType === 'maintenance') {
    row.due_at = cleanDateTime(formData.get('due_at'));
    row.assignee = value('assignee') || null;
    row.details = { notes: value('notes'), recurrence };
  } else if (itemType === 'bill') {
    row.due_at = cleanDateTime(formData.get('due_at'));
    row.details = { amount: value('amount'), autopay: value('autopay'), recurrence };
  } else if (itemType === 'activity') {
    row.starts_at = cleanDateTime(formData.get('starts_at'));
    row.assignee = value('assignee') || null;
    row.details = { location: value('location'), recurrence };
  } else if (itemType === 'list') {
    row.details = { items: value('items').split(/\r?\n/).map(text => text.trim()).filter(Boolean).map(text => ({ text, done: false })) };
  } else if (itemType === 'note') {
    row.details = { text: value('text') };
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
  const item = plannerItems.find(candidate => candidate.id === id);
  if (!item) return;
  const todayKey = localDateKey(new Date());
  let mutation;
  if (action === 'pause-routine' || action === 'resume-routine' || action === 'skip-routine') {
    const details = { ...item.details };
    if (action === 'pause-routine') details.paused = true;
    if (action === 'resume-routine') details.paused = false;
    if (action === 'skip-routine') details.skipped_dates = [...new Set([...(details.skipped_dates || []), todayKey])];
    mutation = { details, updated_via: 'website' };
  } else if (item.details?.recurrence && (action === 'complete' || action === 'reopen')) {
    const completedDates = new Set(item.details.completed_dates || []);
    if (action === 'complete') completedDates.add(todayKey);
    else completedDates.delete(todayKey);
    mutation = { details: { ...item.details, completed_dates: [...completedDates] }, status: 'active', updated_via: 'website' };
  } else {
    mutation = action === 'complete'
      ? { status: 'completed', updated_via: 'website' }
      : action === 'reopen'
      ? { status: 'active', updated_via: 'website' }
      : { status: 'cancelled', updated_via: 'website' };
  }

  button.disabled = true;
  const { error } = await plannerDb.from('planner_items').update(mutation).eq('id', id);
  button.disabled = false;
  if (error) {
    showToast('That change could not be saved.', true);
    return;
  }
  showToast(action === 'remove' ? 'Removed from the planner.' : action === 'skip-routine' ? 'Routine skipped for today.' : 'Planner updated.');
  await loadPlanner({ quiet: true });
}

async function saveItemDetails(item, details, button) {
  button.disabled = true;
  const { error } = await plannerDb.from('planner_items')
    .update({ details, updated_via: 'website' })
    .eq('id', item.id);
  button.disabled = false;
  if (error) {
    showToast('That checklist change could not be saved.', true);
    return;
  }
  await loadPlanner({ quiet: true });
}

async function toggleRoutineStep(button) {
  const item = plannerItems.find(candidate => candidate.id === button.dataset.id);
  if (!item) return;
  const todayKey = localDateKey(new Date());
  const completed = completedRoutineSteps(item, todayKey);
  const index = Number(button.dataset.routineStep);
  if (completed.has(index)) completed.delete(index); else completed.add(index);
  const stepCompletions = { ...(item.details.step_completions || {}), [todayKey]: [...completed].sort((a, b) => a - b) };
  const completedDates = new Set(item.details.completed_dates || []);
  if (routineSteps(item).length && completed.size >= routineSteps(item).length) completedDates.add(todayKey);
  else completedDates.delete(todayKey);
  await saveItemDetails(item, { ...item.details, step_completions: stepCompletions, completed_dates: [...completedDates] }, button);
}

async function toggleListItem(button) {
  const item = plannerItems.find(candidate => candidate.id === button.dataset.id);
  if (!item) return;
  const entries = normalizedListItems(item);
  const index = Number(button.dataset.listIndex);
  if (!entries[index]) return;
  entries[index].done = !entries[index].done;
  await saveItemDetails(item, { ...item.details, items: entries }, button);
}

async function undoLatestWebsiteChange(button) {
  const activity = activityItems.find(entry =>
    entry.item_id && entry.operation !== 'undo' && normalizeEmail(entry.actor_email) === normalizeEmail(currentUser?.email));
  if (!activity) {
    showToast('There is no recent change of yours to undo.', true);
    return;
  }
  const item = plannerItems.find(candidate => candidate.id === activity.item_id);
  if (!item) {
    showToast('That item is no longer available to undo.', true);
    return;
  }
  let mutation;
  if (activity.operation === 'create') {
    mutation = { status: 'cancelled', updated_via: 'undo' };
  } else if (activity.before_state) {
    const before = activity.before_state;
    mutation = {
      item_type: before.item_type, title: before.title, details: before.details || {}, status: before.status,
      starts_at: before.starts_at, ends_at: before.ends_at, due_at: before.due_at,
      planned_for: before.planned_for, assignee: before.assignee, updated_via: 'undo',
    };
  } else {
    showToast('That change does not have enough history to undo safely.', true);
    return;
  }
  button.disabled = true;
  const query = plannerDb.from('planner_items').update(mutation).eq('id', item.id);
  const { error } = activity.after_state?.updated_at ? await query.eq('updated_at', activity.after_state.updated_at) : await query;
  button.disabled = false;
  if (error) {
    showToast('That item changed afterward, so it was not undone.', true);
    return;
  }
  showToast(`Undid the change to ${item.title}.`);
  await loadPlanner({ quiet: true });
}

plannerGrid.addEventListener('click', async event => {
  const routineStep = event.target.closest('button[data-routine-step]');
  if (routineStep) return toggleRoutineStep(routineStep);
  const listItem = event.target.closest('button[data-list-index]');
  if (listItem) return toggleListItem(listItem);
  const undoButton = event.target.closest('button[data-undo-latest]');
  if (undoButton) return undoLatestWebsiteChange(undoButton);
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  await updatePlannerItem(button.dataset.action, button.dataset.id, button);
});

todayPanel.addEventListener('click', async event => {
  const routineStep = event.target.closest('button[data-routine-step]');
  if (routineStep) return toggleRoutineStep(routineStep);
  const button = event.target.closest('button[data-action]');
  if (button) await updatePlannerItem(button.dataset.action, button.dataset.id, button);
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
