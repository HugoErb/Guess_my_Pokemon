import { computed, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { DEFAULT_SETTINGS, GameSettings, Room, RoomPatch } from '../models/room.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class GameService implements OnDestroy {
  private readonly supabaseService = inject(SupabaseService);

  /** Signal Angular : room en cours de jeu, null si aucune. */
  currentRoom = signal<Room | null>(null);

  private roomSubscription: Subscription | null = null;

  // ─── Watch de la room ────────────────────────────────────────────────────────

  async joinAndWatch(roomId: string): Promise<void> {
    this.stopWatching();
    this.roomSubscription = this.supabaseService
      .subscribeToRoom(roomId)
      .subscribe({
        next: updatedRoom => {
          this.currentRoom.set(updatedRoom);
        },
        error: err => {
          console.error('[GameService] Erreur Realtime:', err);
          // Si on perd la connexion, on tente quand même de rafraîchir une fois manuellement
          void this.refreshRoom(roomId);
        }
      });
    // 2. Charger l'état initial ensuite
    const room = await this.supabaseService.getRoomById(roomId);
    this.currentRoom.set(room);
  }

  stopWatching(): void {
    if (this.roomSubscription) {
      this.roomSubscription.unsubscribe();
      this.roomSubscription = null;
    }
  }

  async cancelRoom(roomId: string): Promise<void> {
    this.stopWatching();
    await this.supabaseService.deleteRoom(roomId);
    this.currentRoom.set(null);
  }

  async simulateOpponentReady(roomId: string, pokemonId: number): Promise<void> {
    const room = this.currentRoom();
    if (!room) throw new Error('Aucune room active');

    await this.updateAndRefresh(roomId, {
      pokemon_p2: pokemonId,
      p2_ready: true,
      status: 'playing',
      current_turn: room.player1_id,
    });
  }

  async simulateOpponent(roomId: string): Promise<void> {
    const user = this.supabaseService.getCurrentUser();
    if (!user) throw new Error('Utilisateur non connecté');

    await this.updateAndRefresh(roomId, {
      player2_id: user.id,
      status: 'ready',
    });
  }

  ngOnDestroy(): void {
    this.stopWatching();
  }

  // ─── Actions de jeu ──────────────────────────────────────────────────────────

  async launchGame(roomId: string, settings: GameSettings): Promise<void> {
    await this.updateAndRefresh(roomId, { status: 'selecting', settings });
  }

  async updateSettings(roomId: string, settings: GameSettings): Promise<void> {
    await this.supabaseService.updateRoom(roomId, { settings });
    const refreshed = await this.supabaseService.getRoomById(roomId);
    this.currentRoom.set(refreshed);
  }

  async selectPokemon(roomId: string, pokemonId: number): Promise<void> {
    const user = this.supabaseService.getCurrentUser();
    if (!user) throw new Error('Utilisateur non connecté');

    const room = this.currentRoom();
    if (!room) throw new Error('Aucune room active');

    const patch: RoomPatch = user.id === room.player1_id
      ? { pokemon_p1: pokemonId }
      : { pokemon_p2: pokemonId };

    await this.supabaseService.updateRoom(roomId, patch);
  }

  async setReady(roomId: string): Promise<void> {
    const user = this.supabaseService.getCurrentUser();
    if (!user) throw new Error('Utilisateur non connecté');

    const room = this.currentRoom();
    if (!room) throw new Error('Aucune room active');

    const isPlayer1 = user.id === room.player1_id;
    const patch: RoomPatch = isPlayer1 ? { p1_ready: true } : { p2_ready: true };

    // NOTE: Cette logique de transition est calculée côté client depuis le signal currentRoom.
    // Si deux joueurs appellent setReady() simultanément, une course est possible.
    // Idéalement, cette transition devrait être gérée par une Postgres Function côté Supabase.
    // Vérifier si l'adversaire est déjà prêt
    const otherReady = isPlayer1 ? room.p2_ready : room.p1_ready;
    if (otherReady) {
      // Les deux joueurs sont prêts : démarrer la partie
      Object.assign(patch, {
        status: 'playing',
        current_turn: room.player1_id,
      } satisfies Partial<Room>);
    }

    await this.updateAndRefresh(roomId, patch);
  }

  async guess(roomId: string, pokemonId: number): Promise<'correct' | 'incorrect'> {
    const user = this.supabaseService.getCurrentUser();
    if (!user) throw new Error('Utilisateur non connecté');

    const room = this.currentRoom();
    if (!room) throw new Error('Aucune room active');

    const isPlayer1 = user.id === room.player1_id;

    // Le Pokémon adverse : player1 cherche pokemon_p2 et vice-versa
    const adversaryPokemonId = isPlayer1 ? room.pokemon_p2 : room.pokemon_p1;
    const adversaryId = isPlayer1 ? room.player2_id : room.player1_id;

    if (adversaryPokemonId === null) throw new Error('L\'adversaire n\'a pas encore choisi de Pokémon');

    if (pokemonId === adversaryPokemonId) {
      // Bonne réponse : fin de partie
      await this.updateAndRefresh(roomId, {
        winner_id: user.id,
        status: 'finished',
      });
      return 'correct';
    } else {
      // Mauvaise réponse : passage de tour
      if (!adversaryId) throw new Error('Adversaire introuvable');
      await this.updateAndRefresh(roomId, {
        current_turn: adversaryId,
      });
      return 'incorrect';
    }
  }

  /** Rafraîchit manuellement l'état de la room. */
  async refreshRoom(roomId: string): Promise<void> {
    try {
      const room = await this.supabaseService.getRoomById(roomId);
      this.currentRoom.set(room);
    } catch (err) {
      console.error('[GameService] Impossible de rafraîchir la room:', err);
    }
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

  readonly settings = computed(() => this.currentRoom()?.settings ?? DEFAULT_SETTINGS);
}
