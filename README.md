# Wedding HQ

Wedding HQ is a private, multi-user wedding planning CRM for a March 2027 wedding. Phase 1 includes Supabase authentication, a complete multi-wedding PostgreSQL schema, Row Level Security, the operational dashboard, guest and household management, CSV import/export, a public RSVP flow, an administrative RSVP inbox, activity history, and wedding settings. Phase 2 adds the drag-and-drop seating planner, budget and payment tracking, supplier management, and dedicated entertainment schedules. Phase 3 adds seven linked timeline views, complete task management, and the private document library. Phase 4 completes the product with music, photography, accommodation, transport, gifts, and live operational exports.

The schema already includes the normalised foundations for Tables, Budget, Suppliers, Entertainment, Timeline, Tasks, Documents, Music, Photography, Accommodation, Transport, and Gifts so later phases can be added without restructuring Phase 1 data.

## Local setup

Requirements: Node.js 20 or later, npm, a free Supabase project, and optionally the Supabase CLI.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add the Project URL and publishable/anon key from **Supabase → Project Settings → API**.
4. Apply the database migration described below.
5. Create the first administrator.
6. Start the app with `npm run dev` and visit `http://localhost:3000`.

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=
```

Only the Supabase publishable/anon key belongs in the application. Never add `SUPABASE_SERVICE_ROLE_KEY` to a `NEXT_PUBLIC_` variable or expose it to the browser. Wedding HQ does not need a service-role key at runtime.

For production, set `NEXT_PUBLIC_SITE_URL` to the final `https://...vercel.app` or custom domain URL. Add the same URL under **Supabase → Authentication → URL Configuration**, with `/**` as an allowed redirect path.

## Supabase setup and migrations

The migration at `supabase/migrations/202608050001_initial_schema.sql` creates:

- all application tables, foreign keys, indexes, checks, generated outstanding balances, and timestamp triggers;
- private per-wedding access policies for authenticated members;
- restricted public RSVP lookup and submission functions;
- the private `wedding-documents` Storage bucket and its member policies;
- automatic profile creation for new Supabase Auth users;
- automatic owner membership when the first wedding workspace is created.

With the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Without the CLI, open **Supabase → SQL Editor**, paste the migration file, and run it once. Apply future migration files in filename order. Do not edit a migration after it has been applied to production; add a new one.

## Create the first two administrators

1. In **Supabase → Authentication → Users**, create the first user with an email and password.
2. Sign in to Wedding HQ. The first-time screen creates the wedding; the database trigger makes that account the owner.
3. Create the second Auth user in Supabase.
4. In the SQL Editor, replace the email below and run:

```sql
insert into public.wedding_users (wedding_id, user_id, role)
select w.id, u.id, 'admin'
from public.weddings w
cross join auth.users u
where u.email = 'second-admin@example.com'
  and not exists (
    select 1 from public.wedding_users wu
    where wu.wedding_id = w.id and wu.user_id = u.id
  );
```

The database supports `owner`, `admin`, `planner`, and `viewer` roles and any number of future users. All application reads and writes remain constrained by wedding membership through Row Level Security.

## Running locally

```bash
npm run dev
```

Useful checks before a release:

```bash
npm run build
npm run lint
```

If the login screen says Supabase is not configured, check the environment variables for the current deployment and redeploy after correcting them.

## Deploying to Vercel

1. Import the repository into Vercel as a Next.js project.
2. Add all three environment variables from `.env.example` under **Project Settings → Environment Variables**.
3. Set `NEXT_PUBLIC_SITE_URL` to the production URL and deploy.
4. Add that production URL and `/auth/callback` to the allowed redirects in Supabase Authentication.
5. Keep the Supabase service-role key out of Vercel; the app uses authenticated RLS and restricted public database functions.

The project uses the Next.js App Router and needs no Vercel-specific paid feature.

## Connect the public RSVP form

The hosted form is available at:

```text
https://your-domain.example/rsvp
```

Each household receives a unique code displayed under **Guests → Manage households**. A wedding website can link directly to `/rsvp`.

For a custom external form, use these JSON endpoints:

- `GET /api/rsvp/{INVITATION_CODE}` returns the household, named guests, and active meal choices.
- `POST /api/rsvp` submits individual responses and creates an immutable inbox/history record.

Example submission:

```json
{
  "code": "AB12CD34EF56",
  "responses": [
    {
      "guest_id": "guest-uuid-from-lookup",
      "attending": true,
      "meal_option_id": "meal-option-uuid-or-empty-string",
      "dietary_requirements": "Vegetarian",
      "accessibility_requirements": "",
      "plus_one_name": "",
      "accommodation_required": false,
      "transport_required": true
    }
  ],
  "song_request": "A favourite song",
  "message": "We cannot wait!"
}
```

The endpoints never expose administrator credentials. The database functions validate that each submitted guest belongs to the invitation code’s household.

## CSV import and export

Guest import accepts UTF-8 CSV files exported from Excel, Numbers, or Google Sheets. It recognises both technical and natural column headings, including `First Name` / `Surname` or a single `Guest Name` column. Optional household, contact, invitation, RSVP, plus-one, dietary, allergy, accessibility, accommodation, transport, VIP, highchair, and private-note fields are supported. Household records are created automatically and duplicate guests are skipped safely. A ready-to-use template is available from the Guests page.

Export from the Guests page downloads all operational guest fields, including household and table assignment.

## Backup and recovery

Use both of these regularly:

1. **Operational export:** download the guest CSV from Wedding HQ and save copies of critical documents from the private Storage bucket.
2. **Database backup:** use Supabase’s database backup features where available, or run a local logical backup with the connection string from **Project Settings → Database**:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > wedding-hq-$(date +%Y-%m-%d).dump
```

Store backups encrypted and outside the application repository because they contain private guest information. Test restoration into a separate Supabase project before relying on a backup. Supabase Storage files are separate from PostgreSQL and must be backed up independently.

## Security notes

- Administrative routes refresh and verify the Supabase user session on the server.
- Every wedding-owned table includes `wedding_id` and has RLS enabled.
- Browser requests use only the public anon key; permissions come from the signed-in user’s JWT and wedding membership.
- Public RSVP functions reveal only invitation-safe fields, validate household ownership, and never accept a wedding ID from the submitter.
- The documents bucket is private and paths begin with the wedding ID, allowing storage policies to enforce membership.
- The app sends `noindex` metadata because Wedding HQ is a private operational system.
