// App State
let state = {
  queries: [],
  tabs: [],            // Open tabs list
  activeTabId: null,   // Filename of the active query tab
  activeTagFilter: null,
  searchText: '',
  dbConfigured: false,
  connections: [],
  activeConnectionId: null,
  formatSettings: {
    keywordCase: 'upper',
    dataTypeCase: 'upper',
    functionCase: 'upper',
    indentStyle: '2-spaces',
    indentStyleParam: 'standard', // 'standard' or 'tabularLeft'
    logicalOperatorNewline: 'before', // 'before' or 'after'
    linesBetweenQueries: 2,
    expressionWidth: 50
  }
};

// Load format settings from localStorage if they exist
try {
  const savedFmt = localStorage.getItem('mSql_format_settings');
  if (savedFmt) {
    state.formatSettings = { ...state.formatSettings, ...JSON.parse(savedFmt) };
  }
} catch (e) {}


// DOM Elements
const elements = {
  tabsContainer: document.getElementById('tabs-container'),
  workspaceHeader: document.getElementById('workspace-header'),
  btnNewQuery: document.getElementById('btn-new-query'),
  btnWelcomeNew: document.getElementById('btn-welcome-new'),
  searchInput: document.getElementById('search-input'),
  tagList: document.getElementById('tag-list'),
  queryList: document.getElementById('query-list'),
  welcomeScreen: document.getElementById('welcome-screen'),
  editorWorkspace: document.getElementById('editor-workspace'),
  queryTitle: document.getElementById('query-title'),
  queryDesc: document.getElementById('query-desc'),
  queryTags: document.getElementById('query-tags'),
  queryCreated: document.getElementById('query-created'),
  currentFilename: document.getElementById('current-filename'),
  unsavedDot: document.getElementById('unsaved-dot'),
  btnSave: document.getElementById('btn-save'),
  btnDelete: document.getElementById('btn-delete'),
  btnFormat: document.getElementById('btn-format'),
  btnFormatSettings: document.getElementById('btn-format-settings'),
  formatSettingsPopup: document.getElementById('format-settings-popup'),
  btnSaveFormatSettings: document.getElementById('btn-save-format-settings'),
  btnCloseFormatSettings: document.getElementById('btn-close-format-settings'),
  fmtKeywordCase: document.getElementById('fmt-keyword-case'),
  fmtDataTypeCase: document.getElementById('fmt-datatype-case'),
  fmtFunctionCase: document.getElementById('fmt-function-case'),
  fmtIndent: document.getElementById('fmt-indent'),
  fmtIndentStyle: document.getElementById('fmt-indent-style'),
  fmtOperatorNewline: document.getElementById('fmt-operator-newline'),
  fmtLinesBetween: document.getElementById('fmt-lines-between'),
  fmtExprWidth: document.getElementById('fmt-expr-width'),
  btnRun: document.getElementById('btn-run'),
  sqlTextarea: document.getElementById('sql-textarea'),
  lineNumbers: document.getElementById('editor-line-numbers'),
  resultsPlaceholder: document.getElementById('results-placeholder'),
  resultsTableContainer: document.getElementById('results-table-container'),
  resultsTableHead: document.getElementById('results-table-head'),
  resultsTableBody: document.getElementById('results-table-body'),
  resultsMeta: document.getElementById('results-meta'),
  resultsViewBtns: document.querySelectorAll('.results-view-btn'),
  resultsTable: document.getElementById('results-table'),
  toast: document.getElementById('toast'),
  dbRowsLimit: document.getElementById('db-rows-limit'),
  rowsLimitBtns: document.querySelectorAll('.rows-limit-btn'),
  
  // Settings Modal elements
  btnSettingsToggle: document.getElementById('btn-settings-toggle'),
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  modalOverlay: document.getElementById('modal-overlay'),
  btnModalClose: document.getElementById('btn-modal-close'),
  formConnection: document.getElementById('form-connection'),
  dbType: document.getElementById('db-type'),
  dbHost: document.getElementById('db-host'),
  dbPort: document.getElementById('db-port'),
  dbName: document.getElementById('db-name'),
  dbUser: document.getElementById('db-user'),
  dbPassword: document.getElementById('db-password'),
  btnTestConnection: document.getElementById('btn-test-connection'),
  resultsErrorContainer: document.getElementById('results-error-container'),
  resultsErrorText: document.getElementById('results-error-text'),
  
  // Connection manager additions
  connectionProfileSelect: document.getElementById('connection-profile-select'),
  btnDeleteConnection: document.getElementById('btn-delete-connection'),
  connectionName: document.getElementById('connection-name'),
  queriesPath: document.getElementById('queries-path'),
  btnBrowseQueries: document.getElementById('btn-browse-queries'),
  backendApiUrl: document.getElementById('backend-api-url'),
  
  // Layout Controls
  btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
  sidebar: document.querySelector('.sidebar'),
  editorResizer: document.getElementById('editor-resizer'),
  editorContainer: document.querySelector('.editor-container'),
  resultsPanel: document.querySelector('.results-panel'),
  btnMaximizeEditor: document.getElementById('btn-maximize-editor'),
  btnMaximizeResults: document.getElementById('btn-maximize-results')
};

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  fetchQueries();
  loadConnectionConfig();
  setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
  elements.btnNewQuery.addEventListener('click', createNewQuery);
  elements.btnWelcomeNew.addEventListener('click', createNewQuery);
  elements.btnSave.addEventListener('click', saveActiveQuery);
  elements.btnDelete.addEventListener('click', deleteActiveQuery);
  elements.btnFormat.addEventListener('click', formatActiveQuery);
  elements.btnFormatSettings.addEventListener('click', toggleFormatSettingsPopup);
  elements.btnSaveFormatSettings.addEventListener('click', saveFormatSettings);
  elements.btnRun.addEventListener('click', executeActiveQuery);
  elements.btnCloseFormatSettings.addEventListener('click', () => {
    elements.formatSettingsPopup.classList.add('hidden');
  });
  
  // Close format settings popup when clicking outside
  document.addEventListener('click', (e) => {
    if (elements.formatSettingsPopup && !elements.formatSettingsPopup.classList.contains('hidden')) {
      if (!elements.formatSettingsPopup.contains(e.target) && !elements.btnFormatSettings.contains(e.target)) {
        elements.formatSettingsPopup.classList.add('hidden');
      }
    }
  });
  
  // Settings Modal Listeners
  elements.btnSettingsToggle.addEventListener('click', openSettingsModal);
  elements.btnModalClose.addEventListener('click', closeSettingsModal);
  elements.connectionProfileSelect.addEventListener('change', handleProfileChange);
  elements.btnDeleteConnection.addEventListener('click', deleteConnectionProfile);
  elements.dbType.addEventListener('change', autoUpdatePort);
  elements.btnTestConnection.addEventListener('click', testConnection);
  elements.formConnection.addEventListener('submit', saveConnectionSettings);
  if (elements.backendApiUrl) {
    elements.backendApiUrl.addEventListener('input', toggleQueriesPathVisibility);
  }
  
  // Layout Controls Listeners
  elements.btnToggleSidebar.addEventListener('click', toggleSidebar);
  elements.btnMaximizeEditor.addEventListener('click', toggleMaximizeEditor);
  elements.btnMaximizeResults.addEventListener('click', toggleMaximizeResults);
  setupResizerDrag();
  
  // Section expand/collapse toggles
  const headerTags = document.getElementById('header-tags');
  const tagFiltersContainer = document.querySelector('.tag-filters-container');
  if (headerTags && tagFiltersContainer) {
    headerTags.addEventListener('click', () => {
      tagFiltersContainer.classList.toggle('collapsed');
      const isCollapsed = tagFiltersContainer.classList.contains('collapsed');
      document.getElementById('btn-toggle-tags').title = isCollapsed ? 'Expand section' : 'Collapse section';
    });
  }

  const headerQueries = document.getElementById('header-queries');
  const queryListContainer = document.querySelector('.query-list-container');
  if (headerQueries && queryListContainer) {
    headerQueries.addEventListener('click', () => {
      queryListContainer.classList.toggle('collapsed');
      const isCollapsed = queryListContainer.classList.contains('collapsed');
      document.getElementById('btn-toggle-queries').title = isCollapsed ? 'Expand section' : 'Collapse section';
    });
  }
  
  elements.modalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.modalOverlay) closeSettingsModal();
  });

  elements.searchInput.addEventListener('input', (e) => {
    state.searchText = e.target.value.toLowerCase();
    renderQueryList();
  });
  
  elements.sqlTextarea.addEventListener('input', () => {
    updateLineNumbers();
    if (state.activeTabId) {
      const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
      if (activeTab) {
        activeTab.sql = elements.sqlTextarea.value;
        const changed = checkTabChanges(activeTab);
        markUnsaved(changed);
        updateTabElementUnsavedDot(activeTab.filename, changed);
      }
    }
  });

  elements.sqlTextarea.addEventListener('scroll', () => {
    elements.lineNumbers.scrollTop = elements.sqlTextarea.scrollTop;
  });

  // Handle Tab key in SQL textarea
  elements.sqlTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = elements.sqlTextarea.selectionStart;
      const end = elements.sqlTextarea.selectionEnd;
      const val = elements.sqlTextarea.value;
      elements.sqlTextarea.value = val.substring(0, start) + '    ' + val.substring(end);
      elements.sqlTextarea.selectionStart = elements.sqlTextarea.selectionEnd = start + 4;
      updateLineNumbers();
      
      if (state.activeTabId) {
        const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
        if (activeTab) {
          activeTab.sql = elements.sqlTextarea.value;
          const changed = checkTabChanges(activeTab);
          markUnsaved(changed);
          updateTabElementUnsavedDot(activeTab.filename, changed);
        }
      }
    }
    
    // Command + S or Ctrl + S to Save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveActiveQuery();
    }
    
    // Format Query Shortcut (Shift+Alt+F or Ctrl+Shift+F)
    const isShiftAltF = e.shiftKey && e.altKey && (e.key === 'f' || e.key === 'F');
    const isCtrlShiftF = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F');
    if (isShiftAltF || isCtrlShiftF) {
      e.preventDefault();
      formatActiveQuery();
    }
  });

  // Track changes on title, desc, and tags inputs
  elements.queryTitle.addEventListener('input', () => {
    if (state.activeTabId) {
      const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
      if (activeTab) {
        activeTab.title = elements.queryTitle.value;
        const changed = checkTabChanges(activeTab);
        markUnsaved(changed);
        updateTabElementTitle(activeTab.filename, activeTab.title);
        updateTabElementUnsavedDot(activeTab.filename, changed);
      }
    }
  });

  elements.queryDesc.addEventListener('input', () => {
    if (state.activeTabId) {
      const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
      if (activeTab) {
        activeTab.description = elements.queryDesc.value;
        const changed = checkTabChanges(activeTab);
        markUnsaved(changed);
        updateTabElementUnsavedDot(activeTab.filename, changed);
      }
    }
  });

  elements.queryTags.addEventListener('input', () => {
    if (state.activeTabId) {
      const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
      if (activeTab) {
        activeTab.tags = elements.queryTags.value.split(',').map(t => t.trim()).filter(Boolean);
        const changed = checkTabChanges(activeTab);
        markUnsaved(changed);
        updateTabElementUnsavedDot(activeTab.filename, changed);
      }
    }
  });

  elements.resultsViewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (state.activeTabId) {
        const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
        if (activeTab) {
          activeTab.resultsViewMode = mode;
          applyResultsViewMode(mode);
        }
      } else {
        applyResultsViewMode(mode);
      }
    });
  });

  elements.rowsLimitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const limitMode = btn.dataset.limit;
      if (state.activeTabId) {
        const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
        if (activeTab) {
          activeTab.rowsLimitMode = limitMode;
          applyRowsLimitMode(limitMode);
        }
      } else {
        applyRowsLimitMode(limitMode);
      }
    });
  });

  elements.btnBrowseQueries.addEventListener('click', async () => {
    try {
      elements.btnBrowseQueries.disabled = true;
      elements.btnBrowseQueries.textContent = 'Browsing...';
      
      const response = await fetch('/api/select-folder');
      if (!response.ok) throw new Error('Failed to open folder picker');
      
      const data = await response.json();
      if (data.selectedPath) {
        elements.queriesPath.value = data.selectedPath;
      }
    } catch (e) {
      showToast('Failed to open folder browser dialog', 'error');
    } finally {
      elements.btnBrowseQueries.disabled = false;
      elements.btnBrowseQueries.textContent = 'Browse...';
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (hasAnyUnsavedChanges()) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes in your SQL queries. Are you sure you want to leave?';
    }
  });
}

// Fetch list of queries from Server
async function fetchQueries(selectFilename = null) {
  try {
    const response = await fetch('/api/queries');
    if (!response.ok) throw new Error('Failed to load queries');
    
    state.queries = await response.json();
    renderTags();
    renderQueryList();
    
    if (selectFilename) {
      const target = state.queries.find(q => q.filename === selectFilename);
      if (target) selectQuery(target);
    }
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// Render Tags in sidebar
function renderTags() {
  const tags = new Set();
  state.queries.forEach(q => {
    if (q.tags && Array.isArray(q.tags)) {
      q.tags.forEach(t => tags.add(t));
    }
  });

  elements.tagList.innerHTML = '';
  
  if (tags.size === 0) {
    elements.tagList.innerHTML = '<div style="font-size: 0.8rem; color: var(--color-text-dim);">No tags found</div>';
    return;
  }

  tags.forEach(tag => {
    const badge = document.createElement('span');
    badge.className = `tag-badge ${state.activeTagFilter === tag ? 'active' : ''}`;
    badge.textContent = tag;
    badge.addEventListener('click', () => toggleTagFilter(tag));
    elements.tagList.appendChild(badge);
  });
}

// Filter and Render Query list
function renderQueryList() {
  elements.queryList.innerHTML = '';
  
  const filtered = state.queries.filter(q => {
    const matchesSearch = q.title.toLowerCase().includes(state.searchText) || 
                          q.description.toLowerCase().includes(state.searchText) ||
                          q.tags.some(t => t.toLowerCase().includes(state.searchText));
    
    const matchesTag = !state.activeTagFilter || q.tags.includes(state.activeTagFilter);
    
    return matchesSearch && matchesTag;
  });

  if (filtered.length === 0) {
    elements.queryList.innerHTML = '<div style="text-align: center; color: var(--color-text-dim); padding-top: 20px; font-size: 0.9rem;">No queries found</div>';
    return;
  }

  filtered.forEach(query => {
    const item = document.createElement('div');
    item.className = `query-item ${state.activeTabId && state.activeTabId === query.filename ? 'active' : ''}`;
    
    const title = document.createElement('div');
    title.className = 'query-item-title';
    title.textContent = query.title;
    
    const desc = document.createElement('div');
    desc.className = 'query-item-desc';
    desc.textContent = query.description || 'No description provided';
    
    const meta = document.createElement('div');
    meta.className = 'query-item-meta';
    
    const dateSpan = document.createElement('span');
    dateSpan.textContent = query.created;
    
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'query-item-tags';
    if (query.tags) {
      query.tags.slice(0, 3).forEach(tag => {
        const tSpan = document.createElement('span');
        tSpan.className = 'query-item-tag';
        tSpan.textContent = tag;
        tagsDiv.appendChild(tSpan);
      });
    }

    meta.appendChild(dateSpan);
    meta.appendChild(tagsDiv);
    
    item.appendChild(title);
    item.appendChild(desc);
    item.appendChild(meta);
    
    item.addEventListener('click', () => {
      selectQuery(query);
    });
    
    elements.queryList.appendChild(item);
  });
}

// Toggle sidebar tag filters
function toggleTagFilter(tag) {
  if (state.activeTagFilter === tag) {
    state.activeTagFilter = null;
  } else {
    state.activeTagFilter = tag;
  }
  renderTags();
  renderQueryList();
}

// Tab Management Functions

function openTab(query) {
  // Check if query is already open in a tab
  const existingTab = state.tabs.find(t => t.filename === query.filename);
  if (existingTab) {
    switchTab(existingTab.filename);
    return;
  }
  
  // Create a new tab object
  const newTab = {
    filename: query.filename,
    title: query.title,
    description: query.description || '',
    tags: Array.isArray(query.tags) ? [...query.tags] : [],
    sql: query.sql || '',
    created: query.created,
    results: null, // to preserve execution results per tab
    resultsViewMode: 'wrap', // default view mode
    rowsLimitMode: 'config', // default rows limit mode
    
    originalTitle: query.title,
    originalDescription: query.description || '',
    originalTags: Array.isArray(query.tags) ? [...query.tags] : [],
    originalSql: query.sql || '',
    hasChanges: false
  };
  
  state.tabs.push(newTab);
  switchTab(newTab.filename);
}

function switchTab(filename) {
  // 1. Save current input values into the active tab's state
  saveCurrentTabInputsToMemory();
  
  // 2. Set activeTabId
  state.activeTabId = filename;
  
  // 3. Render tabs list
  renderTabs();
  
  // 4. Load the active tab's state into the editor UI inputs
  if (filename) {
    const activeTab = state.tabs.find(t => t.filename === filename);
    if (activeTab) {
      // Show editor, hide welcome screen
      elements.welcomeScreen.classList.add('hidden');
      elements.editorWorkspace.classList.remove('hidden');
      
      // Set input values
      elements.queryTitle.value = activeTab.title;
      elements.queryDesc.value = activeTab.description;
      elements.queryTags.value = activeTab.tags.join(', ');
      elements.queryCreated.textContent = activeTab.created;
      elements.currentFilename.textContent = activeTab.filename;
      elements.sqlTextarea.value = activeTab.sql;
      
      // Update line numbers and unsaved dot in editor toolbar
      updateLineNumbers();
      markUnsaved(activeTab.hasChanges);
      
      // Restore tab-specific rows limit mode
      applyRowsLimitMode(activeTab.rowsLimitMode || 'config');

      // Restore tab-specific query results
      if (activeTab.results) {
        applyResultsViewMode(activeTab.resultsViewMode || 'wrap');
        
        if (activeTab.results.error) {
          renderErrorResults(activeTab.results.error);
        } else {
          renderResultsGrid(activeTab.results.columns, activeTab.results.rows, activeTab.results.metaText);
        }
      } else {
        applyResultsViewMode('wrap');
        resetResults();
      }
    }
  } else {
    // If no active tab, show welcome screen
    elements.welcomeScreen.classList.remove('hidden');
    elements.editorWorkspace.classList.add('hidden');
    applyRowsLimitMode('config');
  }
  
  // Highlight list selection
  renderQueryList();
}

function applyResultsViewMode(mode) {
  if (!elements.resultsTable) return;
  
  elements.resultsTable.classList.remove('view-nowrap', 'view-nooverflow');
  
  if (mode === 'nowrap') {
    elements.resultsTable.classList.add('view-nowrap');
  } else if (mode === 'nooverflow') {
    elements.resultsTable.classList.add('view-nooverflow');
  }
  
  // Update active state in segmented button control
  if (elements.resultsViewBtns) {
    elements.resultsViewBtns.forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}

function applyRowsLimitMode(mode) {
  if (elements.rowsLimitBtns) {
    elements.rowsLimitBtns.forEach(btn => {
      if (btn.dataset.limit === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
}

function closeTab(filename) {
  const tabIndex = state.tabs.findIndex(t => t.filename === filename);
  if (tabIndex === -1) return;
  
  const tab = state.tabs[tabIndex];
  if (tab.hasChanges) {
    if (!confirm(`"${tab.title}" has unsaved changes. Do you want to discard them and close the tab?`)) {
      return;
    }
  }
  
  // Remove tab from state
  state.tabs.splice(tabIndex, 1);
  
  // If we closed the active tab, switch to another tab
  if (state.activeTabId === filename) {
    if (state.tabs.length > 0) {
      const nextActiveIndex = Math.min(tabIndex, state.tabs.length - 1);
      const nextActiveFilename = state.tabs[nextActiveIndex].filename;
      state.activeTabId = null; // reset temporarily to prevent saving closing tab state
      switchTab(nextActiveFilename);
    } else {
      state.activeTabId = null;
      switchTab(null);
    }
  } else {
    // Just refresh tabs UI
    renderTabs();
  }
}

function saveCurrentTabInputsToMemory() {
  if (!state.activeTabId) return;
  const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
  if (activeTab) {
    activeTab.title = elements.queryTitle.value;
    activeTab.description = elements.queryDesc.value;
    activeTab.tags = elements.queryTags.value.split(',').map(t => t.trim()).filter(Boolean);
    activeTab.sql = elements.sqlTextarea.value;
    
    // Check if dirty
    checkTabChanges(activeTab);
  }
}

function checkTabChanges(tab) {
  const titleChanged = tab.title !== tab.originalTitle;
  const descChanged = tab.description !== tab.originalDescription;
  const sqlChanged = tab.sql !== tab.originalSql;
  
  // Compare tags (arrays)
  const tagsChanged = JSON.stringify(tab.tags) !== JSON.stringify(tab.originalTags);
  
  tab.hasChanges = titleChanged || descChanged || sqlChanged || tagsChanged;
  return tab.hasChanges;
}

function hasAnyUnsavedChanges() {
  return state.tabs.some(t => t.hasChanges);
}

function updateTabElementTitle(filename, title) {
  const tabEl = document.querySelector(`.tab-item[data-filename="${filename}"]`);
  if (tabEl) {
    const titleSpan = tabEl.querySelector('.tab-title');
    if (titleSpan) titleSpan.textContent = title || 'Untitled Query';
  }
}

function updateTabElementUnsavedDot(filename, hasChanges) {
  const tabEl = document.querySelector(`.tab-item[data-filename="${filename}"]`);
  if (tabEl) {
    const dot = tabEl.querySelector('.tab-unsaved-dot');
    if (dot) {
      if (hasChanges) {
        dot.classList.remove('hidden');
      } else {
        dot.classList.add('hidden');
      }
    }
  }
}

function renderTabs() {
  elements.tabsContainer.innerHTML = '';
  
  state.tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item ${state.activeTabId === tab.filename ? 'active' : ''}`;
    tabEl.dataset.filename = tab.filename;
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'tab-title';
    titleSpan.textContent = tab.title || 'Untitled Query';
    tabEl.appendChild(titleSpan);
    
    const dot = document.createElement('span');
    dot.className = `tab-unsaved-dot ${tab.hasChanges ? '' : 'hidden'}`;
    tabEl.appendChild(dot);
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;
    closeBtn.title = 'Close tab';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.filename);
    });
    tabEl.appendChild(closeBtn);
    
    tabEl.addEventListener('click', () => {
      if (state.activeTabId !== tab.filename) {
        switchTab(tab.filename);
      }
    });
    
    elements.tabsContainer.appendChild(tabEl);
  });
}

// Select a specific query to edit
async function selectQuery(query) {
  try {
    const response = await fetch(`/api/queries/${query.filename}`);
    if (!response.ok) throw new Error('Could not fetch query details');
    
    const data = await response.json();
    openTab(data);
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// Sync Editor line numbers
function updateLineNumbers() {
  const code = elements.sqlTextarea.value;
  const lines = code.split('\n');
  const lineCount = Math.max(1, lines.length);
  
  let lineNumbersHtml = '';
  for (let i = 1; i <= lineCount; i++) {
    lineNumbersHtml += `${i}\n`;
  }
  elements.lineNumbers.textContent = lineNumbersHtml;
}

// Create New SQL query
async function createNewQuery() {
  try {
    const response = await fetch('/api/queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'New SQL Query',
        description: 'New custom SQL query description',
        tags: [],
        sql: '-- Write your SQL query here\nSELECT * FROM custom_table;'
      })
    });
    
    if (!response.ok) throw new Error('Failed to create new query');
    
    const newQuery = await response.json();
    showToast('New query created successfully');
    
    // Refetch and select the newly created query
    await fetchQueries(newQuery.filename);
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// Save active SQL query
async function saveActiveQuery() {
  if (!state.activeTabId) return;
  
  saveCurrentTabInputsToMemory();
  const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
  if (!activeTab) return;
  
  const title = activeTab.title.trim();
  const description = activeTab.description.trim();
  const tags = activeTab.tags;
  const sql = activeTab.sql;
  
  if (!title) {
    showToast('Title is required!', 'error');
    elements.queryTitle.focus();
    return;
  }
  
  try {
    const response = await fetch(`/api/queries/${activeTab.filename}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, description, tags, sql })
    });
    
    if (!response.ok) throw new Error('Failed to save query file');
    
    const updated = await response.json();
    showToast('Query saved successfully');
    
    // Update tab info
    const oldFilename = activeTab.filename;
    activeTab.filename = updated.filename;
    activeTab.title = updated.title;
    activeTab.description = updated.description;
    activeTab.tags = updated.tags;
    activeTab.sql = updated.sql;
    activeTab.created = updated.created;
    
    activeTab.originalTitle = updated.title;
    activeTab.originalDescription = updated.description;
    activeTab.originalTags = [...updated.tags];
    activeTab.originalSql = updated.sql;
    activeTab.hasChanges = false;
    
    if (oldFilename !== updated.filename) {
      state.activeTabId = updated.filename;
    }
    
    elements.currentFilename.textContent = updated.filename;
    markUnsaved(false);
    
    // Reload sidebar queries list, selecting the newly updated filename
    await fetchQueries(updated.filename);
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// Delete active query
async function deleteActiveQuery() {
  if (!state.activeTabId) return;
  const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
  if (!activeTab) return;
  
  if (!confirm(`Are you sure you want to delete "${activeTab.title}"?\nThis deletes the physical .sql file from your machine.`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/queries/${activeTab.filename}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete query file');
    
    showToast('Query deleted');
    
    // Close the tab from state and UI
    const tabIndex = state.tabs.findIndex(t => t.filename === activeTab.filename);
    state.tabs.splice(tabIndex, 1);
    
    if (state.activeTabId === activeTab.filename) {
      if (state.tabs.length > 0) {
        const nextActiveIndex = Math.min(tabIndex, state.tabs.length - 1);
        const nextActiveFilename = state.tabs[nextActiveIndex].filename;
        state.activeTabId = null;
        switchTab(nextActiveFilename);
      } else {
        state.activeTabId = null;
        switchTab(null);
      }
    } else {
      renderTabs();
    }
    
    fetchQueries();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// Toggle unsaved changes dot
function markUnsaved(unsaved) {
  if (unsaved) {
    elements.unsavedDot.classList.remove('hidden');
  } else {
    elements.unsavedDot.classList.add('hidden');
  }
}

// Show toast notifications
function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  
  if (type === 'error') {
    elements.toast.style.borderColor = 'var(--color-danger)';
    elements.toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(244, 63, 94, 0.2)';
  } else {
    elements.toast.style.borderColor = 'var(--color-primary)';
    elements.toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), 0 0 15px var(--color-primary-glow)';
  }
  
  elements.toast.classList.remove('hidden');
  
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3000);
}

// Reset results pane
function resetResults() {
  elements.resultsPlaceholder.classList.remove('hidden');
  elements.resultsTableContainer.classList.add('hidden');
  elements.resultsErrorContainer.classList.add('hidden');
  elements.resultsMeta.textContent = 'Ready';
}

// Format SQL query using server API
async function formatActiveQuery() {
  const sql = elements.sqlTextarea.value;
  if (!sql || !sql.trim()) {
    showToast('SQL query is empty', 'error');
    return;
  }
  
  try {
    elements.btnFormat.disabled = true;
    
    // Get active connection type
    let dbType = 'sql';
    if (state.activeConnectionId) {
      const activeConn = state.connections.find(c => c.id === state.activeConnectionId);
      if (activeConn) {
        dbType = activeConn.type;
      }
    }
    
    const response = await fetch('/api/queries/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql,
        type: dbType,
        keywordCase: state.formatSettings.keywordCase,
        dataTypeCase: state.formatSettings.dataTypeCase,
        functionCase: state.formatSettings.functionCase,
        indentStyle: state.formatSettings.indentStyle,
        indentStyleParam: state.formatSettings.indentStyleParam,
        logicalOperatorNewline: state.formatSettings.logicalOperatorNewline,
        linesBetweenQueries: state.formatSettings.linesBetweenQueries,
        expressionWidth: state.formatSettings.expressionWidth
      })
    });
    
    if (!response.ok) {
      let errMsg = 'Failed to format query';
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const err = await response.json();
        errMsg = err.error || errMsg;
      } else {
        if (response.status === 404) {
          errMsg = 'Formatting endpoint not found (404). Please ensure you have restarted your local Node server.';
        } else {
          errMsg = `HTTP Error ${response.status}`;
        }
      }
      throw new Error(errMsg);
    }
    
    const data = await response.json();
    if (data.formatted) {
      const originalValue = elements.sqlTextarea.value;
      if (originalValue !== data.formatted) {
        elements.sqlTextarea.value = data.formatted;
        updateLineNumbers();
        
        // Sync with active tab
        if (state.activeTabId) {
          const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
          if (activeTab) {
            activeTab.sql = data.formatted;
            const changed = checkTabChanges(activeTab);
            markUnsaved(changed);
            updateTabElementUnsavedDot(activeTab.filename, changed);
          }
        }
        showToast('Query formatted successfully');
      }
    }
  } catch (error) {
    showToast(`Formatting failed: ${error.message}`, 'error');
  } finally {
    elements.btnFormat.disabled = false;
    elements.sqlTextarea.focus();
  }
}

// Toggle Formatting Settings Popup
function toggleFormatSettingsPopup(e) {
  e.stopPropagation();
  elements.formatSettingsPopup.classList.toggle('hidden');
  
  // Populate form with current settings
  if (!elements.formatSettingsPopup.classList.contains('hidden')) {
    elements.fmtKeywordCase.value = state.formatSettings.keywordCase || 'preserve';
    elements.fmtDataTypeCase.value = state.formatSettings.dataTypeCase || 'preserve';
    elements.fmtFunctionCase.value = state.formatSettings.functionCase || 'preserve';
    elements.fmtIndent.value = state.formatSettings.indentStyle || '2-spaces';
    elements.fmtIndentStyle.value = state.formatSettings.indentStyleParam || 'standard';
    elements.fmtOperatorNewline.value = state.formatSettings.logicalOperatorNewline || 'before';
    elements.fmtLinesBetween.value = typeof state.formatSettings.linesBetweenQueries !== 'undefined' ? state.formatSettings.linesBetweenQueries : 2;
    elements.fmtExprWidth.value = typeof state.formatSettings.expressionWidth !== 'undefined' ? state.formatSettings.expressionWidth : 50;
  }
}

// Save Formatting Settings
function saveFormatSettings() {
  state.formatSettings.keywordCase = elements.fmtKeywordCase.value;
  state.formatSettings.dataTypeCase = elements.fmtDataTypeCase.value;
  state.formatSettings.functionCase = elements.fmtFunctionCase.value;
  state.formatSettings.indentStyle = elements.fmtIndent.value;
  state.formatSettings.indentStyleParam = elements.fmtIndentStyle.value;
  state.formatSettings.logicalOperatorNewline = elements.fmtOperatorNewline.value;
  state.formatSettings.linesBetweenQueries = parseInt(elements.fmtLinesBetween.value, 10) || 2;
  state.formatSettings.expressionWidth = parseInt(elements.fmtExprWidth.value, 10) || 50;
  
  try {
    localStorage.setItem('mSql_format_settings', JSON.stringify(state.formatSettings));
  } catch (e) {}
  
  elements.formatSettingsPopup.classList.add('hidden');
  showToast('Formatting options applied');
}

// Execute SQL Query (Determines Mock or Live Database Mode)
async function executeActiveQuery() {
  if (!state.activeTabId) return;
  const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
  if (!activeTab) return;
  
  // Minimize the query editor if it is currently maximized so results are visible
  if (elements.editorContainer.classList.contains('maximized')) {
    toggleMaximizeEditor();
  }
  
  elements.resultsPlaceholder.classList.add('hidden');
  elements.resultsTableContainer.classList.add('hidden');
  elements.resultsErrorContainer.classList.add('hidden');
  elements.resultsMeta.textContent = 'Executing query...';
  
  const sql = elements.sqlTextarea.value;
  
  // Clean single-line and multi-line comments from the SQL query before execution
  const cleanedSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* ... */ block comments
    .replace(/--.*$/gm, '')           // Remove -- single line comments
    .trim();
    
  if (!cleanedSql) {
    showToast('SQL query is empty (or contains only comments).', 'error');
    resetResults();
    return;
  }
  
  // Calculate limit parameter to send
  const rowsLimitMode = activeTab.rowsLimitMode || 'config';
  let limit = 'unlimited';
  
  if (rowsLimitMode === 'config') {
    let currentLimit = 10;
    if (state.activeConnectionId) {
      const activeConn = state.connections.find(c => c.id === state.activeConnectionId);
      if (activeConn && typeof activeConn.defaultRowsLimit !== 'undefined') {
        currentLimit = activeConn.defaultRowsLimit;
      }
    }
    limit = currentLimit;
  }
  
  if (!state.dbConfigured) {
    showToast('No active database connection. Please configure and select a connection profile first.', 'error');
    renderErrorResults('No active database connection. Please configure and select a connection profile first.');
    return;
  }
  
  const startTime = Date.now();
  try {
    const response = await fetch('/api/queries/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: cleanedSql, limit })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to execute database query.');
    }
    
    const duration = Date.now() - startTime;
    const metaText = `Query succeeded - ${duration}ms`;
    
    activeTab.results = {
      columns: data.columns,
      rows: data.rows,
      metaText: metaText
    };
    
    renderResultsGrid(data.columns, data.rows, metaText);
  } catch (error) {
    activeTab.results = {
      error: error.message
    };
    renderErrorResults(error.message);
  }
}


// Render dynamic results table grid
function renderResultsGrid(columns, rows, metaText) {
  // Clear and build headers
  elements.resultsTableHead.innerHTML = '';
  const hRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col;
    hRow.appendChild(th);
  });
  elements.resultsTableHead.appendChild(hRow);
  
  // Clear and build body
  elements.resultsTableBody.innerHTML = '';
  
  if (rows.length === 0) {
    const bRow = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = columns.length || 1;
    td.style.textAlign = 'center';
    td.style.color = 'var(--color-text-dim)';
    td.textContent = 'No records found (Command executed successfully)';
    bRow.appendChild(td);
    elements.resultsTableBody.appendChild(bRow);
  } else {
    rows.forEach(row => {
      const bRow = document.createElement('tr');
      columns.forEach(col => {
        const td = document.createElement('td');
        const val = (row && typeof row === 'object') ? row[col] : row;
        td.textContent = val !== undefined && val !== null ? val : 'NULL';
        bRow.appendChild(td);
      });
      elements.resultsTableBody.appendChild(bRow);
    });
  }
  
  elements.resultsTableContainer.classList.remove('hidden');
  elements.resultsMeta.textContent = metaText;
  
  // Apply current active tab's results view mode class
  if (state.activeTabId) {
    const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
    if (activeTab) {
      applyResultsViewMode(activeTab.resultsViewMode || 'wrap');
    }
  } else {
    const activeBtn = document.querySelector('.results-view-btn.active');
    applyResultsViewMode(activeBtn ? activeBtn.dataset.mode : 'wrap');
  }
}

// Render query execution error details
function renderErrorResults(errorMessage) {
  elements.resultsErrorText.textContent = errorMessage;
  elements.resultsErrorContainer.classList.remove('hidden');
  elements.resultsMeta.textContent = 'Query Failed';
}

// Database Connection Settings Integration
async function loadConnectionConfig(activeIdToSelect = null) {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Failed to load database configuration');
    
    const data = await response.json();
    state.connections = data.connections || [];
    state.activeConnectionId = data.activeConnectionId;
    
    // Clear and rebuild select list
    elements.connectionProfileSelect.innerHTML = '';
    
    const newOpt = document.createElement('option');
    newOpt.value = 'new';
    newOpt.textContent = '+ Add New Connection';
    elements.connectionProfileSelect.appendChild(newOpt);
    
    state.connections.forEach(conn => {
      const opt = document.createElement('option');
      opt.value = conn.id;
      opt.textContent = conn.name;
      elements.connectionProfileSelect.appendChild(opt);
    });
    
    const targetId = activeIdToSelect || state.activeConnectionId || 'new';
    elements.connectionProfileSelect.value = targetId;
    
    populateModalFields(targetId);
    updateStatusIndicator(data);
    updateRowsLimitUI();
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

function populateModalFields(id) {
  if (id === 'new') {
    elements.connectionName.value = '';
    elements.dbType.value = 'mssql';
    elements.dbHost.value = '';
    elements.dbPort.value = '1433';
    elements.dbPort.placeholder = '1433';
    elements.dbName.value = '';
    elements.dbUser.value = '';
    elements.dbPassword.value = '';
    elements.queriesPath.value = '';
    elements.dbRowsLimit.value = '10';
    elements.btnDeleteConnection.classList.add('hidden');
  } else {
    const conn = state.connections.find(c => c.id === id);
    if (conn) {
      elements.connectionName.value = conn.name || '';
      elements.dbType.value = conn.type || 'mssql';
      elements.dbHost.value = conn.host || '';
      elements.dbPort.value = conn.port || '';
      elements.dbPort.placeholder = conn.type === 'mssql' ? '1433' : conn.type === 'postgres' ? '5432' : '3306';
      elements.dbName.value = conn.database || '';
      elements.dbUser.value = conn.username || '';
      elements.dbPassword.value = conn.password || '';
      elements.queriesPath.value = conn.queriesPath || '';
      elements.dbRowsLimit.value = typeof conn.defaultRowsLimit !== 'undefined' ? conn.defaultRowsLimit : '10';
      elements.btnDeleteConnection.classList.remove('hidden');
    }
  }
}

function updateRowsLimitUI() {
  let currentLimit = 10;
  if (state.activeConnectionId) {
    const activeConn = state.connections.find(c => c.id === state.activeConnectionId);
    if (activeConn && typeof activeConn.defaultRowsLimit !== 'undefined') {
      currentLimit = activeConn.defaultRowsLimit;
    }
  }
  
  const configBtn = document.getElementById('btn-limit-config');
  if (configBtn) {
    configBtn.textContent = currentLimit;
    configBtn.title = `Limit rows fetched to connection default (${currentLimit})`;
  }
  
  // Also update activeTab state display limit if active
  if (state.activeTabId) {
    const activeTab = state.tabs.find(t => t.filename === state.activeTabId);
    if (activeTab && activeTab.rowsLimitMode === 'config') {
      applyRowsLimitMode('config');
    }
  }
}

async function handleProfileChange() {
  if (hasAnyUnsavedChanges()) {
    if (!confirm('You have unsaved changes in some tabs. Switching profiles will discard these changes. Proceed anyway?')) {
      // Revert selection to active connection id
      elements.connectionProfileSelect.value = state.activeConnectionId || 'new';
      populateModalFields(state.activeConnectionId || 'new');
      return;
    }
  }

  const selectedId = elements.connectionProfileSelect.value;
  populateModalFields(selectedId);
  
  if (selectedId !== 'new') {
    try {
      const response = await fetch('/api/config/active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: selectedId })
      });
      if (!response.ok) throw new Error();
      const res = await response.json();
      state.activeConnectionId = res.activeConnectionId;
      
      // Clear open tabs on active profile switch
      state.tabs = [];
      state.activeTabId = null;
      switchTab(null);
      
      await loadConnectionConfig(selectedId);
      await fetchQueries();
    } catch (e) {
      showToast('Failed to switch active connection profile', 'error');
    }
  }
}

async function deleteConnectionProfile() {
  const selectedId = elements.connectionProfileSelect.value;
  if (selectedId === 'new') return;
  
  const conn = state.connections.find(c => c.id === selectedId);
  if (!conn) return;
  
  if (!confirm(`Are you sure you want to delete "${conn.name}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/config/${selectedId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error();
    
    showToast('Connection profile deleted');
    await loadConnectionConfig('new');
  } catch (e) {
    showToast('Failed to delete connection profile', 'error');
  }
}

function updateStatusIndicator(data) {
  if (window.offlineMode) {
    state.dbConfigured = true;
    elements.statusDot.className = 'status-dot warning';
    const backendUrl = localStorage.getItem('mSql_backend_api_url');
    if (backendUrl) {
      elements.statusText.textContent = 'Offline (Backend Unreachable)';
      elements.statusText.title = `Failed to connect to backend at ${backendUrl}. Running in local storage fallback mode.`;
    } else {
      elements.statusText.textContent = 'Offline Demo Mode (Local Storage)';
      elements.statusText.title = 'mSql is running entirely in your browser using local storage for query data and database simulations.';
    }
    return;
  }
  if (data.exists && data.active) {
    state.dbConfigured = true;
    elements.statusDot.className = 'status-dot active';
    const typeLabel = data.active.type === 'mssql' ? 'SQL Server' : data.active.type === 'postgres' ? 'PostgreSQL' : data.active.type === 'mysql' ? 'MySQL' : 'DB';
    elements.statusText.textContent = `${data.active.name} (${data.active.database})`;
    elements.statusText.title = `Engine: ${typeLabel}\nServer: ${data.active.host}:${data.active.port}\nDatabase: ${data.active.database}`;
  } else {
    state.dbConfigured = false;
    elements.statusDot.className = 'status-dot inactive';
    elements.statusText.textContent = 'Disconnected (Local Mode)';
    elements.statusText.title = 'No active connection. Queries run in local simulation mode.';
  }
}

function toggleQueriesPathVisibility() {
  if (!elements.queriesPath) return;
  const backendUrl = (elements.backendApiUrl ? elements.backendApiUrl.value.trim() : '') || localStorage.getItem('mSql_backend_api_url') || '';
  const isPureOffline = window.offlineMode && !backendUrl;
  
  const parent = elements.queriesPath.closest('.form-group');
  if (isPureOffline) {
    if (parent) parent.classList.add('hidden');
    elements.queriesPath.removeAttribute('required');
  } else {
    if (parent) parent.classList.remove('hidden');
    elements.queriesPath.setAttribute('required', 'required');
  }
}

function openSettingsModal() {
  if (elements.backendApiUrl) {
    elements.backendApiUrl.value = localStorage.getItem('mSql_backend_api_url') || '';
  }
  toggleQueriesPathVisibility();

  elements.modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSettingsModal() {
  elements.modalOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

function autoUpdatePort() {
  const type = elements.dbType.value;
  if (type === 'mssql') {
    elements.dbPort.value = '1433';
    elements.dbPort.placeholder = '1433';
  } else if (type === 'postgres') {
    elements.dbPort.value = '5432';
    elements.dbPort.placeholder = '5432';
  } else if (type === 'mysql') {
    elements.dbPort.value = '3306';
    elements.dbPort.placeholder = '3306';
  }
}

async function testConnection() {
  const selectedId = elements.connectionProfileSelect.value;
  const type = elements.dbType.value;
  const host = elements.dbHost.value.trim();
  const port = elements.dbPort.value.trim();
  const database = elements.dbName.value.trim();
  const username = elements.dbUser.value.trim();
  const password = elements.dbPassword.value;
  
  if (!host || !database) {
    showToast('Host and Database name are required to test connection.', 'error');
    if (!host) elements.dbHost.focus();
    else elements.dbName.focus();
    return;
  }
  
  elements.btnTestConnection.disabled = true;
  elements.btnTestConnection.textContent = 'Testing...';
  
  try {
    const response = await fetch('/api/config/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: selectedId === 'new' ? null : selectedId, type, host, port, database, username, password })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      showToast(result.message);
    } else {
      showToast(result.message || 'Connection test failed', 'error');
    }
  } catch (error) {
    showToast(`Connection test failed: ${error.message}`, 'error');
  } finally {
    elements.btnTestConnection.disabled = false;
    elements.btnTestConnection.textContent = 'Test Connection';
  }
}

async function saveConnectionSettings(e) {
  e.preventDefault();
  
  if (hasAnyUnsavedChanges()) {
    if (!confirm('You have unsaved changes in some tabs. Saving and switching settings will discard these changes. Proceed anyway?')) {
      return;
    }
  }

  const backendApiUrlVal = elements.backendApiUrl ? elements.backendApiUrl.value.trim() : '';
  const oldBackendApiUrl = localStorage.getItem('mSql_backend_api_url') || '';
  localStorage.setItem('mSql_backend_api_url', backendApiUrlVal);
  
  if (backendApiUrlVal !== oldBackendApiUrl) {
    showToast('Backend API URL updated. Reloading page...');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    return;
  }

  const selectedId = elements.connectionProfileSelect.value;
  const name = elements.connectionName.value.trim();
  const type = elements.dbType.value;
  const host = elements.dbHost.value.trim();
  const port = elements.dbPort.value.trim();
  const database = elements.dbName.value.trim();
  const username = elements.dbUser.value.trim();
  const password = elements.dbPassword.value;
  const queriesPath = elements.queriesPath.value.trim();
  const defaultRowsLimit = parseInt(elements.dbRowsLimit.value, 10) || 10;
  
  if (!name) {
    showToast('Connection name is required.', 'error');
    elements.connectionName.focus();
    return;
  }
  
  const url = selectedId === 'new' ? '/api/config' : `/api/config/${selectedId}`;
  const method = selectedId === 'new' ? 'POST' : 'PUT';
  
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, type, host, port, database, username, password, queriesPath, defaultRowsLimit })
    });
    
    if (!response.ok) throw new Error('Failed to save connection config');
    
    const result = await response.json();
    showToast('Database connection settings saved');
    
    // Clear tabs on settings switch
    state.tabs = [];
    state.activeTabId = null;
    switchTab(null);
    
    const activeId = selectedId === 'new' ? result.connection.id : selectedId;
    if (selectedId === 'new') {
      await fetch('/api/config/active', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: activeId })
      });
    }
    
    await loadConnectionConfig(activeId);
    await fetchQueries();
    closeSettingsModal();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// Layout Custom Controls
function toggleSidebar() {
  elements.sidebar.classList.toggle('collapsed');
  const isCollapsed = elements.sidebar.classList.contains('collapsed');
  elements.btnToggleSidebar.title = isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
  
  if (isCollapsed) {
    elements.btnToggleSidebar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
  } else {
    elements.btnToggleSidebar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;
  }
}

function toggleMaximizeEditor() {
  elements.editorContainer.classList.toggle('maximized');
  const isMax = elements.editorContainer.classList.contains('maximized');
  elements.btnMaximizeEditor.title = isMax ? 'Minimize Editor' : 'Maximize Editor';
  
  if (isMax) {
    elements.btnMaximizeEditor.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
      </svg>
    `;
    elements.resultsPanel.classList.add('hidden');
    elements.editorResizer.classList.add('hidden');
  } else {
    elements.btnMaximizeEditor.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
      </svg>
    `;
    elements.resultsPanel.classList.remove('hidden');
    elements.editorResizer.classList.remove('hidden');
  }
}

function toggleMaximizeResults() {
  elements.resultsPanel.classList.toggle('maximized');
  const isMax = elements.resultsPanel.classList.contains('maximized');
  elements.btnMaximizeResults.title = isMax ? 'Minimize Results' : 'Maximize Results';
  
  if (isMax) {
    elements.btnMaximizeResults.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
      </svg>
    `;
    elements.editorContainer.classList.add('hidden');
    elements.editorResizer.classList.add('hidden');
  } else {
    elements.btnMaximizeResults.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
      </svg>
    `;
    elements.editorContainer.classList.remove('hidden');
    elements.editorResizer.classList.remove('hidden');
  }
}

function setupResizerDrag() {
  const resizer = elements.editorResizer;
  const editor = elements.editorContainer;
  const results = elements.resultsPanel;
  
  if (!resizer) return;
  
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizer.classList.add('dragging');
    
    const startY = e.clientY;
    const startEditorHeight = editor.offsetHeight;
    const startResultsHeight = results.offsetHeight;
    const totalHeight = startEditorHeight + startResultsHeight;
    
    function onMouseMove(e) {
      const deltaY = e.clientY - startY;
      
      let newEditorHeight = startEditorHeight + deltaY;
      let newResultsHeight = startResultsHeight - deltaY;
      
      // Enforce limits
      if (newEditorHeight < 100) {
        newEditorHeight = 100;
        newResultsHeight = totalHeight - 100;
      }
      if (newResultsHeight < 100) {
        newResultsHeight = 100;
        newEditorHeight = totalHeight - 100;
      }
      
      editor.style.flex = `0 0 ${newEditorHeight}px`;
      results.style.flex = `0 0 ${newResultsHeight}px`;
    }
    
    function onMouseUp() {
      resizer.classList.remove('dragging');
      
      const finalEditorHeight = editor.offsetHeight;
      editor.style.flex = `0 0 ${finalEditorHeight}px`;
      results.style.flex = `1 1 auto`;
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}
