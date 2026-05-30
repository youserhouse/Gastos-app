# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Modo de trabajo
- Siempre trabajar directamente en la rama `main`
- NO crear ramas nuevas
- NO crear Pull Requests
- Hacer commit y push directo a `main` después de cada tarea

## What This App Is

Gastos-app is a **vanilla JavaScript PWA** for couples to track shared expenses with real-time cloud sync. No build system, no npm — static files served directly. Language throughout is **Spanish** (UI labels, categories, variable names).

## Running the App

No build step required. Serve the root directory with any static file server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Open `http://localhost:8080`. There are no tests or lint commands.

## Architecture

### Single-file structure
- `index.html` — All UI markup (6 panels as `<section>` elements)
- `app.js` — All logic (~1,465 lines, no modules)
- `styles.css` — Styles with CSS variables for theming
- `sw.js` — Service Worker for offline/PWA caching

### State management
One global `state` object is the single source of truth. It's loaded from `localStorage` (`gp_data`) at startup and persisted on every mutation via `save()`, which writes to localStorage and calls `cloudSave()` if the user is authenticated.

Real-time sync uses a Firestore `onSnapshot()` listener on a single shared document. When a cloud update arrives, local state is replaced and all panels are re-rendered.

### Data persistence layers
1. **localStorage** — always present, key `gp_data`
2. **Firebase Firestore** — optional, enabled after Google login. Collection: `parejas`, document: `shared`. Fields: `gastos`, `ingresos`, `presupuestos`, `cats`, `config`.

### Expense data model
```javascript
{
  id: uid(),           // timestamp-based unique ID
  date: "YYYY-MM-DD",
  store: "...",        // merchant name
  cat: "Categoría",   // must match a category in state.cats
  amt: 0.00,           // amount in EUR
  payer: "P1/P2",      // person identifier from state.config
  type: "variable",    // "variable" | "fija" (recurring fixed)
  desc: "..."          // optional description
}
```

### Claude API integration (receipt scanner)
The app calls the Anthropic API **directly from the browser** using a key the user enters in Settings. The key is stored in `localStorage`. The model is `claude-sonnet-4-5`. See `SECURITY.md` — this is a known client-side exposure risk.

### Firebase config
Firebase credentials are hardcoded in `app.js` (project: `gastos-pareja-app`). The keys are domain-restricted and intended to be public-facing (Firebase's standard browser-client pattern). See `SECURITY.md` for details.

## Key Conventions

- **UI panels** are identified by `data-panel` attributes and toggled by `showPanel(name)`.
- **Modal editing** is used for expenses, income, budgets, and categories.
- **Toast notifications** via `showToast(msg)` for user feedback.
- **Default categories** (10): Alimentación, Restaurante, Vivienda, Transporte, Salud, Ocio, Ropa, Facturas, Electrónica, Otros — these are the fallback if `state.cats` is empty.
- **CSV format** uses prefixed rows (`META`, `CONFIG`, `CATEGORIA`, `GASTO`, `INGRESO`, `PRESUPUESTO`) for import/export.
- **Theme** stored in `localStorage` key `gp_theme` (`dark` | `light`), toggled via CSS variables on `:root`.
- All monetary amounts are treated as **EUR**.
