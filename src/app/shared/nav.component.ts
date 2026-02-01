import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="main-nav">
      <div class="nav-brand">Fitness Tracker</div>
      <ul class="nav-links">
        <li>
          <a routerLink="/cardio" routerLinkActive="active">Cardio</a>
        </li>
        <li>
          <a routerLink="/weight" routerLinkActive="active">Weight</a>
        </li>
        <li>
          <a routerLink="/readings" routerLinkActive="active">Readings</a>
        </li>
        <li>
          <a routerLink="/diet" routerLinkActive="active">Diet</a>
        </li>
        <li>
          <a routerLink="/charts" routerLinkActive="active">Charts</a>
        </li>
      </ul>
    </nav>
  `,
  styles: [`
    .main-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 2rem;
      background-color: #2c3e50;
      color: white;
    }

    .nav-brand {
      font-size: 1.25rem;
      font-weight: bold;
    }

    .nav-links {
      display: flex;
      list-style: none;
      margin: 0;
      padding: 0;
      gap: 1.5rem;
    }

    .nav-links a {
      color: #ecf0f1;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .nav-links a:hover {
      background-color: #34495e;
    }

    .nav-links a.active {
      background-color: #3498db;
    }
  `]
})
export class NavComponent {}
