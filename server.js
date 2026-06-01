const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const QUERIES_DIR = path.join(__dirname, 'queries');

// Ensure queries directory exists
if (!fs.existsSync(QUERIES_DIR)) {
  fs.mkdirSync(QUERIES_DIR, { recursive: true });
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
    const files = fs.readdirSync(QUERIES_DIR).filter(file => file.endsWith('.sql'));
    const queries = files.map(file => {
      try {
        return parseSqlFile(path.join(QUERIES_DIR, file));
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
  const filePath = path.join(QUERIES_DIR, filename);
  
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
  
  let filename = getSanitizedFilename(title);
  let filePath = path.join(QUERIES_DIR, filename);
  
  // Ensure unique filename
  let counter = 1;
  while (fs.existsSync(filePath)) {
    const baseName = filename.replace(/\.sql$/, '');
    filePath = path.join(QUERIES_DIR, `${baseName}_${counter}.sql`);
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
  const oldPath = path.join(QUERIES_DIR, filename);
  
  if (!fs.existsSync(oldPath) || !filename.endsWith('.sql')) {
    return res.status(404).json({ error: 'Query file not found' });
  }
  
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  
  try {
    const existing = parseSqlFile(oldPath);
    let newFilename = getSanitizedFilename(title);
    let newPath = path.join(QUERIES_DIR, newFilename);
    
    // If filename needs to change because the title changed
    if (newFilename !== filename) {
      // Ensure unique filename if it already exists
      let counter = 1;
      while (fs.existsSync(newPath) && newFilename !== filename) {
        const baseName = newFilename.replace(/\.sql$/, '');
        newPath = path.join(QUERIES_DIR, `${baseName}_${counter}.sql`);
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
  const filePath = path.join(QUERIES_DIR, filename);
  
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
  const { name, type, host, port, database, username, password } = req.body;
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
      password: password || ''
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
  const { name, type, host, port, database, username, password } = req.body;
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
      password: finalPassword
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

  // If host is 'error' or 'fail', mock connection failure
  if (host.toLowerCase().includes('error') || host.toLowerCase().includes('fail')) {
    return res.status(500).json({
      success: false,
      message: `Connection failed: Could not connect to ${host}:${port || '1433'}. Verify server name and port.`
    });
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

// API: Run live database SQL query
app.post('/api/queries/run', async (req, res) => {
  const { sql } = req.body;
  
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
    
    const results = await executeLiveQuery(active, sql);
    res.json(results);
  } catch (err) {
    console.error('SQL Execution Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
