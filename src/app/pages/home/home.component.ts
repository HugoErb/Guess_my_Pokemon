import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { GameInvite } from '../../models/room.model';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';
import { FriendsCardComponent } from '../../components/friends-card/friends-card.component';

@Component({
  selector: 'app-home',
  imports: [FormsModule, FriendsCardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  animations: [modalAnimation],
  templateUrl: './home.component.html',
  styles: [`
    .avatar-gradient {
      background: linear-gradient(135deg, #ef4444 0%, #3b82f6 100%);
    }
  `]
})
export class HomeComponent implements OnInit, OnDestroy {
  protected readonly ICONS = ICONS;
  showPasswordModal = signal(false);
  showUsernameModal = signal(false);

  openPasswordModal(): void {
    this.showPasswordModal.set(true);
    this.passwordError = '';
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }
  closePasswordModal(): void {
    this.showPasswordModal.set(false);
    this.showCurrentPassword.set(false);
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);
  }

  openUsernameModal(): void {
    this.newUsernameInput = this.username;
    this.showUsernameModal.set(true);
    this.usernameError = '';
  }
  closeUsernameModal(): void { this.showUsernameModal.set(false); }

  username = '';
  avatarUrl = signal<string | null>(null);
  isCreating = false;
  createError = '';
  isLoadingProfile = true;
  isUpdatingPassword = false;
  isUpdatingUsername = false;
  isUpdatingAvatar = false;

  passwordError = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  usernameError = '';
  newUsernameInput = '';

  showToast = signal(false);
  toastMessage = signal('');

  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  // Invitation de jeu entrante
  incomingInvite = signal<GameInvite | null>(null);
  inviteCountdown = signal(15);
  private inviteCountdownInterval: ReturnType<typeof setInterval> | null = null;
  private invitesSub?: Subscription;

  toggleCurrentPassword(): void { this.showCurrentPassword.update(v => !v); }
  toggleNewPassword(): void { this.showNewPassword.update(v => !v); }
  toggleConfirmPassword(): void { this.showConfirmPassword.update(v => !v); }

  private triggerToast(message: string): void {
    this.toastMessage.set(message);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 3000);
  }

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.loadProfile();
    this.supabaseService.trackPresence('online');

    // Toast si un ami a refusé l'invitation (query param passé par le lobby)
    const declined = this.route.snapshot.queryParams['declined'];
    if (declined) {
      this.triggerToast(`${declined} a refusé ton invitation`);
      void this.router.navigate(['/home'], { replaceUrl: true });
    }

    // Écoute les invitations de jeu entrantes
    this.invitesSub = this.supabaseService.subscribeToIncomingGameInvites().subscribe((invite) => {
      this.showGameInviteToast(invite);
    });
  }

  ngOnDestroy(): void {
    this.supabaseService.untrackPresence();
    this.invitesSub?.unsubscribe();
    this.clearInviteToast();
  }

  private async loadProfile(): Promise<void> {
    try {
      const user = this.supabaseService.getCurrentUser();
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }

      const cachedAvatar = localStorage.getItem(`gmp_avatar_${user.id}`);
      if (cachedAvatar) this.avatarUrl.set(cachedAvatar);
      const cachedUsername = localStorage.getItem(`gmp_username_${user.id}`);
      if (cachedUsername) this.username = cachedUsername;

      try {
        const profile = await this.supabaseService.getProfile(user.id);
        this.username = profile.username;
        this.avatarUrl.set(profile.avatar_url ?? null);
        localStorage.setItem(`gmp_username_${user.id}`, profile.username);
        if (profile.avatar_url) {
          localStorage.setItem(`gmp_avatar_${user.id}`, profile.avatar_url);
        } else {
          localStorage.removeItem(`gmp_avatar_${user.id}`);
        }
      } catch {
        const metaUsername = user.user_metadata?.['username'];
        if (metaUsername) {
          await this.supabaseService.ensureProfile(user.id, metaUsername);
          try {
            const profile = await this.supabaseService.getProfile(user.id);
            this.username = profile.username;
            this.avatarUrl.set(profile.avatar_url ?? null);
            localStorage.setItem(`gmp_username_${user.id}`, profile.username);
            return;
          } catch { /* profil toujours inaccessible */ }
        }
        this.username = metaUsername ?? user.email?.split('@')[0] ?? 'Joueur';
      }
    } finally {
      this.isLoadingProfile = false;
    }
  }

  // ─── Invitation de jeu entrante ──────────────────────────────────────────────

  private showGameInviteToast(invite: GameInvite): void {
    this.clearInviteToast();
    this.incomingInvite.set(invite);
    this.inviteCountdown.set(15);

    this.inviteCountdownInterval = setInterval(() => {
      const c = this.inviteCountdown() - 1;
      this.inviteCountdown.set(c);
      if (c <= 0) void this.autoDeclineInvite();
    }, 1000);
  }

  private clearInviteToast(): void {
    if (this.inviteCountdownInterval) {
      clearInterval(this.inviteCountdownInterval);
      this.inviteCountdownInterval = null;
    }
    this.incomingInvite.set(null);
  }

  async acceptGameInvite(): Promise<void> {
    const invite = this.incomingInvite();
    if (!invite) return;
    this.clearInviteToast();
    await this.supabaseService.acceptGameInvite(invite.id, invite.room_id);
    this.router.navigate(['/lobby', invite.room_id]);
  }

  async declineGameInvite(): Promise<void> {
    const invite = this.incomingInvite();
    if (!invite) return;
    this.clearInviteToast();
    await this.supabaseService.declineGameInvite(invite.id);
  }

  private async autoDeclineInvite(): Promise<void> {
    await this.declineGameInvite();
  }

  // ─── Invitation envoyée à un ami ─────────────────────────────────────────────

  async onInviteRequested(event: { friendId: string; username: string }): Promise<void> {
    this.isCreating = true;
    this.createError = '';
    try {
      const { roomId, inviteId } = await this.supabaseService.sendGameInvite(event.friendId);
      this.router.navigate(['/lobby', roomId], { queryParams: { inviteId, friendName: event.username } });
    } catch {
      this.createError = 'Impossible d\'inviter l\'ami. Réessaie.';
      this.isCreating = false;
    }
  }

  // ─── Partie classique ────────────────────────────────────────────────────────

  async createGame(): Promise<void> {
    this.isCreating = true;
    this.createError = '';
    localStorage.removeItem('gmp:filters');
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

  // ─── Compte ──────────────────────────────────────────────────────────────────

  async changePassword(): Promise<void> {
    const current = this.currentPassword.trim();
    const newPwd = this.newPassword.trim();
    const confirm = this.confirmPassword.trim();

    if (!current) { this.passwordError = 'Veuillez saisir votre mot de passe actuel.'; return; }
    if (!newPwd || newPwd.length < 6) { this.passwordError = 'Le nouveau mot de passe doit faire au moins 6 caractères.'; return; }
    if (newPwd !== confirm) { this.passwordError = 'Les nouveaux mots de passe ne correspondent pas.'; return; }

    this.isUpdatingPassword = true;
    this.passwordError = '';
    try {
      const isValid = await this.supabaseService.verifyPassword(current);
      if (!isValid) { this.passwordError = 'Le mot de passe actuel est incorrect.'; return; }
      await this.supabaseService.updatePassword(newPwd);
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.closePasswordModal();
      this.triggerToast('Mot de passe mis à jour !');
    } catch (err: any) {
      this.passwordError = err.message || 'Erreur lors de la mise à jour.';
    } finally {
      this.isUpdatingPassword = false;
    }
  }

  async changeUsername(): Promise<void> {
    const trimmed = this.newUsernameInput.trim();
    if (!trimmed || trimmed.length < 3) { this.usernameError = 'Le pseudo doit faire au moins 3 caractères.'; return; }
    if (trimmed === this.username) { this.closeUsernameModal(); return; }

    this.isUpdatingUsername = true;
    this.usernameError = '';
    try {
      const user = this.supabaseService.getCurrentUser();
      if (!user) throw new Error('Non connecté');
      await this.supabaseService.updateUsername(user.id, trimmed);
      this.username = trimmed;
      localStorage.setItem(`gmp_username_${user.id}`, trimmed);
      this.closeUsernameModal();
      this.triggerToast('Pseudo mis à jour !');
    } catch (err: any) {
      this.usernameError = err.message || 'Erreur lors de la mise à jour.';
    } finally {
      this.isUpdatingUsername = false;
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) { alert('L\'image est trop lourde (max 2Mo)'); return; }

    this.isUpdatingAvatar = true;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const user = this.supabaseService.getCurrentUser();
        if (user) {
          await this.supabaseService.updateProfile(user.id, { avatar_url: base64 });
          this.avatarUrl.set(base64);
          localStorage.setItem(`gmp_avatar_${user.id}`, base64);
        }
      };
      reader.onerror = () => { alert('Impossible de lire le fichier image.'); };
      reader.readAsDataURL(file);
    } catch {
      alert('Impossible de mettre à jour la photo.');
    } finally {
      this.isUpdatingAvatar = false;
    }
  }
}
