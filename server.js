const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Helper: Load connections config with migration logic
function loadConfig() {
  const defaultStructure = {
    activeConnectionId: null,
    connections: []
  };
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return defaultStructure;
  }
  
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    
    // Check if it's the old single-connection structure
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed.connections) && parsed.host !== undefined) {
      const migratedConn = {
        id: 'conn_migrated',
        name: 'Migrated SQL Server',
        type: parsed.type || 'mssql',
        host: parsed.host || '',
        port: parsed.port || '1433',
        database: parsed.database || '',
        username: parsed.username || '',
        password: parsed.password || ''
      };
      
      const newConfig = {
        activeConnectionId: migratedConn.host && migratedConn.database ? 'conn_migrated' : null,
        connections: [migratedConn]
      };
      
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
      return newConfig;
    }
    
    return {
      activeConnectionId: parsed.activeConnectionId || null,
      connections: Array.isArray(parsed.connections) ? parsed.connections : []
    };
  } catch (err) {
    console.error('Error reading/migrating connection config:', err);
    return defaultStructure;
  }
}

// Helper: Save connections config to file
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// Helper: Get active queries folder dynamically
function getQueriesDir() {
  try {
    const config = loadConfig();
    const active = config.connections.find(c => c.id === config.activeConnectionId);
    if (active && active.queriesPath) {
      const p = active.queriesPath.trim();
      if (p) {
        const resolved = path.isAbsolute(p) ? p : path.resolve(__dirname, p);
        if (!fs.existsSync(resolved)) {
          fs.mkdirSync(resolved, { recursive: true });
        }
        return resolved;
      }
    }
  } catch (err) {
    console.error('Error getting dynamic queries directory:', err);
  }
  
  const defaultDir = path.join(__dirname, 'queries');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Parse metadata and SQL from a file
function parseSqlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  
  const lines = content.split(/\r?\n/);
  let title = filename.replace(/\.sql$/i, '').replace(/[-_]+/g, ' ');
  // Capitalize title words
  title = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  let description = '';
  let tags = [];
  let created = '';
  
  let sqlBodyLines = [];
  let parsingHeader = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    if (parsingHeader) {
      if (trimmed === '') {
        // A blank line at the top can be skipped. If we've already parsed some metadata, it signals the end of metadata
        if (description || tags.length > 0 || created || title !== filename.replace(/\.sql$/i, '').replace(/[-_]+/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')) {
          parsingHeader = false;
        }
        continue;
      }
      
      if (trimmed.startsWith('--')) {
        const commentContent = trimmed.substring(2).trim();
        const titleMatch = commentContent.match(/^Title:\s*(.*)$/i);
        const descMatch = commentContent.match(/^Description:\s*(.*)$/i);
        const tagsMatch = commentContent.match(/^Tags:\s*(.*)$/i);
        const createdMatch = commentContent.match(/^Created:\s*(.*)$/i);
        
        if (titleMatch) {
          title = titleMatch[1].trim();
        } else if (descMatch) {
          description = descMatch[1].trim();
        } else if (tagsMatch) {
          tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
        } else if (createdMatch) {
          created = createdMatch[1].trim();
        } else {
          // If it's a comment but doesn't match metadata format, treat it as part of the SQL body
          parsingHeader = false;
          sqlBodyLines.push(line);
        }
        continue;
      } else {
        parsingHeader = false;
      }
    }
    
    sqlBodyLines.push(line);
  }
  
  if (!created) {
    try {
      const stats = fs.statSync(filePath);
      created = stats.birthtime.toISOString().split('T')[0];
    } catch (e) {
      created = new Date().toISOString().split('T')[0];
    }
  }
  
  const sql = sqlBodyLines.join('\n').trim();
  
  return {
    filename,
    title,
    description,
    tags,
    created,
    sql
  };
}

// Helper: Save metadata and SQL to a file
function saveSqlFile(filePath, { title, description, tags, sql, created }) {
  const tagsStr = Array.isArray(tags) ? tags.join(', ') : '';
  const dateStr = created || new Date().toISOString().split('T')[0];
  
  const content = [
    `-- Title: ${title || ''}`,
    `-- Description: ${description || ''}`,
    `-- Tags: ${tagsStr}`,
    `-- Created: ${dateStr}`,
    '',
    sql.trim()
  ].join('\n') + '\n';
  
  fs.writeFileSync(filePath, content, 'utf-8');
}

// Helper: Sanitize title to safe filename
function getSanitizedFilename(title) {
  let name = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!name) name = 'untitled';
  return `${name}.sql`;
}

// API: Get all queries
app.get('/api/queries', (req, res) => {
  try {
    const queriesDir = getQueriesDir();
    const files = fs.readdirSync(queriesDir).filter(file => file.endsWith('.sql'));
    const queries = files.map(file => {
      try {
        return parseSqlFile(path.join(queriesDir, file));
      } catch (err) {
        console.error(`Error parsing file ${file}:`, err);
        return null;
      }
    }).filter(Boolean);
    
    // Sort queries by created date descending
    queries.sort((a, b) => b.created.localeCompare(a.created));
    res.json(queries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read queries directory' });
  }
});

// API: Get a single query
app.get('/api/queries/:filename', (req, res) => {
  const { filename } = req.params;
  const queriesDir = getQueriesDir();
  const filePath = path.join(queriesDir, filename);
  
  if (!fs.existsSync(filePath) || !filename.endsWith('.sql')) {
    return res.status(404).json({ error: 'Query not found' });
  }
  
  try {
    const query = parseSqlFile(filePath);
    res.json(query);
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse query file' });
  }
});

// API: Create new query
app.post('/api/queries', (req, res) => {
  const { title, description, tags, sql } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  const queriesDir = getQueriesDir();
  let filename = getSanitizedFilename(title);
  let filePath = path.join(queriesDir, filename);
  
  // Ensure unique filename
  let counter = 1;
  while (fs.existsSync(filePath)) {
    const baseName = filename.replace(/\.sql$/, '');
    filePath = path.join(queriesDir, `${baseName}_${counter}.sql`);
    filename = `${baseName}_${counter}.sql`;
    counter++;
  }
  
  try {
    const createdDate = new Date().toISOString().split('T')[0];
    saveSqlFile(filePath, {
      title,
      description,
      tags: tags || [],
      sql: sql || '-- Write your SQL query here\nSELECT * FROM users LIMIT 10;',
      created: createdDate
    });
    
    const newQuery = parseSqlFile(filePath);
    res.status(201).json(newQuery);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create query file' });
  }
});

// API: Update query
app.put('/api/queries/:filename', (req, res) => {
  const { filename } = req.params;
  const { title, description, tags, sql } = req.body;
  const queriesDir = getQueriesDir();
  const oldPath = path.join(queriesDir, filename);
  
  if (!fs.existsSync(oldPath) || !filename.endsWith('.sql')) {
    return res.status(404).json({ error: 'Query file not found' });
  }
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  try {
    const existing = parseSqlFile(oldPath);
    let newFilename = getSanitizedFilename(title);
    let newPath = path.join(queriesDir, newFilename);
    
    // If filename needs to change because the title changed
    if (newFilename !== filename) {
      // Ensure unique filename if it already exists
      let counter = 1;
      while (fs.existsSync(newPath) && newFilename !== filename) {
        const baseName = newFilename.replace(/\.sql$/, '');
        newPath = path.join(queriesDir, `${baseName}_${counter}.sql`);
        newFilename = `${baseName}_${counter}.sql`;
        counter++;
      }
      
      // Delete the old file first, or we write to the new and then delete
      saveSqlFile(newPath, {
        title,
        description,
        tags: tags || [],
        sql: sql || '',
        created: existing.created
      });
      fs.unlinkSync(oldPath);
    } else {
      // Just overwrite the old file
      saveSqlFile(oldPath, {
        title,
        description,
        tags: tags || [],
        sql: sql || '',
        created: existing.created
      });
    }
    
    const updatedQuery = parseSqlFile(newPath);
    res.json(updatedQuery);
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update query file' });
  }
});

// API: Delete query
app.delete('/api/queries/:filename', (req, res) => {
  const { filename } = req.params;
  const queriesDir = getQueriesDir();
  const filePath = path.join(queriesDir, filename);
  
  if (!fs.existsSync(filePath) || !filename.endsWith('.sql')) {
    return res.status(404).json({ error: 'Query file not found' });
  }
  
  try {
    fs.unlinkSync(filePath);
    res.json({ message: 'Query deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete query file' });
  }
});

// Configuration file helper calls are now handled at the top

// API: Get Connections Config
app.get('/api/config', (req, res) => {
  try {
    const config = loadConfig();
    const clientConnections = config.connections.map(conn => {
      const masked = { ...conn };
      if (masked.password) masked.password = '__MASKED__';
      return masked;
    });
    
    const active = config.connections.find(c => c.id === config.activeConnectionId);
    const activeInfo = active ? { ...active } : null;
    if (activeInfo && activeInfo.password) {
      activeInfo.password = '__MASKED__';
    }
    
    res.json({
      activeConnectionId: config.activeConnectionId,
      connections: clientConnections,
      active: activeInfo,
      exists: !!activeInfo
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read connection configuration' });
  }
});

// API: Create new Connection Config
app.post('/api/config', (req, res) => {
  const { name, type, host, port, database, username, password, queriesPath, defaultRowsLimit } = req.body;
  if (!name) return res.status(400).json({ error: 'Connection name is required.' });
  
  try {
    const config = loadConfig();
    const newId = 'conn_' + Date.now();
    
    const newConn = {
      id: newId,
      name: name.trim(),
      type: type || 'mssql',
      host: host || '',
      port: port || '',
      database: database || '',
      username: username || '',
      password: password || '',
      queriesPath: queriesPath ? queriesPath.trim() : '',
      defaultRowsLimit: typeof defaultRowsLimit !== 'undefined' ? parseInt(defaultRowsLimit, 10) || 10 : 10
    };
    
    config.connections.push(newConn);
    if (!config.activeConnectionId) {
      config.activeConnectionId = newId;
    }
    
    saveConfig(config);
    
    const clientConn = { ...newConn };
    if (clientConn.password) clientConn.password = '__MASKED__';
    res.status(201).json({ connection: clientConn, activeConnectionId: config.activeConnectionId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create connection profile' });
  }
});

// API: Update Connection Config
app.put('/api/config/:id', (req, res) => {
  const { id } = req.params;
  const { name, type, host, port, database, username, password, queriesPath, defaultRowsLimit } = req.body;
  if (!name) return res.status(400).json({ error: 'Connection name is required.' });
  
  try {
    const config = loadConfig();
    const idx = config.connections.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Connection profile not found' });
    
    let finalPassword = password;
    if (password === '__MASKED__') {
      finalPassword = config.connections[idx].password || '';
    }
    
    config.connections[idx] = {
      id,
      name: name.trim(),
      type: type || 'mssql',
      host: host || '',
      port: port || '',
      database: database || '',
      username: username || '',
      password: finalPassword,
      queriesPath: queriesPath ? queriesPath.trim() : '',
      defaultRowsLimit: typeof defaultRowsLimit !== 'undefined' ? parseInt(defaultRowsLimit, 10) || 10 : 10
    };
    
    saveConfig(config);
    
    const clientConn = { ...config.connections[idx] };
    if (clientConn.password) clientConn.password = '__MASKED__';
    res.json({ connection: clientConn, activeConnectionId: config.activeConnectionId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update connection profile' });
  }
});

// API: Delete Connection Config
app.delete('/api/config/:id', (req, res) => {
  const { id } = req.params;
  try {
    const config = loadConfig();
    const idx = config.connections.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Connection profile not found' });
    
    config.connections.splice(idx, 1);
    if (config.activeConnectionId === id) {
      config.activeConnectionId = config.connections.length > 0 ? config.connections[0].id : null;
    }
    
    saveConfig(config);
    res.json({ success: true, activeConnectionId: config.activeConnectionId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete connection profile' });
  }
});

// API: Open native folder browser and return selected path
app.get('/api/select-folder', (req, res) => {
  const { exec } = require('child_process');
  
  // PowerShell command to open a Windows Forms FolderBrowserDialog using a topmost owner Form to ensure it appears in the foreground.
  // Explicitly uses -NoProfile -STA since WinForms GUI dialogs require STA mode to prevent hangs when spawned from Node.js child_process.
  const psCommand = 'powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.Form; $f.TopMost = $true; $f.WindowState = \'Minimized\'; $f.ShowInTaskbar = $false; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = \'Select Queries Directory\'; $d.ShowNewFolderButton = $true; if ($d.ShowDialog($f) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }; $f.Dispose(); $d.Dispose();"';
  
  console.log('Received request for /api/select-folder');
  exec(psCommand, { timeout: 30000 }, (err, stdout, stderr) => {
    console.log('PowerShell execution completed.');
    console.log('err:', err);
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
    if (err) {
      if (err.killed) {
        console.error('Folder browser dialog timed out or was killed.');
        return res.status(408).json({ error: 'Folder selection timed out (no response in 30 seconds)' });
      }
      console.error('Error running folder browser dialog:', err);
      return res.status(500).json({ error: 'Failed to open folder browser dialog' });
    }
    
    const selectedPath = stdout.trim();
    console.log('selectedPath:', selectedPath);
    res.json({ selectedPath });
  });
});

// API: Switch Active Connection
app.post('/api/config/active', (req, res) => {
  const { id } = req.body;
  try {
    const config = loadConfig();
    if (id !== null && !config.connections.some(c => c.id === id)) {
      return res.status(404).json({ error: 'Connection profile not found' });
    }
    
    config.activeConnectionId = id;
    saveConfig(config);
    
    const active = config.connections.find(c => c.id === id);
    const activeInfo = active ? { ...active } : null;
    if (activeInfo && activeInfo.password) {
      activeInfo.password = '__MASKED__';
    }
    
    res.json({ activeConnectionId: id, active: activeInfo });
  } catch (err) {
    res.status(500).json({ error: 'Failed to switch active connection' });
  }
});

// Helper: Execute actual SQL Query against DB
async function executeLiveQuery(config, sqlQuery) {
  const { type, host, port, database, username, password } = config;
  
  if (type === 'mssql') {
    const mssql = require('mssql');
    const sqlConfig = {
      server: host,
      port: parseInt(port) || 1433,
      database: database,
      user: username,
      password: password,
      options: {
        encrypt: true,
        trustServerCertificate: true
      },
      connectionTimeout: 10000,
      requestTimeout: 30000
    };
    
    let pool;
    try {
      pool = await mssql.connect(sqlConfig);
      const result = await pool.request().query(sqlQuery);
      
      const rows = result.recordset || [];
      const columns = result.recordset && result.recordset.columns 
        ? Object.keys(result.recordset.columns) 
        : (rows.length > 0 ? Object.keys(rows[0]) : []);
      
      return { columns, rows, rowsAffected: result.rowsAffected };
    } finally {
      if (pool) await pool.close();
    }
  } else if (type === 'postgres') {
    const { Client } = require('pg');
    const client = new Client({
      host,
      port: parseInt(port) || 5432,
      database,
      user: username,
      password,
      connectionTimeoutMillis: 10000
    });
    
    await client.connect();
    try {
      const result = await client.query(sqlQuery);
      const res = Array.isArray(result) ? result[result.length - 1] : result;
      const rows = res.rows || [];
      const columns = res.fields ? res.fields.map(f => f.name) : (rows.length > 0 ? Object.keys(rows[0]) : []);
      
      return { columns, rows, rowsAffected: res.rowCount };
    } finally {
      await client.end();
    }
  } else if (type === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host,
      port: parseInt(port) || 3306,
      database,
      user: username,
      password,
      connectTimeout: 10000
    });
    
    try {
      const [rows, fields] = await conn.execute(sqlQuery);
      const isSelect = Array.isArray(rows);
      const columns = fields ? fields.map(f => f.name) : (isSelect && rows.length > 0 ? Object.keys(rows[0]) : []);
      
      return { 
        columns, 
        rows: isSelect ? rows : [], 
        rowsAffected: !isSelect ? rows.affectedRows : null 
      };
    } finally {
      await conn.end();
    }
  } else {
    throw new Error(`Unsupported database provider: ${type}`);
  }
}

// API: Test Connection Config
app.post('/api/config/test', async (req, res) => {
  const { id, type, host, port, database, username, password } = req.body;
  
  if (!host || !database) {
    return res.status(400).json({ success: false, message: 'Host and Database name are required to test connection.' });
  }
  
  let finalPassword = password;
  if (password === '__MASKED__' && id) {
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const config = loadConfig();
        const existing = config.connections.find(c => c.id === id);
        if (existing) {
          finalPassword = existing.password || '';
        }
      } catch (e) {}
    }
  }

  try {
    const config = { type, host, port, database, username, password: finalPassword };
    const testQuery = type === 'mssql' ? 'SELECT 1 AS [test]' : 'SELECT 1 AS test';
    await executeLiveQuery(config, testQuery);
    
    const typeLabel = type === 'mssql' ? 'SQL Server' : type === 'postgres' ? 'PostgreSQL' : type === 'mysql' ? 'MySQL' : 'Database';
    res.json({
      success: true,
      message: `Successfully connected to ${typeLabel} (${host}/${database})!`
    });
  } catch (err) {
    console.error('Test Connection Error:', err);
    res.status(500).json({
      success: false,
      message: `Connection failed: ${err.message}`
    });
  }
});

function hasLimitOrTop(sql, type) {
  const cleanSql = sql.toLowerCase().trim();
  if (type === 'mssql') {
    return /\btop\b\s*\(?\s*\d+/.test(cleanSql) || /\bfetch\s+first\s+\d+/.test(cleanSql);
  } else {
    return /\blimit\b\s+\d+/.test(cleanSql) || /\bfetch\s+first\s+\d+/.test(cleanSql);
  }
}

function applySqlLimit(sql, limit, type) {
  if (!limit || limit === 'unlimited') return sql;
  
  const cleanSql = sql.toLowerCase().trim();
  if (hasLimitOrTop(sql, type)) return sql;
  
  const isSimpleSelect = /^select\b/.test(cleanSql) && !/\bunion\b/.test(cleanSql) && !/\bwith\b/.test(cleanSql);
  
  if (isSimpleSelect) {
    if (type === 'mssql') {
      return sql.replace(/select/i, `SELECT TOP ${limit}`);
    } else {
      return `${sql.trim()} LIMIT ${limit}`;
    }
  }
  
  return sql;
}

// API: Format SQL Query using sql-formatter library
// API: Format SQL Query using sql-formatter library
app.post('/api/queries/format', (req, res) => {
  const { 
    sql, 
    type, 
    keywordCase, 
    dataTypeCase, 
    functionCase, 
    indentStyle,
    indentStyleParam,
    logicalOperatorNewline,
    linesBetweenQueries,
    expressionWidth
  } = req.body;
  
  if (!sql) {
    return res.status(400).json({ error: 'SQL query body is required' });
  }
  
  try {
    const { format } = require('sql-formatter');
    
    // Map mSql database types to sql-formatter language dialects
    let language = 'sql';
    if (type === 'mssql') {
      language = 'tsql';
    } else if (type === 'postgres') {
      language = 'postgresql';
    } else if (type === 'mysql') {
      language = 'mysql';
    }
    
    // Configure indentation options
    let tabWidth = 2;
    let useTabs = false;
    if (indentStyle === '4-spaces') {
      tabWidth = 4;
    } else if (indentStyle === 'tabs') {
      useTabs = true;
    }
    
    const formatted = format(sql, {
      language: language,
      tabWidth: tabWidth,
      useTabs: useTabs,
      keywordCase: keywordCase || 'preserve',
      dataTypeCase: dataTypeCase || 'preserve',
      functionCase: functionCase || 'preserve',
      indentStyle: indentStyleParam || 'standard',
      logicalOperatorNewline: logicalOperatorNewline || 'before',
      linesBetweenQueries: typeof linesBetweenQueries !== 'undefined' ? parseInt(linesBetweenQueries, 10) || 2 : 2,
      expressionWidth: typeof expressionWidth !== 'undefined' ? parseInt(expressionWidth, 10) || 50 : 50
    });
    
    res.json({ formatted });
  } catch (err) {
    console.error('SQL Formatting Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Run live database SQL query
app.post('/api/queries/run', async (req, res) => {
  const { sql, limit } = req.body;
  
  if (!sql) {
    return res.status(400).json({ error: 'SQL query body is required' });
  }
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return res.status(400).json({ error: 'No database connection configured. Please set connection details first.' });
  }
  
  try {
    const config = loadConfig();
    const active = config.connections.find(c => c.id === config.activeConnectionId);
    
    if (!active || !active.host || !active.database) {
      return res.status(400).json({ error: 'No active database connection configured.' });
    }
    
    const sqlToRun = applySqlLimit(sql, limit, active.type);
    const results = await executeLiveQuery(active, sqlToRun);
    res.json(results);
  } catch (err) {
    console.error('SQL Execution Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
