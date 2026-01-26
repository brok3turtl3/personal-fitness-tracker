# Quickstart: Personal Fitness Tracker MVP

**Feature**: 001-fitness-tracker-mvp
**Date**: 2025-01-25

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+ or pnpm
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Initial Setup

### 1. Create Angular Project

```bash
# Install Angular CLI globally (if not installed)
npm install -g @angular/cli

# Create new Angular project with standalone components
ng new personal-fitness-tracker --standalone --routing --style=css --ssr=false

# Navigate to project
cd personal-fitness-tracker
```

### 2. Verify Setup

```bash
# Start development server
ng serve

# Open browser at http://localhost:4200
# You should see the Angular welcome page
```

### 3. Configure TypeScript Strict Mode

Verify `tsconfig.json` has strict mode enabled (should be default):

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Project Structure Setup

### 4. Create Feature Folders

```bash
# Create directory structure
mkdir -p src/app/models
mkdir -p src/app/services
mkdir -p src/app/features/cardio
mkdir -p src/app/features/weight
mkdir -p src/app/features/readings
mkdir -p src/app/features/dashboard
mkdir -p src/app/shared
```

### 5. Generate Core Services

```bash
# Storage service (abstraction layer)
ng generate service services/storage --skip-tests=false

# Domain services
ng generate service services/cardio --skip-tests=false
ng generate service services/weight --skip-tests=false
ng generate service services/readings --skip-tests=false
```

### 6. Generate Feature Components

```bash
# Dashboard
ng generate component features/dashboard/dashboard --standalone

# Cardio feature
ng generate component features/cardio/cardio-list --standalone
ng generate component features/cardio/cardio-form --standalone

# Weight feature
ng generate component features/weight/weight-list --standalone
ng generate component features/weight/weight-form --standalone

# Readings feature
ng generate component features/readings/readings-list --standalone
ng generate component features/readings/readings-form --standalone

# Shared components
ng generate component shared/nav --standalone
```

## Development Commands

### Daily Development

```bash
# Start dev server with hot reload
ng serve

# Run unit tests
ng test

# Run tests in CI mode (single run)
ng test --no-watch --code-coverage

# Lint code (if ESLint configured)
ng lint

# Build for production
ng build --configuration=production
```

### Code Generation

```bash
# Generate a new service with tests
ng generate service services/[name]

# Generate a standalone component
ng generate component features/[feature]/[name] --standalone

# Generate a model interface
# (Manual creation in src/app/models/ recommended for interfaces)
```

## Verification Checklist

After setup, verify:

- [ ] `ng serve` starts without errors
- [ ] `ng test` runs and passes default tests
- [ ] `ng build` completes successfully
- [ ] Directory structure matches plan.md
- [ ] TypeScript strict mode is enabled

## Next Steps

1. Implement models in `src/app/models/` (see data-model.md)
2. Implement `StorageService` (see contracts/storage-service.contract.md)
3. Implement domain services with tests
4. Build feature components
5. Configure routing in `app.routes.ts`

## Troubleshooting

### Common Issues

**Node version mismatch**:
```bash
# Check Node version (should be 18+)
node --version

# If using nvm
nvm use 18
```

**Angular CLI not found**:
```bash
npm install -g @angular/cli
```

**Port 4200 in use**:
```bash
ng serve --port 4201
```

**Test runner issues**:
```bash
# Clear Karma browser cache
rm -rf node_modules/.cache
ng test
```
