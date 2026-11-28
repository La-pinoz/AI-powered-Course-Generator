# Spec 10 — CI Pipeline (GitHub Actions)

Nov 26, 2026

Branch 2 of 4 (suggested name `ci/github-actions`). Comes after Spec 9 (content gaps) and before Spec 11 (deployment) and Spec 12 (README and docs).

Roadmap Milestone 12, "CI/CD Implementation": *"Establish a robust Git workflow … utilizing feature branches and Pull Requests"* and *"Configure CI/CD pipelines (e.g., GitHub Actions) … automate the build, test, and deployment processes"*. This spec covers the **build and test** half. The **deployment** half (Render and Vercel deploying `main` once CI passes) is in Spec 11.

**Why CI comes before deployment:** CI doesn't depend on any hosting, needs no secrets, and is the smallest piece. Once it is on `main`, the deployment branch (Spec 11) and everything after it gets checked automatically, so nothing reaches production untested.

## Problem Statement

The project already follows the roadmap's Git workflow (one branch per feature, merged into `main` through a pull request; PRs #8–#10), but nothing checks a pull request automatically. The server tests, the client lint, the client tests and the production build only run if the owner remembers to run them locally. A change that breaks the build or a route can be merged into `main` without anyone noticing, and once deployment exists (Spec 11), it would go straight to the live site.

There is also no pinned Node version. Local development, a CI runner and a host could each use a different Node, and Express 5, Vite 8 and Vitest 5 need a recent one.

## Solution

- A GitHub Actions workflow runs on every pull request into `main` and every push to `main`.
- It has two jobs, `server` and `client`, run side by side, so a failure shows which package broke.
  - `server` installs and runs the test suite (supertest plus in-memory MongoDB, with Gemini and YouTube mocked).
  - `client` installs and runs lint, tests and the production build.
- Both packages declare the same Node major version, and CI uses it.
- After this branch merges, the owner turns on branch protection for `main` in GitHub settings, so a pull request can only merge when both jobs pass.
- The README gets a CI badge in Spec 12.

## User Stories

1. As the project owner, I want the server test suite to run on every pull request, so that a broken route or service is caught before merging.
2. As the project owner, I want the client lint, tests and production build to run on every pull request, so that a change that breaks the build can't reach `main`.
3. As the project owner, I want the server and client checks to be separate jobs, so that I can see at a glance which side failed.
4. As the project owner, I want both jobs to run in parallel, so that a pull request is checked quickly.
5. As the project owner, I want CI to cache npm packages, so that repeat runs don't download every dependency again.
6. As the project owner, I want CI to cache the in-memory MongoDB binary, so that the server tests don't download `mongod` on every run.
7. As the project owner, I want CI to need no real secrets, so that it can run on any pull request safely and no key can leak through logs.
8. As the project owner, I want CI to make no calls to Gemini, YouTube or Auth0, so that runs are free, fast and not flaky.
9. As the project owner, I want CI to also run on pushes to `main`, so that the README badge reflects the code that is deployed.
10. As the project owner, I want a newer push to a branch to cancel the older run on it, so that I don't wait for results that are already out of date.
11. As the project owner, I want `main` to accept merges only when both jobs pass, so that `main` is always deployable.
12. As the project owner, I want a merge to `main` to also require the branch to be up to date with `main`, so that two pull requests that pass separately can't break `main` together.
13. As the project owner, I want both packages to pin the same Node major version, so that development, CI and production run the same runtime.
14. As the project owner, I want CI to read the Node version from the packages rather than repeat it in the workflow, so that there is one place to change it.
15. As the project owner, I want a failing CI run to show the failing test or lint message in the job log, so that I can fix it without reproducing it locally first.
16. As a developer reading the repository, I want the workflow in the standard GitHub Actions location, so that I find it where I expect.
17. As a judge, I want to see green checks on the merged pull requests, so that I can tell the project is tested automatically.

## Implementation Decisions

- **Node version:** both `server` and `client` package manifests declare the same `engines.node` major, the LTS version used locally. This lives in this branch, not the deployment branch, so CI uses it from the first run.
- **One workflow file** in the repository's GitHub workflows folder, named for CI. Triggers: `pull_request` targeting `main`, and `push` to `main`.
- **Job `server`** (`ubuntu-latest`), with the `server` folder as working directory:
  1. check out the repository
  2. set up Node from the `server` package's `engines`, with the npm cache keyed on the server lockfile
  3. restore and save a cache of the `mongodb-memory-server` binary directory, keyed on the server lockfile
  4. `npm ci`
  5. `npm test`.

  The Vitest config already sets dummy values for every required env var, so no secrets or `.env` file are needed.
- **Job `client`** (`ubuntu-latest`), with the `client` folder as working directory:
  1. check out the repository
  2. set up Node from the `client` package's `engines`, with the npm cache keyed on the client lockfile
  3. `npm ci`
  4. `npm run lint`
  5. `npm test`
  6. `npm run build`, with placeholder `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE` and `VITE_API_BASE_URL` values set as plain workflow env (the build only inlines them; nothing is called).
- The job names are exactly `server` and `client`, because branch protection refers to them by name.
- The two packages stay independent: no root `package.json`, no workspaces, each job runs inside its own folder.
- A concurrency group per workflow and branch, with cancel-in-progress, stops superseded runs.
- **Least privilege:** the workflow's token permission is read-only for contents. It uses no repository secrets and no third-party actions beyond the official checkout, setup-node and cache actions, pinned to a major version.
- **No deployment steps** in the workflow. Deployment uses Render's and Vercel's own Git integration (Spec 11).
- **Branch protection** (a manual GitHub setting the owner turns on once this branch is merged and the jobs have run at least once, so GitHub knows their names):
  - require a pull request before merging into `main`
  - require the `server` and `client` status checks to pass
  - require branches to be up to date before merging.

  Force pushes and deletion of `main` stay blocked. Approvals are not required, because it is a one-person project.
- CLAUDE.md gets a short note about the workflow and the pinned Node version under Commands.

## Testing Decisions

- No new unit tests. The pipeline only runs the existing suites: the server's Vitest + supertest + in-memory MongoDB tests, and the client's oxlint and Vitest tests (`pdfLayout`, `courseSteps`) plus the production build.
- **Verifying the workflow itself:**
  1. Open the pull request for this branch. Both `server` and `client` jobs run and pass.
  2. Re-run, or push again, and check the logs show the npm and MongoDB binary caches being restored.
  3. After merging and turning on branch protection, make a throwaway branch with a deliberately failing test, open a pull request, and check that the merge button is blocked and the failing test name is in the `server` job log. Close the pull request and delete the branch.
  4. Check the push to `main` after the merge also triggered a run.
- A good CI check fails for a real reason (a test, lint or build failure), never because of the environment (a missing secret, a network call, a different Node version). If a job fails only in CI, fix the environment, don't skip the check.

## Out of Scope

- Deploying from Actions (deploy hooks, Render or Vercel CLIs, repository secrets). Deployment is Spec 11.
- End-to-end browser tests, visual tests, coverage thresholds and coverage upload.
- Matrix builds across several Node versions or operating systems.
- Dependency audit, CodeQL, Dependabot or release automation.
- Required pull request approvals or CODEOWNERS.
- Any change to application code beyond the Node version pin.

## Further Notes

- The first branch (Spec 9) merges before this workflow exists. Run its checks by hand before merging it.
- If `mongodb-memory-server` needs a specific MongoDB version on Ubuntu runners, set it through that package's own config rather than in the workflow, so local and CI runs match.
- The badge for the README (Spec 12) uses this workflow's status on `main`.
