const pool = require("./db");

const CATEGORIES = [
  "electronics",
  "clothing",
  "food",
  "health",
  "finance",
  "education",
  "sports",
  "travel",
];
const SUBCATEGORIES = [
  "basic",
  "premium",
  "enterprise",
  "starter",
  "advanced",
  "pro",
  "lite",
  "standard",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTemplate() {
  return [
    { section: "header", label: "Title", type: "text" },
    { section: "body", label: "Description", type: "textarea" },
    { section: "footer", label: "Summary", type: "text" },
  ];
}

function randomConfig() {
  return {
    maxSections: Math.floor(Math.random() * 10) + 1,
    allowComments: Math.random() > 0.5,
    requireApproval: Math.random() > 0.3,
    version: `v${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}`,
  };
}

async function seed() {
  const TEMPLATE_COUNT = 500;
  const MASTERS_PER_TEMPLATE = 4;
  const BATCH = 100;

  // --- Seed report_template ---
  console.log(`Seeding ${TEMPLATE_COUNT} report templates...`);
  const templateIds = [];

  for (let i = 0; i < TEMPLATE_COUNT; i += BATCH) {
    const values = [];
    const params = [];
    let idx = 1;
    const batchSize = Math.min(BATCH, TEMPLATE_COUNT - i);

    for (let j = 0; j < batchSize; j++) {
      values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3})`);
      params.push(
        JSON.stringify(randomConfig()),
        JSON.stringify({ locale: "en", currency: "USD" }),
        JSON.stringify(randomTemplate()),
        `Generate a report for ${pick(CATEGORIES)} category covering key metrics and insights.`,
      );
      idx += 4;
    }

    const { rows } = await pool.query(
      `INSERT INTO report_template (config, config_constant, template, ai_prompt) VALUES ${values.join(", ")} RETURNING id`,
      params,
    );
    rows.forEach((r) => templateIds.push(r.id));
    console.log(
      `  Templates: ${Math.min(i + BATCH, TEMPLATE_COUNT)} / ${TEMPLATE_COUNT}`,
    );
  }

  // --- Seed report_master ---
  const totalMasters = TEMPLATE_COUNT * MASTERS_PER_TEMPLATE;
  console.log(`Seeding ${totalMasters} report masters...`);
  let masterCount = 0;

  for (let i = 0; i < templateIds.length; i += BATCH) {
    const values = [];
    const params = [];
    let idx = 1;
    const batchSize = Math.min(BATCH, templateIds.length - i);

    for (let j = 0; j < batchSize; j++) {
      const templateId = templateIds[i + j];
      for (let k = 0; k < MASTERS_PER_TEMPLATE; k++) {
        values.push(`($${idx}, $${idx + 1}, $${idx + 2})`);
        params.push(templateId, pick(CATEGORIES), pick(SUBCATEGORIES));
        idx += 3;
      }
    }

    await pool.query(
      `INSERT INTO report_master (template_id, category_slug, subcategory_slug) VALUES ${values.join(", ")}`,
      params,
    );
    masterCount += batchSize * MASTERS_PER_TEMPLATE;
    console.log(`  Masters: ${masterCount} / ${totalMasters}`);
  }

  console.log("Done!");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
