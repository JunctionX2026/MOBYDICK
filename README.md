![Swish](apps/web/public/brand/swish-logo-horizontal.svg)

<br/>

**JunctionX Korea 2026 · Team 44 MOBYDICK · Microsoft Track**

Swish is a public-data workflow service that discovers scattered Gyeongsangbuk-do datasets, connects them, and serves the results through APIs and MCP.

<br/>

## Background

Using public data in a real service requires teams to repeat dataset discovery, access requests, API key issuance, and format validation for every source. Regional names and administrative codes are inconsistent, while time and measurement units differ across datasets. These differences can cause silent data loss and invalid joins. Even after an analysis is complete, turning it into a reusable API or MCP server requires additional work.

<br/>

## Solution

Swish connects discovery, composition, and deployment as one sequential pipeline.

| Stage | What Swish does | Result |
| --- | --- | --- |
| **Discover** | Recommends relevant datasets and columns from a user's question. | Dataset and join candidates |
| **Compose** | Connects data on a visual canvas and runs regional-code normalization, joins, and transformations. | Step-level row counts, null rates, match rates, and exclusion reasons |
| **Serve** | Deploys a validated workflow snapshot. | Reusable REST API and MCP endpoints |

AI proposes only a declarative `OperationSpec`; it never produces code for execution. Deterministic, validated code performs the computation, and quality issues such as sharp row-count drops or low match rates become visible stop signals.

<br/>

## Expected Impact

- Reduce the time from a question to usable public datasets.
- Safely connect sources with inconsistent regional names and codes.
- Make intermediate results and exclusion reasons visible for direct quality review.
- Turn completed analyses into reusable APIs and MCP tools for recurring work and AI workflows.
- Expand the practical use of public data across Gyeongsangbuk-do and encourage more regional data-driven services.

<br/>

## Tech Stack

| Area | Technology | Role |
| --- | --- | --- |
| Web | Next.js App Router, React, TypeScript, Tailwind CSS | Project management and the workflow canvas |
| API | GraphQL, Relay | Project and workflow state access |
| Data | FastAPI, DuckDB | Public-data discovery, joins, and transformations |
| AI | OpenAI Responses API, Structured Outputs | Conversion of user questions into validated declarative specs |
| Infrastructure | Cloudflare Workers, Containers, D1 | Web runtime, data runtime, and project storage |
| Tooling | pnpm workspace, Vitest | Monorepo dependency management and contract testing |

```text
Question → Dataset discovery → Workflow composition and validation → REST API / MCP
           FastAPI + DuckDB    Next.js canvas                      Cloudflare
```

<br/>

## Local Development

Node.js 22 or later and pnpm are required. See the [local development guide](docs/LOCAL_DEVELOPMENT.md) for GovData runtime setup.

```bash
pnpm install
pnpm dev
```

Run the full verification suite with:

```bash
pnpm verify
```

See the [spec index](specs/README.md) for product contracts and the [documentation guide](docs/README.md) for repository navigation.

<br/>

## Team

| Role | Name |
| --- | --- |
| Team Lead | Myeongheon Choi |
| Team Member | Youngmin Kang |
| Team Member | Hak Lee |
