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

const authorizationId = new URLSearchParams(location.search).get('authorization_id');
const loginPanel = document.querySelector('#oauthLoginPanel');
const consentPanel = document.querySelector('#oauthConsentPanel');
const googleButton = document.querySelector('#oauthGoogleSignIn');
const loginForm = document.querySelector('#oauthLoginForm');
const approveButton = document.querySelector('#oauthApprove');
const denyButton = document.querySelector('#oauthDeny');
const signOutButton = document.querySelector('#oauthSignOut');
const message = document.querySelector('#oauthMessage');
const clientName = document.querySelector('#oauthClientName');
const userText = document.querySelector('#oauthUser');

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const isAllowed = email => ALLOWED_EMAILS.has(normalizeEmail(email));

function cleanReturnUrl() {
  const url = new URL(location.href);
  ['code', 'error', 'error_code', 'error_description'].forEach(key => url.searchParams.delete(key));
  return url.toString();
}

async function showAuthorization(user) {
  if (!authorizationId) {
    loginPanel.hidden = true;
    consentPanel.hidden = true;
    message.textContent = 'This connection link is missing its authorization request. Start again from ChatGPT.';
    return;
  }

  if (!isAllowed(user?.email)) {
    await supabase.auth.signOut();
    loginPanel.hidden = false;
    consentPanel.hidden = true;
    message.textContent = 'That Google account is not approved for this family planner.';
    return;
  }

  message.textContent = 'Loading the connection details…';
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    message.textContent = error?.message || 'This connection request is no longer valid. Start again from ChatGPT.';
    return;
  }

  if (!Object.hasOwn(data, 'authorization_id') && data.redirect_url) {
    location.assign(data.redirect_url);
    return;
  }

  clientName.textContent = data.client?.name || 'Family Assistant';
  userText.textContent = `Signed in as ${user.email}.`;
  loginPanel.hidden = true;
  consentPanel.hidden = false;
  message.textContent = 'You can disconnect this account later from ChatGPT settings.';
}

async function initialize() {
  if (!authorizationId) {
    await showAuthorization(null);
    return;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    message.textContent = error.message;
    return;
  }
  if (!data.session?.user) {
    loginPanel.hidden = false;
    consentPanel.hidden = true;
    message.textContent = 'Sign in to continue the secure connection.';
    return;
  }
  await showAuthorization(data.session.user);
}

googleButton.addEventListener('click', async () => {
  message.textContent = 'Opening Google sign-in…';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: cleanReturnUrl() },
  });
  if (error) message.textContent = error.message;
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = normalizeEmail(document.querySelector('#oauthEmail').value);
  const password = document.querySelector('#oauthPassword').value;
  if (!isAllowed(email)) {
    message.textContent = 'That email is not approved for this family planner.';
    return;
  }
  message.textContent = 'Signing in…';
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    message.textContent = error.message;
    return;
  }
  await showAuthorization(data.user);
});

approveButton.addEventListener('click', async () => {
  approveButton.disabled = true;
  message.textContent = 'Connecting Family Assistant…';
  const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId);
  if (error) {
    approveButton.disabled = false;
    message.textContent = error.message;
    return;
  }
  location.assign(data.redirect_url);
});

denyButton.addEventListener('click', async () => {
  denyButton.disabled = true;
  const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId);
  if (error) {
    denyButton.disabled = false;
    message.textContent = error.message;
    return;
  }
  location.assign(data.redirect_url);
});

signOutButton.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

initialize();
