import { Component, OnInit, OnDestroy, computed, effect, inject, input, isDevMode, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';

import { GameService } from '../../services/game.service';
import { PokemonService } from '../../services/pokemon.service';
import { SupabaseService } from '../../services/supabase.service';
import { Pokemon } from '../../models/pokemon.model';
import { PokemonCardComponent } from '../../components/pokemon-card/pokemon-card.component';
import { PokedexComponent } from '../../components/pokedex/pokedex.component';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';
import { environment } from '../../../environments/environment';

@Component({
	selector: 'app-game',
	imports: [PokemonCardComponent, PokedexComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	template: `
		<div class="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
			<!-- Header -->
			<header class="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<iconify-icon [icon]="ICONS.pokeball" class="text-2xl text-red-500"></iconify-icon>
					<h1 class="text-lg font-bold text-white">Guess my Pokémon</h1>
					<button (click)="openRulesModal()" class="px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-medium">
						Règles
					</button>
				</div>
			</header>

			<!-- Message de tentative ratée -->
			@if (guessMessage) {
				<div class="bg-red-900/40 border-b border-red-500 text-red-300 text-sm px-6 py-2 text-center font-medium">
					{{ guessMessage }}
				</div>
			}

			<!-- Contenu principal : deux colonnes -->
			<div class="flex-1 flex overflow-hidden">
				<!-- Colonne gauche : Ton Pokémon -->
				<div class="w-80 shrink-0 overflow-y-auto p-4 flex flex-col gap-6">
					<div>
						<h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Ton Pokémon</h3>
						@if (myPokemon) {
							<app-pokemon-card [pokemon]="myPokemon" variant="sidebar" />
						} @else {
							<div class="bg-slate-800 rounded-2xl p-8 flex flex-col items-center gap-3 border border-slate-700">
								<div class="w-20 h-20 flex items-center justify-center text-5xl text-slate-600">?</div>
								<p class="text-slate-500 text-sm">Chargement...</p>
							</div>
						}
					</div>

					<!-- DEV: Pokémon adverse -->
					@if (isDev && devOpponentPokemon) {
						<div class="border-t border-slate-700 pt-6">
							<h3 class="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3 flex items-center gap-2">
								<iconify-icon [icon]="ICONS.shield" class="text-amber-500"></iconify-icon>
								Adversaire [DEV]
							</h3>
							<app-pokemon-card [pokemon]="devOpponentPokemon" variant="sidebar" />
						</div>
					}
				</div>

				<!-- Colonne droite : Pokédex -->
				<div class="flex-1 flex flex-col overflow-hidden border-l border-slate-800">
					<!-- Bandeau d'infos de la partie (Indicateur de tour, etc.) -->
					@if (room()?.status === 'playing') {
						<div class="bg-slate-800/50 border-b border-slate-700 px-6 py-2 flex items-center justify-between shrink-0">
							<div class="flex items-center gap-6">
								<div class="flex items-center gap-2">
									@if (isMyTurn()) {
										<span class="flex items-center gap-2 px-3 py-1 bg-red-600/20 border border-red-500/50 rounded-lg text-[10px] font-black text-red-500 uppercase tracking-[0.1em] shadow-lg shadow-red-500/10 animate-pulse">
											<span class="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
											À toi de jouer
										</span>
									} @else {
										<span class="flex items-center gap-2 px-3 py-1 bg-slate-700/50 border border-slate-600/50 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
											<span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
											Tour adverse
										</span>
									}
								</div>

								<div class="h-4 w-px bg-slate-700"></div>
								<div class="flex items-center text-slate-400">
									<span class="text-[11px] font-bold uppercase tracking-wider">Tour <strong class="ml-0.5 text-slate-100 font-mono text-[13px]">{{ gameTurn() }}</strong></span>
								</div>
							</div>

							<div class="flex items-center gap-3">
								<div class="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/40 px-3 py-1 rounded-lg border border-slate-700/50">
									<span class="text-slate-400 font-black">Salon :</span>
									<span class="text-slate-300 font-mono">{{ roomId() }}</span>
								</div>
								
								<button (click)="promptCancel()" class="flex items-center gap-2 px-2.5 py-1 bg-slate-700/50 hover:bg-slate-600 border border-slate-600/50 hover:border-slate-500 rounded-lg text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider transition-all duration-200 group">
									<iconify-icon [icon]="ICONS.logout" class="text-xs transition-transform"></iconify-icon>
									<span>Quitter la partie</span>
								</button>
							</div>
						</div>
					}

					<div class="flex-1 overflow-y-auto p-4">
						<app-pokedex [showGuessButton]="isMyTurn()" (guess)="onGuess($event)" />
					</div>
				</div>
			</div>
		</div>

		<!-- Modales -->
		@if (showEndModal) {
			<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" [@modalAnimation]>
				<div class="bg-slate-800 rounded-2xl p-8 max-w-sm w-full border border-slate-700 shadow-2xl flex flex-col items-center gap-6 text-center modal-content">
					@if (isWinner) {
						<iconify-icon [icon]="ICONS.trophy" class="text-6xl text-yellow-400 animate-bounce"></iconify-icon>
						<h2 class="text-2xl font-bold text-yellow-400">Victoire !</h2>
						<p class="text-slate-300">Tu as trouvé le Pokémon de ton adversaire !</p>
					} @else {
						<iconify-icon [icon]="ICONS.skull" class="text-6xl text-red-400 animate-pulse"></iconify-icon>
						<h2 class="text-2xl font-bold text-red-400">Défaite !</h2>
						<p class="text-slate-300">Ton adversaire a trouvé ton Pokémon !</p>
					}
					@if (opponentPokemon) {
						<div class="flex flex-col items-center gap-2 bg-slate-700 rounded-xl p-4 w-full">
							<p class="text-xs text-slate-400 uppercase tracking-wider">C'était</p>
							<img [src]="opponentPokemon.sprite" [alt]="opponentPokemon.name" class="w-24 h-24 object-contain" />
							<p class="font-bold text-white capitalize">{{ opponentPokemon.name }}</p>
						</div>
					}
					<button (click)="goHome()" class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2">
						<iconify-icon [icon]="ICONS.home" class="text-xl"></iconify-icon>
						Retour à l'accueil
					</button>
				</div>
			</div>
		}

		@if (showRulesModal()) {
			<div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" (click)="closeRulesModal()" [@modalAnimation]>
				<div class="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-center modal-content" (click)="$event.stopPropagation()">
					<iconify-icon [icon]="ICONS.pokedex" class="text-5xl text-red-500 mx-auto"></iconify-icon>
					<h2 class="text-xl font-bold text-white uppercase tracking-wider">Règles du jeu</h2>
					<ol class="space-y-3 text-sm text-slate-300 list-none text-justify">
						<li class="flex gap-3"><span class="text-red-500 font-bold text-base leading-snug">1.</span><span>Chaque joueur choisit secrètement un Pokémon.</span></li>
						<li class="flex gap-3"><span class="text-red-500 font-bold text-base leading-snug">2.</span><span>Posez une question à l'oral à chaque tour.</span></li>
						<li class="flex gap-3"><span class="text-red-500 font-bold text-base leading-snug">3.</span><span>Répondez par oui ou par non.</span></li>
						<li class="flex gap-3"><span class="text-red-500 font-bold text-base leading-snug">4.</span><span>Tentez votre chance en tapant le nom du Pokémon.</span></li>
						<li class="flex gap-3"><span class="text-red-500 font-bold text-base leading-snug">5.</span><span>Le premier à deviner gagne !</span></li>
					</ol>
					<button (click)="closeRulesModal()" class="mt-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-colors">Fermer</button>
				</div>
			</div>
		}

		@if (showCancelModal()) {
			<div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4" (click)="closeCancelModal()" [@modalAnimation]>
				<div class="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-center modal-content" (click)="$event.stopPropagation()">
					<iconify-icon [icon]="ICONS.alert" class="text-5xl text-red-500 mx-auto"></iconify-icon>
					<h2 class="text-xl font-bold text-white uppercase tracking-wider">Quitter la partie ?</h2>
					<p class="text-slate-300 text-sm">Cela annulera définitivement la partie en cours pour les deux joueurs.</p>
					<div class="flex flex-col-reverse sm:flex-row gap-3 mt-4">
						<button (click)="closeCancelModal()" class="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-colors">Non, rester</button>
						<button (click)="confirmCancel()" [disabled]="isCancelling" class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-bold text-white transition-colors">Oui, quitter</button>
					</div>
				</div>
			</div>
		}
	`,
})
export class GameComponent implements OnInit, OnDestroy {
	protected readonly ICONS = ICONS;
	roomId = input.required<string>();

	private readonly gameService = inject(GameService);
	private readonly pokemonService = inject(PokemonService);
	private readonly supabaseService = inject(SupabaseService);
	private readonly router = inject(Router);

	room = computed(() => this.gameService.currentRoom());
	isMyTurn = this.gameService.isMyTurn;

	myPokemon: Pokemon | null = null;
	opponentPokemon: Pokemon | null = null;
	devOpponentPokemon: Pokemon | null = null;
	guessMessage = '';
	showEndModal = false;
	isWinner = false;
	readonly isDev = environment.devMode && isDevMode();

	showRulesModal = signal(false);
	showCancelModal = signal(false);

	openRulesModal(): void { this.showRulesModal.set(true); }
	closeRulesModal(): void { this.showRulesModal.set(false); }
	isCancelling = false;

	private guessMessageTimer: ReturnType<typeof setTimeout> | null = null;
	private pokemonSub?: Subscription;
	private opponentSub?: Subscription;
	private devOpponentSub?: Subscription;

	turnCounter = signal(0);
	private lastTurnId: string | null = null;
	gameTurn = computed(() => Math.max(1, Math.ceil(this.turnCounter() / 2)));

	constructor() {
		// Watch room signal for 'finished' status
		effect(() => {
			const r = this.room();
			if (r?.status === 'finished' && !this.showEndModal) {
				void this.handleGameFinished(r);
			}

			// Incrémenter le compteur de tours
			if (r?.status === 'playing' && r.current_turn && r.current_turn !== this.lastTurnId) {
				this.turnCounter.update(c => c + 1);
				this.lastTurnId = r.current_turn;
			}
		});
	}

	ngOnInit(): void {
		void this.init();
	}

	private async init(): Promise<void> {
		await firstValueFrom(this.supabaseService.authReady$);
		await this.gameService.joinAndWatch(this.roomId());

		const r = this.room();
		if (!r) return;

		const isPlayer1 = this.gameService.isPlayer1();
		const myPokemonId = isPlayer1 ? r.pokemon_p1 : r.pokemon_p2;

		if (myPokemonId !== null) {
			this.pokemonSub = this.pokemonService.getById(myPokemonId).subscribe((p) => {
				this.myPokemon = p ?? null;
			});
		}

		// DEV : charger le Pokémon adverse pour l'overlay de débogage
		if (this.isDev) {
			const opponentPokemonId = isPlayer1 ? r.pokemon_p2 : r.pokemon_p1;
			if (opponentPokemonId !== null) {
				this.devOpponentSub = this.pokemonService.getById(opponentPokemonId).subscribe((p) => {
					this.devOpponentPokemon = p ?? null;
				});
			}
		}
	}

	private async handleGameFinished(r: { winner_id: string | null; pokemon_p1: number | null; pokemon_p2: number | null }): Promise<void> {
		const currentUser = this.supabaseService.getCurrentUser();
		this.isWinner = !!currentUser && r.winner_id === currentUser.id;

		// Charger le Pokémon adverse pour l'afficher dans la modal
		const isPlayer1 = this.gameService.isPlayer1();
		const opponentPokemonId = isPlayer1 ? r.pokemon_p2 : r.pokemon_p1;

		if (opponentPokemonId !== null) {
			this.opponentSub?.unsubscribe();
			this.opponentSub = this.pokemonService.getById(opponentPokemonId).subscribe((p) => {
				this.opponentPokemon = p ?? null;
			});
		}

		this.showEndModal = true;
	}

	async onGuess(pokemonId: number): Promise<void> {
		if (!this.isMyTurn()) return;

		try {
			const result = await this.gameService.guess(this.roomId(), pokemonId);
			if (result === 'incorrect') {
				this.guessMessage = "Raté ! Ce n'est pas le bon Pokémon.";
				if (this.guessMessageTimer) clearTimeout(this.guessMessageTimer);
				this.guessMessageTimer = setTimeout(() => {
					this.guessMessage = '';
				}, 3000);
			}
			// 'correct' → room signal switches to 'finished' → effect handles modal
		} catch (err) {
			console.error('[GameComponent] Erreur lors du guess', err);
		}
	}

	goHome(): void {
		this.router.navigate(['/home']);
	}

	// ─── Annulation de partie ──────────────────────────────────────────────────

	promptCancel(): void {
		this.showCancelModal.set(true);
	}

	closeCancelModal(): void {
		this.showCancelModal.set(false);
	}

	confirmCancel(): void {
		if (this.isCancelling) return;
		this.isCancelling = true;
		void this.gameService.cancelRoom(this.roomId()).catch(err => {
			console.error('[GameComponent] Erreur lors de l\'annulation', err);
		});
		void this.router.navigate(['/home']);
	}

	ngOnDestroy(): void {
		this.gameService.stopWatching();
		this.pokemonSub?.unsubscribe();
		this.opponentSub?.unsubscribe();
		this.devOpponentSub?.unsubscribe();
		if (this.guessMessageTimer) clearTimeout(this.guessMessageTimer);
	}
}
