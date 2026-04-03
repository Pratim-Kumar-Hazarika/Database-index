const pool = require("./db");

const REPORT_TYPES = [
  // { type: "DEXA_TBS", desc: "BONE DENSITY W/TBS", count: 4_700_000 }, // already done
  { type: "MAMMOGRAM", desc: "DIAGNOSTIC MAMMOGRAM", count: 1_000_000 },
  { type: "MAMMOGRAM_SCREENING", desc: "SCREENING MAMMOGRAM", count: 1_000_000 },
  { type: "LUMBAR_SPINE", desc: "LUMBAR SPINE MRI", count: 1_000_000 },
];

const FIRST_NAMES = [
  "James","Mary","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth",
  "William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen",
  "Christopher","Lisa","Daniel","Nancy","Matthew","Betty","Anthony","Margaret","Mark","Sandra",
  "Donald","Ashley","Steven","Kimberly","Paul","Emily","Andrew","Donna","Joshua","Michelle",
  "Kenneth","Carol","Kevin","Amanda","Brian","Dorothy","George","Melissa","Timothy","Deborah",
  "Ronald","Stephanie","Edward","Rebecca","Jason","Sharon","Jeffrey","Laura","Ryan","Cynthia",
  "Jacob","Kathleen","Gary","Amy","Nicholas","Angela","Eric","Shirley","Jonathan","Anna",
  "Stephen","Brenda","Larry","Pamela","Justin","Emma","Scott","Nicole","Brandon","Helen",
  "Benjamin","Samantha","Samuel","Katherine","Raymond","Christine","Gregory","Debra","Frank","Rachel",
  "Alexander","Carolyn","Patrick","Janet","Jack","Catherine","Dennis","Maria","Jerry","Heather",
];

const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
  "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
  "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
  "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
  "Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes",
  "Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper",
  "Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson",
  "Watson","Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz","Hughes",
  "Price","Alvarez","Castillo","Sanders","Patel","Myers","Long","Ross","Foster","Jimenez",
];

const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "health.org", "medical.net"];
const GENDERS = ["male", "female"];
const RACES = ["White", "Black", "Hispanic", "Asian", "Ashkenazi Jewish", "Native American", "Pacific Islander", "Other"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDOB() {
  const year = 1940 + Math.floor(Math.random() * 65);
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  return `${month}/${day}/${year}`;
}

function randomPhone() {
  const area = String(Math.floor(Math.random() * 900) + 100);
  const mid = String(Math.floor(Math.random() * 900) + 100);
  const last = String(Math.floor(Math.random() * 9000) + 1000);
  return `+1${area}${mid}${last}`;
}

function buildContent(i, reportType, reportDesc, firstName, lastName, dob, gender) {
  const age = new Date().getFullYear() - parseInt(dob.split("/")[2], 10);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}+${i}@${pick(DOMAINS)}`;
  return {
    orderId: String(10000000 + i),
    firstName,
    lastName,
    dateOfBirth: dob,
    age,
    gender,
    race: pick(RACES),
    height: `${Math.floor(Math.random() * 24) + 54} in`,
    weight: `${Math.floor(Math.random() * 150) + 100} lbs`,
    email,
    phoneNumber: randomPhone(),
    mrn: String(20260000000 + i),
    patientId: crypto.randomUUID(),
    reportTypeDesc: reportDesc,
    reportType,
    referringProviderFirstNm: pick(FIRST_NAMES),
    referringProviderLastNm: pick(LAST_NAMES),
    referringProviderNpiNbr: String(1000000000 + Math.floor(Math.random() * 9000000000)),
    lumbar_spine_bmd: Math.floor(Math.random() * 300) + 50,
    lumbar_spine_t_score: +(Math.random() * -4).toFixed(1),
    right_femoral_neck_bmd: Math.floor(Math.random() * 250) + 50,
    right_femoral_neck_t_score: +(Math.random() * -4).toFixed(1),
    left_femoral_neck_bmd: Math.floor(Math.random() * 250) + 50,
    left_femoral_neck_t_score: +(Math.random() * -4).toFixed(1),
  };
}

async function seed() {
  const masterRows = await pool.query("SELECT id, template_id FROM report_master LIMIT 100");
  if (masterRows.rows.length === 0) {
    console.error("No report_master rows found. Run `npm run seed:reports` first.");
    process.exit(1);
  }
  const masters = masterRows.rows;

  const BATCH = 2000;
  let globalIdx = 0;

  for (const { type, desc, count, skip = 0 } of REPORT_TYPES) {
    const remaining = count - skip;
    if (skip > 0) console.log(`\nResuming ${type} from ${skip.toLocaleString()} (${remaining.toLocaleString()} remaining)...`);
    else console.log(`\nSeeding ${count.toLocaleString()} ${type} reports...`);

    globalIdx += skip;
    for (let i = skip; i < count; i += BATCH) {
      const batchSize = Math.min(BATCH, count - i);

      const reportValues = [];
      const reportParams = [];
      const contentJsons = [];
      let pIdx = 1;

      for (let j = 0; j < batchSize; j++) {
        globalIdx++;
        const firstName = pick(FIRST_NAMES);
        const lastName = pick(LAST_NAMES);
        const dob = randomDOB();
        const gender = pick(GENDERS);
        const master = pick(masters);

        reportValues.push(`($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3})`);
        reportParams.push(crypto.randomUUID(), `${type}-${crypto.randomUUID()}`, master.id, master.template_id);
        pIdx += 4;

        contentJsons.push(JSON.stringify(buildContent(globalIdx, type, desc, firstName, lastName, dob, gender)));
      }

      const { rows: insertedReports } = await pool.query(
        `INSERT INTO report (user_id, order_id, master_id, template_id) VALUES ${reportValues.join(", ")} RETURNING id`,
        reportParams,
      );

      const contentValues = [];
      const contentParams = [];
      let cIdx = 1;
      for (let j = 0; j < batchSize; j++) {
        contentValues.push(`($${cIdx}, $${cIdx + 1})`);
        contentParams.push(insertedReports[j].id, contentJsons[j]);
        cIdx += 2;
      }

      await pool.query(
        `INSERT INTO report_content (report_id, content) VALUES ${contentValues.join(", ")}`,
        contentParams,
      );

      const done = Math.min(i + BATCH, count);
      if (done % 100000 === 0 || done === count) {
        console.log(`  ${type}: ${done.toLocaleString()} / ${count.toLocaleString()}`);
      }
    }
  }

  console.log(`\nDone! Inserted ${globalIdx.toLocaleString()} total reports.`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
