import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  username = '';
  isCreating = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    const user = this.supabaseService.getCurrentUser();
    if (user) {
      try {
        const profile = await this.supabaseService.getProfile(user.id);
        this.username = profile.username;
      } catch {
        this.username = user.email ?? 'Joueur';
      }
    }
  }

  async createGame(): Promise<void> {
    this.isCreating = true;
    try {
      const roomId = await this.supabaseService.createRoom();
      this.router.navigate(['/lobby', roomId]);
    } finally {
      this.isCreating = false;
    }
  }

  async logout(): Promise<void> {
    await this.supabaseService.signOut();
    this.router.navigate(['/login']);
  }
}
