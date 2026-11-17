const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const apiSource = readFileSync(`${__dirname}/api.js`, 'utf8');
const appSource = readFileSync(`${__dirname}/app.js`, 'utf8');

function runtime(fetch, overrides = {}) {
  const context = vm.createContext({
    fetch, Headers, AbortController, Uint8Array, crypto, URL, setTimeout, clearTimeout,
    location: { origin: 'http://localhost:5500', hostname: 'localhost' },
    window: { addEventListener() {} }, ...overrides
  });
  vm.runInContext(apiSource, context);
  return context;
}
const connection = { base: 'https://example.com', key: 'test-key', version: '2.0.0' };

 test('normalizes API and copied Swagger URLs including version fragments', () => {
  const context = runtime();
  for (const input of ['https://example.com/', 'https://example.com/swagger-ui/index.html#/', 'https://example.com/v3/api-docs']) {
    assert.equal(vm.runInContext(`apiUrl(${JSON.stringify(input)})`, context), 'https://example.com');
  }
  assert.equal(vm.runInContext("apiUrl('http://localhost:8080/')", context), 'http://localhost:8080');
  for (const input of ['http://example.com', 'https://user:secret@example.com', 'https://example.com?key=secret']) {
    assert.throws(() => vm.runInContext(`apiUrl(${JSON.stringify(input)})`, context));
  }
});

test('sends API authentication, version, selected account and reusable idempotency key', async () => {
  let captured;
  const context = runtime(async (url, options) => {
    captured = { url, ...options };
    return new Response('{"id":1}', { status: 201 });
  });
  context.connection = connection;
  await vm.runInContext("apiRequest(connection, '/companies', { method: 'POST', body: { tradeName: 'Example' }, accountId: 'account', key: 'retry-key' })", context);
  assert.equal(captured.url, 'https://example.com/companies');
  for (const [header, expected] of Object.entries({ 'X-API-Key': 'test-key', 'X-API-Version': '2.0.0', 'X-Account-Id': 'account', 'X-Idempotency-Key': 'retry-key', 'Content-Type': 'application/json' })) {
    assert.equal(captured.headers.get(header), expected);
  }
  assert.equal(captured.credentials, 'omit');
  assert.deepEqual(JSON.parse(captured.body), { tradeName: 'Example' });
});

test('v1 POST omits idempotency and DELETE accepts an empty 204 response', async () => {
  const context = runtime(async (url, options) => {
    assert.equal(options.headers.has('X-Idempotency-Key'), false);
    return new Response(null, { status: 204 });
  });
  context.connection = { ...connection, version: '1.0.1' };
  assert.equal(await vm.runInContext("apiRequest(connection, '/contacts/1', { method: 'DELETE' })", context), null);
  assert.equal(await vm.runInContext("apiRequest(connection, '/contacts', { method: 'POST', body: {} })", context), null);
});

test('HTTP errors retain status, field validation and Retry-After', async () => {
  const context = runtime(async () => new Response(JSON.stringify({ detail: 'Rate limit', errors: [{ field: 'name', message: 'Required' }] }), { status: 429, headers: { 'Retry-After': '2' } }));
  context.connection = connection;
  await assert.rejects(vm.runInContext("apiRequest(connection, '/companies')", context), error => error.status === 429 && /name: Required/.test(error.message) && /2 seconds/.test(error.message));
});

test('network failures explain the exact CORS origin', async () => {
  const context = runtime();
  vm.runInContext("fetch = async () => { throw new TypeError('Failed to fetch'); }", context);
  context.connection = connection;
  await assert.rejects(vm.runInContext("apiRequest(connection, '/companies')", context), /CORP_API_CORS_ORIGINS must include http:\/\/localhost:5500/);
});

test('file origins receive instructions to serve the dashboard', async () => {
  const context = runtime(undefined, { location: { origin: 'null' } });
  vm.runInContext("fetch = async () => { throw new TypeError('Failed to fetch'); }", context);
  context.connection = connection;
  await assert.rejects(vm.runInContext("apiRequest(connection, '/companies')", context), /Serve this dashboard/);
});

test('timeouts terminate the request and provide Render startup guidance', async () => {
  let expire;
  const context = runtime((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason));
  }), { setTimeout: callback => { expire = callback; return 1; }, clearTimeout() {} });
  context.connection = connection;
  const result = vm.runInContext("apiRequest(connection, '/companies')", context);
  expire();
  await assert.rejects(result, /90 seconds/);
});

test('parent cancellation reaches fetch and clears its timer', async () => {
  let cleared = false;
  const controller = new AbortController();
  const context = runtime((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason));
  }), { setTimeout: () => 1, clearTimeout: () => { cleared = true; } });
  context.connection = { ...connection, signal: controller.signal };
  const result = vm.runInContext("apiRequest(connection, '/companies')", context);
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(cleared, true);
});

test('rejects successful HTML responses and tolerates unexpected error schemas', async () => {
  const context = runtime(async () => new Response('<html>Wrong server</html>'));
  context.connection = connection;
  await assert.rejects(vm.runInContext("apiRequest(connection, '/companies')", context), /Check the API URL/);
  context.fetch = async () => new Response('{"errors":{}}', { status: 401 });
  await assert.rejects(vm.runInContext("apiRequest(connection, '/companies')", context), error => error.status === 401);
});

test('local dashboard starts with the production API', () => {
  let initialize;
  const fields = { apiUrl: {} };
  const context = runtime(undefined, { window: { addEventListener: (event, callback) => { initialize = callback; } }, document: { getElementById: id => fields[id] } });
  vm.runInContext(appSource, context);
  vm.runInContext('bindUiEvents = bindAdminEvents = buildEntitySections = connect = () => {}', context);
  initialize();
  assert.equal(fields.apiUrl.value, 'https://corp-financial-api.onrender.com');
});

function appRuntime(handler) {
  const fields = Object.fromEntries(['apiUrl', 'apiVersion', 'apiKey', 'statusText', 'statusDot', 'connectionStatus', 'currentApiUrl'].map(id => [id, {}]));
  fields.apiUrl.value = 'https://example.com';
  fields.apiVersion.value = '2.0.0';
  const context = runtime(handler, { document: { getElementById: id => fields[id], querySelectorAll: () => [] } });
  vm.runInContext(appSource, context);
  vm.runInContext('renderAdminConnection = resetRecords = refreshAllData = () => {}', context);
  return { context, fields };
}

test('connects demo, client and admin credentials using the API contracts', async () => {
  for (const role of ['demo', 'client', 'admin']) {
    const { context, fields } = appRuntime(async (url) => {
      if (url.endsWith('/accounts')) {
        return role === 'admin'
          ? new Response('[{"id":"selected-account","demo":true}]')
          : new Response('{"detail":"Admin required"}', { status: 403 });
      }
      return new Response('{"_embedded":{"companyList":[]}}');
    });
    await vm.runInContext(`connect(${role === 'demo' ? 'DEMO_KEY' : "'credential'"})`, context);
    assert.equal(vm.runInContext('state.connection.role', context), role);
    assert.equal(fields.statusText.textContent, 'API Connected');
    if (role === 'admin') assert.equal(vm.runInContext('state.connection.accountId', context), 'selected-account');
  }
});

test('superseded connection attempts are aborted and cannot replace the new connection', async () => {
  const pending = [];
  const { context } = appRuntime((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason));
    pending.push({ resolve, options });
  }));
  const first = vm.runInContext('connect(DEMO_KEY)', context);
  vm.runInContext("document.getElementById('apiUrl').value = 'https://other.example'", context);
  const second = vm.runInContext('connect(DEMO_KEY)', context);
  assert.equal(pending[0].options.signal.aborted, true);
  pending[1].resolve(new Response('{}'));
  await Promise.all([first, second]);
  assert.equal(vm.runInContext('state.connection.base', context), 'https://other.example');
  assert.equal(vm.runInContext('state.pendingConnection', context), null);
});

test('disconnect aborts a pending connection without reconnecting after its response', async () => {
  let signal;
  const { context } = appRuntime((url, options) => new Promise((resolve, reject) => {
    signal = options.signal;
    signal.addEventListener('abort', () => reject(signal.reason));
  }));
  const connecting = vm.runInContext('connect(DEMO_KEY)', context);
  vm.runInContext('disconnect()', context);
  await connecting;
  assert.equal(signal.aborted, true);
  assert.equal(vm.runInContext('state.connection', context), null);
});
