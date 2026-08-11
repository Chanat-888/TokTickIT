import { getPrisma } from "../src/prisma.js";

// Issue 3 — seed the four supported categories.
// The four names are: Account and Access, Hardware, Software, Network.
// Requirement: running the seed twice must NOT create duplicates.
// Hint: prisma.category.upsert({ where:{name}, update:{}, create:{name} }).
const CATEGORY_NAMES = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

async function main() {
  const prisma = getPrisma();

  // upsert() keys on the unique `name`, so re-running the seed updates the
  // existing row instead of inserting a duplicate.
  //
  // Deliberately sequential — do NOT convert this to Promise.all(). Awaiting
  // each upsert in turn is what assigns ids 1-4 in CATEGORY_NAMES order.
  // Issue 4 returns categories in id order, so parallelising here would make
  // the order non-deterministic and break that.
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const seeded = await prisma.category.findMany({ orderBy: { id: "asc" } });
  console.log(`Seed complete — ${seeded.length} categories:`);
  for (const c of seeded) console.log(`  ${c.id}  ${c.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
