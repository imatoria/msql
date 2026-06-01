# mSql — SQL Query Repository

mSql is a modern, beautiful local web application to store, organize, search, and edit SQL queries. All queries are stored directly on your disk as standard `.sql` files with embedded metadata headers.

## Key Features

- **Portability**: All queries are stored as raw `.sql` files inside the `queries/` directory.
- **Embedded Metadata**: Titles, descriptions, tags, and created dates are stored directly inside standard SQL comments at the very top of each file (e.g. `-- Title: ...`).
- **Premium Glassmorphism Dark Theme**: Sleek, immersive modern developer dashboard.
- **Dynamic Tag Filtering & Live Search**: Fast, responsive filtering of queries.
- **SQL Editor**: Code area equipped with line numbers and standard database text editing conveniences.
- **Mock Runner Simulation**: Simulates running your SQL statements on dynamic datasets (Users, Sales, Database Indexes) depending on your query.

## Setup & Running

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the Express server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to:
   [http://localhost:3000](http://localhost:3000)

## Metadata File Structure Example

```sql
-- Title: Active Users Report
-- Description: Retrieve a list of active users in the last 30 days.
-- Tags: users, analytics
-- Created: 2026-06-01

SELECT * FROM users WHERE active = true;
```
