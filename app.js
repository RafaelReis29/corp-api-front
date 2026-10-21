    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            bgDark: '#131126',
            cardDark: '#1b1834',
            borderDark: '#2a264e',
            neonGreen: '#52e085',
            neonGreenHover: '#3fd073',
            neonPurple: '#a855f7',
            neonYellow: '#eab308',
            neonRed: '#ef4444',
            neonBlue: '#3b82f6'
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
          }
        }
      }
    };

    const API_BASE = "https://corp-financial-api.onrender.com";

    // Application State
    const state = {
      activeTab: 'dashboard',
      activeFilter: null, // { entity: 'contacts', field: 'companyId', value: 3, label: 'Company #3' }
      editingEntity: null,
      editingId: null,
      deleteTarget: null, // { entity, id }
      cache: {
        companies: [],
        contacts: [],
        contracts: [],
        'payment-methods': [],
        invoices: []
      }
    };

    // ENTITY SCHEMAS & METADATA
    const ENTITY_CONFIG = {
      companies: {
        title: "Companies",
        icon: "fa-building",
        badgeColor: "text-blue-400",
        endpoint: "/companies",
        embeddedKey: "companyList", // HATEOAS fallback
        fields: [
          { name: "tradeName", label: "Trade Name", type: "text", required: true },
          { name: "legalName", label: "Legal Name", type: "text" },
          { name: "docNumber", label: "Document (CNPJ/Tax ID)", type: "text", required: true },
          { name: "sector", label: "Sector", type: "text" },
          { name: "email", label: "Email", type: "email" },
          { name: "phone", label: "Phone", type: "text" },
          { name: "active", label: "Active Account", type: "checkbox", defaultValue: true }
        ],
        columns: [
          { key: "id", label: "ID" },
          { key: "tradeName", label: "Company / Trade Name" },
          { key: "docNumber", label: "Doc #" },
          { key: "sector", label: "Sector" },
          { key: "email", label: "Contact Email" },
          { key: "active", label: "Status", format: val => val ? '<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Active</span>' : '<span class="px-2 py-0.5 rounded text-[10px] bg-gray-500/10 text-gray-400 border border-gray-500/30">Inactive</span>' }
        ],
        relationalActions: [
          { label: "Contacts", icon: "fa-users", entity: "contacts", field: "companyId", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
          { label: "Contracts", icon: "fa-file-contract", entity: "contracts", field: "companyId", color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
          { label: "Payments", icon: "fa-credit-card", entity: "payment-methods", field: "companyId", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" }
        ]
      },
      contacts: {
        title: "Contacts",
        icon: "fa-address-book",
        badgeColor: "text-purple-400",
        endpoint: "/contacts",
        embeddedKey: "contactList",
        fields: [
          { name: "companyId", label: "Company ID", type: "number", required: true },
          { name: "name", label: "Full Name", type: "text", required: true },
          { name: "role", label: "Role / Position", type: "text" },
          { name: "email", label: "Email", type: "email" },
          { name: "phone", label: "Phone Number", type: "text" },
          { name: "isPrimary", label: "Primary Contact", type: "checkbox" },
          { name: "active", label: "Active Status", type: "checkbox", defaultValue: true }
        ],
        columns: [
          { key: "id", label: "ID" },
          { key: "name", label: "Name" },
          { key: "companyId", label: "Company ID", format: val => `<button data-action="filter" data-entity="companies" data-field="id" data-value="${val}" data-label="Company #${val}" class="text-blue-400 hover:underline font-mono">#${val}</button>` },
          { key: "role", label: "Role" },
          { key: "email", label: "Email" },
          { key: "isPrimary", label: "Primary", format: val => val ? '<i class="fa-solid fa-star text-amber-400 text-xs"></i>' : '-' }
        ]
      },
      contracts: {
        title: "Contracts",
        icon: "fa-file-contract",
        badgeColor: "text-amber-400",
        endpoint: "/contracts",
        embeddedKey: "contractList",
        fields: [
          { name: "companyId", label: "Company ID", type: "number", required: true },
          { name: "title", label: "Contract Title", type: "text", required: true },
          { name: "description", label: "Description", type: "textarea" },
          { name: "totalValue", label: "Total Value", type: "number", step: "0.01" },
          { name: "currency", label: "Currency (e.g. USD, BRL)", type: "text", defaultValue: "USD" },
          { name: "startDate", label: "Start Date", type: "date" },
          { name: "endDate", label: "End Date", type: "date" },
          { name: "status", label: "Status", type: "select", options: ["ACTIVE", "PENDING", "COMPLETED", "TERMINATED"], defaultValue: "ACTIVE" }
        ],
        columns: [
          { key: "id", label: "ID" },
          { key: "title", label: "Contract Title" },
          { key: "companyId", label: "Company ID", format: val => `<button data-action="filter" data-entity="companies" data-field="id" data-value="${val}" data-label="Company #${val}" class="text-blue-400 hover:underline font-mono">#${val}</button>` },
          { key: "totalValue", label: "Value", format: (val, row) => `<span class="font-bold text-white">${row.currency || '$'} ${Number(val || 0).toLocaleString()}</span>` },
          { key: "status", label: "Status", format: val => `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30">${val || 'ACTIVE'}</span>` }
        ],
        relationalActions: [
          { label: "Invoices", icon: "fa-receipt", entity: "invoices", field: "contractId", color: "text-pink-400 border-pink-500/30 bg-pink-500/10" }
        ]
      },
      'payment-methods': {
        title: "Payment Methods",
        icon: "fa-credit-card",
        badgeColor: "text-emerald-400",
        endpoint: "/payment-methods",
        embeddedKey: "paymentMethodList",
        fields: [
          { name: "companyId", label: "Company ID", type: "number", required: true },
          { name: "type", label: "Type (e.g., CREDIT_CARD, PIX, WIRE)", type: "text", required: true },
          { name: "label", label: "Method Label", type: "text", required: true },
          { name: "provider", label: "Provider/Bank", type: "text" },
          { name: "details", label: "Details / Account Info", type: "textarea" },
          { name: "isDefault", label: "Default Method", type: "checkbox" },
          { name: "active", label: "Active", type: "checkbox", defaultValue: true }
        ],
        columns: [
          { key: "id", label: "ID" },
          { key: "label", label: "Label" },
          { key: "companyId", label: "Company ID", format: val => `<button data-action="filter" data-entity="companies" data-field="id" data-value="${val}" data-label="Company #${val}" class="text-blue-400 hover:underline font-mono">#${val}</button>` },
          { key: "type", label: "Type" },
          { key: "provider", label: "Provider" },
          { key: "isDefault", label: "Default", format: val => val ? '<i class="fa-solid fa-check text-neonGreen text-xs"></i>' : '-' }
        ]
      },
      invoices: {
        title: "Invoices",
        icon: "fa-receipt",
        badgeColor: "text-pink-400",
        endpoint: "/invoices",
        embeddedKey: "invoiceList",
        fields: [
          { name: "contractId", label: "Contract ID", type: "number", required: true },
          { name: "paymentMethodId", label: "Payment Method ID", type: "number" },
          { name: "description", label: "Invoice Description", type: "text" },
          { name: "amount", label: "Amount", type: "number", step: "0.01" },
          { name: "dueDate", label: "Due Date", type: "date" },
          { name: "paidAt", label: "Paid At (Date Time)", type: "datetime-local" },
          { name: "status", label: "Status", type: "select", options: ["OPEN", "PAID", "OVERDUE", "CANCELLED"], defaultValue: "OPEN" }
        ],
        columns: [
          { key: "id", label: "ID" },
          { key: "description", label: "Description" },
          { key: "contractId", label: "Contract ID", format: val => `<button data-action="filter" data-entity="contracts" data-field="id" data-value="${val}" data-label="Contract #${val}" class="text-amber-400 hover:underline font-mono">#${val}</button>` },
          { key: "amount", label: "Amount", format: val => `<span class="font-bold text-white">$ ${Number(val || 0).toLocaleString()}</span>` },
          { key: "dueDate", label: "Due Date" },
          { key: "status", label: "Status", format: val => {
            let color = "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
            if (val === 'PAID') color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
            if (val === 'OVERDUE') color = "text-red-400 bg-red-500/10 border-red-500/30";
            return `<span class="px-2 py-0.5 rounded text-[10px] ${color} border">${val || 'OPEN'}</span>`;
          }}
        ]
      }
    };

    // INIT
    window.addEventListener('DOMContentLoaded', () => {
      bindUiEvents();
      buildEntitySections();
      checkApiHealth();
      refreshAllData();
    });

    function bindUiEvents() {
      document.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return;

        const button = event.target.closest('[data-action]');
        if (!button) return;

        switch (button.dataset.action) {
          case 'switch-tab':
            switchTab(button.dataset.tab);
            break;
          case 'clear-filter':
            clearFilter();
            break;
          case 'refresh-data':
            refreshAllData();
            break;
          case 'close-modal':
            closeModal();
            break;
          case 'close-delete-modal':
            closeDeleteModal();
            break;
          case 'confirm-delete':
            executeDelete();
            break;
          case 'fetch-entity':
            fetchEntityData(button.dataset.entity);
            break;
          case 'create-entity':
            openCreateModal(button.dataset.entity);
            break;
          case 'edit-entity':
            openEditModal(button.dataset.entity, button.dataset.id);
            break;
          case 'delete-entity':
            openDeleteModal(button.dataset.entity, button.dataset.id);
            break;
          case 'filter':
            filterByEntity(
              button.dataset.entity,
              button.dataset.field,
              button.dataset.value,
              button.dataset.label
            );
            break;
        }
      });

      document.addEventListener('input', event => {
        if (event.target instanceof Element && event.target.matches('[data-action="search-entity"]')) {
          renderEntityTable(event.target.dataset.entity);
        }
      });

      document.getElementById('crudForm').addEventListener('submit', handleFormSubmit);
    }

    // CHECK API HEALTH
    async function checkApiHealth() {
      const dot = document.getElementById('statusDot');
      const text = document.getElementById('statusText');
      const banner = document.getElementById('coldStartBanner');

      try {
        banner.classList.remove('hidden');
        const res = await fetch(`${API_BASE}/companies`, { method: 'GET' });
        if (res.ok) {
          dot.className = "w-2.5 h-2.5 rounded-full bg-neonGreen";
          text.innerText = "API Connected";
          banner.classList.add('hidden');
        } else {
          throw new Error('API return non-200');
        }
      } catch (err) {
        dot.className = "w-2.5 h-2.5 rounded-full bg-red-500";
        text.innerText = "API Offline/Sleeping";
      }
    }

    // HELPER: HAL JSON / HATEOAS UNWRAPPER
    function unwrapHateoas(json, entityKey) {
      if (!json) return [];
      // Direct array response
      if (Array.isArray(json)) return json;
      // Embedded HAL response
      if (json._embedded) {
        const config = ENTITY_CONFIG[entityKey];
        if (config && config.embeddedKey && json._embedded[config.embeddedKey]) {
          return json._embedded[config.embeddedKey];
        }
        // Fallback: take first array inside _embedded
        const keys = Object.keys(json._embedded);
        if (keys.length > 0 && Array.isArray(json._embedded[keys[0]])) {
          return json._embedded[keys[0]];
        }
      }
      return [];
    }

    // FETCH DATA FOR AN ENTITY
    async function fetchEntityData(entityKey) {
      const config = ENTITY_CONFIG[entityKey];
      try {
        const response = await fetch(`${API_BASE}${config.endpoint}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        const data = unwrapHateoas(json, entityKey);
        state.cache[entityKey] = data;
        renderEntityTable(entityKey);
        updateCounters();
        return data;
      } catch (err) {
        console.warn(`Failed fetching ${entityKey}`, err);
        renderTableError(entityKey, err.message);
      }
    }

    async function refreshAllData() {
      await Promise.all(Object.keys(ENTITY_CONFIG).map(e => fetchEntityData(e)));
      updateDashboardStats();
    }

    // UPDATE DASHBOARD OVERVIEW NUMBERS
    function updateDashboardStats() {
      document.getElementById('stat-companies').innerText = state.cache.companies.length;
      document.getElementById('stat-contacts').innerText = state.cache.contacts.length;
      document.getElementById('stat-contracts').innerText = state.cache.contracts.length;
      document.getElementById('stat-invoices').innerText = state.cache.invoices.length;

      // Contract total val
      const totalVal = state.cache.contracts.reduce((sum, c) => sum + (parseFloat(c.totalValue) || 0), 0);
      document.getElementById('stat-contract-val').innerText = `$ ${totalVal.toLocaleString()}`;

      // Paid invoices count
      const paidInvoices = state.cache.invoices.filter(i => i.status === 'PAID').length;
      document.getElementById('stat-paid-count').innerText = `${paidInvoices} / ${state.cache.invoices.length}`;
    }

    function updateCounters() {
      Object.keys(ENTITY_CONFIG).forEach(key => {
        const counterEl = document.getElementById(`count-${key}`);
        if (counterEl) counterEl.innerText = state.cache[key].length;
      });
    }

    // DYNAMIC DOM BUILDER FOR TABLES
    function buildEntitySections() {
      const container = document.getElementById('entitySectionsContainer');
      container.innerHTML = '';

      Object.keys(ENTITY_CONFIG).forEach(key => {
        const config = ENTITY_CONFIG[key];
        const sec = document.createElement('section');
        sec.id = `sec-${key}`;
        sec.className = 'tab-content hidden space-y-6';

        sec.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                <i class="fa-solid ${config.icon} ${config.badgeColor}"></i>
                <span>${config.title} Management</span>
              </h2>
              <p class="text-xs text-gray-400">Perform CRUD actions and filter relational dependencies</p>
            </div>
            
            <div class="flex items-center gap-2">
              <button data-action="fetch-entity" data-entity="${key}" class="p-2 rounded-xl bg-cardDark border border-borderDark hover:border-neonGreen/50 text-xs font-semibold text-gray-300 transition-all">
                <i class="fa-solid fa-rotate text-neonGreen"></i>
              </button>
              <button data-action="create-entity" data-entity="${key}" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neonGreen hover:bg-neonGreenHover text-bgDark font-bold text-xs transition-all shadow-md shadow-neonGreen/10">
                <i class="fa-solid fa-plus"></i> New ${config.title.slice(0, -1)}
              </button>
            </div>
          </div>

          <!-- SEARCH & TABLE CONTAINER -->
          <div class="bg-cardDark border border-borderDark rounded-2xl overflow-hidden">
            <div class="p-4 border-b border-borderDark flex flex-wrap items-center justify-between gap-3 bg-bgDark/30">
              <div class="relative flex-1 max-w-xs">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-xs text-gray-500"></i>
                <input type="text" id="search-${key}" data-action="search-entity" data-entity="${key}" placeholder="Search ${config.title.toLowerCase()}..." 
                       class="w-full bg-bgDark border border-borderDark rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-neonGreen">
              </div>
              <span id="showing-count-${key}" class="text-xs text-gray-400 font-mono">Showing all records</span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-gray-300">
                <thead class="bg-bgDark/60 text-gray-400 font-semibold uppercase tracking-wider text-[10px] border-b border-borderDark">
                  <tr>
                    ${config.columns.map(c => `<th class="px-4 py-3">${c.label}</th>`).join('')}
                    ${config.relationalActions ? `<th class="px-4 py-3">Related Data</th>` : ''}
                    <th class="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody id="tbody-${key}" class="divide-y divide-borderDark/50">
                  <tr><td colspan="10" class="p-8 text-center text-gray-500">Loading ${config.title}...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        `;
        container.appendChild(sec);
      });
    }

    // RENDER ENTITY TABLE CONTENT
    function renderEntityTable(key) {
      const config = ENTITY_CONFIG[key];
      const tbody = document.getElementById(`tbody-${key}`);
      const searchVal = (document.getElementById(`search-${key}`)?.value || '').toLowerCase();

      let items = state.cache[key] || [];

      // Apply active global filter if applicable
      if (state.activeFilter && state.activeFilter.targetEntity === key) {
        items = items.filter(item => String(item[state.activeFilter.field]) === String(state.activeFilter.value));
      }

      // Apply Search
      if (searchVal) {
        items = items.filter(item => JSON.stringify(item).toLowerCase().includes(searchVal));
      }

      const countEl = document.getElementById(`showing-count-${key}`);
      if (countEl) countEl.innerText = `Showing ${items.length} of ${state.cache[key].length} records`;

      if (items.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" class="p-8 text-center text-gray-500">
              <i class="fa-solid fa-folder-open text-2xl mb-2 block opacity-40"></i>
              No records found.
            </td>
          </tr>`;
        return;
      }

      tbody.innerHTML = items.map(row => {
        const columnsHtml = config.columns.map(col => {
          let val = row[col.key];
          if (col.format) val = col.format(val, row);
          else if (val === undefined || val === null) val = '-';
          return `<td class="px-4 py-3 whitespace-nowrap">${val}</td>`;
        }).join('');

        // Relational quick action buttons
        let relationalHtml = '';
        if (config.relationalActions) {
          relationalHtml = `<td class="px-4 py-3 whitespace-nowrap"><div class="flex gap-1.5">`;
          config.relationalActions.forEach(act => {
            relationalHtml += `
              <button data-action="filter" data-entity="${act.entity}" data-field="${act.field}" data-value="${row.id}" data-label="${config.title.slice(0, -1)} #${row.id}" 
                      class="px-2 py-1 rounded-md text-[10px] font-semibold border ${act.color} hover:opacity-80 transition-all flex items-center gap-1">
                <i class="fa-solid ${act.icon}"></i> ${act.label}
              </button>
            `;
          });
          relationalHtml += `</div></td>`;
        }

        return `
          <tr class="hover:bg-cardDark/80 transition-all">
            ${columnsHtml}
            ${relationalHtml}
            <td class="px-4 py-3 text-right whitespace-nowrap space-x-1">
              <button data-action="edit-entity" data-entity="${key}" data-id="${row.id}" class="p-1.5 rounded-lg text-gray-400 hover:text-neonGreen hover:bg-borderDark transition-all" title="Edit">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button data-action="delete-entity" data-entity="${key}" data-id="${row.id}" class="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-borderDark transition-all" title="Delete">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderTableError(key, errorMsg) {
      const tbody = document.getElementById(`tbody-${key}`);
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="p-8 text-center text-red-400">
            <i class="fa-solid fa-triangle-exclamation text-xl mb-1 block"></i>
            Failed to load ${key}: ${errorMsg}
          </td>
        </tr>`;
    }

    // RELATIONAL CROSS-FILTERING WORKFLOW
    function filterByEntity(targetEntity, field, value, label) {
      state.activeFilter = { targetEntity, field, value, label };
      
      const filterBanner = document.getElementById('filterBanner');
      const filterDesc = document.getElementById('filterDescription');
      filterDesc.innerText = `Showing ${ENTITY_CONFIG[targetEntity].title} linked to ${label}`;
      filterBanner.classList.remove('hidden');

      switchTab(targetEntity);
    }

    function clearFilter() {
      state.activeFilter = null;
      document.getElementById('filterBanner').classList.add('hidden');
      if (state.activeTab !== 'dashboard') {
        renderEntityTable(state.activeTab);
      }
    }

    // TAB NAVIGATION
    function switchTab(tabId) {
      state.activeTab = tabId;

      // Update Nav Buttons
      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-neonGreen/10', 'text-neonGreen', 'border', 'border-neonGreen/30');
      });
      const activeNav = document.getElementById(`nav-${tabId}`);
      if (activeNav) {
        activeNav.classList.add('bg-neonGreen/10', 'text-neonGreen', 'border', 'border-neonGreen/30');
      }

      // Hide all contents
      document.querySelectorAll('.tab-content').forEach(sec => sec.classList.add('hidden'));

      // Show selected content
      const activeSec = document.getElementById(`sec-${tabId}`);
      if (activeSec) {
        activeSec.classList.remove('hidden');
        if (tabId !== 'dashboard') {
          renderEntityTable(tabId);
        }
      }
    }

    // MODALS HANDLING
    function openCreateModal(entityKey) {
      state.editingEntity = entityKey;
      state.editingId = null;

      const config = ENTITY_CONFIG[entityKey];
      document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus text-neonGreen"></i> New ${config.title.slice(0, -1)}`;

      renderModalForm(config.fields, {});
      document.getElementById('crudModal').classList.remove('hidden');
    }

    function openEditModal(entityKey, id) {
      state.editingEntity = entityKey;
      state.editingId = id;

      const config = ENTITY_CONFIG[entityKey];
      const record = state.cache[entityKey].find(r => r.id == id);

      document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square text-neonGreen"></i> Edit ${config.title.slice(0, -1)} #${id}`;

      renderModalForm(config.fields, record || {});
      document.getElementById('crudModal').classList.remove('hidden');
    }

    function renderModalForm(fields, data) {
      const formFieldsContainer = document.getElementById('modalFormFields');
      formFieldsContainer.innerHTML = fields.map(field => {
        let val = data[field.name] !== undefined ? data[field.name] : (field.defaultValue !== undefined ? field.defaultValue : '');

        if (field.type === 'checkbox') {
          return `
            <div class="flex items-center gap-3 pt-2">
              <input type="checkbox" id="field-${field.name}" name="${field.name}" ${val ? 'checked' : ''}
                     class="w-4 h-4 rounded border-borderDark bg-bgDark text-neonGreen focus:ring-neonGreen">
              <label for="field-${field.name}" class="text-xs font-semibold text-gray-300">${field.label}</label>
            </div>`;
        }

        if (field.type === 'textarea') {
          return `
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1">${field.label} ${field.required ? '*' : ''}</label>
              <textarea name="${field.name}" rows="3" ${field.required ? 'required' : ''}
                        class="w-full bg-bgDark border border-borderDark rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neonGreen">${val}</textarea>
            </div>`;
        }

        if (field.type === 'select') {
          return `
            <div>
              <label class="block text-xs font-semibold text-gray-400 mb-1">${field.label} ${field.required ? '*' : ''}</label>
              <select name="${field.name}" ${field.required ? 'required' : ''}
                      class="w-full bg-bgDark border border-borderDark rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neonGreen">
                ${field.options.map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
            </div>`;
        }

        return `
          <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1">${field.label} ${field.required ? '*' : ''}</label>
            <input type="${field.type}" name="${field.name}" value="${val}" ${field.step ? `step="${field.step}"` : ''} ${field.required ? 'required' : ''}
                   class="w-full bg-bgDark border border-borderDark rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-neonGreen">
          </div>`;
      }).join('');
    }

    function closeModal() {
      document.getElementById('crudModal').classList.add('hidden');
    }

    // FORM SUBMIT (POST / PUT)
    async function handleFormSubmit(event) {
      event.preventDefault();
      const entityKey = state.editingEntity;
      const config = ENTITY_CONFIG[entityKey];
      const form = event.target;
      const formData = new FormData(form);

      const payload = {};
      config.fields.forEach(field => {
        if (field.type === 'checkbox') {
          payload[field.name] = formData.has(field.name);
        } else if (field.type === 'number') {
          const raw = formData.get(field.name);
          payload[field.name] = raw !== '' ? Number(raw) : null;
        } else {
          payload[field.name] = formData.get(field.name);
        }
      });

      const isEdit = state.editingId !== null;
      const url = isEdit ? `${API_BASE}${config.endpoint}/${state.editingId}` : `${API_BASE}${config.endpoint}`;
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Server returned status ${response.status}`);

        showToast(`Record ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
        closeModal();
        await fetchEntityData(entityKey);
        updateDashboardStats();
      } catch (err) {
        showToast(`Operation failed: ${err.message}`, 'error');
      }
    }

    // DELETE MODAL & ACTION
    function openDeleteModal(entityKey, id) {
      state.deleteTarget = { entity: entityKey, id };
      document.getElementById('deleteConfirmText').innerText = `Are you sure you want to delete ${ENTITY_CONFIG[entityKey].title.slice(0, -1)} #${id}?`;
      document.getElementById('deleteModal').classList.remove('hidden');
    }

    function closeDeleteModal() {
      document.getElementById('deleteModal').classList.add('hidden');
    }

    async function executeDelete() {
      if (!state.deleteTarget) return;
      const { entity, id } = state.deleteTarget;
      const config = ENTITY_CONFIG[entity];

      try {
        const response = await fetch(`${API_BASE}${config.endpoint}/${id}`, {
          method: 'DELETE'
        });

        if (!response.ok) throw new Error(`Delete failed with status ${response.status}`);

        showToast('Record deleted successfully!', 'success');
        closeDeleteModal();
        await fetchEntityData(entity);
        updateDashboardStats();
      } catch (err) {
        showToast(`Error deleting record: ${err.message}`, 'error');
      }
    }

    // TOAST SYSTEM
    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');

      const isSuccess = type === 'success';
      const bgColor = isSuccess ? 'bg-slate-900/90 border-neonGreen text-neonGreen' : 'bg-slate-900/90 border-red-500 text-red-400';
      const icon = isSuccess ? 'fa-circle-check' : 'fa-triangle-exclamation';

      toast.className = `pointer-events-auto border px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-semibold backdrop-blur-md transition-all duration-300 transform translate-y-2 opacity-0 ${bgColor}`;
      toast.innerHTML = `<i class="fa-solid ${icon} text-base"></i> <span>${message}</span>`;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      }, 10);

      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }
