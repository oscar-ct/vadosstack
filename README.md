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
PAYMENT_LINK_ENCRYPTION_KEY="A_DIFFERENT_LONG_RANDOM_SECRET"
PAYMENT_APPLICATION_FEE_BASIS_POINTS="0"
PAYMENT_APPLICATION_FEE_FIXED_CENTS="0"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_CONNECTED_ACCOUNT_COUNTRY="US"
```

`DATABASE_URL` is required by Prisma. `NEXT_PUBLIC_SITE_URL` is used for public metadata, sitemap, robots, and SEO URLs. In production, set it to the deployed domain.

Payment application fees default to zero. `PAYMENT_APPLICATION_FEE_BASIS_POINTS` sets the percentage in basis
points (`250` is 2.5%), while `PAYMENT_APPLICATION_FEE_FIXED_CENTS` adds an optional fixed amount in cents. A fee
configuration that is invalid or greater than the payment fails closed instead of creating a charge.

`PAYMENT_LINK_ENCRYPTION_KEY` encrypts recoverable customer payment-link tokens at rest. Production requires a dedicated,
stable value; changing it prevents staff from copying previously created links, although their one-way hashes continue
to validate links already shared with customers. Development and tests may fall back to `AUTH_SECRET`, then
`STRIPE_SECRET_KEY`.

`CRON_SECRET` protects scheduled maintenance routes. `/api/cron/payments` runs every ten minutes to retry durable Stripe
webhook events and reconcile recent Stripe payments with VadosStack's ledger.

Stripe uses one platform secret and one Connect webhook secret for the deployment. Each workspace stores only its
Stripe connected-account ID. Register `/api/webhooks/stripe` as a Connect webhook endpoint; never place an individual
company's Stripe secret key in VadosStack. Subscribe to `account.updated`, the four `checkout.session.*` events used by
Checkout, `charge.refunded`, `refund.created`, `refund.updated`, `refund.failed`, and the `charge.dispute.*` lifecycle
events.

Workspace onboarding uses full-dashboard Standard connected accounts and direct charges. The connected company is the
merchant of record, pays Stripe processing fees, and manages its Stripe account directly. VadosStack's application fee
remains independently configurable and defaults to zero.

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
- `/employee-portal` employee sign-in
- `/employee-portal/timesheet` employee timesheet

## Current Caveats

- Test coverage is not set up yet.
- Production dependency audit still reports a moderate Next/PostCSS advisory through Next's bundled dependency. Do not run `npm audit fix --force`; npm suggests an unsafe downgrade.
- Non-Geist font options are offline-safe CSS fallback stacks. For exact brand typography, self-host font files with `next/font/local`.
