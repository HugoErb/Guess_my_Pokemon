import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  input,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, filter, take, Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { environment } from '../../../environments/environment';
import { GameService } from '../../services/game.service';
import { PokemonService } from '../../services/pokemon.service';
import { SupabaseService } from '../../services/supabase.service';
import { Pokemon } from '../../models/pokemon.model';

@Component({
  selector: 'app-lobby',
  imports: [FormsModule],
  template: `
    <div class="min-h-screen bg-slate-900 text-white flex flex-col">

      <!-- Header -->
      <header class="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-lg font-bold">P</div>
        <h1 class="text-xl font-bold text-white">Guess My Pokémon</h1>
      </header>

      @if (!room() && isLoading) {
        <div class="flex items-center justify-center h-64">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
        </div>
      }

      <!-- Phase 1 : En attente du 2ème joueur -->
      @if (room()?.player2_id === null) {
        <div class="flex-1 flex items-center justify-center p-6">
          <div class="bg-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-slate-700">
            <div class="text-4xl mb-4">⏳</div>
            <h2 class="text-2xl font-bold mb-2">En attente de ton adversaire…</h2>
            <p class="text-slate-400 mb-6">Partage ce lien à ton ami pour qu'il rejoigne la partie :</p>

            <!-- Lien d'invitation -->
            <div class="flex gap-2 mb-4">
              <input
                type="text"
                [value]="inviteLink"
                readonly
                class="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300 truncate focus:outline-none"
              />
              <button
                (click)="copyInviteLink()"
                [class]="copied
                  ? 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap'
                  : 'bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap'"
              >
                {{ copied ? 'Lien copié ! ✓' : '📋 Copier' }}
              </button>
            </div>

            <!-- Spinner -->
            <div class="flex justify-center mt-6">
              <div class="w-10 h-10 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
            </div>

            <!-- Bouton Annuler -->
            <button
              (click)="cancelRoom()"
              [disabled]="isCancelling"
              class="mt-6 w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors"
            >
              {{ isCancelling ? 'Annulation…' : 'Annuler' }}
            </button>

            <!-- Bouton mode dev -->
            @if (devMode) {
              <button
                (click)="simulateOpponent()"
                [disabled]="isSimulating"
                class="mt-2 w-full bg-amber-800/50 hover:bg-amber-700/50 border border-amber-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium text-amber-300 transition-colors"
              >
                {{ isSimulating ? 'Simulation en cours…' : '⚙ Simuler adversaire [DEV]' }}
              </button>
            }
          </div>
        </div>
      }

      <!-- Phase 2 : Sélection du Pokémon -->
      @if (room()?.player2_id !== null) {
        <div class="flex-1 flex flex-col overflow-hidden">

          <!-- Contenu principal en deux colonnes -->
          <div class="flex-1 flex overflow-hidden">

            <!-- Colonne gauche : ton Pokémon + statut adversaire -->
            <div class="w-56 shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col p-4 gap-4">
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Ton Pokémon</h3>
                @if (selectedPokemon) {
                  <div class="bg-slate-700 rounded-xl p-3 flex flex-col items-center gap-2 border-2 border-red-500">
                    <img
                      [src]="selectedPokemon.sprite"
                      [alt]="selectedPokemon.name"
                      class="w-20 h-20 object-contain pixelated"
                    />
                    <span class="text-sm font-medium capitalize">{{ selectedPokemon.name }}</span>
                  </div>
                } @else {
                  <div class="bg-slate-700 rounded-xl p-3 flex flex-col items-center gap-2 border-2 border-dashed border-slate-500">
                    <div class="w-20 h-20 flex items-center justify-center text-5xl text-slate-500">?</div>
                    <span class="text-xs text-slate-500">Aucun Pokémon</span>
                  </div>
                }
              </div>

              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Adversaire</h3>
                @if (opponentReady()) {
                  <div class="flex items-center gap-2 text-green-400">
                    <span class="text-lg">✓</span>
                    <span class="text-sm font-medium">Prêt !</span>
                  </div>
                } @else {
                  <div class="flex items-center gap-2 text-slate-400">
                    <div class="w-3 h-3 rounded-full border-2 border-slate-500 border-t-transparent animate-spin"></div>
                    <span class="text-sm">En attente…</span>
                  </div>
                }
              </div>

              @if (isReady) {
                <div class="flex items-center gap-2 text-green-400 mt-auto">
                  <span class="text-lg">✓</span>
                  <span class="text-sm font-medium">Tu es prêt !</span>
                </div>
              }
            </div>

            <!-- Colonne droite : sélecteur de Pokémon -->
            <div class="flex-1 flex flex-col overflow-hidden p-4 gap-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Choisir un Pokémon</h3>

              <!-- Barre de recherche + bouton aléatoire -->
              <div class="flex gap-2">
                <div class="flex-1 relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                  <input
                    type="text"
                    placeholder="Chercher..."
                    [(ngModel)]="searchQuery"
                    (ngModelChange)="onSearch()"
                    class="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <button
                  (click)="pickRandom()"
                  class="bg-slate-700 hover:bg-slate-600 border border-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  🎲 Aléatoire
                </button>
              </div>

              <!-- Grille de Pokémon scrollable -->
              <div class="flex-1 overflow-y-auto">
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pb-2">
                  @for (pokemon of filteredPokemons; track pokemon.id) {
                    <button
                      (click)="selectPokemon(pokemon)"
                      [class]="pokemon.id === selectedPokemon?.id
                        ? 'flex flex-col items-center gap-1 p-2 rounded-xl bg-red-900/40 border-2 border-red-500 hover:bg-red-900/60 transition-all'
                        : 'flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-700/60 border-2 border-transparent hover:bg-slate-700 hover:border-slate-500 transition-all'"
                    >
                      <img
                        [src]="pokemon.sprite"
                        [alt]="pokemon.name"
                        class="w-16 h-16 object-contain pixelated"
                        loading="lazy"
                      />
                      <span class="text-xs text-center capitalize leading-tight">{{ pokemon.name }}</span>
                    </button>
                  }
                </div>
                @if (filteredPokemons.length === 0 && allPokemons.length > 0) {
                  <div class="text-center text-slate-500 py-10">Aucun Pokémon trouvé pour "{{ searchQuery }}"</div>
                }
                @if (allPokemons.length === 0) {
                  <div class="flex justify-center py-10">
                    <div class="w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Erreur sélection Pokémon -->
          @if (selectError) {
            <div class="bg-red-900/40 border border-red-500 text-red-300 text-sm px-4 py-2 text-center">
              {{ selectError }}
            </div>
          }

          <!-- Footer : bouton Je suis prêt -->
          <div class="bg-slate-800 border-t border-slate-700 px-6 py-4 flex justify-center">
            <button
              (click)="setReady()"
              [disabled]="!selectedPokemon || isSettingReady || isReady"
              class="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-xl font-bold text-base transition-colors"
            >
              @if (isSettingReady) {
                <span class="flex items-center gap-2">
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Confirmation…
                </span>
              } @else if (isReady) {
                ✅ Tu es prêt !
              } @else {
                ✅ Je suis prêt !
              }
            </button>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .pixelated {
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
  `]
})
export class LobbyComponent implements OnInit, OnDestroy {
  roomId = input.required<string>();

  private readonly gameService = inject(GameService);
  private readonly pokemonService = inject(PokemonService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  // États
  room = computed(() => this.gameService.currentRoom());
  isPlayer1 = computed(() => this.gameService.isPlayer1());

  opponentReady = computed(() => {
    const r = this.room();
    if (!r) return false;
    return this.isPlayer1() ? r.p2_ready : r.p1_ready;
  });

  // Sélection Pokémon
  allPokemons: Pokemon[] = [];
  filteredPokemons: Pokemon[] = [];
  selectedPokemon: Pokemon | null = null;
  searchQuery = '';
  isReady = false;
  isSettingReady = false;
  selectError = '';

  // État de chargement
  isLoading = true;

  // Lien d'invitation
  inviteLink = '';
  copied = false;

  // Annulation / mode dev
  isCancelling = false;
  isSimulating = false;
  readonly devMode = environment.devMode;

  private pokemonsSub?: Subscription;

  ngOnInit(): void {
    void this.init();
  }

  private async init(): Promise<void> {
    // 1. Attendre que l'auth soit prête
    await firstValueFrom(this.supabaseService.authReady$);

    // 2. Lancer joinAndWatch (Realtime)
    await this.gameService.joinAndWatch(this.roomId());
    this.isLoading = false;

    // 3. Construire le lien d'invitation
    this.inviteLink = `${globalThis.location.origin}/invite/${this.roomId()}`;

    // 4. Charger tous les Pokémon
    this.pokemonsSub = this.pokemonService.loadAll().subscribe(pokemons => {
      this.allPokemons = pokemons;
      this.filteredPokemons = pokemons;
    });

    // 5. Watcher Realtime : si status 'playing' → navigate /game/:roomId
    toObservable(this.room)
      .pipe(
        filter(r => r?.status === 'playing'),
        take(1)
      )
      .subscribe(() => {
        this.router.navigate(['/game', this.roomId()]);
      });
  }

  ngOnDestroy(): void {
    this.gameService.stopWatching();
    this.pokemonsSub?.unsubscribe();
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async selectPokemon(pokemon: Pokemon): Promise<void> {
    if (this.isReady) return;
    this.selectedPokemon = pokemon;
    this.selectError = '';
    try {
      await this.gameService.selectPokemon(this.roomId(), pokemon.id);
    } catch {
      this.selectError = 'Erreur lors de la sélection. Réessaie.';
      this.selectedPokemon = null;
    }
  }

  pickRandom(): void {
    if (this.isReady) return;
    this.pokemonService.random().pipe(take(1)).subscribe(p => this.selectPokemon(p));
  }

  onSearch(): void {
    this.filteredPokemons = this.allPokemons.filter(p =>
      p.name.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  async setReady(): Promise<void> {
    if (!this.selectedPokemon || this.isSettingReady || this.isReady) return;
    this.isSettingReady = true;
    try {
      await this.gameService.setReady(this.roomId());
      this.isReady = true;
    } finally {
      this.isSettingReady = false;
    }
  }

  async cancelRoom(): Promise<void> {
    if (this.isCancelling) return;
    this.isCancelling = true;
    try {
      await this.gameService.cancelRoom(this.roomId());
      this.router.navigate(['/home']);
    } finally {
      this.isCancelling = false;
    }
  }

  async simulateOpponent(): Promise<void> {
    if (this.isSimulating) return;
    this.isSimulating = true;
    try {
      const pokemon = await firstValueFrom(this.pokemonService.random());
      await this.gameService.simulateOpponent(this.roomId(), pokemon.id);
    } finally {
      this.isSimulating = false;
    }
  }

  async copyInviteLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.inviteLink);
    } catch {
      // Fallback pour HTTP
      const el = document.createElement('input');
      el.value = this.inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }
}
