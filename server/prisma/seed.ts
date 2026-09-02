import { randomUUID } from "node:crypto";
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

// Issue 15 — related systems, requesters, and tickets for Lab 2.
const RELATED_SYSTEM_NAMES = [
  "Email",
  "VPN",
  "Payroll Portal",
  "Shared Drive",
  "Ticketing System",
  "Printer Fleet",
];

// Four active Requesters is the spec §7 minimum. The ~25/~5/0 ticket split
// is defined over three of them (Alex, Sam, Priya), so Dana is the fourth
// active Requester and holds no tickets. Priya is the one AC-13 uses for the
// empty state; Dana exists so the selector dropdown has a fourth option.
const REQUESTERS = [
  { name: "Alex Rivera", email: "alex.rivera@example.com", isActive: true },
  { name: "Sam Okafor", email: "sam.okafor@example.com", isActive: true },
  { name: "Priya Nair", email: "priya.nair@example.com", isActive: true },
  { name: "Dana Lim", email: "dana.lim@example.com", isActive: true },
  { name: "Chris Boonmee", email: "chris.boonmee@example.com", isActive: false },
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

async function main() {
  const prisma = getPrisma();
  const year = new Date().getFullYear();
  const base = new Date(`${year}-01-15T09:00:00Z`);

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
      create: { name, isActive: true },
    });
  }

  const categories = await prisma.category.findMany({ orderBy: { id: "asc" } });
  console.log(`Seed complete — ${categories.length} categories:`);
  for (const c of categories) console.log(`  ${c.id}  ${c.name}`);

  // Sequential for the same reason as categories: deterministic id order.
  for (const name of RELATED_SYSTEM_NAMES) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name, isActive: true },
    });
  }

  const relatedSystems = await prisma.relatedSystem.findMany({ orderBy: { id: "asc" } });
  console.log(`Seed complete — ${relatedSystems.length} related systems:`);
  for (const r of relatedSystems) console.log(`  ${r.id}  ${r.name}`);

  // Sequential for the same reason as categories: deterministic id order.
  for (const requester of REQUESTERS) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: {},
      create: requester,
    });
  }

  const requesters = await prisma.requesterUser.findMany({ orderBy: { id: "asc" } });
  console.log(`Seed complete — ${requesters.length} requester users:`);
  for (const r of requesters) console.log(`  ${r.id}  ${r.name}  (active: ${r.isActive})`);

  const alex = requesters.find((r) => r.name === "Alex Rivera")!;
  const sam = requesters.find((r) => r.name === "Sam Okafor")!;
  const priya = requesters.find((r) => r.name === "Priya Nair")!;

  // 25 tickets for Alex, 5 for Sam, 0 for Priya — ticket numbers 1..30 in
  // creation order across all requesters, per specification.md §7.
  const ticketPlan: { requesterId: number; requesterName: string }[] = [
    ...Array.from({ length: 25 }, () => ({ requesterId: alex.id, requesterName: alex.name })),
    ...Array.from({ length: 5 }, () => ({ requesterId: sam.id, requesterName: sam.name })),
  ];

  const ticketCounts: Record<string, number> = { [alex.name]: 0, [sam.name]: 0, [priya.name]: 0 };

  // Sequential so ticket numbers are assigned 1..30 in a deterministic order.
  for (let i = 0; i < ticketPlan.length; i++) {
    const seq = i + 1;
    const ticketNumber = `TKT-${year}-${String(seq).padStart(6, "0")}`;
    const { requesterId, requesterName } = ticketPlan[i];
    const category = categories[i % categories.length];
    const relatedSystem = relatedSystems[i % relatedSystems.length];
    const requestedPriority = PRIORITIES[i % PRIORITIES.length];

    await prisma.ticket.upsert({
      where: { ticketNumber },
      update: {},
      create: {
        ticketNumber,
        requesterId,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: `Seed ticket ${seq} for ${requesterName}`,
        description: `Auto-generated seed ticket ${seq} for ${requesterName}, used to exercise search, filter, sort, and pagination in My Tickets.`,
        requestedPriority,
        status: "NEW",
        idempotencyKey: randomUUID(),
        createdAt: new Date(base.getTime() + i * 29 * 60 * 60 * 1000),
      },
    });

    ticketCounts[requesterName] += 1;
  }

  // Report the count from this seed's own plan (25 + 5 = 30), not a raw
  // DB count — prisma.ticket.count() would include any tickets created
  // separately (e.g. by the Playwright E2E suite against this same dev
  // database), which is real data but not part of what this seed run did.
  console.log(`Seed complete — ${ticketPlan.length} tickets:`);
  for (const [name, count] of Object.entries(ticketCounts)) {
    console.log(`  ${name}: ${count}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
