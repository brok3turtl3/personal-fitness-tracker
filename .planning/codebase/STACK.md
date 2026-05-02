# Technology Stack

**Analysis Date:** 2026-05-02

## Languages

**Primary:**
- TypeScript ~5.5.2 — All Angular application source under `src/app/` (components, services, models, tests). Strict mode enabled (`tsconfig.json`).
- JavaScript (CommonJS) — Electron main and preload scripts (`electron/main.js`, `electron/preload.js`).

**Secondary:**
- HTML — Angular component templates (`src/index.html`, `src/app/app.component.html`, inline templates in standalone components).
- CSS — Global styles (`src/styles.css`), per-component styles (`src/app/app.component.css`, inline `styles: [...]` arrays in standalone components).
- JSON — Configuration (`angular.json`, `package.json`, `tsconfig*.json`) and the `package.json` import in `src/app/shared/nav.component.ts` (enabled by `resolveJsonModule: true`).

## Runtime

**Environment:**
- Browser runtime (Chromium-based) — Application is a single-page Angular app served at `http://localhost:4200/` in development.
- Electron 33.x (desktop runtime) — `electron/main.js` wraps the production Angular bundle in a `BrowserWindow` (1200x800) loading `dist/personal-fitness-tracker/browser/index.html`. Context isolation on, node integration off.
- Node.js — Required for the toolchain (Angular CLI, Electron build). No runtime Node usage in the browser app.
- `zone.js` ~0.14.10 — Angular change detection polyfill (configured in `angular.json` `polyfills` and `tsconfig.app.json`).

**Package Manager:**
- npm — Lockfile present at `package-lock.json` (635 KB). No `pnpm-lock.yaml` or `yarn.lock`.

## Frameworks

**Core:**
- Angular 18.2.x — Standalone components only (no NgModules). Bootstrapped via `bootstrapApplication()` in `src/main.ts` with `appConfig` from `src/app/app.config.ts`. Uses `provideRouter(routes, withHashLocation())` for hash-based routing (Electron-friendly: avoids `file://` path-rewrite issues).
- Angular Router (`@angular/router` ^18.2.0) — Lazy-loaded routes in `src/app/app.routes.ts` (one `loadComponent` per feature page).
- Angular Reactive Forms (`@angular/forms` ^18.2.0) — `ReactiveFormsModule` in entry/edit forms (cardio, weight, readings, diet, charts, settings); `FormsModule` only in `src/app/features/chat/chat-input.component.ts`.
- RxJS ~7.8.0 — Pervasive use of `Observable`, `map`, `switchMap`, `of`, `throwError`, `from`, `forkJoin` across all services. Async pipe pattern in templates.

**Testing:**
- Jasmine ~5.2 (`jasmine-core`, `@types/jasmine` ~5.1) — Test framework.
- Karma ~6.4 — Test runner (`karma`, `karma-chrome-launcher`, `karma-coverage`, `karma-jasmine`, `karma-jasmine-html-reporter`).
- Builder: `@angular-devkit/build-angular:karma` (configured in `angular.json` `architect.test`).
- 12 `.spec.ts` files in `src/app/` (services, validators, app component, shared utilities).

**Build/Dev:**
- Angular CLI ^18.2.21 (`@angular/cli`, `@angular-devkit/build-angular`) — Builder is `@angular-devkit/build-angular:application` (Esbuild-based application builder, not Webpack-based browser builder).
- TypeScript ~5.5.2 — Compiler with strict mode (`strict: true`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`).
- Angular Compiler — Strict template checking (`strictTemplates: true`, `strictInjectionParameters: true`, `strictInputAccessModifiers: true`).
- electron-builder ^25.0.0 — Packaging for Windows (NSIS) and macOS (DMG); auto-publishes to GitHub releases (`build.publish` block in `package.json`). Existing Linux artifacts in `release/` (AppImage, snap) suggest Linux target was used historically.

## Key Dependencies

**Critical:**
- `@angular/animations` ^18.2.0 — Bundled with Angular core (no direct usage detected in source).
- `@angular/cdk` ^18.2.14 — Component Dev Kit (no direct imports detected; available for future a11y/overlay/portal use).
- `@angular/common` ^18.2.0 — `CommonModule` imported in every standalone feature page for `*ngIf`/`*ngFor`/`async` pipes.
- `@angular/compiler` ^18.2.0, `@angular/compiler-cli` ^18.2.0 — Template compilation (compiler-cli is dev-only).
- `@angular/core` ^18.2.0 — `Component`, `Injectable`, `ApplicationConfig`, `provideZoneChangeDetection`.
- `@angular/forms` ^18.2.0 — Reactive forms in feature pages, template-driven forms only in chat input.
- `@angular/platform-browser` ^18.2.0, `@angular/platform-browser-dynamic` ^18.2.0 — Bootstrap target.
- `@angular/router` ^18.2.0 — Hash-based routing with lazy `loadComponent` definitions.
- `chart.js` ^4.5.1 — Chart engine. Used via `ng2-charts` directive in `src/app/features/charts/charts-page.component.ts` and `src/app/features/reports/report-page.component.ts` (imports `ChartConfiguration`, `ChartData` types).
- `ng2-charts` ^7.0.0 — Angular wrapper around chart.js. `provideCharts(withDefaultRegisterables())` in `src/app/app.config.ts`; `BaseChartDirective` used in chart components.
- `rxjs` ~7.8.0 — Reactive programming primitives across services.
- `tslib` ^2.3.0 — TypeScript runtime helpers (`importHelpers: true` in `tsconfig.json`).
- `zone.js` ~0.14.10 — Change detection (declared in `angular.json` `polyfills`).

**Infrastructure:**
- `electron` ^33.0.0 (devDependency) — Desktop runtime.
- `electron-builder` ^25.0.0 (devDependency) — Distributable packaging and GitHub release publisher.
- `electron-updater` ^6.1.0 (runtime dependency) — Auto-update on launch via `autoUpdater.checkForUpdatesAndNotify()` in `electron/main.js`.
- `puppeteer` ^24.37.3 (devDependency) — Listed but no usage detected in `src/` or `electron/`. Likely a Karma/headless-Chrome aid; treat as unused candidate.

## Configuration

**Environment:**
- No runtime environment-variable injection. The Angular app reads no `.env` file at build or run time.
- AI API key (Anthropic) is stored client-side in LocalStorage via `AISettingsService` (`src/app/services/ai-settings.service.ts`); user supplies it on the `/settings` page. There is no server, no env var, and no build-time secret.
- `.gitignore` declares `.env`, `.env.local`, `.env.*.local` as ignored, but no such files exist in the repo.
- Angular CLI analytics disabled (`angular.json` `cli.analytics: false`).

**Build:**
- `angular.json` — Build, serve, and test targets. Production build adds output hashing and budgets (initial bundle warn 500 kB / error 1 MB; per-component style warn 2 kB / error 4 kB). Default configuration is `production`.
- `tsconfig.json` — Root TS config (target ES2022, module ES2022, `moduleResolution: "bundler"`, lib `["ES2022", "dom"]`).
- `tsconfig.app.json` — App build (extends root, entry `src/main.ts`).
- `tsconfig.spec.json` — Test build (extends root, includes `src/**/*.spec.ts`, types `["jasmine"]`).
- `.editorconfig` — UTF-8, 2-space indent, single quotes for `*.ts`.
- `electron-builder` config block in `package.json`:
  - `appId: com.personal-fitness-tracker.app`
  - `productName: Personal Fitness Tracker`
  - Files included: `dist/personal-fitness-tracker/browser/**/*` and `electron/**/*`
  - Windows target: NSIS; macOS target: DMG
  - Publish: GitHub provider, owner `brok3turtl3`, repo `personal-fitness-tracker`, releaseType `release`

## Platform Requirements

**Development:**
- Node.js + npm (version not pinned; no `.nvmrc`, no `engines` field in `package.json`).
- Angular CLI 18.2.x (`ng` available via `npm run ng`).
- Chromium browser for Karma tests (`karma-chrome-launcher`).
- Commands (from `CLAUDE.md` and `package.json`):
  - `ng serve` — dev server at `http://localhost:4200`
  - `ng test` — watch-mode unit tests
  - `ng test --no-watch` — single-run for CI
  - `ng test --no-watch --code-coverage` — with coverage
  - `ng build --configuration=production` — production build
  - `npm run electron:dev` — production-build Angular and launch Electron
  - `npm run electron:build` — production-build Angular and package via electron-builder
  - `npm run electron:publish` — build and publish to GitHub releases

**Production:**
- Static-file deployment of `dist/personal-fitness-tracker/browser/` (single-page app, hash routing, no server-side rendering).
- Electron desktop distributables produced by electron-builder targeting Windows (NSIS installer) and macOS (DMG); historical Linux AppImage and snap artifacts present under `release/`.
- No backend service. All data persisted to browser/Electron LocalStorage (~5 MB). Auto-update fetches updates from GitHub releases via `electron-updater`.

---

*Stack analysis: 2026-05-02*
