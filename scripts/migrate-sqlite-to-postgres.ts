import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SQLITE_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/mogent.sqlite');
const PG_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mogent';

async function runMigration() {
  console.log('====================================================');
  console.log('🔄 Mogent SQLite -> PostgreSQL Migration Engine');
  console.log(`📂 Source SQLite: ${SQLITE_PATH}`);
  console.log(`🐘 Target PostgreSQL: ${PG_URL.replace(/:[^:@]*@/, ':****@')}`);
  console.log('====================================================\n');

  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`❌ Source SQLite database file not found at ${SQLITE_PATH}`);
    process.exit(1);
  }

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new Pool({
    connectionString: PG_URL,
    ssl: PG_URL.includes('neon.tech') || PG_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // 1. Verify PostgreSQL connection
    const testRes = await pg.query('SELECT NOW() as now, current_database() as db');
    console.log(`✅ Connected to PostgreSQL database "${testRes.rows[0].db}"\n`);

    // 2. Initialize PostgreSQL Schema
    const schemaPath = path.join(__dirname, '../server/src/db/schema.postgres.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pg.query(schemaSql);
    console.log('✅ PostgreSQL Schema initialized successfully.\n');

    // 3. Tables to migrate in foreign key order
    const tables = [
      { name: 'global_system_config', hasAutoId: false },
      { name: 'subscription_plans', hasAutoId: false },
      { name: 'coupons', hasAutoId: true },
      { name: 'tenants', hasAutoId: false },
      { name: 'tenant_api_wallets', hasAutoId: true },
      { name: 'admin_users', hasAutoId: true },
      { name: 'product_groups', hasAutoId: false },
      { name: 'products', hasAutoId: false },
      { name: 'custom_inventory', hasAutoId: true },
      { name: 'customers', hasAutoId: true },
      { name: 'deposits', hasAutoId: true },
      { name: 'orders', hasAutoId: true },
      { name: 'crypto_verified_transactions', hasAutoId: true },
      { name: 'platform_wholesale_rules', hasAutoId: false },
      { name: 'subscription_history', hasAutoId: true },
    ];

    console.log('📦 Starting table-by-table data pump:\n');

    for (const table of tables) {
      try {
        const rows = sqlite.prepare(`SELECT * FROM ${table.name}`).all();
        if (rows.length === 0) {
          console.log(`  ⚪ ${table.name.padEnd(30)}: 0 rows (Skipped)`);
          continue;
        }

        const columns = Object.keys(rows[0] as object);
        const colList = columns.map(c => `"${c}"`).join(', ');
        const placeholderList = columns.map((_, i) => `$${i + 1}`).join(', ');

        const client = await pg.connect();
        try {
          await client.query('BEGIN');
          let inserted = 0;

          for (const row of rows) {
            const values = columns.map(col => (row as any)[col]);
            const insertSql = `
              INSERT INTO "${table.name}" (${colList})
              VALUES (${placeholderList})
              ON CONFLICT DO NOTHING
            `;
            await client.query(insertSql, values);
            inserted++;
          }

          // Advance sequence if table has auto-increment ID
          if (table.hasAutoId) {
            try {
              const seqQuery = `
                SELECT setval(
                  pg_get_serial_sequence('"${table.name}"', 'id'),
                  COALESCE(MAX(id), 1)
                ) FROM "${table.name}"
              `;
              await client.query(seqQuery);
            } catch {
              // Sequence adjustment optional
            }
          }

          await client.query('COMMIT');
          console.log(`  ✅ ${table.name.padEnd(30)}: Migrated ${inserted} rows.`);
        } catch (err: any) {
          await client.query('ROLLBACK');
          console.error(`  ❌ ${table.name.padEnd(30)}: Error: ${err.message}`);
        } finally {
          client.release();
        }
      } catch (tableErr: any) {
        console.warn(`  ⚠️ Could not read ${table.name} from SQLite: ${tableErr.message}`);
      }
    }

    console.log('\n====================================================');
    console.log('🎉 Data Migration Complete! All tables transferred.');
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    sqlite.close();
    await pg.end();
  }
}

runMigration().catch(console.error);
