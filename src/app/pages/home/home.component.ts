import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  animations: [modalAnimation],
  templateUrl: './home.component.html',
  styles: [`
    .avatar-gradient {
      background: linear-gradient(135deg, #ef4444 0%, #3b82f6 100%);
    }
  `]
})
export class HomeComponent implements OnInit {
  protected readonly ICONS = ICONS;
  showPasswordModal = signal(false);
  showUsernameModal = signal(false);

  /** Ouvre la modal de changement de mot de passe en réinitialisant les champs. */
  openPasswordModal(): void {
    this.showPasswordModal.set(true);
    this.passwordError = '';
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }
  /** Ferme la modal de changement de mot de passe. */
  closePasswordModal(): void {
    this.showPasswordModal.set(false);
    this.showCurrentPassword.set(false);
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);
  }

  /** Ouvre la modal de changement de pseudo en pré-remplissant le champ. */
  openUsernameModal(): void {
    this.newUsernameInput = this.username;
    this.showUsernameModal.set(true);
    this.usernameError = '';
  }
  /** Ferme la modal de changement de pseudo. */
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

  /** Bascule la visibilité du champ mot de passe actuel. */
  toggleCurrentPassword(): void { this.showCurrentPassword.update(v => !v); }
  /** Bascule la visibilité du champ nouveau mot de passe. */
  toggleNewPassword(): void { this.showNewPassword.update(v => !v); }
  /** Bascule la visibilité du champ confirmation du mot de passe. */
  toggleConfirmPassword(): void { this.showConfirmPassword.update(v => !v); }

  /** Affiche un toast de confirmation avec le message donné pendant 3 secondes. */
  private triggerToast(message: string): void {
    this.toastMessage.set(message);
    this.showToast.set(true);
    setTimeout(() => this.showToast.set(false), 3000);
  }

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router
  ) {}

  /** Lifecycle Angular — charge le profil de l'utilisateur. */
  ngOnInit(): void {
    this.loadProfile();
  }

  /**
   * Charge le profil de l'utilisateur depuis Supabase avec mise en cache locale.
   * Utilise le cache localStorage pour un affichage instantané avant la réponse réseau.
   */
  private async loadProfile(): Promise<void> {
    try {
      const user = this.supabaseService.getCurrentUser();
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }

      // 1. Tenter de charger depuis le cache pour un affichage instantané
      const cachedAvatar = localStorage.getItem(`gmp_avatar_${user.id}`);
      if (cachedAvatar) {
        this.avatarUrl.set(cachedAvatar);
      }
      const cachedUsername = localStorage.getItem(`gmp_username_${user.id}`);
      if (cachedUsername) {
        this.username = cachedUsername;
      }

      try {
        const profile = await this.supabaseService.getProfile(user.id);
        this.username = profile.username;
        this.avatarUrl.set(profile.avatar_url ?? null);

        // Mettre à jour le cache
        localStorage.setItem(`gmp_username_${user.id}`, profile.username);
        if (profile.avatar_url) {
          localStorage.setItem(`gmp_avatar_${user.id}`, profile.avatar_url);
        } else {
          localStorage.removeItem(`gmp_avatar_${user.id}`);
        }
      } catch {
        // Profil absent : tenter de le créer depuis les métadonnées d'inscription
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

  /** Crée une nouvelle partie et navigue vers le lobby correspondant. */
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

  /** Déconnecte l'utilisateur et navigue vers la page de connexion. */
  async logout(): Promise<void> {
    await this.supabaseService.signOut();
    this.router.navigate(['/login']);
  }

  /**
   * Valide et met à jour le mot de passe de l'utilisateur.
   * Vérifie le mot de passe actuel avant d'effectuer le changement.
   */
  async changePassword(): Promise<void> {
    const current = this.currentPassword.trim();
    const newPwd = this.newPassword.trim();
    const confirm = this.confirmPassword.trim();

    if (!current) {
      this.passwordError = 'Veuillez saisir votre mot de passe actuel.';
      return;
    }
    if (!newPwd || newPwd.length < 6) {
      this.passwordError = 'Le nouveau mot de passe doit faire au moins 6 caractères.';
      return;
    }
    if (newPwd !== confirm) {
      this.passwordError = 'Les nouveaux mots de passe ne correspondent pas.';
      return;
    }

    this.isUpdatingPassword = true;
    this.passwordError = '';
    try {
      // 1. Vérifier le mot de passe actuel
      const isValid = await this.supabaseService.verifyPassword(current);
      if (!isValid) {
        this.passwordError = 'Le mot de passe actuel est incorrect.';
        return;
      }

      // 2. Mettre à jour le mot de passe
      await this.supabaseService.updatePassword(newPwd);

      // Reset des champs
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

  /**
   * Valide et met à jour le pseudo de l'utilisateur
   * dans Supabase Auth, la table des profils et le cache local.
   */
  async changeUsername(): Promise<void> {
    const trimmed = this.newUsernameInput.trim();
    if (!trimmed || trimmed.length < 3) {
      this.usernameError = 'Le pseudo doit faire au moins 3 caractères.';
      return;
    }
    if (trimmed === this.username) {
      this.closeUsernameModal();
      return;
    }

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

  /**
   * Gère la sélection d'une image pour l'avatar (max 2 Mo).
   * Encode en base64 et met à jour le profil et le cache local.
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      alert('L\'image est trop lourde (max 2Mo)');
      return;
    }

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
      reader.onerror = () => {
        alert('Impossible de lire le fichier image.');
      };
      reader.readAsDataURL(file);
    } catch {
      alert('Impossible de mettre à jour la photo.');
    } finally {
      this.isUpdatingAvatar = false;
    }
  }
}
