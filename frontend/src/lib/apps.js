/*
 * HRMS and Chat are two apps on the same site with one login. Each runs in its own browser tab,
 * so people can keep them side by side (or use only Chat).
 */
export const APPS = {
  hrms: { label: 'HRMS', home: '/dashboard', windowName: 'peoplehub-hrms' },
  chat: { label: 'Chat', home: '/chat', windowName: 'peoplehub-chat' },
};

export const appForPath = (path = '') => (path === '/chat' || path.startsWith('/chat/') || path.startsWith('/chat?') ? 'chat' : 'hrms');

// Names the current tab so links from the other app reuse it instead of opening another one
export function claimTab(app) {
  window.name = APPS[app].windowName;
}

/*
 * Opens the app in its own tab, or reuses that tab if it is already open.
 * Without a path an open tab is only brought forward (keeps what it was showing).
 */
export function openApp(app, path) {
  const { home, windowName } = APPS[app];
  const target = window.open('', windowName);
  if (!target) {
    // Pop-ups blocked: go there in this tab
    window.location.href = path || home;
    return;
  }
  let current = '';
  try {
    current = target.location.href;
  } catch {
    /* not readable, treat as new */
  }
  if (!current || current === 'about:blank') target.location.href = path || home;
  else if (path) target.location.href = path;
  target.focus();
}

// Only same-site paths are allowed after login (never "//evil.com" or a full URL)
export function safeNextPath(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

// The app picked on the login page last time (per browser)
const LANDING_KEY = 'hrms_landing_app';
export function getLandingApp() {
  try {
    return localStorage.getItem(LANDING_KEY) === 'chat' ? 'chat' : 'hrms';
  } catch {
    return 'hrms';
  }
}
export function setLandingApp(app) {
  try {
    localStorage.setItem(LANDING_KEY, app);
  } catch {
    /* ignore */
  }
}
