import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <nav class="navbar">
        <div class="nav-content">
          <h1 class="nav-title">🔒 Secure File Exchange</h1>
          <div class="nav-links">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Accueil</a>
            <a routerLink="/exchange" routerLinkActive="active">Échange</a>
          </div>
        </div>
      </nav>
      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
    }
    
    .navbar {
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 1rem 0;
      margin-bottom: 2rem;
    }
    
    .nav-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .nav-title {
      font-size: 1.5rem;
      color: #333;
      margin: 0;
    }
    
    .nav-links {
      display: flex;
      gap: 2rem;
    }
    
    .nav-links a {
      color: #666;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
    }
    
    .nav-links a:hover,
    .nav-links a.active {
      color: #667eea;
    }
    
    main {
      padding-bottom: 2rem;
    }
  `]
})
export class AppComponent {
  title = 'Secure File Exchange';
}
