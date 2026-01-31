import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/cardio', pathMatch: 'full' },
  { 
    path: 'cardio', 
    loadComponent: () => import('./features/cardio/cardio-page.component').then(m => m.CardioPageComponent)
  },
  { 
    path: 'weight', 
    loadComponent: () => import('./features/weight/weight-page.component').then(m => m.WeightPageComponent)
  },
  { 
    path: 'readings', 
    loadComponent: () => import('./features/readings/readings-page.component').then(m => m.ReadingsPageComponent)
  },
  {
    path: 'charts',
    loadComponent: () => import('./features/charts/charts-page.component').then(m => m.ChartsPageComponent)
  },
  {
    path: 'report',
    loadComponent: () => import('./features/reports/report-page.component').then(m => m.ReportPageComponent)
  },
];
