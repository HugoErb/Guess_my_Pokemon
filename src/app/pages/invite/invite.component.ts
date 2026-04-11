import { Component, input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-invite',
  imports: [],
  templateUrl: './invite.component.html',
})
export class InviteComponent implements OnInit {
  readonly roomId = input.required<string>();

  state: 'loading' | 'valid' | 'error' | 'full' = 'loading';
  errorMessage = '';
  inviterUsername = '';
  isJoining = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadRoom();
  }

  private async loadRoom(): Promise<void> {
    try {
      const room = await this.supabaseService.getRoomById(this.roomId());

      if (room?.status !== 'waiting') {
        this.state = 'error';
        this.errorMessage = "Cette invitation n'est plus valide.";
        return;
      }

      if (room.player2_id) {
        this.state = 'full';
        this.errorMessage = 'Cette partie est déjà complète.';
        return;
      }

      const currentUser = await firstValueFrom(this.supabaseService.authReady$);
      if (currentUser?.id === room.player1_id) {
        this.router.navigate(['/lobby', this.roomId()]);
        return;
      }

      const profile = await this.supabaseService.getProfile(room.player1_id);
      this.inviterUsername = profile.username;
      this.state = 'valid';
    } catch {
      this.state = 'error';
      this.errorMessage = "Cette invitation n'est plus valide.";
    }
  }

  async accept(): Promise<void> {
    this.isJoining = true;
    try {
      await this.supabaseService.joinRoom(this.roomId());
      this.router.navigate(['/lobby', this.roomId()]);
    } catch {
      this.state = 'error';
      this.errorMessage = "Impossible de rejoindre la partie.";
    } finally {
      this.isJoining = false;
    }
  }

  decline(): void {
    this.router.navigate(['/home']);
  }
}
