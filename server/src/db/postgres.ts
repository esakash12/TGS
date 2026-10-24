import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';

export const PG_DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mogent';

let pool: Pool | null = null;
let isConnected = false;

export function getPostgresPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: PG_DATABASE_URL,
      ssl: PG_DATABASE_URL.includes('neon.tech') || PG_DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      max: 20, // Max 20 concurrent connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected error on idle client:', err.message);
      isConnected = false;
    });
  }
  return pool;
}

/**
 * Test connectivity to PostgreSQL instance
 */
export async function testPostgresConnection(): Promise<boolean> {
  try {
    const p = getPostgresPool();
    const res = await p.query('SELECT NOW() as now, current_database() as db');
    isConnected = true;
    console.log(`[PostgreSQL] ✅ Connected to database "${res.rows[0].db}" at ${res.rows[0].now}`);
    return true;
  } catch (err: any) {
    isConnected = false;
    console.warn('[PostgreSQL] ⚠️ Connection test failed:', err.message);
    return false;
  }
}

export function isPostgresAvailable(): boolean {
  return isConnected;
}

/**
 * Execute DDL Schema on PostgreSQL
 */
export async function initPostgresSchema(): Promise<boolean> {
  try {
    const schemaPath = path.join(__dirname, 'schema.postgres.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    const sql = fs.readFileSync(schemaPath, 'utf8');
    const p = getPostgresPool();
    await p.query(sql);
    console.log('[PostgreSQL] ✅ Production schema initialized successfully.');
    return true;
  } catch (err: any) {
    console.error('[PostgreSQL] ❌ Schema initialization failed:', err.message);
    return false;
  }
}

/**
 * Execute an atomic transaction on PostgreSQL with automatic rollback on error
 */
export async function withPgTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const p = getPostgresPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Generic query helper
 */
export async function pgQuery<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<R>> {
  const p = getPostgresPool();
  return p.query<R>(text, params);
}
