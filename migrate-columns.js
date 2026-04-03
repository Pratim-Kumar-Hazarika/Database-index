const pool = require("./db");

async function migrate() {
  console.log("Step 1: Adding columns to report_content...");
  await pool.query(`
    ALTER TABLE report_content
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(20),
      ADD COLUMN IF NOT EXISTS report_type VARCHAR(100);
  `);
  console.log("  Columns added.");

  console.log("Step 2: Backfilling data from content JSONB...");
  const BATCH = 50000;
  let updated = 0;

  const countResult = await pool.query(
    "SELECT COUNT(*) FROM report_content WHERE email IS NULL"
  );
  const total = parseInt(countResult.rows[0].count, 10);
  console.log(`  ${total.toLocaleString()} rows to backfill.`);

  while (updated < total) {
    const result = await pool.query(`
      UPDATE report_content
      SET
        email = content->>'email',
        first_name = content->>'firstName',
        last_name = content->>'lastName',
        date_of_birth = content->>'dateOfBirth',
        report_type = content->>'reportType'
      WHERE id IN (
        SELECT id FROM report_content
        WHERE email IS NULL
        LIMIT $1
      )
    `, [BATCH]);

    updated += result.rowCount;
    console.log(`  Backfilled ${updated.toLocaleString()} / ${total.toLocaleString()}`);
  }
  console.log("  Backfill complete.");

  console.log("Step 3: Creating B-tree indexes...");

  console.log("  Creating idx_report_content_email...");
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_content_email ON report_content (email);`);

  console.log("  Creating idx_report_content_first_name...");
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_content_first_name ON report_content (first_name);`);

  console.log("  Creating idx_report_content_last_name...");
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_content_last_name ON report_content (last_name);`);

  console.log("  Creating idx_report_content_dob...");
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_content_dob ON report_content (date_of_birth);`);

  console.log("  Creating idx_report_content_report_type...");
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_report_content_report_type ON report_content (report_type);`);

  console.log("\nStep 4: Creating GIN trigram indexes (for ILIKE/partial search)...");

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);

  console.log("  Creating gin_report_content_email...");
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_report_content_email ON report_content USING gin (email gin_trgm_ops);`);

  console.log("  Creating gin_report_content_first_name...");
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_report_content_first_name ON report_content USING gin (first_name gin_trgm_ops);`);

  console.log("  Creating gin_report_content_last_name...");
  await pool.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_report_content_last_name ON report_content USING gin (last_name gin_trgm_ops);`);

  console.log("\nMigration complete!");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
