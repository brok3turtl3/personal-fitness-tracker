// Karma config — extracted from angular.json:73-93 inline form (D-03).
// Adds per-pattern coverage thresholds (D-01..D-04 in 01-CONTEXT.md):
//   - global floor: 60/50/60/60 (statements/branches/lines/functions)
//   - per-file default (each): 40/30/40/40 (lifts as Phases 2-5 add specs)
//   - services/** + shared/**: 90/80/90/90
//   - storage.service.ts + legacy-schemas.ts (migration data-loss risk): 100/100/100/100
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
            'src/app/services/**/*.ts': { statements: 90, branches: 80, lines: 90, functions: 90 },
            'src/app/shared/**/*.ts':   { statements: 90, branches: 80, lines: 90, functions: 90 },
            'src/app/services/storage.service.ts':  { statements: 100, branches: 100, lines: 100, functions: 100 },
            'src/app/services/legacy-schemas.ts':   { statements: 100, branches: 100, lines: 100, functions: 100 },
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
