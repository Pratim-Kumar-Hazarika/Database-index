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
