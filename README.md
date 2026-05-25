# GigToGo

Astro app for worker and business shift matching.

## Supabase Setup

1. Create a Supabase project.
2. In Supabase, open **SQL Editor** and run the contents of `supabase-schema.sql`.
3. Go to **Project Settings > API** and copy:
   - Project URL
   - anon public key
4. Create a local `.env` file using `.env.example`:

```sh
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

5. In Supabase Auth settings, for easiest local testing, disable email confirmation. Otherwise register will create the user, then ask them to confirm by email before login.
6. Run the app:

```sh
npm run dev
```

Useful test flow:

1. Register a business account.
2. Log in as that business and create a shift.
3. Log out.
4. Register a worker account.
5. Apply to the shift from `/worker/shifts`.
6. Log back into the business account and accept or reject the applicant in `/business/applications`.

## Commands

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |
