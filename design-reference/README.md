# Handoff: Dodane — Visual Identity & UI Redesign

## Overview
This package contains a new visual design system and UI redesign for Dodane, the multi-site carwash operations PWA (Ninove, Sint-Pieters-Leeuw, Edingen). It replaces the previous dark/glassmorphism visual style with a clean, light, high-clarity UI aimed at fast, low-friction use by non-technical staff on the floor and by owners/admins doing back-office work.

**The goal of this handoff: take the NEW visual design/UI patterns from this package and apply them to the EXISTING functional codebase** (routing, auth, data models, API calls, PWA/offline logic, role permissions, etc. all stay as they are — only the look, layout, and interaction patterns change).

## About the Design Files
The file `Dodane Operations Dashboard.dc.html` in this folder is a **design reference / interactive HTML prototype** — built to show layout, visual style, copy, and interaction behavior. It is **not production code to copy directly**. It uses a custom templating runtime (`support.js`) that only exists in the design tool — do not port that runtime into the app.

**The task is: recreate this design in the existing app's real environment** (whatever framework/stack the current functional Dodane codebase uses — e.g. React/Vue/Svelte + existing state management, existing API layer, existing auth/role guards) using the app's established patterns, component library, and data flow. Treat this HTML file purely as the source of truth for **visual design, layout, copy tone, and interaction/UX behavior** — the "old functional code" folder should be the source of truth for **data, business logic, routing, and integrations**.

Where the prototype's mock/dummy data (site names, staff names, stock %, alerts, etc.) doesn't match real data shapes in the existing codebase, use the existing data shapes and just apply the new visual treatment.

## Fidelity
**High-fidelity (hifi).** Colors, type sizes, spacing, corner radii, and component states below are final and should be recreated precisely. Where the prototype and the existing app's design tokens conflict, prefer the values below (this is the intended new design system).

## Design Direction Summary
- Light, "modern but friendly" aesthetic — moved away from dark glassmorphism to a bright neutral-warm-white UI with soft cards, generous corner radii, and restrained color use.
- One accent-forward blue for primary actions/links, with a small, consistent semantic palette for severity/status (green=good/low, amber=warning/medium, red=critical/high, purple used sparingly for people/avatars).
- Density: moderate (not sparse, not data-dense) — optimized for scanning on mobile while standing.
- Role-adaptive: the SAME screens restructure their content per role rather than routing to separate apps. Role is a first-class concept in every screen (see "Role-adaptive UI" below).
- Multi-site model is explicit everywhere a person or data could be site-scoped (see "Multi-site & site-switching" below) — this was a specific correction requested mid-project and should not be lost in re-implementation.

## Design Tokens

### Colors
- Background (app canvas / outer frame area): `#eceae4` (warm off-white, used only as the surrounding "desk" background in the prototype's phone-frame demo — the real app background is white)
- Surface / card background: `#ffffff`
- Card border: `#eeece7`
- Secondary surface (chips, inputs' resting bg, subtle sections): `#f4f3f0` / `#faf9f7`
- Input border: `#e7e5e0`
- Primary text: `#1b1d22`
- Secondary text: `#6b7280`
- Tertiary/muted text: `#8a8f98`
- Faint text (timestamps, disabled): `#b3b7bf`
- Primary accent (buttons, links, active states): `#3762e0`
  - Accent hover/active/dark: `#2949b3`
  - Accent tint background (banners, badges, active chip bg): `#eaf1ff`
  - Accent tint border: `#d7e3fd` / `#c7dafd`
- Purple (avatars/people): `#8b5cf6`, tint bg `#f2edfe`
- Teal/green (success, low/good severity, "in stock", clock-in): `#0f9a78`, tint bg `#e6f8f3`
- Amber (medium severity, warnings, approaching-due): `#b8790f` (text) / `#c98a1c`, tint bg `#fdf3e2`, tint border `#f5e0b3`
- Red (high severity, critical, destructive actions, overdue): `#d64545`, tint bg `#fdeaea`, tint border `#f7c9c9`
- Dark chrome (role-switcher demo bar only — not part of the shipped app; remove in production): `#1b1d22`

### Typography
- Font family: **Inter** (Google Fonts, weights 400/500/600/700/800)
- Scale used:
  - Page title: 18–20px / weight 800 / tight line-height (1.25) / slight negative letter-spacing on hero (-0.01em)
  - Section label (eyebrow): 12px / weight 700 / uppercase / letter-spacing 0.04em / color `#8a8f98`
  - Card title / row title: 12.5–13px / weight 600–700
  - Body/secondary: 11.5–12.5px / weight 500 / color `#6b7280` or `#8a8f98`
  - Micro (timestamps, hints): 10.5–11px / weight 500 / color `#b3b7bf`
  - Buttons: 12.5–14px / weight 700

### Spacing & Shape
- Base spacing rhythm: 4pt-ish scale, most gaps 8/10/12/16px
- Screen padding: 16–18px horizontal, 16px top, ~90px bottom (clears bottom nav)
- Card border-radius: 14–16px
- Pill/chip/button border-radius: 9–13px (fully rounded 100px for status pills, toggles, tab pills)
- Card shadow: `0 1px 2px rgba(20,20,30,0.03)` (very subtle — cards are mostly defined by the 1px border, not shadow)
- Modal/bottom-sheet shadow on open: standard sheet slide-up animation, rounded top corners 20px

### Severity / Status Semantics (used consistently everywhere: incidents, alerts, maintenance, tasks)
- Low → green (`#0f9a78` / `#e6f8f3`)
- Medium → amber (`#b8790f` / `#fdf3e2`)
- High → red (`#d64545` / `#fdeaea`)

## Role-Adaptive UI (critical behavior, not just route gating)
Four roles: `developer`, `owner`, `employee`, `technician`. The SAME dashboard screen changes its content per role:
- **Employee**: sees a check-in/out "Logboek" card (clock in/out button + status) + a horizontal quick-access pill bar (Dagfiche, Logboek, Opdrachten, Planning, Incidenten, Leveringen, Onderhoud, Diversen, Technieker) instead of the admin/owner panels.
- **Owner**: sees the full admin dashboard — announcement banner, period selector (week/month), consumption anomaly callout, tabbed alerts panel (Meldingen/Onderhoud/Incidenten), stock levels, wash-program cost breakdown with a "per liter" toggle.
- **Technician**: sees a single cross-site worklist of defects/damage/maintenance tasks assigned to them, each advanceable through a status (open → in progress → resolved), tagged with which site it belongs to.
- **Developer**: same as owner, plus an additional "Developer paneel" (superadmin) reachable from the "Meer" (more) sheet, with tabs for Sites / Gebruikers / Programma's / Voorraad / Onderhoud CRUD-style lists.

Implement this as **conditional content within one dashboard component**, keyed off the current user's role — not as a role → separate-page redirect. This preserves shared chrome (top bar, nav) while the body reflows per role.

## Multi-Site & Site-Switching (critical, explicitly requested)
The data model is: **one owner account → multiple carwash sites** (e.g. Ninove, Sint-Pieters-Leeuw, Edingen) **→ staff (employee/technician) assigned to one or more of that owner's sites.**

This must be visually explicit, not implicit:
- **Owner/Developer**: scoped to one site at a time via a site switcher in the top bar (tap site name next to "Dodane" wordmark → dropdown listing all of that owner's sites, tap to switch active site). Only shown as a dropdown when the role has >1 site; shown as plain static text when only one site exists.
- **Employee**: also site-scoped with the same switcher, but only shows the sites THAT SPECIFIC employee is assigned to (which may be a subset of the owner's full site list — e.g. an employee might work Ninove + Sint-Pieters-Leeuw but not Edingen).
- **Technician**: NOT site-scoped — technicians work cross-site by design, so instead of a switcher, the top bar shows all their assigned sites joined together with a "· cross-site" label, and their worklist (dashboard + dedicated Technieker screen) tags every task with its originating site name so it's clear at a glance which location each task belongs to.
- **Account screen**: the site's user list shows, per staff member, a "Werkt op: [site names]" line under their name — making per-user site assignment visible to owners managing the team, in addition to their role badge.
- **Developer panel → Sites tab**: lists all sites under this owner with user counts, plus a "+ Nieuwe site toevoegen" affordance that leads into the Setup Wizard for adding a new site.

When implementing against the real backend: the site switcher's options list should be driven by the real "which sites is this user assigned to" relation, not a hardcoded role→site-list map (the prototype hardcodes this per role purely for demo purposes).

## Screens Included in This Prototype
All screens live in one file, toggled via internal state (`screen` value) — a real app should route these normally.

1. **Dashboard** (role-adaptive home) — see above.
2. **Dagfiche (daily checklist)** — 8 fixed checklist rows (checkbox + inline remark text field), a "maintenance due today" checklist block, an inline defect-report sub-form (description + severity chips: low/medium/high) toggled open/closed, a running list of already-reported defects for the day, a live timeline of today's events, and a wash-count-today stat in the header.
3. **Wekelijkse Ingave (consumption entry form)** — grouped sections: tellerstanden (odometer/wash-counter, water, energy, salt, blob — required fields marked with `*` and validated on submit with inline red error text), per-program wash counts, per-chemical usage (all pre-filled from a "last entry" default), and an auto-flagged maintenance/stock warning banner when a threshold is crossed.
4. **Historiek (history)** — a simple SVG line chart of chemical usage over time + a list of past period entries with their costs.
5. **Incidenten (incident report)** — two tabs:
   - **Schade (damage)**: plate/vehicle/customer fields, severity chips, multi-select damage-location chip grid, "onze fout?"/"verzekering ingeschakeld?" toggles, free-text description, up to 5 photo slots (striped placeholder + remove button + add button), submit.
   - **EHBO (first aid)**: victim name, role radio (medewerker/klant), incident description, first-aider name, "dokter nodig?" toggle, single photo slot, submit.
6. **Account** — profile card, site's user list (with per-user site assignment, see above), energy bill history, logout.
7. **Developer paneel** — tabbed CRUD-style lists: Sites (with add-site → wizard), Gebruikers, Programma's, Voorraad, Onderhoud.
8. **Leveringen (deliveries)** — form to register a stock delivery (product/qty/supplier) that prepends to a recent-deliveries list.
9. **Logboek** — check-in/out attendance list, scoped by role (employee sees only their own row).
10. **Onderhoud (maintenance)** — task list with urgency badge (Te laat/Bijna/Op schema), due-label, mark-done action.
11. **Opdrachten (tasks/assignments)** — checkbox list of date-scoped tasks with assignee ("Iedereen" or a named person).
12. **Planning** — per-employee, per-week (3-week) shift schedule. Employee chips (+ "+ Medewerker toevoegen" inline add-form), week chips, and a day list where **tapping a day expands an inline editor** with a "vrije dag" (day off) toggle, start/end time pickers, and a notes field, saved with a "Klaar" button. This inline-edit pattern (tap row → expands in place → explicit save) is the model for making "add/edit" actions obvious to non-technical users — reuse it elsewhere admins need to edit scheduled/tabular data.
13. **Diversen (misc)** — birthdays list + announcement feed.
14. **Instellingen (settings)** — pricing config (per-liter, per-wash), per-stock-item threshold inputs, save button.
15. **Setup wizard** — 3-step first-run flow (site info → pricing → initial maintenance tasks) with a progress bar, back/next, and checkbox task list on the final step.
16. **Login** — email/password + site dropdown selector, centered card layout.
17. **Handleiding (manual)** — accordion list of help topics (tap title to expand/collapse body text).

## Interactions & Behavior
- **Alert detail modal**: tapping an alert/incident row in the dashboard's tabbed alerts panel opens a bottom sheet (slide-up animation) with full detail and a close button — no full-page navigation.
- **Dismissible alerts**: an `×` on each alert row removes it from view (session-only in the prototype; should be persisted, e.g. per-user localStorage or backend "dismissed" flag, in the real app).
- **"Meer" (more) sheet**: bottom nav's 4th icon opens a bottom-sheet grid/list of all remaining screens not pinned to the bottom nav (Historiek, Opdrachten, Diversen, Account, Instellingen, Handleiding, and — for developer role only — an extra "Developer paneel" entry).
- **Toasts**: transient bottom-center toast (auto-dismiss ~2.2s) confirms actions like "Ingave opgeslagen", "Melding verzonden", "Levering geregistreerd".
- **Price-per-liter toggle**: a switch on the wash-programs card re-renders each program row's value between total cost and cost-per-liter.
- **Severity chips**: single-select 3-way chip group (Laag/Midden/Hoog) used identically across defect reports, damage reports, and (implicitly) maintenance/alerts — reuse one component.
- **Toggles**: consistent pill-style on/off switches (fout?/verzekering?/dokter nodig?/vrije dag) — track background `#3762e0` on / `#e7e5e0` off, white 18–20px knob sliding via `left` offset.
- **Form validation**: required fields show a red border + small red helper text below on failed submit (e.g. Ingave's tellerstand/water, Schade's kenteken/locations, EHBO's naam, Login's fields). Validate on submit, not on blur, to avoid nagging.
- **Bottom nav**: 4 destinations — Dashboard (house icon), Ingave (invoice icon), Melden/incident (warning-triangle icon), Meer (three-dot icon) — all as inline SVG line icons that recolor (stroke + fill) to the accent color when active.
- **Photo upload placeholders**: 72×72px striped rounded squares (diagonal repeating-gradient placeholder) with a small `×` remove button and a filename/size caption; a dashed "+" tile to add more (max 5 for Schade, max 1 for EHBO). Real implementation needs actual camera/file input + client-side compression per the original spec.

## State Management (as prototyped — replace with real store/API in the app)
- `role`, `currentSite`, `siteSwitcherOpen` — identity/site context
- `screen` — current view
- `alertTab`, `dismissedAlerts`, `modalAlertId` — dashboard alerts panel
- `pricePerLiter`, `period` — dashboard toggles
- `techStatus` — per-task status map for technician worklist
- `checklist`, `remarks`, `maintChecks`, `defectFormOpen`, `defectDesc`, `defectSeverity`, `reportedDefects` — Dagfiche
- `ingave` object — consumption form fields + nested `programs`/`chemicals`/`errors`
- `incidentTab`, `schade` object, `ehbo` object — incident forms (each with its own `errors` map + `photos` array)
- `developerTab`, `deliveries`, `delivery`, `onderhoudDone`, `opdrachtenDone` — admin lists
- `planningEmployee`, `planningWeek`, `planningOverrides` (keyed by employee+week+day), `planningEmployeesExtra`, `addEmployeeOpen`, `newEmployeeName` — planning
- `settingsPricePerLiter`, `settingsPricePerWash` — settings
- `wizardStep`, `wizardSiteName`, `wizardAddress`, `wizardPricePerLiter`, `wizardPricePerWash`, `wizardTasks` — setup wizard
- `loginEmail`, `loginPassword`, `loginSite` — login
- `handleidingOpen` — manual accordion
- `toastMsg`/`toastVisible`, `meerOpen` — global UI chrome

All of the above are currently in-memory/mock only. In the real app, wire each section to its existing data source (API/store) instead — the shapes above are a guide to what each screen needs, not a schema to adopt verbatim.

## Assets
No external image assets — photo upload slots use a CSS striped-gradient placeholder (no real images). Icons are hand-drawn inline SVG (house, invoice/document, warning triangle, three-dot "more", dropdown chevron) — no icon font/library dependency. Font is loaded from Google Fonts (Inter).

## Files
- `Dodane Operations Dashboard.dc.html` — the full interactive prototype (design reference only, see above). Contains ALL 17 screens behind an internal role/screen switcher (visible in a dev-only dark "Bekijk als" role-switcher bar — strip that bar from production).
- `support.js` — the prototyping tool's runtime, required only to preview the `.dc.html` file locally in a browser. **Do not port this into the app.**
