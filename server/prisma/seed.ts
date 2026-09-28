import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
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

// docs/lab-03/specification.md §11.9 — every seeded account shares this
// local-dev-only initial password (mustChangePassword forces a real change
// at first login). Never a real secret; documented again in README.
const SEED_PASSWORD = "ChangeMe123!";

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

// docs/lab-03/specification.md §7 — 3+ active IT Staff, 1 inactive.
const IT_STAFF = [
  { name: "Jordan Blake", email: "jordan.blake@example.com", isActive: true },
  { name: "Morgan Silva", email: "morgan.silva@example.com", isActive: true },
  { name: "Taylor Chen", email: "taylor.chen@example.com", isActive: true },
  { name: "Casey Novak", email: "casey.novak@example.com", isActive: false },
];

// docs/lab-03/specification.md §7 — 1+ active Administrator.
const ADMINISTRATORS = [{ name: "Robin Park", email: "robin.park@example.com", isActive: true }];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

// Non-NEW statuses cycled across a subset of Tickets so the IT Staff Queue
// has a realistic status mix to filter/sort against (specification.md §7).
const ASSIGNED_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
] as const;

type ActionStep = {
  description: string;
  result: string;
  byOther: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
};

// Indexed by (assigned-ticket position % 3): none, one, three (two performers).
const ACTION_PLANS: ActionStep[][] = [
  [],
  [{ description: "Restarted the service and cleared the local cache.", result: "Issue no longer reproduces.", byOther: false, followUpNote: null, attachmentNotes: null }],
  [
    { description: "Collected logs from the affected device.", result: "Logs attached for review.", byOther: false, followUpNote: null, attachmentNotes: "Screenshot of the error dialog is in the ticket attachments." },
    { description: "Reviewed the logs and applied the vendor patch.", result: "Patch installed; awaiting user confirmation.", byOther: true, followUpNote: "Check with the requester on Friday that the fix held.", attachmentNotes: null },
    { description: "Confirmed the fix with the requester by phone.", result: "Requester confirmed the problem is resolved.", byOther: false, followUpNote: null, attachmentNotes: null },
  ],
];

function bumpPriority(p: (typeof PRIORITIES)[number]): (typeof PRIORITIES)[number] {
  return p === "LOW" ? "MEDIUM" : p === "MEDIUM" ? "HIGH" : "HIGH";
}

async function main() {
  const prisma = getPrisma();
  const year = new Date().getFullYear();
  const base = new Date(`${year}-01-15T09:00:00Z`);
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

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
    await prisma.user.upsert({
      where: { email: requester.email },
      update: {},
      create: { ...requester, passwordHash, role: "REQUESTER", mustChangePassword: true },
    });
  }
  for (const staff of IT_STAFF) {
    await prisma.user.upsert({
      where: { email: staff.email },
      update: {},
      create: { ...staff, passwordHash, role: "IT_STAFF", mustChangePassword: true },
    });
  }
  for (const admin of ADMINISTRATORS) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {},
      create: { ...admin, passwordHash, role: "ADMINISTRATOR", mustChangePassword: true },
    });
  }

  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  console.log(`Seed complete — ${users.length} users:`);
  for (const u of users) console.log(`  ${u.id}  ${u.name}  ${u.role}  (active: ${u.isActive})`);

  const requesters = users.filter((u) => u.role === "REQUESTER");
  const alex = requesters.find((r) => r.name === "Alex Rivera")!;
  const sam = requesters.find((r) => r.name === "Sam Okafor")!;
  const priya = requesters.find((r) => r.name === "Priya Nair")!;
  const activeStaff = users.filter((u) => (u.role === "IT_STAFF" || u.role === "ADMINISTRATOR") && u.isActive);

  // 25 tickets for Alex, 5 for Sam, 0 for Priya — ticket numbers 1..30 in
  // creation order across all requesters, per specification.md §7. Counts
  // per Requester are unchanged from Lab 2 — e2e/lab-02/requester-ticket-flow
  // depends on Alex's count being exactly 25.
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

    // Roughly a quarter of tickets are claimed by IT Staff/Admin and moved
    // off New, with IT Priority sometimes changed from Requested Priority —
    // gives the IT Staff Queue non-trivial data to filter/sort/paginate
    // (specification.md §7). The rest stay New/unassigned, matching Lab 2's
    // original all-New seed so its e2e assumptions are undisturbed.
    const isAssigned = i % 4 === 1;
    const owner = isAssigned ? activeStaff[Math.floor(i / 4) % activeStaff.length] : null;
    const status = isAssigned ? ASSIGNED_STATUSES[Math.floor(i / 4) % ASSIGNED_STATUSES.length] : "NEW";
    const itPriority = i % 5 === 0 ? bumpPriority(requestedPriority) : requestedPriority;
    const createdAt = new Date(base.getTime() + i * 29 * 60 * 60 * 1000);
    // BR-24 / Queue flag: a Requester indicated the problem appears
    // resolved on Tickets that reached RESOLVED or REOPENED, so that data
    // exists to exercise (a few hours after creation, well before now).
    const requesterIndicatedResolvedAt =
      status === "RESOLVED" || status === "REOPENED"
        ? new Date(createdAt.getTime() + 6 * 60 * 60 * 1000)
        : null;

    const ticket = await prisma.ticket.upsert({
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
        itPriority,
        status,
        ownerId: owner?.id ?? null,
        requesterIndicatedResolvedAt,
        idempotencyKey: randomUUID(),
        createdAt,
      },
    });

    ticketCounts[requesterName] += 1;

    // A handful of example Public Comments and Internal Notes on the
    // assigned tickets (specification.md §7) — no sensitive content.
    if (isAssigned && owner) {
      const commentExists = await prisma.publicComment.findFirst({ where: { ticketId: ticket.id } });
      if (!commentExists) {
        await prisma.publicComment.create({
          data: {
            ticketId: ticket.id,
            authorId: owner.id,
            body: "Thanks for the report — looking into this now.",
          },
        });
      }

      const noteExists = await prisma.internalNote.findFirst({ where: { ticketId: ticket.id } });
      if (!noteExists) {
        await prisma.internalNote.create({
          data: {
            ticketId: ticket.id,
            authorId: owner.id,
            body: "Checked known-issues list — nothing matching yet, escalate if unresolved by EOD.",
          },
        });
      }

      // Lab 4 Actions Taken (specification.md §7): assigned tickets cycle
      // through zero / one / three actions; unassigned tickets stay at zero.
      // Taylor Chen never performs an action, so the IT Staff Dashboard's
      // "My Recent Actions Taken" empty state stays reachable. The three-
      // action case is performed by two different staff (BR-02).
      const performers = activeStaff.filter((s) => s.name !== "Taylor Chen");
      const plan = ACTION_PLANS[Math.floor(i / 4) % 3];
      const other = performers.find((p) => p.id !== owner.id);
      if (plan.length > 0 && performers.some((p) => p.id === owner.id) && other) {
        for (const [n, step] of plan.entries()) {
          const idempotencyKey = `seed-action-${ticketNumber}-${n + 1}`;
          const performer = step.byOther ? other : owner;
          await prisma.actionTaken.upsert({
            where: { ticketId_idempotencyKey: { ticketId: ticket.id, idempotencyKey } },
            update: {},
            create: {
              ticketId: ticket.id,
              performedById: performer.id,
              description: step.description,
              result: step.result,
              followUpRequired: step.followUpNote !== null,
              followUpNote: step.followUpNote,
              attachmentNotes: step.attachmentNotes,
              idempotencyKey,
              createdAt: new Date(createdAt.getTime() + (n + 1) * 2 * 60 * 60 * 1000),
            },
          });
        }
      }
    }

    // Staff may act on any Ticket without owning it (BR-08), so a few
    // unassigned Tickets also get one triage action.
    if (!isAssigned && i % 8 === 0) {
      const triager = activeStaff.filter((s) => s.name !== "Taylor Chen")[(i / 8) % 3];
      const idempotencyKey = `seed-action-${ticketNumber}-1`;
      await prisma.actionTaken.upsert({
        where: { ticketId_idempotencyKey: { ticketId: ticket.id, idempotencyKey } },
        update: {},
        create: {
          ticketId: ticket.id,
          performedById: triager.id,
          description: "Triaged the request and confirmed it is not a duplicate.",
          result: "Ready to be picked up by the team.",
          idempotencyKey,
          createdAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
        },
      });
    }
  }

  const actualCount = await prisma.ticket.count();
  if (actualCount !== ticketPlan.length) {
    console.error(
      `Seed count mismatch: expected ${ticketPlan.length} tickets from ` +
      `this seed's plan, but the database has ${actualCount}. This does ` +
      `not necessarily mean something is wrong — if tickets exist from ` +
      `other sources (e.g. the Playwright E2E suite run against this ` +
      `same dev database), a difference here is expected, not a seed bug. ` +
      `Investigate if this number is unexpectedly low.`
    );
  }
  console.log(`Seed complete — ${ticketPlan.length} tickets (this run's plan; DB total: ${actualCount}):`);
  for (const [name, count] of Object.entries(ticketCounts)) {
    console.log(`  ${name}: ${count}`);
  }
  console.log(`\nAll seeded accounts share the local-dev-only password: ${SEED_PASSWORD}`);
  console.log("Every account requires a password change at first login (mustChangePassword).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
