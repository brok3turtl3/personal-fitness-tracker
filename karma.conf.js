// Karma config — extracted from angular.json:73-93 inline form (D-03).
// Adds per-pattern coverage thresholds (D-01..D-04 in 01-CONTEXT.md), set to
// the Phase-1-end baseline as a no-decrease ratchet. Phases 2-5 will lift
// individual file thresholds as specs are added (e.g., DIET-* phases will
// raise diet.service.ts and diet-page.component.ts; CHAT-* phases raise chat.*).
//
// Threshold strategy:
//   - global floor: 60/50/60/60 (statements/branches/lines/functions)
//   - per-file default (each): 40/30/40/40 (lifts as Phases 2-5 add component specs)
//   - services/**: 85/40/85/75 (current Phase 1 baseline; some services are spec-light)
//   - shared/**:   65/50/70/30 (current Phase 1 baseline; a11y-test-helpers + recovery-banner + date-range are partially covered)
//   - legacy-schemas.ts: 100/100/100/100 (type-only module; trivially passes)
//   - per-file overrides codify the current baseline for files below their pattern default
//
// The `check` block is intentionally placed inside `coverageReporter` so it
// only runs when Karma's coverage instrumentation runs — i.e., when
// `--code-coverage` is passed (D-04 + RESEARCH §Pitfall 2). Plain
// `ng test` stays threshold-free for fast dev iteration.
//
// Source pattern: RESEARCH.md §Pattern 1 (lines 187-285) + karma-coverage docs
// https://github.com/karma-runner/karma-coverage/blob/master/docs/configuration.md

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: { jasmine: {}, clearContext: false },
    jasmineHtmlReporter: { suppressAll: true },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/personal-fitness-tracker'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }, { type: 'lcovonly' }],
      check: {
        emitWarning: false,
        global: { statements: 60, branches: 50, lines: 60, functions: 60 },
        each: {
          statements: 40,
          branches: 30,
          lines: 40,
          functions: 40,
          excludes: ['src/main.ts', 'src/app/**/*.spec.ts', 'src/environments/**'],
          overrides: {
            // More-specific overrides FIRST (karma-coverage takes the first match).
            // Per-file lowers for Phase-1-end baseline:
            'src/app/services/diet.service.ts':                    { statements: 45, branches: 30, lines: 55, functions: 45 },
            'src/app/services/chat.service.ts':                    { statements: 70, branches: 40, lines: 75, functions: 70 },
            'src/app/services/storage.service.ts':                 { statements: 85, branches: 65, lines: 90, functions: 75 },
            // Type-only module — trivially passes:
            'src/app/services/legacy-schemas.ts':                  { statements: 100, branches: 100, lines: 100, functions: 100 },
            // Per-file feature lowers (below the default 40/30/40/40):
            'src/app/features/chat/chat-input.component.ts':       { statements: 30, branches: 0,  lines: 30, functions: 0 },
            'src/app/features/chat/chat-page.component.ts':        { statements: 40, branches: 5,  lines: 40, functions: 40 },
            'src/app/features/diet/diet-page.component.ts':        { statements: 30, branches: 4,  lines: 30, functions: 30 },
            // Pattern defaults LAST — apply to any file not matched above:
            'src/app/services/**/*.ts': { statements: 85, branches: 40, lines: 85, functions: 75 },
            'src/app/shared/**/*.ts':   { statements: 65, branches: 50, lines: 70, functions: 30 },
          },
        },
      },
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: { base: 'ChromeHeadless', flags: ['--no-sandbox'] },
    },
    restartOnFileChange: true,
  });
};
