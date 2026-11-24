const { createClient } = window.supabase;
const supabaseClient = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
window.supabaseClient = supabaseClient;

async function requireUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    alert('Сначала войдите в аккаунт.');
    window.location.href = 'login.html';
    return null;
  }
  return session.user;
}

async function getCurrentUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session?.user || null;
}

async function updateAuthLinks() {
  const user = await getCurrentUser();
  document.querySelectorAll('a[href="register.html"]').forEach(a => {
    if (user) {
      a.textContent = 'Аккаунт';
      a.href = 'account.html';
    }
  });
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.hidden = !user;
    btn.onclick = async () => {
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    };
  });
}

document.addEventListener('DOMContentLoaded', updateAuthLinks);
