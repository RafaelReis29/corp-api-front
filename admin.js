function bindAdminEvents() {
  $('adminAccountSelect').addEventListener('change', event => selectAdminAccount(event.target.value));
  $('adminNewAccount').addEventListener('submit', event => submitAdminForm(event, '/accounts', data => ({
    name: data.get('name').trim()
  }), (account, connection) => {
    connection.accounts = [...connection.accounts, account];
    selectAdminAccount(account.id);
    if (state.connection?.accountId === account.id) adminNotice(`Account created: ${account.name}`);
  }));
  $('adminNewKey').addEventListener('submit', event => {
    $('adminIssuedKey').hidden = true;
    $('adminSecret').textContent = '';
    submitAdminForm(event, '/api-keys', data => ({
      accountId: state.connection.accountId,
      type: data.get('type'),
      label: data.get('label').trim()
    }), async (created, connection) => {
      $('adminSecret').textContent = created.apiKey;
      $('adminIssuedKey').hidden = false;
      await refreshAdmin({ accounts: false });
      if (state.connection === connection) adminNotice('Key issued.');
    });
  });
  $('adminReload').addEventListener('click', () => refreshAdmin());
  $('adminInspectAccount').addEventListener('click', () => inspectAdminResource('accounts', state.connection?.accountId));
  $('adminKeysBody').addEventListener('click', event => {
    const action = event.target.closest('button[data-admin-action]');
    if (!action) return;
    if (action.dataset.adminAction === 'inspect') inspectAdminResource('api-keys', action.dataset.id);
    if (action.dataset.adminAction === 'revoke') revokeAdminKey(action.dataset.id);
  });
  $('adminCopySecret').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('adminSecret').textContent);
      adminNotice('Key copied.');
    } catch {
      adminNotice('Select the key text to copy it.', true);
    }
  });
  $('adminDismissSecret').addEventListener('click', clearIssuedKey);
  $('adminContext').addEventListener('change', event => selectAdminAccount(event.target.value));
}

function clearIssuedKey() {
  $('adminSecret').textContent = '';
  $('adminIssuedKey').hidden = true;
}

function renderAdminConnection() {
  const connection = state.connection;
  const isAdmin = connection?.role === 'admin';
  $('nav-admin').hidden = !isAdmin;
  $('adminContextPanel').hidden = !isAdmin;
  clearIssuedKey();
  $('adminKeysBody').replaceChildren();
  $('adminNewKey').reset();
  $('adminNewAccount').reset();
  adminNotice('');
  if (!isAdmin) {
    if (state.activeTab === 'admin') switchTab('dashboard');
    return;
  }
  renderAccountOptions();
  refreshAdmin({ accounts: false });
}

function renderAccountOptions() {
  const { accounts, accountId } = state.connection;
  const options = accounts.map(account =>
    `<option value="${escapeHtml(account.id)}">${escapeHtml(account.name)}${account.demo ? ' · Demo' : ''} · ${escapeHtml(account.id)}</option>`).join('');
  for (const select of [$('adminAccountSelect'), $('adminContext')]) {
    select.innerHTML = options;
    select.value = accountId || '';
    select.disabled = accounts.length === 0;
  }
  const selected = accounts.find(account => account.id === accountId);
  $('adminAccountId').textContent = selected ? `Account ID: ${selected.id}` : 'Create an account to get started.';
  $('adminInspectAccount').disabled = !selected;
  $('adminNewKey').hidden = !selected || selected.demo;
  $('adminKeyHint').hidden = !selected || !selected.demo;
}

function selectAdminAccount(accountId) {
  const prior = state.connection;
  if (prior?.role !== 'admin' || prior.accountId === accountId || !prior.accounts.some(account => account.id === accountId)) return;
  prior.controller.abort();
  state.connection = { ...prior, accountId, controller: new AbortController() };
  clearIssuedKey();
  renderAccountOptions();
  refreshAdmin({ accounts: false });
  resetRecords();
  refreshAllData();
}

function adminNotice(message, error = false) {
  const output = $('adminStatus');
  output.textContent = message;
  output.classList.toggle('text-red-300', error);
}

async function refreshAdmin({ accounts = true } = {}) {
  const connection = state.connection;
  if (connection?.role !== 'admin') return;
  try {
    if (accounts) {
      const records = await request('/accounts', {}, connection);
      if (state.connection !== connection) return;
      connection.accounts = records;
      renderAccountOptions();
    }
    const keys = await request('/api-keys', {}, connection);
    if (state.connection !== connection) return;
    renderAdminKeys(keys, connection.accounts);
  } catch (error) {
    if (state.connection === connection) adminNotice(error.message, true);
  }
}

function renderAdminKeys(keys, accounts) {
  $('adminKeysBody').innerHTML = keys.length ? keys.map(key => `
    <tr>
      <td>${escapeHtml(key.label)}</td>
      <td>${escapeHtml(accounts.find(account => account.id === key.accountId)?.name ?? key.accountId)}</td>
      <td>${escapeHtml(key.type)}</td>
      <td>${escapeHtml(key.createdAt ? new Date(key.createdAt).toLocaleString() : '—')}</td>
      <td>
        <button data-admin-action="inspect" data-id="${escapeHtml(key.id)}" class="text-neonGreen">View details</button>
        <button data-admin-action="revoke" data-id="${escapeHtml(key.id)}" class="text-red-300">Revoke</button>
      </td>
    </tr>`).join('') : '<tr><td colspan="5">No API keys found.</td></tr>';
}

async function submitAdminForm(event, path, createBody, onCreated) {
  event.preventDefault();
  const form = event.currentTarget;
  const connection = state.connection;
  if (connection?.role !== 'admin') return;
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  const body = createBody(new FormData(form));
  if (!Object.values(body).every(Boolean)) {
    adminNotice('Fill in all fields before submitting.', true);
    return;
  }

  // Keep the same key for retries of this request body in this connection.
  const fingerprint = JSON.stringify(body);
  let pending = connection.adminPosts.get(path);
  if (pending?.fingerprint !== fingerprint) {
    pending = { fingerprint, key: idempotencyKey() };
    connection.adminPosts.set(path, pending);
  }

  button.disabled = true;
  try {
    const result = await request(path, { method: 'POST', body, key: pending.key }, connection);
    if (state.connection !== connection) return;
    connection.adminPosts.delete(path);
    form.reset();
    await onCreated(result, connection);
  } catch (error) {
    if (state.connection === connection) adminNotice(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function inspectAdminResource(resource, id) {
  const connection = state.connection;
  if (connection?.role !== 'admin' || !id) return;
  try {
    const record = await request(`/${resource}/${encodeURIComponent(id)}`, {}, connection);
    if (state.connection !== connection) return;
    showRecordDetails(resource === 'accounts' ? 'Account details' : 'API key details', record);
  } catch (error) {
    if (state.connection === connection) adminNotice(error.message, true);
  }
}

async function revokeAdminKey(id) {
  const connection = state.connection;
  if (connection?.role !== 'admin' || !id || !confirm('Revoke this API key? Requests using it will stop working.')) return;
  try {
    await request(`/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' }, connection);
    if (state.connection !== connection) return;
    clearIssuedKey();
    await refreshAdmin({ accounts: false });
    if (state.connection === connection) adminNotice('Key revoked.');
  } catch (error) {
    if (state.connection === connection) adminNotice(error.message, true);
  }
}
