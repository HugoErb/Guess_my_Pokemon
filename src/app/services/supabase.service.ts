import { Injectable, OnDestroy, signal } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, skipUntil } from 'rxjs/operators';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { GameSettings, Profile, Room, RoomPatch } from '../models/room.model';

@Injectable({ providedIn: 'root' })
export class SupabaseService implements OnDestroy {
	private supabase: SupabaseClient;
	private userSubject = new BehaviorSubject<User | null>(null);
	private authSubscription: { unsubscribe: () => void } | null = null;
	private readonly isInitializedSubject = new BehaviorSubject<boolean>(false);
	private broadcastSubject = new Subject<{ event: string; payload: any }>();

	broadcastEvents$ = this.broadcastSubject.asObservable();
	private activeRoomChannel: any = null;

	currentUser$: Observable<User | null> = this.userSubject.asObservable();
	readonly authReady$: Observable<User | null>;
	readonly currentUserSignal = signal<User | null>(null);

	constructor() {
		this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

		this.authReady$ = this.userSubject.pipe(skipUntil(this.isInitializedSubject.pipe(filter((v) => v))));

		// Initialise avec la session courante
		this.supabase.auth.getSession().then(({ data }) => {
			const user = data.session?.user ?? null;
			this.userSubject.next(user);
			this.currentUserSignal.set(user);
			this.isInitializedSubject.next(true);
		});

		// Écoute les changements d'état d'authentification
		const {
			data: { subscription },
		} = this.supabase.auth.onAuthStateChange((event, session) => {
			const user = session?.user ?? null;
			this.userSubject.next(user);
			this.currentUserSignal.set(user);

			// Crée le profil à la première connexion (cas confirmation email activée)
			if (event === 'SIGNED_IN' && user) {
				this.ensureProfile(user.id, user.user_metadata?.['username']);
			}
		});
		this.authSubscription = subscription;
	}

	ngOnDestroy(): void {
		this.authSubscription?.unsubscribe();
	}

	// ─── Auth ────────────────────────────────────────────────────────────────────

	async signUp(email: string, password: string, username: string): Promise<void> {
		const { data, error } = await this.supabase.auth.signUp({
			email,
			password,
			options: { data: { username, display_name: username } },
		});
		if (error) throw error;

		const user = data.user;
		if (!user) throw new Error("Aucun utilisateur retourné après l'inscription");

		// Toujours tenter d'insérer le profil dès que l'utilisateur est créé,
		// que la confirmation email soit activée ou non.
		const { error: profileError } = await this.supabase
			.from('profiles')
			.upsert({ id: user.id, username }, { onConflict: 'id', ignoreDuplicates: true });

		if (profileError) console.error("Erreur création profil à l'inscription:", profileError);

		if (!data.session) {
			// Confirmation email requise
			throw new Error('Un email de confirmation a été envoyé. Clique sur le lien dans ta boîte mail pour activer ton compte.');
		}
	}

	async ensureProfile(userId: string, username?: string): Promise<void> {
		const { data } = await this.supabase.from('profiles').select('id').eq('id', userId).maybeSingle();

		if (!data && username) {
			const { error } = await this.supabase.from('profiles').insert({ id: userId, username });
			if (error) console.error('Erreur création profil:', error);
		}
	}

	async signIn(email: string, password: string): Promise<void> {
		const { error } = await this.supabase.auth.signInWithPassword({ email, password });
		if (error) throw error;
	}

	async signOut(): Promise<void> {
		const { error } = await this.supabase.auth.signOut();
		if (error) throw error;
	}

	async resetPasswordForEmail(email: string): Promise<void> {
		const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/reset-password`,
		});
		if (error) throw error;
	}

	async updatePassword(newPassword: string): Promise<void> {
		const { error } = await this.supabase.auth.updateUser({ password: newPassword });
		if (error) throw error;
	}

	async verifyPassword(password: string): Promise<boolean> {
		const user = this.userSubject.getValue();
		if (!user?.email) return false;

		// On tente une reconnexion silencieuse pour vérifier le mot de passe actuel
		const { error } = await this.supabase.auth.signInWithPassword({
			email: user.email,
			password: password,
		});

		return !error;
	}

	// ─── Profil ──────────────────────────────────────────────────────────────────

	async getProfile(userId: string): Promise<Profile> {
		const { data, error } = await this.supabase.from('profiles').select('*').eq('id', userId).single();

		if (error) throw error;
		return data as Profile;
	}

	async updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
		const { error } = await this.supabase.from('profiles').update(patch).eq('id', userId);

		if (error) throw error;
	}

	async updateUsername(userId: string, newUsername: string): Promise<void> {
		// 1. Mettre à jour les métadonnées de l'utilisateur (Auth)
		const { error: authError } = await this.supabase.auth.updateUser({
			data: {
				username: newUsername,
				display_name: newUsername,
			},
		});
		if (authError) throw authError;

		// 2. Mettre à jour la table des profils (Public)
		const { error: profileError } = await this.supabase.from('profiles').update({ username: newUsername }).eq('id', userId);
		if (profileError) throw profileError;
	}

	// ─── Rooms ───────────────────────────────────────────────────────────────────

	async createRoom(): Promise<string> {
		const user = this.userSubject.getValue();
		if (!user) throw new Error('Utilisateur non connecté');

		const { data, error } = await this.supabase.from('rooms').insert({ player1_id: user.id, status: 'waiting' }).select('id').single();

		if (error) throw error;
		return (data as { id: string }).id;
	}

	async getRoomById(roomId: string): Promise<Room> {
		const { data, error } = await this.supabase.from('rooms').select('*').eq('id', roomId).single();

		if (error) throw error;
		return data as Room;
	}

	async joinRoom(roomId: string): Promise<void> {
		const user = this.userSubject.getValue();
		if (!user) throw new Error('Utilisateur non connecté');

		const room = await this.getRoomById(roomId);

		if (!room) throw new Error('Room introuvable');
		if (room.player2_id) throw new Error('Room déjà complète');
		if (room.status !== 'waiting') throw new Error('Room non joignable');
		if (room.player1_id === user.id) throw new Error('Le créateur ne peut pas rejoindre sa propre room');

		const { data, error } = await this.supabase.from('rooms').update({ player2_id: user.id, status: 'ready' }).eq('id', roomId).select('*');

		console.log('JOIN RESULT', data);

		if (error) throw error;
	}

	async launchGame(roomId: string, settings: GameSettings): Promise<void> {
		const { error } = await this.supabase.from('rooms').update({ status: 'selecting', settings }).eq('id', roomId);

		if (error) throw error;
	}

	subscribeToRoom(roomId: string): Observable<Room> {
		return new Observable<Room>((observer) => {
			const channel = this.supabase
				.channel(`room-${roomId}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'rooms',
						filter: `id=eq.${roomId}`,
					},
					(payload) => {
						console.log('[Realtime] rooms update', payload);
						observer.next(payload.new as Room);
					},
				)
				.on('broadcast', { event: '*' }, ({ event, payload }) => {
					console.log(`[SupabaseService] Broadcast reçu sur canal : ${event}`, payload);
					this.broadcastSubject.next({ event, payload });
				})
				.subscribe((status) => {
					console.log('[Realtime] status:', status, roomId);

					if (status === 'CHANNEL_ERROR') {
						observer.error(new Error(`Erreur canal room-${roomId}`));
					}
				});

			this.activeRoomChannel = channel;

			// Cleanup : retirer le canal à la désinscription
			return () => {
				this.supabase.removeChannel(channel);
				this.activeRoomChannel = null;
			};
		});
	}

    async updateRoom(roomId: string, patch: RoomPatch): Promise<void> {
        const { data, error } = await this.supabase
            .from('rooms')
            .update(patch)
            .eq('id', roomId)
            .select('*');

        console.log('UPDATE ROOM RESULT', patch, data);

        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error('UPDATE rooms refusé ou aucune ligne modifiée');
        }
    }

	async deleteRoom(roomId: string): Promise<void> {
		const { error } = await this.supabase.from('rooms').delete().eq('id', roomId);

		if (error) throw error;
	}

	// ─── Utilitaire interne ──────────────────────────────────────────────────────

	async broadcastGuess(pokemonId: number, senderId: string | null): Promise<void> {
		if (this.activeRoomChannel) {
			console.log(`[SupabaseService] Envoi du broadcast guess: ${pokemonId} (sender: ${senderId})`);
			const eventData = {
				type: 'broadcast',
				event: 'opponent_guess',
				payload: { pokemonId, senderId },
			};

			await this.activeRoomChannel.send(eventData);

			// En mode DEV, si on est seul, on double l'envoi localement pour être sûr
			if (environment.devMode) {
				this.broadcastSubject.next({ event: eventData.event, payload: eventData.payload });
			}
		} else {
			console.warn("[SupabaseService] Impossible d'envoyer le broadcast : canal inactif");
		}
	}

	getCurrentUser(): User | null {
		return this.userSubject.getValue();
	}
}
