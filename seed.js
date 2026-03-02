const pool = require("./db");

const AUTHORS = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Eve",
  "Frank",
  "Grace",
  "Hank",
  "Ivy",
  "Jack",
];
const ADJECTIVES = [
  "Quick",
  "Lazy",
  "Happy",
  "Sad",
  "Bright",
  "Dark",
  "Silent",
  "Loud",
  "Ancient",
  "Modern",
];
const NOUNS = [
  "Guide",
  "Tutorial",
  "Deep Dive",
  "Overview",
  "Intro",
  "Masterclass",
  "Handbook",
  "Review",
  "Analysis",
  "Study",
];
const TOPICS = [
  "JavaScript",
  "PostgreSQL",
  "Docker",
  "React",
  "Node.js",
  "GraphQL",
  "Redis",
  "Kubernetes",
  "TypeScript",
  "Linux",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate() {
  const start = new Date(2022, 0, 1);
  const end = new Date();
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

async function seed() {
  const TOTAL = 1000000;
  const BATCH = 1000;
  console.log(`Seeding ${TOTAL} rows in batches of ${BATCH}...`);

  for (let i = 0; i < TOTAL; i += BATCH) {
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (let j = 0; j < BATCH; j++) {
      const title = `${pick(ADJECTIVES)} ${pick(TOPICS)} ${pick(NOUNS)} #${i + j + 1}`;
      const content = `This is post number ${i + j + 1}. It covers ${pick(TOPICS)} in detail with practical examples and tips for developers.`;
      const author = pick(AUTHORS);
      const createdAt = randomDate().toISOString();

      values.push(
        `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`,
      );
      params.push(title, content, author, createdAt);
      paramIdx += 4;
    }

    await pool.query(
      `INSERT INTO posts (title, content, author, created_at) VALUES ${values.join(", ")}`,
      params,
    );

    console.log(`  Inserted ${Math.min(i + BATCH, TOTAL)} / ${TOTAL}`);
  }

  console.log("Done!");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
