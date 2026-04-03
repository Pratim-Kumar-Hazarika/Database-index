const express = require("express");
const pool = require("./db");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// GET all posts (with optional pagination)
app.get("/posts", async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const countResult = await pool.query("SELECT COUNT(*) FROM posts");
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await pool.query(
      "SELECT * FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    );

    res.json({ total, page, limit, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get posts by author
// GET /posts/author?name=Alice
app.get("/posts/author", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name)
      return res.status(400).json({
        error: 'Query param "name" is required (e.g. /posts/author?name=Alice)',
      });

    const start = process.hrtime.bigint();
    const { rows } = await pool.query(
      "SELECT * FROM posts WHERE author = $1 ",
      [name],
    );
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;

    res.json({
      author: name,
      elapsed_ms: elapsed.toFixed(2),
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search posts by exact title match
// GET /posts/title?q=Quick PostgreSQL Guide
app.get("/posts/title", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q)
      return res.status(400).json({ error: 'Query param "q" is required' });

    const start = process.hrtime.bigint();
    const { rows } = await pool.query("SELECT * FROM posts WHERE title = $1", [
      q,
    ]);
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;

    res.json({
      query: q,
      elapsed_ms: elapsed.toFixed(2),
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single post by id (must come AFTER /posts/age and /posts/title)
app.get("/posts/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM posts WHERE id = $1", [
      req.params.id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fuzzy search posts by title (ILIKE)
// GET /search?q=javascript
app.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q)
      return res.status(400).json({ error: 'Query param "q" is required' });

    const start = process.hrtime.bigint();
    const { rows } = await pool.query(
      "SELECT * FROM posts WHERE title ILIKE $1 LIMIT 50",
      [`%${q}%`],
    );
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;

    res.json({
      query: q,
      elapsed_ms: elapsed.toFixed(2),
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a report: creates report + report_content in a transaction
// POST /reports/submit
app.post("/reports/submit", async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, masterId, reportContent } = req.body;
    if (!userId || !masterId || !reportContent)
      return res
        .status(400)
        .json({ error: "userId, masterId, and reportContent are required" });

    const orderId = reportContent.orderId;
    if (!orderId)
      return res
        .status(400)
        .json({ error: "reportContent.orderId is required" });

    await client.query("BEGIN");

    const masterResult = await client.query(
      "SELECT id, template_id FROM report_master WHERE id = $1",
      [masterId],
    );
    if (masterResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Report master not found" });
    }
    const templateId = masterResult.rows[0].template_id;

    const reportResult = await client.query(
      `INSERT INTO report (user_id, order_id, master_id, template_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, orderId, masterId, templateId],
    );
    const report = reportResult.rows[0];

    const contentResult = await client.query(
      `INSERT INTO report_content (report_id, content)
       VALUES ($1, $2) RETURNING *`,
      [report.id, JSON.stringify(reportContent)],
    );

    await client.query("COMMIT");

    res.status(201).json({
      report,
      reportContent: contentResult.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Simple search inside report_content JSONB - no report join filters
// GET /reports/find?firstName=Pratim
// GET /reports/find?lastName=Rinki
// GET /reports/find?email=michael.gray
// GET /reports/find?reportType=LUMBAR_SPINE
// GET /reports/find?orderId=12780505
app.get("/reports/find", async (req, res) => {
  try {
    const { firstName, lastName, email, dob, reportType, orderId } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (firstName) {
      conditions.push(`rc.content->>'firstName' ILIKE $${paramIdx}`);
      params.push(`%${firstName}%`);
      paramIdx++;
    }
    if (lastName) {
      conditions.push(`rc.content->>'lastName' ILIKE $${paramIdx}`);
      params.push(`%${lastName}%`);
      paramIdx++;
    }
    if (email) {
      conditions.push(`rc.content->>'email' ILIKE $${paramIdx}`);
      params.push(`%${email}%`);
      paramIdx++;
    }
    if (dob) {
      conditions.push(`rc.content->>'dateOfBirth' = $${paramIdx}`);
      params.push(dob);
      paramIdx++;
    }
    if (reportType) {
      conditions.push(`rc.content->>'reportType' = $${paramIdx}`);
      params.push(reportType);
      paramIdx++;
    }
    if (orderId) {
      conditions.push(`rc.content->>'orderId' = $${paramIdx}`);
      params.push(orderId);
      paramIdx++;
    }

    if (conditions.length === 0)
      return res.status(400).json({ error: "At least one filter is required" });

    const whereSQL = conditions.join(" AND ");

    const start = process.hrtime.bigint();

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM report_content rc
       INNER JOIN report r ON r.id = rc.report_id
       WHERE ${whereSQL}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await pool.query(
      `SELECT rc.*, r.status AS report_status, r.user_id, r.order_id,
              r.created_at AS report_created_at, r.published_at, r.rejected_at
       FROM report_content rc
       INNER JOIN report r ON r.id = rc.report_id
       WHERE ${whereSQL}
       ORDER BY rc.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;

    res.json({
      elapsed_ms: elapsed.toFixed(2),
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search using INDEXED columns (after migration) - much faster
// GET /reports/find-indexed?firstName=Pratim
// GET /reports/find-indexed?firstName=Pratim&lastName=Rinki
// GET /reports/find-indexed?email=michael.gray
// GET /reports/find-indexed?reportType=LUMBAR_SPINE&dob=07/19/1974
app.get("/reports/find-indexed", async (req, res) => {
  try {
    const { firstName, lastName, email, dob, reportType } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (firstName) {
      conditions.push(`rc.first_name = $${paramIdx}`);
      params.push(firstName);
      paramIdx++;
    }
    if (lastName) {
      conditions.push(`rc.last_name = $${paramIdx}`);
      params.push(lastName);
      paramIdx++;
    }
    if (email) {
      conditions.push(`rc.email = $${paramIdx}`);
      params.push(email);
      paramIdx++;
    }
    if (dob) {
      conditions.push(`rc.date_of_birth = $${paramIdx}`);
      params.push(dob);
      paramIdx++;
    }
    if (reportType) {
      conditions.push(`rc.report_type = $${paramIdx}`);
      params.push(reportType);
      paramIdx++;
    }

    if (conditions.length === 0)
      return res.status(400).json({ error: "At least one filter is required" });

    const whereSQL = conditions.join(" AND ");

    const start = process.hrtime.bigint();

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM report_content rc
       INNER JOIN report r ON r.id = rc.report_id
       WHERE ${whereSQL}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await pool.query(
      `SELECT rc.*, r.status AS report_status, r.user_id, r.order_id,
              r.created_at AS report_created_at, r.published_at, r.rejected_at
       FROM report_content rc
       INNER JOIN report r ON r.id = rc.report_id
       WHERE ${whereSQL}
       ORDER BY rc.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset],
    );
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;

    res.json({
      elapsed_ms: elapsed.toFixed(2),
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search report content - searches inside JSONB content + joins report for status/dates
// GET /reports/search?search=Pratim&reportType=DEXA_TBS&status=INREVIEW&dob=01/01/2001&page=1&limit=10
// GET /reports/search?search=james smith (splits into first+last name)
// GET /reports/search?generationDateFrom=2024-01-01&generationDateTo=2025-01-01
app.get("/reports/search", async (req, res) => {
  try {
    const {
      search,
      firstName,
      lastName,
      email,
      dob,
      reportType,
      status = "INREVIEW",
      generationDateFrom,
      generationDateTo,
      publishedDateFrom,
      publishedDateTo,
      rejectedDateFrom,
      rejectedDateTo,
    } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const conditions = ["rc.is_active = true", "r.is_active = true"];
    const params = [];
    let paramIdx = 1;

    // Status filter on report
    conditions.push(`r.status = $${paramIdx}`);
    params.push(status);
    paramIdx++;

    // Search: name (first+last) or email inside content JSONB
    if (search && search.trim()) {
      const trimmed = search.trim();
      const parts = trimmed.split(" ");

      if (parts.length === 2) {
        conditions.push(`(
          rc.content->>'email' ILIKE $${paramIdx}
          OR (
            rc.content->>'firstName' ILIKE $${paramIdx + 1}
            AND rc.content->>'lastName' ILIKE $${paramIdx + 2}
          )
        )`);
        params.push(`%${trimmed}%`, `%${parts[0]}%`, `%${parts[1]}%`);
        paramIdx += 3;
      } else {
        conditions.push(`(
          rc.content->>'email' ILIKE $${paramIdx}
          OR rc.content->>'firstName' ILIKE $${paramIdx}
          OR rc.content->>'lastName' ILIKE $${paramIdx}
        )`);
        params.push(`%${trimmed}%`);
        paramIdx++;
      }
    }

    // DOB filter
    if (dob) {
      conditions.push(`rc.content->>'dateOfBirth' = $${paramIdx}`);
      params.push(dob);
      paramIdx++;
    }

    // First name filter
    if (firstName) {
      conditions.push(`rc.content->>'firstName' ILIKE $${paramIdx}`);
      params.push(`%${firstName}%`);
      paramIdx++;
    }

    // Last name filter
    if (lastName) {
      conditions.push(`rc.content->>'lastName' ILIKE $${paramIdx}`);
      params.push(`%${lastName}%`);
      paramIdx++;
    }

    // Email filter
    if (email) {
      conditions.push(`rc.content->>'email' ILIKE $${paramIdx}`);
      params.push(`%${email}%`);
      paramIdx++;
    }

    // Report type filter
    if (reportType) {
      conditions.push(`rc.content->>'reportType' = $${paramIdx}`);
      params.push(reportType);
      paramIdx++;
    }

    // Date range filters on report table
    if (generationDateFrom) {
      conditions.push(`r.created_at >= $${paramIdx}`);
      params.push(generationDateFrom);
      paramIdx++;
    }
    if (generationDateTo) {
      conditions.push(`r.created_at <= $${paramIdx}`);
      params.push(generationDateTo);
      paramIdx++;
    }
    if (publishedDateFrom) {
      conditions.push(`r.published_at >= $${paramIdx}`);
      params.push(publishedDateFrom);
      paramIdx++;
    }
    if (publishedDateTo) {
      conditions.push(`r.published_at <= $${paramIdx}`);
      params.push(publishedDateTo);
      paramIdx++;
    }
    if (rejectedDateFrom) {
      conditions.push(`r.rejected_at >= $${paramIdx}`);
      params.push(rejectedDateFrom);
      paramIdx++;
    }
    if (rejectedDateTo) {
      conditions.push(`r.rejected_at <= $${paramIdx}`);
      params.push(rejectedDateTo);
      paramIdx++;
    }

    const whereSQL = conditions.join(" AND ");

    const start = process.hrtime.bigint();

    const countQuery = `
      SELECT COUNT(*) FROM report_content rc
      INNER JOIN report r ON r.id = rc.report_id
      WHERE ${whereSQL}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT rc.id, rc.report_id, rc.content, rc.comments, rc.is_active,
             rc.created_at, rc.updated_at, rc.created_by, rc.updated_by,
             r.status AS report_status, r.user_id, r.order_id,
             r.created_at AS report_created_at, r.published_at, r.rejected_at
      FROM report_content rc
      INNER JOIN report r ON r.id = rc.report_id
      WHERE ${whereSQL}
      ORDER BY r.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;

    const { rows } = await pool.query(dataQuery, [...params, limit, offset]);
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6;

    res.json({
      elapsed_ms: elapsed.toFixed(2),
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// EXPLAIN ANALYZE any query
// GET /explain?query=SELECT * FROM posts WHERE author = 'Alice'
app.get("/explain", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query)
      return res.status(400).json({ error: 'Query param "query" is required' });

    const { rows } = await pool.query(`EXPLAIN ANALYZE ${query}`);
    const plan = rows.map((r) => r["QUERY PLAN"]);

    res.json({ query, plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
