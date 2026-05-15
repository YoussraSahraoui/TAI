# Contributing to the Timetabling AI

This document outlines the strict development workflow, team boundaries, and Git protocols required to contribute to this repository. 

## The Golden Rule
**The `main` branch is strictly protected.** No one is allowed to push directly to `main`. All changes must go through a feature branch and a reviewed Pull Request (PR).
"Do not push to main"
"Do not push to main"
"Do not push to main"

---

## Team Roles & Strict Boundaries

To prevent overlapping work, development tasks are evenly divided. You are only authorized to modify files within your assigned domain unless explicitly coordinated.

* **Lead Maintainer & Architect:** Owns `/src/core`. Resposible for:
- Defining the `State` interfaces and fitness function. and the final gatekeeper for all PRs merging into `main`.
* **Data & Testing Lead:** Owns `/src/data` and `/tests`. Responsible for: 
- Parsing the raw data into useable structures inside the core/engine model.
- Serializing results into representable data, for further demonstration and visulization.
- Implementing the testing scripts, to detect and report bugs and unexpected behavior
* **Algorithm Specialists (SA & Tabu):** Own `/src/algorithms`. Responsible for:
- Building pure math engines, the code must be completely agnostic to the context, and can interact *only* with the `State` interfaces defined by the Architect.
* **Visualization Specialist:** Owns `/src/visualization`. Responsible for:
Translating raw output logs into graphs, grid schedules and visual appealing dashboard or animations.
* **Demo & Integration Lead:** Owns the root execution files. Responsible for:
- Wiring the algorithms to the data and visualization tools.
- Implementing a professional interface (Terminal-based or Web-based app), that hanldes user interactions.

---

## Branching Strategy

When creating a new branch off `main`, use the following strict naming convention:
`[type]/[algorithm-or-domain]-[short-description]`

**Valid Types:**
* `feat/` (New features or logic)
* `fix/` (Bug fixes)
* `docs/` (Updating internal or external documentation)
* `test/` (Adding unit tests)

**Examples:**
* `feat/sa-cooling-schedule`
* `fix/data-csv-parser`
* `feat/core-fitness-interface`

---

## The Development Workflow

Follow this exact sequence to add code to the project. Do not skip steps.

### 1. Sync Your Local Machine
Always start by ensuring your local `main` branch is identical to the server.
```bash
git checkout main
git pull origin main
```
### 2. Isolate Your Work
Create your parallel workspace.
```bash
git checkout -b feat/your-feature-name
```
### 3. Write, Test, and Commit
Write your code within your domain. Once a logical chunk is complete, commit it with a clear, descriptive message.
```bash
git add [specific-files-changed]
git commit -m "Implement memory queue for Tabu Search local optima escape"
```
### 4. Rebase and Push
Before opening a PR, you must pull down any new changes the team has merged into main while you were working, and place your commits cleanly on top.
```bash
git pull --rebase origin main
git push -u origin feat/your-feature-name
```

## Pull Request (PR) Policy

Once your branch is pushed, open a Pull Request on GitHub. To get merged, your PR must meet these conditions:

- No Merge Conflicts: If there are conflicts, you must resolve them locally on your machine before the PR can be reviewed.

- Interface Integrity: Your changes must not break the calculate_fitness() or get_neighbors() interfaces established by the Architect.

- Mandatory Review: At least one other team member must review and approve your code.

- Maintainer Approval: Only the Lead Maintainer is authorized to click the "Merge" button to bring your code into main.