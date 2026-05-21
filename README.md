# VadosStack

VadosStack is a Next.js app for service businesses and contractors. It combines customer management, jobs, estimates, invoices, service templates, company settings, and employee time tracking into one dashboard, with a separate lightweight employee time portal.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma with PostgreSQL
- Tailwind CSS v4
- Base UI / shadcn-style components
- Biome for linting and formatting

## Requirements

- Node.js `>=20.17`
- npm
- PostgreSQL database

## Environment

Create a local `.env` file:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
GOOGLE_TOKEN_ENCRYPTION_KEY="A_LONG_RANDOM_SECRET"
```

`DATABASE_URL` is required by Prisma. `NEXT_PUBLIC_SITE_URL` is used for public metadata, sitemap, robots, and SEO URLs. In production, set it to the deployed domain.

For Google sign-in, create an OAuth 2.0 Client ID in Google Cloud and add this authorized redirect URI for local development:

```text
http://localhost:3000/api/auth/google/callback
http://localhost:3000/api/auth/google/mail/callback
```

The first callback is for Google sign-in. The second callback is for Gmail invoice sending and requires the Gmail API `gmail.send` scope. `GOOGLE_TOKEN_ENCRYPTION_KEY` is used to encrypt stored Gmail refresh tokens.

If production is behind a proxy or needs a different callback than `NEXT_PUBLIC_SITE_URL`, set `GOOGLE_REDIRECT_URI` and `GOOGLE_MAIL_REDIRECT_URI` explicitly.

## Local Setup

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Database

Prisma migrations live in `prisma/migrations`.

For a new empty database:

```bash
npm run db:deploy
```

For local schema work:

```bash
npm run db:migrate
```

For an existing database that was previously created by the old setup scripts, mark the baseline migration as already applied before deploying migrations:

```bash
npx prisma migrate resolve --applied 20260520000000_init
npm run db:deploy
```

The follow-up migration `20260520001000_drop_dead_customer_history` removes legacy customer history tables if they exist.

## Scripts

```bash
npm run dev          # Start local dev server
npm run build        # Production build using webpack
npm run start        # Start built app
npm run lint         # Run Biome lint
npm run typecheck    # Generate Next route types and run TypeScript
npm run check        # Run Biome check
npm run check:fix    # Run Biome check with fixes
npm run format       # Format files with Biome
npm run db:generate  # Generate Prisma Client
npm run db:migrate   # Create/apply local Prisma migrations
npm run db:deploy    # Apply migrations in production
npm run db:studio    # Open Prisma Studio
```

There are also legacy setup and seed scripts. Prefer Prisma migrations for schema changes going forward.

## Production Notes

- Use `npm run db:deploy` during deployment before starting the app.
- Use `npm run build` for production builds.
- The build script intentionally uses `next build --webpack`. Turbopack currently has project-root/build behavior that is not reliable enough for this app.
- `.env` is ignored by git. Keep secrets in the hosting provider environment.
- The app stores auth sessions in the `sessions` table with HTTP-only cookies.

## Main Routes

- `/` public marketing page
- `/login` and `/register` account access
- `/dashboard/overview` main dashboard
- `/dashboard/customers`
- `/dashboard/jobs`
- `/dashboard/estimates`
- `/dashboard/invoices`
- `/dashboard/services`
- `/dashboard/time-tracking`
- `/employee-time-tracking` employee portal

## Current Caveats

- Test coverage is not set up yet.
- Production dependency audit still reports a moderate Next/PostCSS advisory through Next's bundled dependency. Do not run `npm audit fix --force`; npm suggests an unsafe downgrade.
- Non-Geist font options are offline-safe CSS fallback stacks. For exact brand typography, self-host font files with `next/font/local`.
