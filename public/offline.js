// Browser Offline / Static Demo Fallback Interceptor
window.offlineMode = false;
let sqlFormatterGlobal = null;

if (
  window.location.hostname.endsWith('github.io') || 
  window.location.hostname.includes('pages.dev') || 
  window.location.protocol === 'file:' ||
  window.location.search.includes('offline=true')
) {
  window.offlineMode = true;
  console.log('mSql: Static hosting or file protocol detected. Activating Offline Demo Mode.');
}

async function loadSqlFormatter() {
  if (sqlFormatterGlobal) return sqlFormatterGlobal;
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/sql-formatter@15.4.3/+esm');
    sqlFormatterGlobal = module;
    return module;
  } catch (e) {
    console.error('mSql: Failed to load sql-formatter from CDN, falling back to basic formatter:', e);
    return null;
  }
}

function getSampleQueries() {
  return [
    {
      filename: 'get_active_customers.sql',
      title: 'Get Active Customers',
      description: 'Retrieve all customers who placed an order in the last 30 days.',
      tags: ['customers', 'sales', 'active'],
      created: '2026-06-01',
      sql: `-- Title: Get Active Customers\n-- Description: Retrieve all customers who placed an order in the last 30 days.\n-- Tags: customers, sales, active\n-- Created: 2026-06-01\n\nSELECT \n  c.customer_id, \n  c.first_name, \n  c.last_name, \n  c.email, \n  COUNT(o.order_id) AS total_orders, \n  SUM(o.total_amount) AS total_spent\nFROM customers c\nJOIN orders o ON c.customer_id = o.customer_id\nWHERE o.order_date >= DATEADD(day, -30, GETDATE())\nGROUP BY c.customer_id, c.first_name, c.last_name, c.email\nORDER BY total_spent DESC;`
    },
    {
      filename: 'daily_revenue_summary.sql',
      title: 'Daily Revenue Summary',
      description: 'Summarize revenue and order counts grouped by day.',
      tags: ['revenue', 'reports', 'dashboards'],
      created: '2026-05-28',
      sql: `-- Title: Daily Revenue Summary\n-- Description: Summarize revenue and order counts grouped by day.\n-- Tags: revenue, reports, dashboards\n-- Created: 2026-05-28\n\nSELECT \n  CAST(order_date AS DATE) AS sale_date,\n  COUNT(order_id) AS orders_count,\n  SUM(total_amount) AS gross_revenue,\n  SUM(tax_amount) AS total_taxes,\n  SUM(shipping_amount) AS total_shipping,\n  SUM(total_amount - tax_amount - shipping_amount) AS net_revenue\nFROM orders\nWHERE order_status = 'Completed'\nGROUP BY CAST(order_date AS DATE)\nORDER BY sale_date DESC;`
    },
    {
      filename: 'database_table_sizes.sql',
      title: 'Database Table Sizes',
      description: 'Monitor space usage and row counts of user tables.',
      tags: ['admin', 'space', 'utility'],
      created: '2026-05-15',
      sql: `-- Title: Database Table Sizes\n-- Description: Monitor space usage and row counts of user tables.\n-- Tags: admin, space, utility\n-- Created: 2026-05-15\n\nSELECT \n  t.name AS table_name,\n  s.name AS schema_name,\n  p.rows AS row_counts,\n  SUM(a.total_pages) * 8 AS total_space_kb,\n  SUM(a.used_pages) * 8 AS used_space_kb,\n  (SUM(a.total_pages) - SUM(a.used_pages)) * 8 AS unused_space_kb\nFROM sys.tables t\nINNER JOIN sys.indexes i ON t.object_id = i.object_id\nINNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id\nINNER JOIN sys.allocation_units a ON p.partition_id = a.container_id\nLEFT OUTER JOIN sys.schemas s ON t.schema_id = s.schema_id\nWHERE t.is_ms_shipped = 0 AND i.object_id > 255\nGROUP BY t.name, s.name, p.rows\nORDER BY total_space_kb DESC;`
    }
  ];
}

async function mockApiHandler(url, options) {
  const parsedUrl = new URL(url, window.location.origin);
  const path = parsedUrl.pathname;
  const method = (options && options.method || 'GET').toUpperCase();
  const body = options && options.body ? JSON.parse(options.body) : null;
  
  const jsonResponse = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
      status: status,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  
  // GET /api/config
  if (path === '/api/config' && method === 'GET') {
    let config = JSON.parse(localStorage.getItem('mSql_mock_config'));
    if (!config) {
      config = {
        activeConnectionId: 'conn_mock_1',
        connections: [
          {
            id: 'conn_mock_1',
            name: 'Demo SQL Server (Read-Only)',
            type: 'mssql',
            host: 'demo-server.database.windows.net',
            port: '1433',
            database: 'sales_warehouse',
            username: 'demo_user',
            queriesPath: '/local/mock/queries',
            defaultRowsLimit: 10
          }
        ]
      };
      localStorage.setItem('mSql_mock_config', JSON.stringify(config));
    }
    const active = config.connections.find(c => c.id === config.activeConnectionId) || null;
    return jsonResponse({
      activeConnectionId: config.activeConnectionId,
      connections: config.connections,
      active: active,
      exists: !!active
    });
  }
  
  // POST /api/config
  if (path === '/api/config' && method === 'POST') {
    let config = JSON.parse(localStorage.getItem('mSql_mock_config')) || { activeConnectionId: null, connections: [] };
    const newId = 'conn_' + Date.now();
    const newConn = {
      id: newId,
      name: body.name.trim(),
      type: body.type || 'mssql',
      host: body.host || '',
      port: body.port || '',
      database: body.database || '',
      username: body.username || '',
      password: body.password || '',
      queriesPath: body.queriesPath || '',
      defaultRowsLimit: parseInt(body.defaultRowsLimit, 10) || 10
    };
    config.connections.push(newConn);
    if (!config.activeConnectionId) {
      config.activeConnectionId = newId;
    }
    localStorage.setItem('mSql_mock_config', JSON.stringify(config));
    return jsonResponse({ connection: newConn, activeConnectionId: config.activeConnectionId }, 201);
  }
  
  // PUT /api/config/:id
  if (path.startsWith('/api/config/') && method === 'PUT') {
    const id = path.split('/').pop();
    let config = JSON.parse(localStorage.getItem('mSql_mock_config'));
    if (!config) return jsonResponse({ error: 'Config not found' }, 404);
    const idx = config.connections.findIndex(c => c.id === id);
    if (idx === -1) return jsonResponse({ error: 'Connection profile not found' }, 404);
    
    config.connections[idx] = {
      id,
      name: body.name.trim(),
      type: body.type || 'mssql',
      host: body.host || '',
      port: body.port || '',
      database: body.database || '',
      username: body.username || '',
      password: body.password || '',
      queriesPath: body.queriesPath || '',
      defaultRowsLimit: parseInt(body.defaultRowsLimit, 10) || 10
    };
    localStorage.setItem('mSql_mock_config', JSON.stringify(config));
    return jsonResponse({ connection: config.connections[idx], activeConnectionId: config.activeConnectionId });
  }
  
  // DELETE /api/config/:id
  if (path.startsWith('/api/config/') && method === 'DELETE') {
    const id = path.split('/').pop();
    let config = JSON.parse(localStorage.getItem('mSql_mock_config'));
    if (!config) return jsonResponse({ error: 'Config not found' }, 404);
    const idx = config.connections.findIndex(c => c.id === id);
    if (idx === -1) return jsonResponse({ error: 'Connection profile not found' }, 404);
    
    config.connections.splice(idx, 1);
    if (config.activeConnectionId === id) {
      config.activeConnectionId = config.connections.length > 0 ? config.connections[0].id : null;
    }
    localStorage.setItem('mSql_mock_config', JSON.stringify(config));
    return jsonResponse({ success: true, activeConnectionId: config.activeConnectionId });
  }
  
  // POST /api/config/active
  if (path === '/api/config/active' && method === 'POST') {
    let config = JSON.parse(localStorage.getItem('mSql_mock_config'));
    if (!config) return jsonResponse({ error: 'Config not found' }, 404);
    const id = body.id;
    if (id !== null && !config.connections.some(c => c.id === id)) {
      return jsonResponse({ error: 'Connection profile not found' }, 404);
    }
    config.activeConnectionId = id;
    localStorage.setItem('mSql_mock_config', JSON.stringify(config));
    const active = config.connections.find(c => c.id === id) || null;
    return jsonResponse({ activeConnectionId: id, active });
  }
  
  // POST /api/config/test
  if (path === '/api/config/test' && method === 'POST') {
    return jsonResponse({
      success: true,
      message: `Successfully connected to Simulated ${body.type} Database (${body.host}/${body.database})!`
    });
  }
  
  // GET /api/select-folder
  if (path === '/api/select-folder' && method === 'GET') {
    return jsonResponse({ selectedPath: 'C:\\mSql\\Queries\\Demo' });
  }
  
  // GET /api/queries
  if (path === '/api/queries' && method === 'GET') {
    let queries = JSON.parse(localStorage.getItem('mSql_mock_queries'));
    if (!queries) {
      queries = getSampleQueries();
      localStorage.setItem('mSql_mock_queries', JSON.stringify(queries));
    }
    return jsonResponse(queries);
  }
  
  // GET /api/queries/:filename
  if (path.startsWith('/api/queries/') && !path.endsWith('/run') && !path.endsWith('/format') && method === 'GET') {
    const filename = path.split('/').pop();
    let queries = JSON.parse(localStorage.getItem('mSql_mock_queries')) || getSampleQueries();
    const query = queries.find(q => q.filename === filename);
    if (!query) return jsonResponse({ error: 'Query not found' }, 404);
    return jsonResponse(query);
  }
  
  // POST /api/queries
  if (path === '/api/queries' && method === 'POST') {
    let queries = JSON.parse(localStorage.getItem('mSql_mock_queries')) || getSampleQueries();
    let filename = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'untitled';
    filename = filename + '.sql';
    
    let counter = 1;
    let finalFilename = filename;
    while (queries.some(q => q.filename === finalFilename)) {
      const base = filename.replace(/\.sql$/, '');
      finalFilename = `${base}_${counter}.sql`;
      counter++;
    }
    
    const createdDate = new Date().toISOString().split('T')[0];
    const newQuery = {
      filename: finalFilename,
      title: body.title,
      description: body.description || '',
      tags: body.tags || [],
      created: createdDate,
      sql: body.sql || ''
    };
    queries.push(newQuery);
    queries.sort((a, b) => b.created.localeCompare(a.created));
    localStorage.setItem('mSql_mock_queries', JSON.stringify(queries));
    return jsonResponse(newQuery, 201);
  }
  
  // PUT /api/queries/:filename
  if (path.startsWith('/api/queries/') && !path.endsWith('/run') && !path.endsWith('/format') && method === 'PUT') {
    const filename = path.split('/').pop();
    let queries = JSON.parse(localStorage.getItem('mSql_mock_queries')) || getSampleQueries();
    const idx = queries.findIndex(q => q.filename === filename);
    if (idx === -1) return jsonResponse({ error: 'Query not found' }, 404);
    
    let newFilename = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'untitled';
    newFilename = newFilename + '.sql';
    
    if (newFilename !== filename) {
      let counter = 1;
      let finalFilename = newFilename;
      while (queries.some(q => q.filename === finalFilename && q.filename !== filename)) {
        const base = newFilename.replace(/\.sql$/, '');
        finalFilename = `${base}_${counter}.sql`;
        counter++;
      }
      newFilename = finalFilename;
    } else {
      newFilename = filename;
    }
    
    queries[idx] = {
      filename: newFilename,
      title: body.title,
      description: body.description || '',
      tags: body.tags || [],
      created: queries[idx].created,
      sql: body.sql || ''
    };
    localStorage.setItem('mSql_mock_queries', JSON.stringify(queries));
    return jsonResponse(queries[idx]);
  }
  
  // DELETE /api/queries/:filename
  if (path.startsWith('/api/queries/') && !path.endsWith('/run') && !path.endsWith('/format') && method === 'DELETE') {
    const filename = path.split('/').pop();
    let queries = JSON.parse(localStorage.getItem('mSql_mock_queries')) || getSampleQueries();
    const idx = queries.findIndex(q => q.filename === filename);
    if (idx === -1) return jsonResponse({ error: 'Query not found' }, 404);
    
    queries.splice(idx, 1);
    localStorage.setItem('mSql_mock_queries', JSON.stringify(queries));
    return jsonResponse({ message: 'Query deleted successfully' });
  }
  
  // POST /api/queries/run
  if (path === '/api/queries/run' && method === 'POST') {
    const sql = body.sql;
    const limit = body.limit;
    let resultData = { columns: [], rows: [] };
    
    if (/customers/i.test(sql)) {
      resultData.columns = ["customer_id", "first_name", "last_name", "email", "total_orders", "total_spent"];
      resultData.rows = [
        { customer_id: 1, first_name: "John", last_name: "Doe", email: "john.doe@example.com", total_orders: 5, total_spent: 249.99 },
        { customer_id: 2, first_name: "Jane", last_name: "Smith", email: "jane.smith@example.com", total_orders: 12, total_spent: 1189.50 },
        { customer_id: 3, first_name: "Robert", last_name: "Johnson", email: "robert.j@example.com", total_orders: 3, total_spent: 75.20 },
        { customer_id: 4, first_name: "Emily", last_name: "Davis", email: "emily.d@example.com", total_orders: 8, total_spent: 420.00 },
        { customer_id: 5, first_name: "Michael", last_name: "Brown", email: "mbrown@example.com", total_orders: 1, total_spent: 15.99 }
      ];
    } else if (/revenue|orders/i.test(sql)) {
      resultData.columns = ["sale_date", "orders_count", "gross_revenue", "total_taxes", "total_shipping", "net_revenue"];
      resultData.rows = [
        { sale_date: "2026-06-02", orders_count: 42, gross_revenue: 5420.50, total_taxes: 433.64, total_shipping: 210.00, net_revenue: 4776.86 },
        { sale_date: "2026-06-01", orders_count: 38, gross_revenue: 4890.00, total_taxes: 391.20, total_shipping: 190.00, net_revenue: 4308.80 },
        { sale_date: "2026-05-31", orders_count: 55, gross_revenue: 7120.25, total_taxes: 569.62, total_shipping: 275.00, net_revenue: 6275.63 },
        { sale_date: "2026-05-30", orders_count: 29, gross_revenue: 3150.80, total_taxes: 252.06, total_shipping: 145.00, net_revenue: 2753.74 },
        { sale_date: "2026-05-29", orders_count: 31, gross_revenue: 3840.40, total_taxes: 307.23, total_shipping: 155.00, net_revenue: 3378.17 }
      ];
    } else if (/sys\.|tables/i.test(sql)) {
      resultData.columns = ["table_name", "schema_name", "row_counts", "total_space_kb", "used_space_kb", "unused_space_kb"];
      resultData.rows = [
        { table_name: "orders", schema_name: "dbo", row_counts: 1420580, total_space_kb: 312480, used_space_kb: 308120, unused_space_kb: 4360 },
        { table_name: "order_items", schema_name: "dbo", row_counts: 4892040, total_space_kb: 256840, used_space_kb: 251900, unused_space_kb: 4940 },
        { table_name: "customers", schema_name: "dbo", row_counts: 85000, total_space_kb: 18450, used_space_kb: 18100, unused_space_kb: 350 },
        { table_name: "products", schema_name: "dbo", row_counts: 12500, total_space_kb: 4820, used_space_kb: 4710, unused_space_kb: 110 },
        { table_name: "audit_logs", schema_name: "dbo", row_counts: 12504300, total_space_kb: 1850400, used_space_kb: 1800200, unused_space_kb: 50200 }
      ];
    } else {
      resultData.columns = ["id", "query_snippet", "execution_status", "simulated_by", "timestamp"];
      resultData.rows = [
        { 
          id: 1, 
          query_snippet: sql.substring(0, 40) + (sql.length > 40 ? '...' : ''), 
          execution_status: "Success", 
          simulated_by: "mSql Browser-Only Engine", 
          timestamp: new Date().toISOString() 
        }
      ];
    }
    
    if (limit && typeof limit === 'number' && limit < resultData.rows.length) {
      resultData.rows = resultData.rows.slice(0, limit);
    }
    
    return jsonResponse(resultData);
  }
  
  // POST /api/queries/format
  if (path === '/api/queries/format' && method === 'POST') {
    const sql = body.sql;
    const type = body.type;
    const formatter = await loadSqlFormatter();
    
    if (formatter && formatter.format) {
      let language = 'sql';
      if (type === 'mssql') language = 'tsql';
      else if (type === 'postgres') language = 'postgresql';
      else if (type === 'mysql') language = 'mysql';
      
      let tabWidth = 2;
      let useTabs = false;
      if (body.indentStyle === '4-spaces') tabWidth = 4;
      else if (body.indentStyle === 'tabs') useTabs = true;
      
      try {
        const formatted = formatter.format(sql, {
          language: language,
          tabWidth: tabWidth,
          useTabs: useTabs,
          keywordCase: body.keywordCase || 'preserve',
          dataTypeCase: body.dataTypeCase || 'preserve',
          functionCase: body.functionCase || 'preserve',
          indentStyle: body.indentStyleParam || 'standard',
          logicalOperatorNewline: body.logicalOperatorNewline || 'before',
          linesBetweenQueries: typeof body.linesBetweenQueries !== 'undefined' ? parseInt(body.linesBetweenQueries, 10) || 2 : 2,
          expressionWidth: typeof body.expressionWidth !== 'undefined' ? parseInt(body.expressionWidth, 10) || 50 : 50
        });
        return jsonResponse({ formatted });
      } catch (err) {
        return jsonResponse({ error: 'Format failed client-side: ' + err.message }, 500);
      }
    } else {
      const keywords = ['select', 'from', 'where', 'join', 'on', 'group by', 'order by', 'and', 'or', 'limit', 'insert', 'update', 'delete', 'having', 'left', 'right', 'inner', 'outer', 'as', 'into', 'values'];
      let formatted = sql;
      keywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        formatted = formatted.replace(regex, kw.toUpperCase());
      });
      return jsonResponse({ formatted });
    }
  }
  
  return jsonResponse({ error: 'Not Found' }, 404);
}

// Monkeypatch fetch
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
  const urlString = typeof url === 'string' ? url : (url && url.url ? url.url : '');
  
  if (urlString.startsWith('/api/') || urlString.includes('/api/')) {
    const backendApiUrl = localStorage.getItem('mSql_backend_api_url') || '';
    
    if (backendApiUrl) {
      window.offlineMode = false;
      try {
        const parsedUrl = new URL(urlString, window.location.origin);
        const path = parsedUrl.pathname;
        const targetUrl = backendApiUrl.replace(/\/$/, '') + path;
        const response = await originalFetch(targetUrl, options);
        return response;
      } catch (error) {
        console.warn('Failed to contact remote Backend API at ' + backendApiUrl + '. Falling back to Offline Mock mode.', error);
        window.offlineMode = true;
        if (typeof updateStatusIndicator === 'function') {
          updateStatusIndicator({ exists: false, active: null });
        }
        return mockApiHandler(urlString, options);
      }
    }
    
    if (window.offlineMode) {
      return mockApiHandler(urlString, options);
    }
    
    try {
      const response = await originalFetch(url, options);
      if (response.status === 404) {
        console.warn('mSql API returned 404. Falling back to Browser Offline Mock mode.');
        window.offlineMode = true;
        if (typeof updateStatusIndicator === 'function') {
          updateStatusIndicator({ exists: false, active: null });
        }
        return mockApiHandler(urlString, options);
      }
      return response;
    } catch (error) {
      console.warn('mSql Backend server not reachable. Falling back to Browser Offline Mock mode.', error);
      window.offlineMode = true;
      if (typeof updateStatusIndicator === 'function') {
        updateStatusIndicator({ exists: false, active: null });
      }
      return mockApiHandler(urlString, options);
    }
  }
  
  return originalFetch(url, options);
};
