import { Component, input, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { ICONS } from '../../constants/icons';

@Component({
	selector: 'app-invite',
	imports: [],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './invite.component.html',
})
export class InviteComponent implements OnInit {
	protected readonly ICONS = ICONS;
	readonly roomId = input.required<string>();

	state: 'loading' | 'valid' | 'error' | 'full' = 'loading';
	errorMessage = '';

	constructor(
		private readonly supabaseService: SupabaseService,
		private readonly router: Router,
	) {}

	ngOnInit(): void {
		this.loadRoom();
	}

	private async loadRoom(): Promise<void> {
		try {
			const room = await this.supabaseService.getRoomById(this.roomId());

			if (room?.status !== 'waiting' && room?.status !== 'ready') {
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

			try {
				await this.supabaseService.joinRoom(this.roomId());
				console.log('JOIN OK');
				await this.router.navigate(['/lobby', this.roomId()]);
				return;
			} catch (err) {
				console.error('JOIN FAIL', err);
				this.state = 'error';
				this.errorMessage = 'Impossible de rejoindre la partie.';
				return;
			}
		} catch {
			this.state = 'error';
			this.errorMessage = "Cette invitation n'est plus valide.";
		}
	}

	decline(): void {
		this.router.navigate(['/home']);
	}
}
