import { Component, OnInit, OnDestroy, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA, HostListener, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';
import { FriendStatus, FriendWithStatus, FriendRequest } from '../../models/room.model';
import { ICONS } from '../../constants/icons';

@Component({
	selector: 'app-friends-card',
	standalone: true,
	imports: [FormsModule],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './friends-card.component.html',
	styles: [
		':host { display: block; }',
		`@keyframes tabFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
		.tab-content { animation: tabFadeIn 0.18s ease-out both; }`,
	],
})
export class FriendsCardComponent implements OnInit, OnDestroy {
	protected readonly ICONS = ICONS;
	private readonly supabaseService = inject(SupabaseService);

	@Output() inviteRequested = new EventEmitter<{ friendId: string; username: string; gameMode: 'guess_my_pokemon' | 'stat_duel' | 'draft_duo' }>();

	activeTab = signal<'friends' | 'requests' | 'add'>('friends');
	friends = signal<FriendWithStatus[]>([]);
	pendingRequests = signal<FriendRequest[]>([]);
	isLoadingFriends = signal(true);
	confirmDeleteFriend = signal<FriendWithStatus | null>(null);
	openMenuFriend = signal<FriendWithStatus | null>(null);
	menuPosition = signal<{ top: number; right: number } | null>(null);

	hasPendingRequests = computed(() => this.pendingRequests().length > 0);

	tabIndicatorLeft = computed(() => {
		const map: Record<string, string> = {
			friends: '4px',
			requests: 'calc(8px + (100% - 16px) / 3)',
			add: 'calc(12px + (100% - 16px) * 2 / 3)',
		};
		return map[this.activeTab()];
	});

	addFriendInput = '';
	addFriendError = '';
	addFriendSuccess = '';
	isAddingFriend = false;

	private presenceSub?: Subscription;
	private friendshipsSub?: Subscription;

	async ngOnInit(): Promise<void> {
		await this.reload();
		this.friendshipsSub = this.supabaseService.subscribeToFriendships().subscribe(() => {
			void this.reload();
		});
	}

	ngOnDestroy(): void {
		this.presenceSub?.unsubscribe();
		this.friendshipsSub?.unsubscribe();
	}

	private async reload(): Promise<void> {
		this.isLoadingFriends.set(true);
		const [friends, requests] = await Promise.all([
			this.supabaseService.getFriendsWithStatus(),
			this.supabaseService.getPendingRequests(),
		]);
		this.friends.set(friends);
		this.pendingRequests.set(requests);
		this.isLoadingFriends.set(false);

		this.presenceSub?.unsubscribe();
		const friendIds = friends.map((f) => f.friendId);
		if (friendIds.length > 0) {
			this.presenceSub = this.supabaseService.subscribeToFriendsPresence(friendIds).subscribe((statusMap) => {
				this.friends.update((list) =>
					list
						.map((f) => ({ ...f, status: statusMap.get(f.friendId) ?? 'offline' }))
						.sort((a, b) => {
							const order: Record<FriendStatus, number> = { online: 0, in_game: 1, offline: 2 };
							return order[a.status] - order[b.status];
						}),
				);
			});
		}
	}

	async sendFriendRequest(): Promise<void> {
		const username = this.addFriendInput.trim();
		if (!username) return;
		this.isAddingFriend = true;
		this.addFriendError = '';
		this.addFriendSuccess = '';
		try {
			await this.supabaseService.sendFriendRequest(username);
			this.addFriendSuccess = `Demande envoyée à ${username} !`;
			this.addFriendInput = '';
		} catch (err: any) {
			this.addFriendError = err.message ?? 'Erreur lors de l\'envoi';
		} finally {
			this.isAddingFriend = false;
		}
	}

	async acceptRequest(friendshipId: string): Promise<void> {
		await this.supabaseService.acceptFriendRequest(friendshipId);
	}

	async declineRequest(friendshipId: string): Promise<void> {
		await this.supabaseService.declineFriendRequest(friendshipId);
	}

	inviteFriend(friend: FriendWithStatus, gameMode: 'guess_my_pokemon' | 'stat_duel' | 'draft_duo'): void {
		this.inviteRequested.emit({ friendId: friend.friendId, username: friend.username, gameMode });
	}

	askRemoveFriend(friend: FriendWithStatus): void {
		this.confirmDeleteFriend.set(friend);
	}

	cancelRemove(): void {
		this.confirmDeleteFriend.set(null);
	}

	async confirmRemove(): Promise<void> {
		const friend = this.confirmDeleteFriend();
		if (!friend) return;
		this.confirmDeleteFriend.set(null);
		await this.supabaseService.removeFriend(friend.id);
		await this.reload();
	}

	@HostListener('document:click')
	onDocumentClick(): void {
		this.openMenuFriend.set(null);
		this.menuPosition.set(null);
	}

	toggleMenu(friend: FriendWithStatus, event: Event): void {
		event.stopPropagation();
		if (this.openMenuFriend()?.id === friend.id) {
			this.openMenuFriend.set(null);
			this.menuPosition.set(null);
		} else {
			const btn = event.currentTarget as HTMLElement;
			const rect = btn.getBoundingClientRect();
			this.menuPosition.set({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
			this.openMenuFriend.set(friend);
		}
	}

	closeMenu(): void {
		this.openMenuFriend.set(null);
		this.menuPosition.set(null);
	}

	setTab(tab: 'friends' | 'requests' | 'add'): void {
		this.activeTab.set(tab);
		this.addFriendError = '';
		this.addFriendSuccess = '';
	}

	statusLabel(status: FriendStatus): string {
		if (status === 'online') return 'En ligne';
		if (status === 'in_game') return 'En jeu';
		return 'Hors ligne';
	}

	statusDotClass(status: FriendStatus): string {
		if (status === 'online') return 'bg-green-500';
		if (status === 'in_game') return 'bg-yellow-500';
		return 'bg-gray-500';
	}

	statusTextClass(status: FriendStatus): string {
		if (status === 'online') return 'text-green-400';
		if (status === 'in_game') return 'text-yellow-400';
		return 'text-slate-500';
	}
}
