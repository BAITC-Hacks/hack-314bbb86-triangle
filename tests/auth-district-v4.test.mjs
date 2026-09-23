// Copy into tests/: node --experimental-sqlite --test tests/auth-district-v4.test.mjs
// Uses the actual HTTP session wrapper, API, SQLite migrations and scoring engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {api} from '../backend/api.mjs';
import {withBrowserSession, passwordHash, canEdit} from '../backend/session.mjs';
import {openDatabase} from '../backend/sqlite.mjs';
import {hash} from '../backend/database.mjs';
import {districtFacts, districtIdOrDefault} from '../shared/district.mjs';
import {BASELINE} from '../shared/engine.mjs';
import {DISTRICTS, EXAMPLE} from '../shared/data.mjs';

const ORIGIN = 'https://akim.test';
// Runtime-only fixture credentials. No deployment secrets or network calls.
const accounts = await Promise.all(['mayor', 'manager'].map(async role => {
  const password = randomUUID() + randomUUID();
  const salt = randomBytes(24).toString('hex');
  return {id: role, role, name: `Test ${role}`, email: `${role}@example.test`,
    password, salt, passwordHash: await passwordHash(password, salt)};
}));
const publicAccounts = accounts.map(({password, ...account}) => account);

function fixture(t) {
  const DB = openDatabase(':memory:');
  t.after(() => DB.close());
  return {DB, LOCAL: '1', AUTH_ACCOUNTS: JSON.stringify(publicAccounts)};
}

async function request(env, path, {method = 'GET', body, cookie, headers = {}} = {}) {
  const sent = new Headers(headers);
  if (cookie) sent.set('cookie', cookie);
  if (body !== undefined) sent.set('content-type', 'application/json');
  if (method !== 'GET' && !sent.has('origin')) sent.set('origin', ORIGIN);
  const req = new Request(ORIGIN + path, {method, headers: sent,
    body: body === undefined ? undefined : JSON.stringify(body)});
  const response = await withBrowserSession(req, env, user => api(req, env, user));
  const setCookie = response.headers.get('set-cookie');
  return {status: response.status, body: await response.json(), headers: response.headers,
    setCookie, cookie: setCookie?.split(';', 1)[0]};
}

async function signIn(env, role = 'mayor', options = {}) {
  const account = accounts.find(a => a.role === role);
  const response = await request(env, '/api/auth/login', {
    method: 'POST', ...options,
    body: {email: account.email, password: account.password, ...options.body},
  });
  assert.equal(response.status, 200, 'fixture login should succeed');
  assert.ok(response.cookie, 'login should establish a browser cookie');
  return response;
}

async function expectError(response, status, error) {
  assert.equal(response.status, status);
  assert.deepEqual(response.body, {error});
}

const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, message || `${actual} != ${expected}`);

test('password login establishes a secure opaque session with a hashed server token', async t => {
  const env = fixture(t);
  const guest = await request(env, '/api/config');
  assert.equal(guest.status, 200);
  assert.equal(guest.body.user, null);
  assert.equal(guest.body.canEdit, false);
  assert.equal(guest.setCookie, null, 'config must not create a guest identity');

  const login = await signIn(env, 'mayor', {body: {email: '  MAYOR@EXAMPLE.TEST  '}});
  assert.match(login.cookie, /^akim_session=[a-f0-9]{64}$/);
  for (const flag of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/', 'Max-Age=28800'])
    assert.ok(login.setCookie.includes(flag), `missing cookie attribute: ${flag}`);
  assert.equal(login.headers.get('cache-control'), 'no-store');
  const raw = login.cookie.slice('akim_session='.length);
  const row = env.DB.raw.prepare('SELECT * FROM auth_sessions').get();
  assert.equal(row.id, await hash(raw));
  assert.notEqual(row.id, raw);
  assert.equal(row.account_id, 'mayor');
  assert.ok(row.expires_at > Date.now());
  assert.ok(row.expires_at <= Date.now() + 28800 * 1000);

  const config = await request(env, '/api/config', {cookie: login.cookie});
  assert.deepEqual(config.body.user, {id: 'mayor', name: 'Test mayor',
    email: 'mayor@example.test', role: 'mayor', kind: 'account'});
  assert.equal(config.body.canEdit, true);
  assert.equal('passwordHash' in config.body.user, false);
  assert.equal('password_hash' in config.body.user, false);
  assert.equal('salt' in config.body.user, false);
});

test('new login rotates the cookie; logout and expiration revoke replayed sessions', async t => {
  const env = fixture(t);
  const first = await signIn(env);
  const second = await signIn(env, 'mayor', {cookie: first.cookie});
  assert.notEqual(second.cookie, first.cookie);
  await expectError(await request(env, '/api/draft', {cookie: first.cookie}), 401, 'AUTH_REQUIRED');
  assert.equal((await request(env, '/api/draft', {cookie: second.cookie})).status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n, 1);

  const logout = await request(env, '/api/auth/logout', {method: 'POST', cookie: second.cookie});
  assert.equal(logout.status, 200);
  assert.match(logout.setCookie, /^akim_session=;/);
  assert.ok(logout.setCookie.includes('Max-Age=0'));
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n, 0);
  await expectError(await request(env, '/api/draft', {cookie: second.cookie}), 401, 'AUTH_REQUIRED');

  const expired = await signIn(env);
  env.DB.raw.prepare('UPDATE auth_sessions SET expires_at=?').run(Date.now() - 1);
  await expectError(await request(env, '/api/draft', {cookie: expired.cookie}), 401, 'AUTH_REQUIRED');
});

test('legacy guest cookies and forged role headers cannot impersonate an account', async t => {
  const env = fixture(t);
  const forgedHeaders = {'oai-authenticated-user-id': 'mayor',
    'oai-authenticated-user-email': 'mayor@example.test', 'x-user-role': 'mayor',
    'x-user-id': 'mayor', authorization: 'Bearer forged-test-token'};
  for (const cookie of [undefined, 'akim_session=legacy-guest.invalid-signature',
    `akim_session=${'a'.repeat(64)}; role=mayor; user_id=mayor`]) {
    const config = await request(env, '/api/config', {cookie, headers: forgedHeaders});
    assert.equal(config.body.user, null);
    assert.equal(config.body.canEdit, false);
    await expectError(await request(env, '/api/draft', {cookie, headers: forgedHeaders}), 401, 'AUTH_REQUIRED');
  }
  const manager = await signIn(env, 'manager', {
    headers: forgedHeaders, body: {role: 'mayor', id: 'mayor', kind: 'account'},
  });
  assert.equal(manager.body.user.role, 'manager');
  assert.equal(manager.body.user.id, 'manager');
  const config = await request(env, '/api/config', {cookie: manager.cookie, headers: forgedHeaders});
  assert.equal(config.body.user.role, 'manager');
  assert.equal(canEdit({id: 'mayor', role: 'mayor', kind: 'guest'}), false);
  assert.equal(canEdit({id: 'mayor', role: 'admin', kind: 'account'}), false);
});

test('invalid credentials are generic and account throttling blocks repeated attempts', async t => {
  const env = fixture(t);
  const bad = {email: accounts[0].email, password: 'incorrect-runtime-fixture'};
  const unknown = {email: 'missing@example.test', password: accounts[0].password};
  await expectError(await request(env, '/api/auth/login', {method: 'POST', body: bad}), 401, 'INVALID_CREDENTIALS');
  await expectError(await request(env, '/api/auth/login', {method: 'POST', body: unknown}), 401, 'INVALID_CREDENTIALS');
  await expectError(await request(env, '/api/auth/login', {method: 'POST', body: {email: 42}}), 401, 'INVALID_CREDENTIALS');
  for (let i = 1; i < 10; i++)
    await expectError(await request(env, '/api/auth/login', {method: 'POST', body: bad}), 401, 'INVALID_CREDENTIALS');
  // Correct credentials do not bypass an exhausted account bucket.
  const limited = await request(env, '/api/auth/login', {method: 'POST',
    body: {email: accounts[0].email, password: accounts[0].password}});
  await expectError(limited, 429, 'LOGIN_LIMIT');
  assert.equal(limited.setCookie, null);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n, 0);
});

test('guests cannot use protected simulation, AI, draft or scenario APIs', async t => {
  const env = fixture(t);
  const routes = [
    ['/api/draft', 'GET'], ['/api/draft', 'PUT', {decisions: [], revision: 0}],
    ['/api/scenarios', 'GET'], ['/api/scenarios', 'POST', {name: 'Test', team: 'Test', decisions: EXAMPLE}],
    ['/api/simulate', 'POST', {decisions: EXAMPLE}],
    ['/api/analyze', 'POST', {decisions: EXAMPLE, locale: 'en'}],
    ['/api/what-if', 'POST', {decisions: [], message: 'Improve Nura', locale: 'en'}],
  ];
  for (const [path, method, body] of routes) {
    const response = await request(env, path, {method, body});
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.deepEqual(response.body, {error: 'AUTH_REQUIRED'}, `${method} ${path}`);
  }
  assert.equal((await request(env, '/api/config')).status, 200);
  assert.equal((await request(env, '/api/leaderboard')).status, 200);
});

test('cross-origin and cross-site writes are rejected even with a valid session', async t => {
  const env = fixture(t);
  const {cookie} = await signIn(env);
  for (const headers of [{origin: 'https://other.test'}, {'sec-fetch-site': 'cross-site'}]) {
    await expectError(await request(env, '/api/draft', {method: 'PUT', cookie, headers,
      body: {decisions: EXAMPLE, revision: 0}}), 403, 'ORIGIN_DENIED');
    await expectError(await request(env, '/api/auth/logout', {method: 'POST', cookie, headers}), 403, 'ORIGIN_DENIED');
    await expectError(await request(env, '/api/auth/login', {method: 'POST', headers,
      body: {email: accounts[0].email, password: accounts[0].password}}), 403, 'ORIGIN_DENIED');
  }
  assert.deepEqual((await request(env, '/api/draft', {cookie})).body, {decisions: [], revision: 0});
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) n FROM auth_sessions').get().n, 1);
});

test('account drafts survive logout and relogin and stay isolated between the two roles', async t => {
  const env = fixture(t);
  const mayor = await signIn(env, 'mayor');
  const manager = await signIn(env, 'manager');
  const mayorPlan = [{measureId: 'M7', districtId: 'nura'}];
  const managerPlan = [{measureId: 'M4', districtId: 'esil'}];
  for (const [cookie, decisions] of [[mayor.cookie, mayorPlan], [manager.cookie, managerPlan]]) {
    assert.deepEqual((await request(env, '/api/draft', {cookie})).body, {decisions: [], revision: 0});
    const saved = await request(env, '/api/draft', {method: 'PUT', cookie,
      body: {decisions, revision: 0, owner_id: 'forged-owner', role: 'mayor'}});
    assert.equal(saved.status, 200);
    assert.equal(saved.body.revision, 1);
  }
  await request(env, '/api/auth/logout', {method: 'POST', cookie: mayor.cookie});
  const relogin = await signIn(env, 'mayor');
  assert.deepEqual((await request(env, '/api/draft', {cookie: relogin.cookie})).body,
    {decisions: mayorPlan, revision: 1});
  assert.deepEqual((await request(env, '/api/draft', {cookie: manager.cookie})).body,
    {decisions: managerPlan, revision: 1});
  const owners = env.DB.raw.prepare('SELECT owner_id FROM drafts ORDER BY owner_id').all().map(x => x.owner_id);
  assert.deepEqual(owners, ['manager', 'mayor']);
});

test('draft revisions prevent lost updates and invalid writes preserve the saved draft', async t => {
  const env = fixture(t);
  const {cookie} = await signIn(env);
  const plans = [[{measureId: 'M7', districtId: 'nura'}], [{measureId: 'M4', districtId: 'esil'}]];
  const writes = await Promise.all(plans.map(decisions => request(env, '/api/draft', {
    method: 'PUT', cookie, body: {decisions, revision: 0},
  })));
  assert.deepEqual(writes.map(r => r.status).sort(), [200, 409]);
  const winningPlan = plans[writes.findIndex(r => r.status === 200)];
  assert.deepEqual(writes.find(r => r.status === 409).body, {error: 'DRAFT_CONFLICT'});
  await expectError(await request(env, '/api/draft', {method: 'PUT', cookie,
    body: {decisions: [], revision: -1}}), 400, 'INVALID_REVISION');
  await expectError(await request(env, '/api/draft', {method: 'PUT', cookie,
    body: {decisions: [], revision: 1.5}}), 400, 'INVALID_REVISION');
  const invalid = await request(env, '/api/draft', {method: 'PUT', cookie,
    body: {decisions: [{measureId: 'M7', districtId: 'outside-dataset'}], revision: 1}});
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.valid, false);
  assert.deepEqual((await request(env, '/api/draft', {cookie})).body,
    {decisions: winningPlan, revision: 1});
});

test('scenario ownership uses the authenticated account and sharing is explicit', async t => {
  const env = fixture(t);
  const mayor = await signIn(env, 'mayor');
  const manager = await signIn(env, 'manager');
  const created = await request(env, '/api/scenarios', {method: 'POST', cookie: mayor.cookie,
    body: {name: 'Private fixture', team: 'Test', decisions: EXAMPLE, owner_id: 'manager'}});
  assert.equal(created.status, 201);
  const {id} = created.body.scenario;
  assert.equal(created.body.scenario.shareId, null);
  assert.equal((await request(env, '/api/scenarios', {cookie: manager.cookie})).body.scenarios.length, 0);
  for (const [suffix, method] of [['', 'GET'], ['', 'DELETE'], ['/share', 'POST'], ['/publish', 'POST']])
    await expectError(await request(env, `/api/scenarios/${id}${suffix}`, {method, cookie: manager.cookie}), 404, 'NOT_FOUND');
  assert.equal((await request(env, `/api/scenarios/${id}`, {cookie: mayor.cookie})).status, 200);
  const shared = await request(env, `/api/scenarios/${id}/share`, {method: 'POST', cookie: mayor.cookie});
  assert.equal(shared.status, 200);
  const publicRead = await request(env, `/api/shared/${shared.body.scenario.shareId}`);
  assert.equal(publicRead.status, 200);
  assert.equal(publicRead.body.scenario.id, id);
  assert.equal((await request(env, '/api/leaderboard')).body.scenarios.length, 0);
});

test('a local project only changes its target district and retains the shared city budget', () => {
  const decisions = [{measureId: 'M7', districtId: 'nura'}];
  const originalInput = structuredClone(decisions);
  const originalBaseline = structuredClone(BASELINE);
  const target = districtFacts(decisions, 'nura');
  near(target.delta, 1.1);
  assert.equal(target.localCost, 24);
  assert.equal(target.citywideCost, 0);
  assert.deepEqual(target.measures.map(m => m.id), ['M7']);
  assert.equal(target.after.metrics.S1, 48);
  assert.equal(target.criticalBefore, 2);
  assert.equal(target.criticalAfter, 1);
  for (const district of DISTRICTS.filter(d => d.id !== 'nura')) {
    const other = districtFacts(decisions, district.id);
    assert.equal(other.delta, 0, district.id);
    assert.deepEqual(other.before.metrics, other.after.metrics, district.id);
    assert.equal(other.metrics.every(m => m.delta === 0), true);
    assert.deepEqual(other.measures, []);
    assert.equal(other.localCost, 0);
    assert.equal(other.citywideCost, 0);
    assert.equal(other.city.cost, 24, 'district view must retain total committed city spending');
  }
  assert.deepEqual(decisions, originalInput);
  assert.deepEqual(BASELINE, originalBaseline);
  assert.equal(districtIdOrDefault('esil'), 'esil');
  assert.equal(districtIdOrDefault('unknown'), 'nura');
  assert.throws(() => districtFacts(decisions, 'unknown'), /INVALID_DISTRICT/);
});

test('district facts separate citywide costs and effects, local synergy and quarter projections', () => {
  const decisions = [{measureId: 'M10', districtId: 'nura'}, {measureId: 'M12'}];
  const nura = districtFacts(decisions, 'nura');
  const esil = districtFacts(decisions, 'esil');
  assert.deepEqual(nura.measures.map(m => m.id), ['M10', 'M12']);
  assert.deepEqual(esil.measures.map(m => m.id), ['M12']);
  assert.equal(nura.localCost, 12);
  assert.equal(esil.localCost, 0);
  assert.equal(nura.citywideCost, 14);
  assert.equal(esil.citywideCost, 14);
  assert.equal(esil.city.cost, 26);
  near(nura.after.metrics.B1 - nura.before.metrics.B1, 12.5, 'local lighting plus fixed synergy');
  assert.equal(esil.after.metrics.B1 - esil.before.metrics.B1, 0, 'synergy must not leak to another district');
  for (const district of DISTRICTS) {
    const facts = districtFacts(decisions, district.id);
    near(facts.after.metrics.C2 - facts.before.metrics.C2, 4.375, 'city measure must affect every model district');
  }
  const quarterZero = districtFacts(decisions, 'nura', 0);
  assert.equal(quarterZero.delta, 0);
  assert.equal(quarterZero.city.cost, 26, 'cost is committed even before realized effects');
  assert.deepEqual(quarterZero.before.metrics, quarterZero.after.metrics);
  assert.equal(nura.series.length, 9);
  assert.deepEqual(nura.series.map(s => s.quarter), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  near(nura.series[0].score, nura.before.score);
  near(nura.series[8].score, nura.after.score);
  assert.throws(() => districtFacts(decisions, 'nura', 9), /INVALID_QUARTER/);
});
