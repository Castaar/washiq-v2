---
name: Feature roadmap 2026-05
description: All 7 customer-requested features implemented in the May 2026 session
type: project
---

All 7 features from the customer feedback session implemented and building successfully.

**Why:** Customer wanted expanded employee management, product flexibility, and data visibility controls.

**How to apply:** When extending these features, follow the patterns below.

## Implemented features

1. **Onderhoud laatste beurt** — `POST /api/maintenance` now accepts `last_done_at` + `washes_at_last_done`; DeveloperPanel form has date input
2. **Toegangsbeheer medewerkers** — `CarwashPage` hides ConsumptionCards, ProgrammaCard chemie, VoorraadPanel, UsageToggle for `userRole === 'employee'`; employee quick-bar links to dagfiche/logboek/opdrachten/planning/incidenten
3. **Extra producten beheren** — Owner can add/delete ChemicalStock via `/instellingen` (InstellingenForm "Producten beheren" section); stock API now has auth guards
4. **Grafiek per product** — Recharts LineChart in `/historiek` (`ChemieChart` component); data from `WeeklyEntry.chemical_usages`; filterable by product
5. **Logboek aanwezigheid** — `AttendanceLog` model + `/api/attendance` + `/logboek` page; employees register arrival/departure; owner sees all
6. **Opdrachten** — `Opdracht` model + `/api/opdrachten` + `/opdrachten` page; owner creates tasks per day with optional employee assignment; employees see + check off their tasks
7. **Planning** — `Planning` model + `/api/planning` + `/planning` page; owner sees 7-day grid and adds shifts; employees see their own upcoming schedule

## New models added to lib/models/index.ts
- `AttendanceLog` — site_id, user_id, user_name, type (opening/sluiting), timestamp, note
- `Opdracht` — site_id, date, text, created_by, assigned_to_ids[], is_done, done_by_name
- `Planning` — site_id, user_id, user_name, date, start_time, end_time, note, created_by

## New routes added to proxy.ts
- `/logboek`, `/opdrachten`, `/planning` are accessible to all roles (employees included)
