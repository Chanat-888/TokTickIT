# TokTickIT E2E / Responsive Suite (Lab 2)

This suite requires the `toktickit` database (not `toktickit_test`) to be
freshly seeded before a run, since E2E-04 and the `docs/lab-02/tests.md` §4
screenshot checklist depend on the `specification.md` §7 ~25/~5/0 ticket
distribution across Alex Rivera / Sam Okafor / Priya Nair.

Running `npm run prisma:seed` from `server/` twice is safe (idempotent) and
should be done before `npx playwright test` if the dev database has drifted
from that shape:

```
cd ../server && npm run prisma:seed && npm run prisma:seed
cd ../e2e && npm install
npx playwright test
```
