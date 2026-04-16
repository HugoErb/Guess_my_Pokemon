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

	/** Désinscrit l'abonnement d'authentification. */
	ngOnDestroy(): void {
		this.authSubscription?.unsubscribe();
	}

	// ─── Auth ────────────────────────────────────────────────────────────────────

	/**
	 * Crée un nouveau compte utilisateur avec email, mot de passe et pseudo,
	 * puis insère le profil correspondant. Lance une erreur si la confirmation
	 * email est requise.
	 */
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
		await this.supabase
			.from('profiles')
			.upsert({ id: user.id, username }, { onConflict: 'id', ignoreDuplicates: true });

		if (!data.session) {
			// Confirmation email requise
			throw new Error('Un email de confirmation a été envoyé. Clique sur le lien dans ta boîte mail pour activer ton compte.');
		}
	}

	/**
	 * Crée le profil utilisateur s'il n'existe pas encore en base.
	 * Utilisé après la confirmation email.
	 */
	async ensureProfile(userId: string, username?: string): Promise<void> {
		const { data } = await this.supabase.from('profiles').select('id').eq('id', userId).maybeSingle();

		if (!data && username) {
			await this.supabase.from('profiles').insert({ id: userId, username });
		}
	}

	/** Connecte l'utilisateur avec son email et son mot de passe. */
	async signIn(email: string, password: string): Promise<void> {
		const { error } = await this.supabase.auth.signInWithPassword({ email, password });
		if (error) throw error;
	}

	/** Déconnecte l'utilisateur courant. */
	async signOut(): Promise<void> {
		const { error } = await this.supabase.auth.signOut();
		if (error) throw error;
	}

	/** Envoie un email de réinitialisation du mot de passe à l'adresse fournie. */
	async resetPasswordForEmail(email: string): Promise<void> {
		const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/reset-password`,
		});
		if (error) throw error;
	}

	/** Met à jour le mot de passe de l'utilisateur connecté. */
	async updatePassword(newPassword: string): Promise<void> {
		const { error } = await this.supabase.auth.updateUser({ password: newPassword });
		if (error) throw error;
	}

	/**
	 * Vérifie si le mot de passe fourni est correct pour l'utilisateur courant
	 * en tentant une reconnexion silencieuse.
	 */
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

	/** Récupère le profil complet d'un utilisateur depuis la base de données. */
	async getProfile(userId: string): Promise<Profile> {
		const { data, error } = await this.supabase.from('profiles').select('*').eq('id', userId).single();

		if (error) throw error;
		return data as Profile;
	}

	/** Met à jour partiellement le profil d'un utilisateur. */
	async updateProfile(userId: string, patch: Partial<Profile>): Promise<void> {
		const { error } = await this.supabase.from('profiles').update(patch).eq('id', userId);

		if (error) throw error;
	}

	/**
	 * Met à jour le pseudo de l'utilisateur dans Supabase Auth
	 * et dans la table des profils publics.
	 */
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

	/** Crée une nouvelle room de jeu et retourne son identifiant. */
	async createRoom(): Promise<string> {
		const user = this.userSubject.getValue();
		if (!user) throw new Error('Utilisateur non connecté');

		const { data, error } = await this.supabase.from('rooms').insert({ player1_id: user.id, status: 'waiting' }).select('id').single();

		if (error) throw error;
		return (data as { id: string }).id;
	}

	/** Récupère une room par son identifiant. */
	async getRoomById(roomId: string): Promise<Room> {
		const { data, error } = await this.supabase.from('rooms').select('*').eq('id', roomId).single();

		if (error) throw error;
		return data as Room;
	}

	/**
	 * Ajoute l'utilisateur courant à une room existante en tant que joueur 2.
	 * Lance une erreur si la room est pleine, non joignable ou appartient au joueur.
	 */
	async joinRoom(roomId: string): Promise<void> {
		const user = this.userSubject.getValue();
		if (!user) throw new Error('Utilisateur non connecté');

		const room = await this.getRoomById(roomId);

		if (!room) throw new Error('Room introuvable');
		if (room.player2_id) throw new Error('Room déjà complète');
		if (room.status !== 'waiting') throw new Error('Room non joignable');
		if (room.player1_id === user.id) throw new Error('Le créateur ne peut pas rejoindre sa propre room');

		const { error } = await this.supabase.from('rooms').update({ player2_id: user.id, status: 'ready' }).eq('id', roomId).select('*');

		if (error) throw error;
	}

	/** Lance la partie en passant la room au statut 'selecting'. */
	async launchGame(roomId: string, settings: GameSettings): Promise<void> {
		const { error } = await this.supabase.from('rooms').update({ status: 'selecting', settings }).eq('id', roomId);

		if (error) throw error;
	}

	/**
	 * S'abonne aux mises à jour Realtime d'une room via PostgreSQL Changes et Broadcast.
	 * Émet les nouvelles valeurs de la room à chaque modification.
	 */
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
						observer.next(payload.new as Room);
					},
				)
				.on('broadcast', { event: '*' }, ({ event, payload }) => {
					this.broadcastSubject.next({ event, payload });
				})
				.subscribe((status) => {
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

	/**
	 * Met à jour les données d'une room en base.
	 * Lance une erreur si la mise à jour est refusée ou n'affecte aucune ligne.
	 */
    async updateRoom(roomId: string, patch: RoomPatch): Promise<void> {
        const { data, error } = await this.supabase
            .from('rooms')
            .update(patch)
            .eq('id', roomId)
            .select('*');

        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error('UPDATE rooms refusé ou aucune ligne modifiée');
        }
    }

	/** Supprime une room de la base de données. */
	async deleteRoom(roomId: string): Promise<void> {
		const { error } = await this.supabase.from('rooms').delete().eq('id', roomId);

		if (error) throw error;
	}

	// ─── Utilitaire interne ──────────────────────────────────────────────────────

	/**
	 * Diffuse le guess d'un joueur via le canal Broadcast de la room active.
	 * En mode DEV, pousse également localement pour éviter la race condition.
	 */
	async broadcastGuess(pokemonId: number, senderId: string | null): Promise<void> {
		if (this.activeRoomChannel) {
			const eventData = {
				type: 'broadcast',
				event: 'opponent_guess',
				payload: { pokemonId, senderId },
			};

			// En mode DEV, pousser localement en premier pour garantir que opponentLastGuess
			// est défini avant que l'effect DB ne déclenche la modale (channel.send est async)
			if (environment.devMode) {
				this.broadcastSubject.next({ event: eventData.event, payload: eventData.payload });
			}

			await this.activeRoomChannel.send(eventData);
		}
	}

	/** Retourne l'utilisateur courant ou null s'il n'est pas connecté. */
	getCurrentUser(): User | null {
		return this.userSubject.getValue();
	}
}
