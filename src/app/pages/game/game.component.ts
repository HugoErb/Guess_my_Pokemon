import { Component, OnInit, OnDestroy, computed, effect, inject, input, isDevMode, signal, untracked, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';

import { GameService } from '../../services/game.service';
import { PokemonService } from '../../services/pokemon.service';
import { SupabaseService } from '../../services/supabase.service';
import { Pokemon } from '../../models/pokemon.model';
import { PokemonCardComponent } from '../../components/pokemon-card/pokemon-card.component';
import { PokedexComponent } from '../../components/pokedex/pokedex.component';
import { CancelModalComponent } from '../../components/cancel-modal/cancel-modal.component';
import { RulesModalComponent } from '../../components/rules-modal/rules-modal.component';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';
import { environment } from '../../../environments/environment';

@Component({
	selector: 'app-game',
	imports: [PokemonCardComponent, PokedexComponent, CancelModalComponent, RulesModalComponent],
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
								<button (click)="openGameSettingsModal()" class="flex items-center gap-2 px-2 py-1 bg-slate-700/50 hover:bg-slate-600 border border-slate-600/50 rounded-lg text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider transition-all group">
									<iconify-icon [icon]="ICONS.rules" class="text-xs group-hover:scale-110 transition-transform"></iconify-icon>
									Configuration
								</button>

								<div class="h-4 w-px bg-slate-700"></div>
								<div class="flex items-center text-slate-400">
									<span class="text-[11px] font-bold uppercase tracking-wider">Tour <strong class="ml-0.5 text-slate-100 font-mono text-[13px]">{{ gameTurn() }}</strong></span>
								</div>
							</div>

							<div class="flex items-center gap-3">
								<button (click)="promptCancel()" class="flex items-center gap-2 px-2.5 py-1 bg-slate-700/50 hover:bg-slate-600 border border-slate-600/50 hover:border-slate-500 rounded-lg text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider transition-all duration-200 group">
									<iconify-icon [icon]="ICONS.logout" class="text-xs transition-transform"></iconify-icon>
									<span>Quitter la partie</span>
								</button>
							</div>
						</div>
					}

					<div class="flex-1 overflow-y-auto p-4">
						<app-pokedex
						[showGuessButton]="isMyTurn()"
						[restrictedGenerations]="settings().generations"
						[noPokedex]="settings().noPokedex"
						[noSearch]="settings().noSearch"
						(guess)="onGuess($event)"
					/>
					</div>
				</div>
			</div>
		</div>

		<!-- Modale de Fin de Partie -->
		@if (showEndModal) {
			<div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" [@modalAnimation]>
				<div class="bg-slate-800 border border-slate-600 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6 text-center modal-content">
					
					<div class="flex flex-col items-center gap-2">
						@if (isWinner) {
							<iconify-icon [icon]="ICONS.trophy" class="text-6xl text-yellow-400 animate-bounce"></iconify-icon>
							<h2 class="text-2xl font-bold text-yellow-400 uppercase tracking-tight">Victoire !</h2>
							<p class="text-slate-300">Tu as trouvé le Pokémon de ton adversaire !</p>
						} @else {
							<iconify-icon [icon]="ICONS.skull" class="text-6xl text-red-500 animate-pulse"></iconify-icon>
							<h2 class="text-2xl font-bold text-red-500 uppercase tracking-tight">Défaite</h2>
							<p class="text-slate-300">Ton adversaire a trouvé ton Pokémon !</p>
						}
					</div>

					@if (opponentPokemon) {
						<div class="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center gap-2">
							@if (!isWinner) {
								<p class="text-slate-400 text-sm">Le pokémon de l'adversaire était :</p>
							}
							<div class="flex flex-col items-center gap-1">
								<img [src]="opponentPokemon.sprite" [alt]="opponentPokemon.name" class="w-24 h-24 object-contain" />
								<h3 class="text-lg font-bold text-white capitalize">{{ opponentPokemon.name }}</h3>
							</div>
						</div>
					}

					<div class="bg-slate-900/30 border border-slate-700/50 rounded-xl py-2 px-6 w-fit">
						<p class="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Partie terminée en</p>
						<p class="text-lg font-mono font-bold text-white">{{ gameTurn() }} tours</p>
					</div>

					<div class="w-full flex flex-col gap-2">
						<button
							(click)="requestReplay()"
							[disabled]="iWantReplay()"
							class="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-colors flex flex-col items-center justify-center gap-0.5"
						>
							<div class="flex items-center gap-2">
								<iconify-icon [icon]="ICONS.dice" class="text-lg"></iconify-icon>
								<span>{{ iWantReplay() ? 'En attente...' : 'Rejouer' }}</span>
							</div>
							@if (iWantReplay() && !opponentWantsReplay()) {
								<span class="text-[9px] font-medium uppercase tracking-wider opacity-80 italic">En attente de l'adversaire</span>
							}
						</button>

						<button
							(click)="goHome()"
							class="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2"
						>
							<iconify-icon [icon]="ICONS.home" class="text-lg"></iconify-icon>
							Retour à l'accueil
						</button>
					</div>
				</div>
			</div>
		}

		@if (showRulesModal()) {
			<app-rules-modal (close)="closeRulesModal()" />
		}

		@if (showCancelModal()) {
			<app-cancel-modal
				[isCancelling]="isCancelling"
				(confirm)="confirmCancel()"
				(cancel)="closeCancelModal()"
			/>
		}

		@if (showGameSettingsModal()) {
			<div 
				class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
				(click)="closeGameSettingsModal()"
				[@modalAnimation]
			>
				<div 
					class="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-5 modal-content" 
					(click)="$event.stopPropagation()"
				>
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
							<iconify-icon [icon]="ICONS.rules" class="text-2xl text-blue-400"></iconify-icon>
						</div>
						<div>
							<h2 class="text-lg font-bold text-white uppercase tracking-wider">Configuration</h2>
							<p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">Paramètres de la partie</p>
						</div>
					</div>

					<div class="space-y-3">
						<!-- Générations -->
						<div class="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3 flex flex-col gap-2">
							<div class="flex items-center justify-between">
								<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Générations</span>
								<span class="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] font-black rounded uppercase">
									{{ settings().generations.length === 9 ? 'Toutes' : settings().generations.length + ' Actives' }}
								</span>
							</div>
							<div class="flex flex-wrap gap-1.5">
								@for (gen of settings().generations; track gen) {
									<span class="text-[11px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Gén {{ gen }}</span>
								}
							</div>
						</div>

						<!-- Restrictions Pokédex -->
						<div class="grid grid-cols-2 gap-3">
							<div class="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3 flex flex-col gap-1 items-center text-center">
								<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Pokédex</span>
								@if (settings().noPokedex) {
									<iconify-icon [icon]="ICONS.close" class="text-xl text-red-500"></iconify-icon>
									<span class="text-[11px] font-bold text-red-400 uppercase">Désactivé</span>
								} @else {
									<iconify-icon [icon]="ICONS.check" class="text-xl text-green-500"></iconify-icon>
									<span class="text-[11px] font-bold text-green-400 uppercase">Activé</span>
								}
							</div>

							<div class="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3 flex flex-col gap-1 items-center text-center">
								<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Recherche</span>
								@if (settings().noSearch) {
									<iconify-icon [icon]="ICONS.close" class="text-xl text-red-500"></iconify-icon>
									<span class="text-[11px] font-bold text-red-400 uppercase">Désactivée</span>
								} @else {
									<iconify-icon [icon]="ICONS.check" class="text-xl text-green-500"></iconify-icon>
									<span class="text-[11px] font-bold text-green-400 uppercase">Activée</span>
								}
							</div>
						</div>
					</div>

					<button (click)="closeGameSettingsModal()" class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-bold text-white transition-colors">
						Fermer
					</button>
				</div>
			</div>
		}
		@if (showIncorrectModal()) {
			<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] p-4" [@modalAnimation]>
				<div class="bg-slate-800 rounded-2xl p-8 max-w-sm w-full border border-slate-600 shadow-2xl flex flex-col items-center gap-6 text-center modal-content">
					<div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
						<iconify-icon [icon]="ICONS.close" class="text-4xl text-red-500"></iconify-icon>
					</div>
					
					<div class="space-y-2">
						<h2 class="text-2xl font-bold text-red-500 uppercase tracking-tight">Raté !</h2>
						<p class="text-slate-300">
							Ce n'était pas 
							@if (lastGuessedPokemon) {
								<strong class="text-white capitalize">{{ lastGuessedPokemon.name }}</strong>.
							} @else {
								le bon Pokémon
							}
						</p>
						<p class="text-slate-300">C'est maintenant au tour de l'adversaire de jouer.</p>
					</div>

					<button (click)="showIncorrectModal.set(false)" class="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2">
						Compris
					</button>
				</div>
			</div>
		}

		@if (showMyTurnModal()) {
			<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] p-4" [@modalAnimation]>
				<div class="bg-slate-800 border border-slate-600 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6 text-center modal-content">
					<div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
						<iconify-icon [icon]="ICONS.pokeball" class="text-4xl text-red-500 animate-bounce"></iconify-icon>
					</div>

					<div class="space-y-2">
						<h2 class="text-2xl font-bold text-red-400 uppercase tracking-tight">À toi de jouer !</h2>
						@if (opponentLastGuess) {
							<p class="text-slate-300">
								L'adversaire a tenté
								<strong class="text-white capitalize">{{ opponentLastGuess.name }}</strong>...
							</p>
							<p class="text-slate-300">C'est raté ! C'est ton tour.</p>
						} @else {
							<p class="text-slate-300">La partie commence, c'est à toi de jouer en premier.</p>
						}
						<p class="text-slate-300">Pose maintenant une question à ton adversaire !</p>
					</div>

					<button (click)="showMyTurnModal.set(false)" class="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2">
						Prêt !
					</button>
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
    private hadTurn = false;

	room = computed(() => this.gameService.currentRoom());
	isMyTurn = this.gameService.isMyTurn;
	isPlayer1 = this.gameService.isPlayer1;
	readonly settings = this.gameService.settings;

	iWantReplay = computed(() => {
		const r = this.room();
		if (!r) return false;
		return this.isPlayer1() ? r.p1_ready : r.p2_ready;
	});

	opponentWantsReplay = computed(() => {
		const r = this.room();
		if (!r) return false;
		return this.isPlayer1() ? r.p2_ready : r.p1_ready;
	});

	myPokemon: Pokemon | null = null;
	opponentPokemon: Pokemon | null = null;
	devOpponentPokemon: Pokemon | null = null;
	lastGuessedPokemon: Pokemon | null = null;
	opponentLastGuess: Pokemon | null = null;
	showEndModal = false;
	showIncorrectModal = signal(false);
	showMyTurnModal = signal(false);
	isWinner = false;
	devOpponentTries = signal(0);
	private isSimulatingTurn = false;
	readonly isDev = environment.devMode && isDevMode();

	showRulesModal = signal(false);
	showCancelModal = signal(false);
	showGameSettingsModal = signal(false);

	openRulesModal(): void { this.showRulesModal.set(true); }
	closeRulesModal(): void { this.showRulesModal.set(false); }

	openGameSettingsModal(): void { this.showGameSettingsModal.set(true); }
	closeGameSettingsModal(): void { this.showGameSettingsModal.set(false); }
	isCancelling = false;

	private pokemonSub?: Subscription;
	private opponentSub?: Subscription;
	private devOpponentSub?: Subscription;
	private broadcastSub?: Subscription;

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

			// Incrémenter le compteur de tours (Accepte null pour le bot)
			if (r?.status === 'playing' && r.current_turn !== this.lastTurnId) {
				this.turnCounter.update(c => c + 1);
				this.lastTurnId = r.current_turn;
			}

			// Simulation DEV de l'adversaire
			if (this.isDev && r?.status === 'playing' && !this.isMyTurn()) {
				untracked(() => {
					void this.simulateOpponentTurn();
				});
			}

			// Navigation vers le lobby si une revanche est lancée
			if (r?.status === 'selecting') {
				untracked(() => {
					void this.router.navigate(['/lobby', this.roomId()]);
				});
			}

			// Simulation Rejouer pour le mode DEV
			if (this.isDev && r?.status === 'finished' && this.iWantReplay() && !this.opponentWantsReplay()) {
				untracked(() => {
					// Petit délai avant que le bot accepte la revanche
					setTimeout(() => {
						void this.gameService.simulateOpponentReplay(this.roomId());
					}, 2000);
				});
			}

            const isMyTurnNow = this.isMyTurn();

            if (r?.status === 'playing') {
                if (!this.hadTurn && isMyTurnNow) {
                    untracked(() => {
                        this.showMyTurnModal.set(true);
                    });
                }
                this.hadTurn = isMyTurnNow;
            }
		});
	}

	ngOnInit(): void {
		void this.init();
	}

	private async init(): Promise<void> {
		await firstValueFrom(this.supabaseService.authReady$);
		await this.gameService.joinAndWatch(this.roomId());
        this.hadTurn = this.isMyTurn();

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

		// ─── Écoute des Broadcasts (Guesses de l'adversaire) ──────────────
		this.broadcastSub = this.gameService.broadcastEvents$.subscribe(evt => {
			console.log('[GameComponent] Broadcast reçu:', evt);
			if (evt.event === 'opponent_guess') {
				const { pokemonId, senderId } = evt.payload;
				const currentUserId = this.supabaseService.getCurrentUser()?.id;
				
				console.log('[GameComponent] Guess adversaire:', { pokemonId, senderId, currentUserId });

				// On ne traite que si c'est l'adversaire (ou le bot) qui a joué
				if (senderId !== currentUserId) {
					this.pokemonService.getById(pokemonId).subscribe(async p => {
						this.opponentLastGuess = p ?? null;
						
						// Si la modale "Raté" est encore ouverte, on attend qu'elle se ferme
						if (this.showIncorrectModal()) {
							console.log('[GameComponent] Attente fermeture modale incorrecte...');
							while (this.showIncorrectModal()) {
								await new Promise(resolve => setTimeout(resolve, 500));
							}
						}
						
						console.log('[GameComponent] Affichage modale tour adverse');
						this.showMyTurnModal.set(true);
					});
				}
			}
		});
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

		this.showMyTurnModal.set(false);
		this.showIncorrectModal.set(false);
		this.showEndModal = true;
	}

	async onGuess(pokemonId: number): Promise<void> {
		if (!this.isMyTurn()) return;

		try {
			const result = await this.gameService.guess(this.roomId(), pokemonId);
			if (result === 'incorrect') {
				this.pokemonService.getById(pokemonId).subscribe(p => {
					this.lastGuessedPokemon = p ?? null;
					this.showIncorrectModal.set(true);
				});
			}
			// 'correct' → room signal switches to 'finished' → effect handles modal
		} catch (err) {
			console.error('[GameComponent] Erreur lors du guess', err);
		}
	}

	private async simulateOpponentTurn(): Promise<void> {
		if (this.isSimulatingTurn) return;
		this.isSimulatingTurn = true;

		try {
			// Délai augmenté pour laisser le temps de lire la pop-up d'erreur
			await new Promise(resolve => setTimeout(resolve, 4000));
			
			const r = this.room();
			if (!r || r.status !== 'playing' || this.isMyTurn()) return;

			const currentTries = this.devOpponentTries();
			let targetPokemonId: number;

			if (currentTries < 2) {
				// Raté : On prend un Pokémon au hasard (différent du mien)
				targetPokemonId = this.myPokemon?.id === 1 ? 4 : 1; 
				this.devOpponentTries.update(t => t + 1);
			} else {
				// Gagné : L'adversaire trouve mon Pokémon
				if (!this.myPokemon) return;
				targetPokemonId = this.myPokemon.id;
			}

			console.log('[GameComponent] Bot simulation guess:', targetPokemonId);
			await this.gameService.simulateOpponentGuess(this.roomId(), targetPokemonId);
		} catch (err) {
			console.error('[GameComponent] Erreur simulation guess', err);
		} finally {
			this.isSimulatingTurn = false;
		}
	}

	goHome(): void {
		this.router.navigate(['/home']);
	}

	async requestReplay(): Promise<void> {
		try {
			await this.gameService.requestReplay(this.roomId());
		} catch (err) {
			console.error('[GameComponent] Erreur lors de la demande de revanche', err);
		}
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
		this.broadcastSub?.unsubscribe();
	}
}
