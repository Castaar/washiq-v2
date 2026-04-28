# Dodane — Carwash Inventory Suite

Next.js 15 PWA for managing carwash operations (stock, consumption, incidents, maintenance). UI is in Dutch (Flemish). Backend is MongoDB via Mongoose.

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run lint     # ESLint

node scripts/seed.mjs          # seed database with 3 sites + demo users
node scripts/cleanup-collections.mjs  # drop all collections
```

## Environment variables (`.env.local`)

| Variable                       | Purpose                               |
| ------------------------------ | ------------------------------------- |
| `MONGODB_URI`                  | MongoDB Atlas connection string       |
| `SESSION_SECRET`               | 32+ char secret for JWT signing       |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push VAPID public key             |
| `VAPID_PRIVATE_KEY`            | Web Push VAPID private key            |
| `VAPID_SUBJECT`                | Web Push contact email (`mailto:...`) |

## Architecture

### Auth & sessions

- Custom JWT auth via `jose` — no NextAuth or external library.
- Session stored in an `httpOnly` cookie named `dodane_session` (7-day expiry).
- `lib/session.ts` — sign, verify, read session from cookie or `NextRequest`.
- `proxy.ts` — runs on every request; redirects unauthenticated users to `/login` and enforces role-based page access.

### Role system

Three roles enforced in both `proxy.ts` and individual API routes:

| Role        | Access                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `developer` | All pages including `/developer`                                                                          |
| `owner`     | All pages except `/developer`                                                                             |
| `employee`  | `/dagfiche` and `/incidenten` only; redirected away from `/wekelijkse-ingave`, `/historiek`, `/developer` |

### Database

- MongoDB Atlas, Mongoose ODM.
- Connection singleton in `lib/db/mongoose.ts` (global cache survives hot-reloads).
- All 14 models defined in a single file: `lib/models/index.ts`.

**Models:** `Site`, `User`, `PriceConfig`, `WashProgram`, `WeeklyEntry`, `ChemicalStock`, `StockDelivery`, `MaintenanceTask`, `MaintenanceLog`, `DailyChecklist`, `IncidentSchade`, `IncidentEhbo`, `Defect`, `PushSubscription`

### PWA & push notifications

- Service worker registered via `components/layout/PwaRegister.tsx` (`public/sw.js`).
- Web Push via `web-push` library; VAPID keys in `.env.local`.
- Push subscription stored in DB (`PushSubscription` model); subscription endpoint is `POST /api/push/subscribe`.
- Push helpers in `lib/push.ts`.

## Project structure

```
app/
  layout.tsx                  # root layout — registers PWA + push, loads Inter font
  page.tsx                    # dashboard (/)
  login/                      # public login page
  dagfiche/                   # daily checklist (employee + owner)
  wekelijkse-ingave/          # weekly consumption entry (owner only)
  historiek/                  # history of weekly entries (owner only)
  incidenten/                 # incident overview; sub-routes: /ehbo, /schade
  account/                    # account settings
  developer/                  # dev tools (developer role only)
  api/
    auth/login|logout         # session cookie set/clear
    dashboard                 # aggregated dashboard data
    dagfiche                  # submit daily checklist
    weekly-entry/[id]         # CRUD weekly entries
    sites/[id]                # CRUD sites
    users/[id]                # CRUD users
    programs/[id]             # CRUD wash programs
    stock/[id]                # CRUD chemical stock
    maintenance/[id]          # CRUD maintenance tasks
    incidents/ + schade|ehbo|defect  # incident reporting
    ranking                   # wash count rankings
    push/subscribe            # register push subscription
    account                   # update own account

components/
  layout/     # AppShell, NavBar, Sidebar, TopBar, PushSetup, PwaRegister
  dashboard/  # all dashboard cards, panels, and modals
  forms/      # DagficheForm, WeeklyEntryForm, HistoryList
  incidenten/ # IncidentenPanel, EhboForm, SchadeForm
  account/    # AccountForm
  auth/       # LoginForm
  developer/  # DeveloperPanel
  ui/         # Button, Card, Badge, IconWrapper, icons

lib/
  session.ts          # JWT sign/verify/cookie helpers
  db/mongoose.ts      # DB connection singleton
  models/index.ts     # all Mongoose schemas + interfaces
  types/dashboard.ts  # shared TS types (payloads, AlertItem, etc.)
  push.ts             # web-push helpers
  mock-data/          # static mock data for development

styles/
  globals.scss        # entry point, imports partials
  _variables.scss     # design tokens
  _typography.scss    # font scale
  _reset.scss         # CSS reset

scripts/
  seed.mjs            # seeds 3 sites, 5 wash programs each, demo users
  cleanup-collections.mjs  # drops all collections
```

## Conventions

- **Path alias:** `@/` maps to the project root.
- **SCSS Modules:** every component co-locates a `.module.scss` file — no CSS-in-JS.
- **SASS globals:** `styles/` is in `includePaths`; partials can be imported without a path prefix.
- **API routes:** always call `dbConnect()` before touching models; always re-verify session with `getSession()` inside the handler (don't rely on proxy alone).
- **Models file:** add new Mongoose models to `lib/models/index.ts`, not separate files.
- **Types:** shared dashboard-related interfaces live in `lib/types/dashboard.ts`.

## Seed / demo credentials

| Role               | Email                        | Password      |
| ------------------ | ---------------------------- | ------------- |
| developer          | alec@castaar.com             | Cas#Dev@2026! |
| owner              | owner@dodane.be              | wachtwoord123 |
| employee (Ninove)  | medewerker.ninove@dodane.be  | wachtwoord123 |
| employee (SPL)     | medewerker.spl@dodane.be     | wachtwoord123 |
| employee (Edingen) | medewerker.edingen@dodane.be | wachtwoord123 |

Sites: **Dodane Ninove**, **Dodane Sint-Pieters-Leeuw**, **Dodane Edingen**
