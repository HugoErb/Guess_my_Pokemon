import { Injectable, OnDestroy, signal } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map, skipUntil } from 'rxjs/operators';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { FriendRequest, FriendStatus, FriendWithStatus, Friendship, GameInvite, GameMode, GameSettings, Profile, Room, RoomPatch, StatDuelRoom, StatPick } from '../models/room.model';

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

        if (!data.session) {
            // Confirmation email requise — le profil sera créé par ensureProfile après confirmation
            throw new Error('Un email de confirmation a été envoyé. Clique sur le lien dans ta boîte mail pour activer ton compte.');
        }

        const { error: profileError } = await this.supabase
            .from('profiles')
            .upsert({ id: user.id, username }, { onConflict: 'id', ignoreDuplicates: true });

        if (profileError) {
            if (profileError.code === '23505') throw new Error('Ce nom d\'utilisateur est déjà utilisé.');
            throw new Error(profileError.message);
        }
    }

    /**
     * Crée le profil utilisateur s'il n'existe pas encore en base.
     * Utilisé après la confirmation email.
     */
    async ensureProfile(userId: string, username?: string): Promise<void> {
        const { data } = await this.supabase.from('profiles').select('id').eq('id', userId).maybeSingle();

        if (!data && username) {
            await this.supabase.from('profiles').insert({ id: userId, username: username.trim() });
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
        const trimmed = newUsername.trim();
        // 1. Mettre à jour les métadonnées de l'utilisateur (Auth)
        const { error: authError } = await this.supabase.auth.updateUser({
            data: {
                username: trimmed,
                display_name: trimmed,
            },
        });
        if (authError) throw authError;

        // 2. Mettre à jour la table des profils (Public)
        const { error: profileError } = await this.supabase.from('profiles').update({ username: trimmed }).eq('id', userId);
        if (profileError) {
            if (profileError.code === '23505') throw new Error('Ce nom d\'utilisateur est déjà utilisé.');
            throw profileError;
        }
    }

    // ─── Rooms ───────────────────────────────────────────────────────────────────

    /** Crée une nouvelle room de jeu (Guess my Pokémon) et retourne son identifiant. */
    async createRoom(): Promise<string> {
        const user = this.userSubject.getValue();
        if (!user) throw new Error('Utilisateur non connecté');

        const { data, error } = await this.supabase.from('guess_pokemon_rooms').insert({ player1_id: user.id, status: 'waiting' }).select('id').single();

        if (error) throw error;
        return (data as { id: string }).id;
    }

    /** Récupère une room (Guess my Pokémon) par son identifiant. */
    async getRoomById(roomId: string): Promise<Room> {
        const { data, error } = await this.supabase.from('guess_pokemon_rooms').select('*').eq('id', roomId).single();

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

        const { error } = await this.supabase.from('guess_pokemon_rooms').update({ player2_id: user.id, status: 'ready' }).eq('id', roomId).select('*');

        if (error) throw error;
    }

    /** Lance la partie en passant la room au statut 'selecting'. */
    async launchGame(roomId: string, settings: GameSettings): Promise<void> {
        const { error } = await this.supabase.from('guess_pokemon_rooms').update({ status: 'selecting', settings }).eq('id', roomId);

        if (error) throw error;
    }

    /**
     * S'abonne aux mises à jour Realtime d'une room (Guess my Pokémon) via PostgreSQL Changes et Broadcast.
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
                        table: 'guess_pokemon_rooms',
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
     * Met à jour les données d'une room (Guess my Pokémon) en base.
     * Lance une erreur si la mise à jour est refusée ou n'affecte aucune ligne.
     */
    async updateRoom(roomId: string, patch: RoomPatch): Promise<void> {
        const { data, error } = await this.supabase
            .from('guess_pokemon_rooms')
            .update(patch)
            .eq('id', roomId)
            .select('*');

        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error('UPDATE guess_pokemon_rooms refusé ou aucune ligne modifiée');
        }
    }

    /** Supprime une room (Guess my Pokémon) de la base de données. */
    async deleteRoom(roomId: string): Promise<void> {
        const { error } = await this.supabase.from('guess_pokemon_rooms').delete().eq('id', roomId);

        if (error) throw error;
    }

    // ─── Stat Duel Rooms ─────────────────────────────────────────────────────────

    /** Crée une nouvelle room Duel de Base Stats et retourne son identifiant. */
    async createStatDuelRoom(): Promise<string> {
        const user = this.userSubject.getValue();
        if (!user) throw new Error('Utilisateur non connecté');

        const { data, error } = await this.supabase
            .from('stat_duel_rooms')
            .insert({ player1_id: user.id, status: 'waiting' })
            .select('id')
            .single();

        if (error) throw error;
        return (data as { id: string }).id;
    }

    /** Récupère une room Duel de Base Stats par son identifiant. */
    async getStatDuelRoom(roomId: string): Promise<StatDuelRoom> {
        const { data, error } = await this.supabase
            .from('stat_duel_rooms')
            .select('*')
            .eq('id', roomId)
            .single();

        if (error) throw error;
        return data as StatDuelRoom;
    }

    /** Ajoute l'utilisateur courant en tant que joueur 2 d'une room Duel de Base Stats. */
    async joinStatDuelRoom(roomId: string): Promise<void> {
        const user = this.userSubject.getValue();
        if (!user) throw new Error('Utilisateur non connecté');

        const { error } = await this.supabase
            .from('stat_duel_rooms')
            .update({ player2_id: user.id })
            .eq('id', roomId);

        if (error) throw error;
    }

    /** Met à jour les données d'une room Duel de Base Stats. */
    async updateStatDuelRoom(roomId: string, patch: Partial<StatDuelRoom>): Promise<void> {
        const { error } = await this.supabase
            .from('stat_duel_rooms')
            .update(patch)
            .eq('id', roomId);

        if (error) throw error;
    }

    /** Ajoute un pick de stat dans p1_picks ou p2_picks via concaténation JSON. */
    async appendStatPick(roomId: string, column: 'p1_picks' | 'p2_picks', pick: StatPick): Promise<void> {
        const { data: current, error: fetchError } = await this.supabase
            .from('stat_duel_rooms')
            .select(column)
            .eq('id', roomId)
            .single();

        if (fetchError) throw fetchError;

        const existing: StatPick[] = (current as any)[column] ?? [];
        const updated = [...existing, pick];

        const { error } = await this.supabase
            .from('stat_duel_rooms')
            .update({ [column]: updated })
            .eq('id', roomId);

        if (error) throw error;
    }

    /** S'abonne aux mises à jour Realtime d'une room Duel de Base Stats. */
    subscribeToStatDuelRoom(roomId: string): Observable<StatDuelRoom> {
        return new Observable<StatDuelRoom>((observer) => {
            const channel = this.supabase
                .channel(`stat-duel-${roomId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'stat_duel_rooms',
                        filter: `id=eq.${roomId}`,
                    },
                    (payload) => {
                        observer.next(payload.new as StatDuelRoom);
                    },
                )
                .subscribe((status) => {
                    if (status === 'CHANNEL_ERROR') {
                        observer.error(new Error(`Erreur canal stat-duel-${roomId}`));
                    }
                });

            return () => { this.supabase.removeChannel(channel); };
        });
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

    /** Diffuse l'événement de départ d'un joueur via le canal Broadcast de la room active. */
    async broadcastPlayerLeft(): Promise<void> {
        if (this.activeRoomChannel) {
            await this.activeRoomChannel.send({
                type: 'broadcast',
                event: 'player_left',
                payload: {},
            });
        }
    }

    /** Retourne l'utilisateur courant ou null s'il n'est pas connecté. */
    getCurrentUser(): User | null {
        return this.userSubject.getValue();
    }

    // ─── Présence ────────────────────────────────────────────────────────────────

    private presenceChannel: any = null;
    private readonly presenceStateSubject = new BehaviorSubject<Record<string, any[]>>({});

    /** Rejoint le canal de présence global et diffuse le statut de l'utilisateur. */
    trackPresence(status: 'online' | 'in_game'): void {
        const user = this.getCurrentUser();
        if (!user) return;

        if (this.presenceChannel) {
            this.supabase.removeChannel(this.presenceChannel);
            this.presenceChannel = null;
        }

        const channel = this.supabase.channel('presence-home', {
            config: { presence: { key: user.id } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                this.presenceStateSubject.next(channel.presenceState());
            })
            .subscribe(async (s: string) => {
                if (s === 'SUBSCRIBED') {
                    await channel.track({ user_id: user.id, status });
                }
            });

        this.presenceChannel = channel;
    }

    /** Quitte le canal de présence et remet l'état à vide. */
    untrackPresence(): void {
        if (this.presenceChannel) {
            this.supabase.removeChannel(this.presenceChannel);
            this.presenceChannel = null;
        }
        this.presenceStateSubject.next({});
    }

    /** Retourne un Observable du statut de présence de chaque ami. */
    subscribeToFriendsPresence(friendIds: string[]): Observable<Map<string, FriendStatus>> {
        return this.presenceStateSubject.pipe(
            map((state) => {
                const result = new Map<string, FriendStatus>();
                for (const id of friendIds) result.set(id, 'offline');
                for (const [key, presences] of Object.entries(state)) {
                    if (friendIds.includes(key) && presences.length > 0) {
                        const p = presences[0] as { status: 'online' | 'in_game' };
                        result.set(key, p.status ?? 'offline');
                    }
                }
                return result;
            }),
        );
    }

    // ─── Amis ────────────────────────────────────────────────────────────────────

    /** Envoie une demande d'ami à l'utilisateur portant le pseudo donné. */
    async sendFriendRequest(username: string): Promise<void> {
        const me = this.getCurrentUser();
        if (!me) throw new Error('Non connecté');

        const { data: profile, error: profileError } = await this.supabase
            .from('profiles')
            .select('id')
            .ilike('username', username.trim())
            .maybeSingle();

        if (profileError || !profile) throw new Error('Utilisateur introuvable');
        if (profile.id === me.id) throw new Error('Tu ne peux pas t\'ajouter toi-même');

        const { data: existing } = await this.supabase
            .from('friendships')
            .select('id')
            .or(`and(requester_id.eq.${me.id},recipient_id.eq.${profile.id}),and(requester_id.eq.${profile.id},recipient_id.eq.${me.id})`)
            .maybeSingle();

        if (existing) throw new Error('Déjà ami ou demande déjà envoyée');

        const { error } = await this.supabase
            .from('friendships')
            .insert({ requester_id: me.id, recipient_id: profile.id });

        if (error) throw error;
    }

    /** Récupère la liste des amis acceptés avec leurs profils. */
    async getFriendsWithStatus(): Promise<FriendWithStatus[]> {
        const me = this.getCurrentUser();
        if (!me) return [];

        const { data: friendships } = await this.supabase
            .from('friendships')
            .select('*')
            .eq('status', 'accepted')
            .or(`requester_id.eq.${me.id},recipient_id.eq.${me.id}`);

        if (!friendships?.length) return [];

        const friendIds = friendships.map((f: Friendship) => (f.requester_id === me.id ? f.recipient_id : f.requester_id));
        const { data: profiles } = await this.supabase.from('profiles').select('id, username, avatar_url').in('id', friendIds);
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

        return friendships.map((f: Friendship) => {
            const friendId = f.requester_id === me.id ? f.recipient_id : f.requester_id;
            const profile = profileMap.get(friendId);
            return { id: f.id, friendId, username: profile?.username ?? 'Inconnu', avatarUrl: profile?.avatar_url, status: 'offline' as FriendStatus };
        });
    }

    /** Récupère les demandes d'amitié en attente adressées à l'utilisateur courant. */
    async getPendingRequests(): Promise<FriendRequest[]> {
        const me = this.getCurrentUser();
        if (!me) return [];

        const { data: friendships } = await this.supabase
            .from('friendships')
            .select('*')
            .eq('status', 'pending')
            .eq('recipient_id', me.id);

        if (!friendships?.length) return [];

        const requesterIds = friendships.map((f: Friendship) => f.requester_id);
        const { data: profiles } = await this.supabase.from('profiles').select('id, username, avatar_url').in('id', requesterIds);
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

        return friendships.map((f: Friendship) => {
            const profile = profileMap.get(f.requester_id);
            return { id: f.id, requesterId: f.requester_id, username: profile?.username ?? 'Inconnu', avatarUrl: profile?.avatar_url };
        });
    }

    /** Accepte une demande d'amitié. */
    async acceptFriendRequest(friendshipId: string): Promise<void> {
        const { error } = await this.supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
        if (error) throw error;
    }

    /** Refuse (supprime) une demande d'amitié. */
    async declineFriendRequest(friendshipId: string): Promise<void> {
        const { error } = await this.supabase.from('friendships').delete().eq('id', friendshipId);
        if (error) throw error;
    }

    async removeFriend(friendshipId: string): Promise<void> {
        const { error } = await this.supabase.from('friendships').delete().eq('id', friendshipId);
        if (error) throw error;
    }

    /** S'abonne aux changements de la table friendships pour l'utilisateur courant. */
    subscribeToFriendships(): Observable<void> {
        return new Observable((observer) => {
            const userId = this.getCurrentUser()?.id;
            if (!userId) return;

            const channel = this.supabase
                .channel(`friendships-${userId}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
                    observer.next();
                })
                .subscribe();

            return () => { this.supabase.removeChannel(channel); };
        });
    }

    // ─── Invitations de jeu ──────────────────────────────────────────────────────

    /** Crée une room et une invitation de jeu pour un ami dans le mode choisi. */
    async sendGameInvite(recipientId: string, gameMode: GameMode = 'guess_my_pokemon'): Promise<{ roomId: string; inviteId: string }> {
        const me = this.getCurrentUser();
        if (!me) throw new Error('Non connecté');

        const roomId = gameMode === 'stat_duel'
            ? await this.createStatDuelRoom()
            : await this.createRoom();

        const { data, error } = await this.supabase
            .from('game_invites')
            .insert({ sender_id: me.id, recipient_id: recipientId, room_id: roomId, game_mode: gameMode })
            .select('id')
            .single();

        if (error) throw error;
        return { roomId, inviteId: (data as { id: string }).id };
    }

    /** Accepte une invitation de jeu et rejoint la room correspondant au mode. */
    async acceptGameInvite(inviteId: string, roomId: string, gameMode: GameMode = 'guess_my_pokemon'): Promise<void> {
        const joinFn = gameMode === 'stat_duel'
            ? this.joinStatDuelRoom(roomId)
            : this.joinRoom(roomId);

        await Promise.all([
            this.supabase.from('game_invites').update({ status: 'accepted' }).eq('id', inviteId),
            joinFn,
        ]);
    }

    /** Refuse une invitation de jeu. */
    async declineGameInvite(inviteId: string): Promise<void> {
        const { error } = await this.supabase.from('game_invites').update({ status: 'declined' }).eq('id', inviteId);
        if (error) throw error;
    }

    /** S'abonne aux nouvelles invitations de jeu reçues par l'utilisateur courant. */
    subscribeToIncomingGameInvites(): Observable<GameInvite> {
        return new Observable((observer) => {
            const userId = this.getCurrentUser()?.id;
            if (!userId) return;

            const channel = this.supabase
                .channel(`incoming-invites-${userId}`)
                .on(
                    'postgres_changes',
                    { event: 'INSERT', schema: 'public', table: 'game_invites', filter: `recipient_id=eq.${userId}` },
                    async (payload: any) => {
                        const invite = payload.new as GameInvite;
                        const { data: profile } = await this.supabase.from('profiles').select('username').eq('id', invite.sender_id).single();
                        observer.next({ ...invite, sender_profile: profile ? { username: (profile as any).username } : undefined });
                    },
                )
                .subscribe();

            return () => { this.supabase.removeChannel(channel); };
        });
    }

    /** S'abonne aux mises à jour d'une invitation de jeu spécifique (accept/decline). */
    subscribeToGameInviteResponse(inviteId: string): Observable<GameInvite> {
        return new Observable((observer) => {
            const channel = this.supabase
                .channel(`invite-response-${inviteId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'game_invites', filter: `id=eq.${inviteId}` },
                    (payload: any) => { observer.next(payload.new as GameInvite); },
                )
                .subscribe();

            return () => { this.supabase.removeChannel(channel); };
        });
    }
}
