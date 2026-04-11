import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Room, RoomPatch } from '../models/room.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class GameService implements OnDestroy {
  private supabaseService = inject(SupabaseService);

  /** Signal Angular : room en cours de jeu, null si aucune. */
  currentRoom = signal<Room | null>(null);

  private roomSubscription: Subscription | null = null;

  // ─── Watch de la room ────────────────────────────────────────────────────────

  async joinAndWatch(roomId: string): Promise<void> {
    this.stopWatching();
    // 1. S'abonner d'abord pour ne rater aucune mise à jour
    this.roomSubscription = this.supabaseService
      .subscribeToRoom(roomId)
      .subscribe(updatedRoom => {
        this.currentRoom.set(updatedRoom);
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

  ngOnDestroy(): void {
    this.stopWatching();
  }

  // ─── Actions de jeu ──────────────────────────────────────────────────────────

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

    await this.supabaseService.updateRoom(roomId, patch);
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
      await this.supabaseService.updateRoom(roomId, {
        winner_id: user.id,
        status: 'finished',
      });
      return 'correct';
    } else {
      // Mauvaise réponse : passage de tour
      if (!adversaryId) throw new Error('Adversaire introuvable');
      await this.supabaseService.updateRoom(roomId, {
        current_turn: adversaryId,
      });
      return 'incorrect';
    }
  }

  // ─── Helpers d'état ──────────────────────────────────────────────────────────

  isMyTurn(): boolean {
    const room = this.currentRoom();
    const user = this.supabaseService.getCurrentUser();
    if (!room || !user) return false;
    return room.current_turn === user.id;
  }

  isPlayer1(): boolean {
    const room = this.currentRoom();
    const user = this.supabaseService.getCurrentUser();
    if (!room || !user) return false;
    return room.player1_id === user.id;
  }
}
