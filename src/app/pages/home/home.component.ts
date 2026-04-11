import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  username = '';
  isCreating = false;
  createError = '';
  isLoadingProfile = true;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    try {
      const user = this.supabaseService.getCurrentUser();
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }
      try {
        const profile = await this.supabaseService.getProfile(user.id);
        this.username = profile.username;
      } catch {
        this.username = user.email ?? 'Joueur';
      }
    } finally {
      this.isLoadingProfile = false;
    }
  }

  async createGame(): Promise<void> {
    this.isCreating = true;
    this.createError = '';
    try {
      const roomId = await this.supabaseService.createRoom();
      this.router.navigate(['/lobby', roomId]);
    } catch {
      this.createError = 'Impossible de créer la partie. Réessaie.';
    } finally {
      this.isCreating = false;
    }
  }

  async logout(): Promise<void> {
    await this.supabaseService.signOut();
    this.router.navigate(['/login']);
  }
}
