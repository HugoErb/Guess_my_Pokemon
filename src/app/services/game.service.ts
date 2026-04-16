import { computed, inject, Injectable, isDevMode, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { DEFAULT_SETTINGS, GameSettings, Room, RoomPatch } from '../models/room.model';
import { SupabaseService } from './supabase.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GameService implements OnDestroy {
    private readonly supabaseService = inject(SupabaseService);
    private pollInterval: any;

    /** Signal Angular : room en cours de jeu, null si aucune. */
    currentRoom = signal<Room | null>(null, {
        equal: (a, b) => {
            if (a === b) return true;
            if (!a || !b) return false;
            return (
                a.status === b.status &&
                a.current_turn === b.current_turn &&
                a.winner_id === b.winner_id &&
                a.p1_ready === b.p1_ready &&
                a.p2_ready === b.p2_ready &&
                a.pokemon_p1 === b.pokemon_p1 &&
                a.pokemon_p2 === b.pokemon_p2 &&
                JSON.stringify(a.settings) === JSON.stringify(b.settings)
            );
        }
    });

    /** Retourne true si l'application est en mode développement. */
    isDev(): boolean {
        return environment.devMode && isDevMode();
    }

    /** Événements diffusés en direct (broadcast) */
    broadcastEvents$ = this.supabaseService.broadcastEvents$;

    private roomSubscription: Subscription | null = null;

    // ─── Watch de la room ────────────────────────────────────────────────────────

    /**
     * Rejoint une room et s'abonne aux mises à jour Realtime.
     * Charge également l'état initial de la room et démarre un polling de secours.
     */
    async joinAndWatch(roomId: string): Promise<void> {
        this.stopWatching();
        this.roomSubscription = this.supabaseService.subscribeToRoom(roomId).subscribe({
            next: (updatedRoom) => {
                this.currentRoom.set(updatedRoom);
            },
            error: () => {
                // Si on perd la connexion, on tente quand même de rafraîchir une fois manuellement
                void this.refreshRoom(roomId);
            },
        });
        // 2. Charger l'état initial ensuite
        const room = await this.supabaseService.getRoomById(roomId);
        this.currentRoom.set(room);

        this.pollInterval && clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            void this.refreshRoom(roomId);
        }, 1000);
    }

    /** Arrête l'abonnement Realtime de la room courante. */
    stopWatching(): void {
        if (this.roomSubscription) {
            this.roomSubscription.unsubscribe();
            this.roomSubscription = null;
        }
    }

    /** Annule la room, arrête le watch et réinitialise l'état local. */
    async cancelRoom(roomId: string): Promise<void> {
        this.stopWatching();
        await this.supabaseService.deleteRoom(roomId);
        this.currentRoom.set(null);
    }

    /**
     * DEV : Simule l'adversaire en choisissant un Pokémon et en passant
     * au statut 'playing' avec le premier tour résolu.
     */
    async simulateOpponentReady(roomId: string, pokemonId: number): Promise<void> {
        const room = this.currentRoom();
        if (!room) throw new Error('Aucune room active');

        const refreshedForTurn = await this.supabaseService.getRoomById(roomId);
        await this.updateAndRefresh(roomId, {
            pokemon_p2: pokemonId,
            p2_ready: true,
            status: 'playing',
            current_turn: this.resolveFirstTurn(refreshedForTurn),
        });
    }

    /** DEV : Simule un adversaire sans compte réel dans la room. */
    async simulateOpponent(roomId: string): Promise<void> {
        const user = this.supabaseService.getCurrentUser();
        if (!user) throw new Error('Utilisateur non connecté');

        await this.updateAndRefresh(roomId, {
            player2_id: null,
            status: 'ready',
        });
    }

    /** Lifecycle Angular — arrête le watch de la room. */
    ngOnDestroy(): void {
        this.stopWatching();
    }

    // ─── Actions de jeu ──────────────────────────────────────────────────────────

    /** Passe la room en phase de sélection de Pokémon avec les paramètres fournis. */
    async launchGame(roomId: string, settings: GameSettings): Promise<void> {
        await this.updateAndRefresh(roomId, { status: 'selecting', settings });
    }

    /** Met à jour les paramètres de la partie et rafraîchit le signal local. */
    async updateSettings(roomId: string, settings: GameSettings): Promise<void> {
        await this.supabaseService.updateRoom(roomId, { settings });
        const refreshed = await this.supabaseService.getRoomById(roomId);
        this.currentRoom.set(refreshed);
    }

    /** Enregistre le Pokémon choisi par le joueur courant (p1 ou p2 selon son rôle). */
    async selectPokemon(roomId: string, pokemonId: number): Promise<void> {
        const user = this.supabaseService.getCurrentUser();
        if (!user) throw new Error('Utilisateur non connecté');

        const room = this.currentRoom();
        if (!room) throw new Error('Aucune room active');

        const patch: RoomPatch = user.id === room.player1_id ? { pokemon_p1: pokemonId } : { pokemon_p2: pokemonId };

        await this.supabaseService.updateRoom(roomId, patch);
    }

    /**
     * Marque le joueur courant comme prêt.
     * Si les deux joueurs sont prêts, lance la partie et détermine le premier tour.
     */
    async setReady(roomId: string): Promise<void> {
        const user = this.supabaseService.getCurrentUser();
        if (!user) throw new Error('Utilisateur non connecté');

        const room = this.currentRoom();
        if (!room) throw new Error('Aucune room active');

        const isPlayer1 = user.id === room.player1_id;
        const patch: RoomPatch = isPlayer1 ? { p1_ready: true } : { p2_ready: true };

        await this.supabaseService.updateRoom(roomId, patch);

        const refreshed = await this.supabaseService.getRoomById(roomId);

        if (refreshed.p1_ready && refreshed.p2_ready && refreshed.status === 'selecting') {
            await this.supabaseService.updateRoom(roomId, {
                status: 'playing',
                current_turn: this.resolveFirstTurn(refreshed),
            });
            const finalRoom = await this.supabaseService.getRoomById(roomId);
            this.currentRoom.set(finalRoom);
            return;
        }

        this.currentRoom.set(refreshed);
    }

    /**
     * Soumet un guess de Pokémon par le joueur courant.
     * Retourne `'correct'` si le Pokémon est trouvé (fin de partie),
     * ou `'incorrect'` si le tour passe à l'adversaire.
     */
    async guess(roomId: string, pokemonId: number): Promise<'correct' | 'incorrect'> {
        const user = this.supabaseService.getCurrentUser();
        if (!user) throw new Error('Utilisateur non connecté');

        const room = this.currentRoom();
        if (!room) throw new Error('Aucune room active');

        const isPlayer1 = user.id === room.player1_id;

        // Le Pokémon adverse : player1 cherche pokemon_p2 et vice-versa
        const adversaryPokemonId = isPlayer1 ? room.pokemon_p2 : room.pokemon_p1;
        let adversaryId = isPlayer1 ? room.player2_id : room.player1_id;

        // Fallback pour le mode dev si l'adversaire simulé n'a pas d'ID
        if (this.isDev() && !adversaryId) {
            adversaryId = null; // Le tour passera à null, ce qui désactivera le tour du joueur 1
        }

        if (adversaryPokemonId === null) throw new Error("L'adversaire n'a pas encore choisi de Pokémon");

        if (pokemonId === adversaryPokemonId) {
            // Bonne réponse : fin de partie
            await this.updateAndRefresh(roomId, {
                winner_id: user.id,
                status: 'finished',
                p1_ready: false,
                p2_ready: false,
            });
            return 'correct';
        } else {
            // Mauvaise réponse : passage de tour
            if (!adversaryId && !this.isDev()) throw new Error('Adversaire introuvable');

            // Diffuser le guess à l'adversaire via Broadcast
            void this.supabaseService.broadcastGuess(pokemonId, user.id);

            await this.updateAndRefresh(roomId, {
                current_turn: adversaryId,
            });
            return 'incorrect';
        }
    }

    /**
     * DEV : Simule un guess de l'adversaire.
     */
    async simulateOpponentGuess(roomId: string, pokemonId: number): Promise<'correct' | 'incorrect'> {
        const room = this.currentRoom();
        if (!room) throw new Error('Aucune room active');

        const isPlayer1 = this.isPlayer1();
        const targetPokemonId = isPlayer1 ? room.pokemon_p1 : room.pokemon_p2;

        if (pokemonId === targetPokemonId) {
            await this.updateAndRefresh(roomId, {
                winner_id: isPlayer1 ? room.player2_id : room.player1_id,
                status: 'finished',
                p1_ready: false,
                p2_ready: false,
            });
            return 'correct';
        } else {
            void this.supabaseService.broadcastGuess(pokemonId, null);
            await this.updateAndRefresh(roomId, {
                current_turn: room.player1_id,
            });
            return 'incorrect';
        }
    }

    /**
     * Demande une revanche.
     * Si les deux joueurs acceptent, la partie repasse en mode sélection.
     */
    async requestReplay(roomId: string): Promise<void> {
        const user = this.supabaseService.getCurrentUser();
        if (!user) throw new Error('Utilisateur non connecté');

        const room = this.currentRoom();
        if (!room) throw new Error('Aucune room active');

        const isPlayer1 = this.isPlayer1();
        const patch: RoomPatch = isPlayer1 ? { p1_ready: true } : { p2_ready: true };

        await this.supabaseService.updateRoom(roomId, patch);

        const refreshed = await this.supabaseService.getRoomById(roomId);

        if (refreshed.p1_ready && refreshed.p2_ready && refreshed.status === 'finished') {
            await this.supabaseService.updateRoom(roomId, {
                status: 'selecting',
                pokemon_p1: null,
                pokemon_p2: null,
                p1_ready: false,
                p2_ready: false,
                winner_id: null,
                current_turn: null,
            });

            const finalRoom = await this.supabaseService.getRoomById(roomId);
            this.currentRoom.set(finalRoom);
            return;
        }

        this.currentRoom.set(refreshed);
    }

    /**
     * DEV : Simule l'acceptation d'une revanche par l'adversaire.
     */
    async simulateOpponentReplay(roomId: string): Promise<void> {
        const room = this.currentRoom();
        if (!room) throw new Error('Aucune room active');

        const isPlayer1 = this.isPlayer1();
        // On veut simuler l'action de l'AUTRE joueur
        const patch: RoomPatch = isPlayer1 ? { p2_ready: true } : { p1_ready: true };

        const opponentAlreadyRequested = isPlayer1 ? room.p1_ready : room.p2_ready;

        if (opponentAlreadyRequested) {
            Object.assign(patch, {
                status: 'selecting',
                pokemon_p1: null,
                pokemon_p2: null,
                p1_ready: false,
                p2_ready: false,
                winner_id: null,
                current_turn: null,
            } satisfies RoomPatch);
        }

        await this.updateAndRefresh(roomId, patch);
    }

    /** Rafraîchit manuellement l'état de la room. */
    async refreshRoom(roomId: string): Promise<void> {
        try {
            const room = await this.supabaseService.getRoomById(roomId);
            this.currentRoom.set(room);
        } catch {
            // ignore les erreurs de rafraîchissement
        }
    }

    /**
     * Détermine l'identifiant du joueur qui commence la partie
     * selon le paramètre `firstPlayer` des settings.
     */
    private resolveFirstTurn(room: Room): string {
        const fp = room.settings?.firstPlayer ?? 'player1';
        // player2_id peut être null en mode dev (adversaire simulé sans compte réel) : fallback sur player1
        if (fp === 'player2') return room.player2_id ?? room.player1_id;
        if (fp === 'random') return Math.random() < 0.5 ? room.player1_id : (room.player2_id ?? room.player1_id);
        return room.player1_id; // 'player1' ou fallback
    }

    // ─── Helpers internes ─────────────────────────────────────────────────────────

    /**
     * Met à jour la room en base ET rafraîchit immédiatement le signal local.
     * Cela garantit que le watcher réagit même si le Realtime Supabase est lent ou absent.
     */
    private async updateAndRefresh(roomId: string, patch: RoomPatch): Promise<void> {
        await this.supabaseService.updateRoom(roomId, patch);
        const refreshed = await this.supabaseService.getRoomById(roomId);
        this.currentRoom.set(refreshed);
    }

    // ─── Helpers d'état ──────────────────────────────────────────────────────────

    readonly isMyTurn = computed(() => {
        const room = this.currentRoom();
        const user = this.supabaseService.currentUserSignal();
        if (!room || !user) return false;
        return room.current_turn === user.id;
    });

    readonly isPlayer1 = computed(() => {
        const room = this.currentRoom();
        const user = this.supabaseService.currentUserSignal();
        if (!room || !user) return false;
        return room.player1_id === user.id;
    });

    readonly settings = computed(() => {
        const room = this.currentRoom();
        return room?.settings ?? DEFAULT_SETTINGS;
    }, { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) });
}
