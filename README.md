# Rehearsal

Review working HTML prototypes together, with the edits made by each person's own AI agent. See [PLAN.md](PLAN.md) for what it is and where it's going.

## Running it locally

```bash
pnpm install
vercel env pull .env.local   # Clerk, Neon and TOKEN_SECRET
pnpm dev
```

Open http://localhost:3000.

## What's in `.env.local`

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Sign-in and teams (Clerk) |
| `DATABASE_URL` | Projects and connections (Neon Postgres) |
| `TOKEN_SECRET` | Encrypting stored GitHub tokens and signing prototype view links |

## Database changes

Edit `src/db/schema.ts`, then:

```bash
npx dotenv -e .env.local -- npx drizzle-kit push
```

## How a prototype is shown

Files live in the team's own GitHub repository. The viewer asks GitHub for the files at a given commit and serves them from `/view/<grant>/<commit>/<file>`, where the grant is a short-lived signed permission for one project. The prototype runs in a sandboxed frame with a small helper script added, which reports the element under the pointer back to the app.

## Connecting an agent

Open **Connect your agent** in the app, create a token, and paste the command it shows into your agent. The MCP server lives at `/api/mcp`; tokens are `rh_…` strings and only their hash is stored.
