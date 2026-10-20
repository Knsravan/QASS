# QASS: notes for Claude

## Ship every change, without asking

Whenever you change or add anything in this repository, ship it. Don't ask
before opening, merging or deploying; report what was shipped.

1. Commit on your working branch and push.
2. Open a pull request against `main`, or let the push update the one
   already open for the branch.
3. Merge it once CI is green on its latest commit: both jobs of the CI
   workflow, "Lint, test and build" and "Smoke test in a browser". Use a
   merge commit. If CI is red, fix it and push again; never merge a red PR.
4. Merging deploys: Vercel's GitHub integration builds `main` and publishes
   it to https://qass.vercel.app. Confirm it: the live `index.html` names
   the new build's files (`/assets/index-<hash>.js`, the same names a local
   `npm run build` gives).

Before pushing, run what CI runs: `npm run lint`, `npm test` and
`npm run build`, plus `npm run test:e2e` for anything a browser can see.
