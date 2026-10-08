/*
 * Load test for the HRMS + Chat API.
 *
 * Logs in once per user (stays under the 20 per 15 min login limit), then hits the most used
 * pages with autocannon and prints latency / throughput per endpoint. Everything is read-only
 * except "chat: send message", which writes messages into a chat between the two demo users.
 *
 * Usage:
 *   npm run loadtest                                  # http://localhost:5000, 50 users, 20s each
 *   npm run loadtest -- --url http://localhost:5050 --connections 100 --duration 30
 *   npm run loadtest -- --only chat                   # only scenarios whose name contains "chat"
 *
 * Only point it at a server you own, never at the live database: it slows the app down for
 * real users and the chat scenario writes messages.
 */
import autocannon from 'autocannon';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);

const BASE_URL = (args.url || process.env.LOADTEST_URL || 'http://localhost:5000').replace(/\/+$/, '');
const CONNECTIONS = Number(args.connections) || 50;
const DURATION = Number(args.duration) || 20;
const PASSWORD = args.password || process.env.LOADTEST_PASSWORD || 'Password@123';
const ONLY = args.only ? args.only.toLowerCase() : null;

// Seeded demo users (see src/seed/seedData.js)
const USERS = { admin: 'admin@hrms.com', employee: 'employee@hrms.com', lead: 'thomas@hrms.com' };

async function api(method, path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${json.message || ''}`);
  return json.data;
}

const tokens = {};
for (const [role, email] of Object.entries(USERS)) tokens[role] = (await api('POST', '/api/auth/login', null, { email, password: PASSWORD })).token;

// A chat between the employee and the team lead for the chat scenarios
const lead = await api('GET', '/api/auth/me', tokens.lead);
const chat = await api('POST', '/api/chat/conversations/direct', tokens.employee, { userId: lead._id });

// [name, role whose token is used, path, optional { method, body }]
const SCENARIOS = [
  ['health (no DB)', null, '/health'],
  ['auth/me', 'employee', '/api/auth/me'],
  ['dashboard', 'employee', '/api/dashboard'],
  ['attendance/today', 'employee', '/api/attendance/today'],
  ['leaves/balances', 'employee', '/api/leaves/balances'],
  ['notifications', 'employee', '/api/notifications'],
  ['employees/directory', 'employee', '/api/employees/directory'],
  ['employees (HR list)', 'admin', '/api/employees'],
  ['reports/management', 'admin', '/api/reports/management'],
  ['chat: conversation list', 'employee', '/api/chat/conversations'],
  ['chat: unread badge', 'employee', '/api/chat/unread'],
  ['chat: folders', 'employee', '/api/chat/folders'],
  ['chat: open a chat (40 msgs)', 'employee', `/api/chat/conversations/${chat._id}/messages`],
  ['chat: send message', 'employee', `/api/chat/conversations/${chat._id}/messages`, { method: 'POST', body: { text: 'load test message' } }],
].filter(([name]) => !ONLY || name.toLowerCase().includes(ONLY));

function runOne(path, token, request = {}) {
  return new Promise((resolve, reject) => {
    autocannon(
      {
        url: `${BASE_URL}${path}`,
        connections: CONNECTIONS,
        duration: DURATION,
        method: request.method || 'GET',
        body: request.body ? JSON.stringify(request.body) : undefined,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
  });
}

console.log(`\nTarget ${BASE_URL} | ${CONNECTIONS} concurrent connections | ${DURATION}s per endpoint\n`);

const rows = [];
for (const [name, role, path, request] of SCENARIOS) {
  process.stdout.write(`Running ${name}... `);
  const r = await runOne(path, role && tokens[role], request);
  const ok = r['2xx'];
  const failed = r.non2xx + r.errors + r.timeouts;
  rows.push({
    endpoint: name,
    'req/s': Math.round(r.requests.average),
    'p50 ms': r.latency.p50,
    'p90 ms': r.latency.p90,
    'p99 ms': r.latency.p99,
    'max ms': r.latency.max,
    ok,
    failed,
    'error %': ((failed / Math.max(ok + failed, 1)) * 100).toFixed(1),
  });
  console.log('done');
}

console.log();
console.table(rows);

// Simple pass/fail so this can run in CI: p99 under 1s and under 1% errors everywhere
const slow = rows.filter((row) => row['p99 ms'] > 1000 || Number(row['error %']) > 1);
if (slow.length) {
  console.log(`\nFAIL: ${slow.map((row) => row.endpoint).join(', ')} (p99 > 1000ms or errors > 1%)`);
  process.exitCode = 1;
} else {
  console.log('\nPASS: every endpoint p99 < 1000ms with < 1% errors');
}
