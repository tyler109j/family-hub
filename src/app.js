const SUPABASE_URL = 'https://vxorqbapoienakldbdre.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RxZwNUwJTJ5OlvZrobIwRA_5SGfxQGs';
const ALLOWED_EMAILS = new Set([
  'tyler109j@gmail.com',
  'kaylajilljoyce@gmail.com',
]);
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const sections = [
  ['calendar', 'Calendar', ['Event title', 'Date', 'Notes']],
  ['tasks', 'Tasks & chores', ['Task', 'Assignee', 'Due date']],
  ['shopping', 'Shopping list', ['Item', 'Category']],
  ['meals', 'Meal plan', ['Day', 'Meal']],
  ['notes', 'Family notes', ['Note title', 'Details']],
  ['agents', 'Agent inbox', ['Agent name', 'Suggestion']],
];
const blankData = () => Object.fromEntries(sections.map(([key]) => [key, []]));

let currentUser = null;
let data = blankData();
const dashboard = document.querySelector('#dashboard');
const authForm = document.querySelector('#authForm');
const authMessage = document.querySelector('#authMessage');
const signOutButton = document.querySelector('#signOut');

const normalizeEmail = value => value.trim().toLowerCase();
const isAllowed = email => ALLOWED_EMAILS.has(normalizeEmail(email || ''));
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

function storageKey() {
  return currentUser ? `familyPlanner:${currentUser.id}` : null;
}

function render() {
  dashboard.innerHTML = sections.map(([key, title, fields]) => `
    <article class="card">
      <h2>${title}</h2>
      <form class="form" data-key="${key}">
        ${fields.map((field, index) => index === fields.length - 1 && key === 'notes'
          ? `<textarea placeholder="${field}"></textarea>`
          : `<input placeholder="${field}">`).join('')}
        <button>Add ${title.toLowerCase()}</button>
      </form>
      <div>${(data[key] || []).map((item, index) => `
        <div class="item">
          <div>
            <strong>${escapeHtml(item[0])}</strong>
            <small>${escapeHtml(item[1] || '')}</small>
            ${item[2] ? `<small>${escapeHtml(item[2])}</small>` : ''}
          </div>
          <button data-remove="${key}" data-index="${index}">Done</button>
        </div>`).join('')}
      </div>
    </article>`).join('');
}

function saveLocal() {
  if (storageKey()) localStorage.setItem(storageKey(), JSON.stringify(data));
}

async function loadPlanner() {
  const local = localStorage.getItem(storageKey());
  data = local ? JSON.parse(local) : blankData();
  const { data: rows, error } = await supabase
    .from('family_items')
    .select('section,values')
    .eq('user_id', currentUser.id);
  if (error) {
    authMessage.textContent = 'Signed in, but planner data could not be loaded.';
    return;
  }
  if (rows.length) {
    data = blankData();
    rows.forEach(row => (data[row.section] ||= []).push(row.values));
    saveLocal();
  }
  dashboard.hidden = false;
  render();
}

async function acceptSession(user) {
  if (!user || !isAllowed(user.email)) {
    await supabase.auth.signOut();
    currentUser = null;
    dashboard.hidden = true;
    authForm.hidden = false;
    signOutButton.hidden = true;
    authMessage.textContent = 'Access is limited to Tyler and Kayla.';
    return;
  }
  currentUser = user;
  authForm.hidden = true;
  signOutButton.hidden = false;
  authMessage.textContent = `Signed in as ${user.email}`;
  await loadPlanner();
}

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = normalizeEmail(document.querySelector('#email').value);
  const password = document.querySelector('#password').value;
  const action = event.submitter?.value || 'signin';

  if (!isAllowed(email)) {
    authMessage.textContent = 'That email is not approved for this private planner.';
    return;
  }

  authMessage.textContent = action === 'signup' ? 'Creating accountâ€¦' : 'Signing inâ€¦';
  const result = action === 'signup'
    ? await supabase.auth.signUp({ email, password })
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
  await supabase.auth.signOut();
  location.reload();
});

dashboard.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser) return;
  const form = event.target;
  const section = form.dataset.key;
  const values = [...form.querySelectorAll('input,textarea')].map(input => input.value.trim());
  if (!values[0]) return;
  const { error } = await supabase.from('family_items').insert({
    user_id: currentUser.id,
    section,
    values,
  });
  if (error) {
    authMessage.textContent = 'This account is not authorized to save planner data.';
    return;
  }
  data[section].push(values);
  saveLocal();
  render();
});

dashboard.addEventListener('click', event => {
  if (!event.target.dataset.remove) return;
  data[event.target.dataset.remove].splice(Number(event.target.dataset.index), 1);
  saveLocal();
  render();
});

supabase.auth.getSession().then(({ data: sessionData }) => {
  if (sessionData.session) acceptSession(sessionData.session.user);
});