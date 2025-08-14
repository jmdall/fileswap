import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ExchangeService } from '../../services/exchange.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  isCreating = false;
  sessionCreated = false;
  sessionData: any = null;
  error = '';
  location = window.location;

  constructor(
    private exchangeService: ExchangeService,
    private router: Router
  ) {}

  async createSession() {
    this.isCreating = true;
    this.error = '';
    this.sessionCreated = false;
    
    try {
      this.sessionData = await this.exchangeService.createSession();
      this.sessionCreated = true;
      
      // Copy links to clipboard
      const links = `Participant A: ${window.location.origin}/exchange?sid=${this.sessionData.sessionId}&token=${this.sessionData.invites.A.token}
Participant B: ${window.location.origin}/exchange?sid=${this.sessionData.sessionId}&token=${this.sessionData.invites.B.token}`;
      
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(links);
      }
    } catch (error: any) {
      this.error = error.message || 'Erreur lors de la création de la session';
    } finally {
      this.isCreating = false;
    }
  }

  copyLink(role: 'A' | 'B') {
    const invite = this.sessionData.invites[role];
    const link = `${window.location.origin}/exchange?sid=${this.sessionData.sessionId}&token=${invite.token}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      alert(`Lien du participant ${role} copié !`);
    }
  }

  openInNewTab(role: 'A' | 'B') {
    const invite = this.sessionData.invites[role];
    const link = `/exchange?sid=${this.sessionData.sessionId}&token=${invite.token}`;
    window.open(link, '_blank');
  }
}
