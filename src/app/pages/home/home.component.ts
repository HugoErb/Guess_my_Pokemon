import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ICONS } from '../../constants/icons';

@Component({
  selector: 'app-home',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  protected readonly ICONS = ICONS;
  showRulesModal = signal(false);

  openRulesModal(): void { this.showRulesModal.set(true); }
  closeRulesModal(): void { this.showRulesModal.set(false); }
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
        // Profil absent : tenter de le créer depuis les métadonnées d'inscription
        const metaUsername = user.user_metadata?.['username'];
        if (metaUsername) {
          await this.supabaseService.ensureProfile(user.id, metaUsername);
          try {
            const profile = await this.supabaseService.getProfile(user.id);
            this.username = profile.username;
            return;
          } catch { /* profil toujours inaccessible */ }
        }
        this.username = metaUsername ?? user.email?.split('@')[0] ?? 'Joueur';
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
