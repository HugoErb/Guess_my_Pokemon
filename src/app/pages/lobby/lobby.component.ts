import { Component, OnInit, OnDestroy, computed, inject, input, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, filter, take, Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { environment } from '../../../environments/environment';
import { GameService } from '../../services/game.service';
import { PokemonService } from '../../services/pokemon.service';
import { SupabaseService } from '../../services/supabase.service';
import { Pokemon } from '../../models/pokemon.model';
import { PokemonCardComponent } from '../../components/pokemon-card/pokemon-card.component';
import { ICONS } from '../../constants/icons';

@Component({
	selector: 'app-lobby',
	imports: [FormsModule, PokemonCardComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<div class="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
			<!-- Header -->
			<header class="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<iconify-icon [icon]="ICONS.pokeball" class="text-2xl text-red-500"></iconify-icon>
					<h1 class="text-xl font-bold text-white">Guess my Pokémon</h1>
					<button (click)="openRulesModal()" class="px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-medium">
						Règles
					</button>
				</div>
				<button (click)="promptCancel()" class="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-red-600 border border-slate-600 hover:border-red-500 rounded text-sm text-slate-300 hover:text-white transition-colors">
					<iconify-icon [icon]="ICONS.logout" class="text-lg"></iconify-icon>
					<span class="hidden sm:inline">Quitter la partie</span>
				</button>
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
						<iconify-icon [icon]="ICONS.timer" class="text-4xl mb-4 text-blue-400 animate-pulse"></iconify-icon>
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
								[class]="
									copied
										? 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap'
										: 'bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap'
								"
							>
								@if (copied) {
									<iconify-icon [icon]="ICONS.checkCircle" class="mr-1"></iconify-icon>
									Lien copié !
								} @else {
									<iconify-icon [icon]="ICONS.copy" class="mr-1"></iconify-icon>
									Copier
								}
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
									<div class="relative bg-slate-700 rounded-xl p-3 flex flex-col items-center gap-2 border-2 border-red-500">
										<img [src]="selectedPokemon.sprite" [alt]="selectedPokemon.name" class="w-20 h-20 object-contain" />
										<span class="text-sm font-medium capitalize">{{ selectedPokemon.name }}</span>
										<button
											(click)="openPokemonDetails(selectedPokemon)"
											class="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-slate-800/90 hover:bg-blue-500 rounded-full text-slate-300 hover:text-white transition-colors border border-slate-600 shadow-sm"
											title="Voir ton Pokémon"
										>
											<iconify-icon [icon]="ICONS.search" class="text-sm"></iconify-icon>
										</button>
									</div>
								} @else {
									<div class="bg-slate-700 rounded-xl p-3 flex flex-col items-center gap-2 border-2 border-dashed border-slate-500">
										<div class="w-20 h-20 flex items-center justify-center text-5xl text-slate-500">?</div>
										<span class="text-xs text-slate-500">Aucun Pokémon</span>
									</div>
								}
							</div>

							<div class="flex flex-col gap-2">
								<button
									(click)="setReady()"
									[disabled]="!selectedPokemon || isSettingReady || isReady"
									class="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl font-bold text-sm transition-colors w-full"
								>
									@if (isSettingReady) {
										<span class="flex items-center justify-center gap-2">
											<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
											Confirmation…
										</span>
									} @else if (isReady) {
										<span class="flex items-center justify-center gap-1">
											<iconify-icon [icon]="ICONS.checkCircle"></iconify-icon>
											Tu es prêt !
										</span>
									} @else {
										<span class="flex items-center justify-center gap-1">
											<iconify-icon [icon]="ICONS.checkCircle"></iconify-icon>
											Je suis prêt !
										</span>
									}
								</button>
								@if (devMode && isReady && !opponentReady()) {
									<button
										(click)="simulateOpponentReady()"
										[disabled]="isSimulatingReady"
										class="bg-amber-800/50 hover:bg-amber-700/50 border border-amber-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-xs font-medium text-amber-300 transition-colors w-full"
									>
										{{ isSimulatingReady ? 'Simulation…' : '⚙ Simuler adversaire prêt [DEV]' }}
									</button>
								}
							</div>

							<div class="border-t border-slate-700 pt-4 mt-2">
								<h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Adversaire</h3>
								@if (opponentReady()) {
									<div class="flex items-center gap-2 text-green-400">
										<iconify-icon [icon]="ICONS.checkCircle" class="text-lg"></iconify-icon>
										<span class="text-sm font-medium">Prêt !</span>
									</div>
								} @else {
									<div class="flex items-center gap-2 text-slate-400">
										<iconify-icon [icon]="ICONS.loading" class="text-lg animate-spin"></iconify-icon>
										<span class="text-sm">En attente…</span>
									</div>
								}
							</div>
						</div>

						<!-- Colonne droite : sélecteur de Pokémon -->
						<div class="flex-1 flex flex-col overflow-hidden p-4 gap-3">
							<h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Choisir un Pokémon</h3>

							<!-- Barre de recherche + bouton aléatoire -->
							<div class="flex gap-2">
								<div class="flex-1 relative">
									<iconify-icon
										[icon]="ICONS.search"
										class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
									></iconify-icon>
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
									<iconify-icon [icon]="ICONS.dice" class="mr-1"></iconify-icon>
									Aléatoire
								</button>
							</div>

							<!-- Grille de Pokémon scrollable -->
							<div class="flex-1 overflow-y-auto pr-2" (scroll)="onGridScroll($event)">
								<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pb-2">
									@for (pokemon of visiblePokemons; track pokemon.id) {
										<div class="relative w-full h-full">
											<button
												(click)="selectPokemon(pokemon)"
												[class]="
													pokemon.id === selectedPokemon?.id
														? 'w-full h-full flex flex-col items-center gap-1 p-2 rounded-xl bg-red-900/40 border-2 border-red-500 hover:bg-red-900/60 transition-all'
														: 'w-full h-full flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-700/60 border-2 border-transparent hover:bg-slate-700 hover:border-slate-500 transition-all'
												"
											>
												<img
													[src]="pokemon.sprite"
													[alt]="pokemon.name"
													class="w-16 h-16 object-contain"
													loading="lazy"
												/>
												<span class="text-xs text-center capitalize leading-tight">{{ pokemon.name }}</span>
											</button>
											<button
												(click)="openPokemonDetails(pokemon); $event.stopPropagation()"
												class="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-slate-800/90 hover:bg-blue-500 rounded-full text-slate-300 hover:text-white transition-colors border border-slate-600 shadow-sm"
												title="Voir le Pokédex complet"
											>
												<iconify-icon [icon]="ICONS.search" class="text-xs"></iconify-icon>
											</button>
										</div>
									}
								</div>
								@if (visiblePokemons.length === 0 && allPokemons.length > 0) {
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

				</div>
			}

			<!-- Modal Pokédex -->
			@if (selectedPokemonDetails) {
				<div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" (click)="closePokemonDetails()">
					<div class="bg-slate-800 border border-slate-600 rounded-2xl p-3 max-w-md w-full shadow-2xl relative flex flex-col gap-3 max-h-[95vh]" (click)="$event.stopPropagation()">
						
						<!-- Bouton Fermer Absolu -->
						<button (click)="closePokemonDetails()" class="absolute top-5 right-5 z-10 bg-slate-900/60 hover:bg-red-600 rounded-full w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white transition-colors backdrop-blur-sm">
							<iconify-icon [icon]="ICONS.close" class="text-lg"></iconify-icon>
						</button>

						<!-- Contenu scrollable si nécessaire -->
						<div class="overflow-y-auto flex-1">
							<app-pokemon-card [pokemon]="selectedPokemonDetails" />
						</div>

						<!-- Footer action -->
						<button 
							(click)="selectFromDetails(selectedPokemonDetails)"
							class="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-white transition-colors mt-2 shadow-lg flex items-center justify-center gap-2"
						>
							<iconify-icon [icon]="ICONS.checkCircle" class="text-xl"></iconify-icon>
							Sélectionner ce Pokémon
						</button>
					</div>
				</div>
			}

			<!-- Modal règles -->
			@if (showRulesModal()) {
				<div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" (click)="closeRulesModal()">
					<div class="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-center" (click)="$event.stopPropagation()">
						<iconify-icon [icon]="ICONS.pokedex" class="text-5xl text-red-500 mx-auto"></iconify-icon>
						<h2 class="text-xl font-bold text-white uppercase tracking-wider">Règles du jeu</h2>
						<ol class="space-y-3 text-sm text-slate-300 list-none text-justify">
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug">1.</span>
								<span>Au début de la partie, chaque joueur choisit secrètement un Pokémon que son adversaire devra deviner.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug">2.</span>
								<span>À chaque tour, le joueur actif pose <strong class="text-white">une question à l'oral</strong> à son adversaire sur son Pokémon.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug">3.</span>
								<span>L'adversaire doit répondre <strong class="text-white">par oui ou par non</strong>, en disant la vérité.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug">4.</span>
								<span>Quand un joueur pense avoir trouvé, il tape le nom du Pokémon dans le champ de recherche pour tenter sa chance.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug">5.</span>
								<span>Le <strong class="text-white">premier à deviner</strong> le Pokémon de son adversaire remporte la partie !</span>
							</li>
						</ol>
						<button (click)="closeRulesModal()" class="mt-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-colors">
							Fermer
						</button>
					</div>
				</div>
			}

			<!-- Modal de confirmation d'annulation -->
			@if (showCancelModal()) {
				<div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4" (click)="closeCancelModal()">
					<div class="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-center" (click)="$event.stopPropagation()">
						<iconify-icon [icon]="ICONS.alert" class="text-5xl text-red-500 mx-auto"></iconify-icon>
						<h2 class="text-xl font-bold text-white uppercase tracking-wider">Quitter la partie ?</h2>
						<p class="text-slate-300 text-sm">
							Es-tu sûr de vouloir revenir à l'accueil ? Cela <strong class="text-red-400">annulera définitivement</strong> la partie en cours pour les deux joueurs.
						</p>
						<div class="flex flex-col-reverse sm:flex-row gap-3 mt-4">
							<button (click)="closeCancelModal()" class="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium transition-colors">
								Non, rester
							</button>
							<button (click)="confirmCancel()" [disabled]="isCancelling" class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white transition-colors">
								{{ isCancelling ? 'Annulation...' : 'Oui, quitter' }}
							</button>
						</div>
					</div>
				</div>
			}
		</div>
	`,
	styles: [],
})
export class LobbyComponent implements OnInit, OnDestroy {
	protected readonly ICONS = ICONS;
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
	visiblePokemons: Pokemon[] = [];
	selectedPokemon: Pokemon | null = null;
	searchQuery = '';
	isReady = false;
	isSettingReady = false;
	selectError = '';
	private displayedCount = 100;
	private readonly PAGE_SIZE = 100;

	// Détails du Pokémon
	selectedPokemonDetails: Pokemon | null = null;

	// État de chargement
	isLoading = true;

	// Lien d'invitation
	inviteLink = '';
	copied = false;

	// Annulation / mode dev
	isCancelling = false;
	showRulesModal = signal(false);
	showCancelModal = signal(false);

	openRulesModal(): void { this.showRulesModal.set(true); }
	closeRulesModal(): void { this.showRulesModal.set(false); }
	isSimulating = false;
	isSimulatingReady = false;
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
		this.pokemonsSub = this.pokemonService.loadAll().subscribe((pokemons) => {
			this.allPokemons = pokemons;
			this.filteredPokemons = pokemons;
			this.displayedCount = this.PAGE_SIZE;
			this.visiblePokemons = pokemons.slice(0, this.displayedCount);
		});

		// 5. Watcher Realtime : si status 'playing' → navigate /game/:roomId
		toObservable(this.room)
			.pipe(
				filter((r) => r?.status === 'playing'),
				take(1),
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
		this.pokemonService
			.random()
			.pipe(take(1))
			.subscribe((p) => this.selectPokemon(p));
	}

	onSearch(): void {
		this.filteredPokemons = this.allPokemons.filter((p) => p.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
		this.displayedCount = this.PAGE_SIZE;
		this.visiblePokemons = this.filteredPokemons.slice(0, this.displayedCount);
	}

	onGridScroll(event: Event): void {
		const el = event.target as HTMLElement;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && this.displayedCount < this.filteredPokemons.length) {
			this.displayedCount += this.PAGE_SIZE;
			this.visiblePokemons = this.filteredPokemons.slice(0, this.displayedCount);
		}
	}

	async setReady(): Promise<void> {
		if (!this.selectedPokemon || this.isSettingReady || this.isReady) return;
		this.isSettingReady = true;
		try {
			await this.gameService.setReady(this.roomId());
			this.isReady = true;
			// Navigation directe si la partie démarre (ne pas attendre le Realtime)
			if (this.room()?.status === 'playing') {
				void this.router.navigate(['/game', this.roomId()]);
			}
		} finally {
			this.isSettingReady = false;
		}
	}

	cancelRoom(): void {
		if (this.isCancelling) return;
		this.isCancelling = true;
		void this.gameService.cancelRoom(this.roomId()).catch(err => {
			console.error('[LobbyComponent] Erreur lors de l\'annulation', err);
		});
		void this.router.navigate(['/home']);
	}

	async simulateOpponent(): Promise<void> {
		if (this.isSimulating) return;
		this.isSimulating = true;
		try {
			let pokemons = this.allPokemons;
			if (pokemons.length === 0) {
				pokemons = await firstValueFrom(this.pokemonService.loadAll());
			}
			if (pokemons.length === 0) return;
			const randomPokemon = pokemons[Math.floor(Math.random() * pokemons.length)];
			await this.gameService.simulateOpponent(this.roomId(), randomPokemon.id);
		} finally {
			this.isSimulating = false;
		}
	}

	async simulateOpponentReady(): Promise<void> {
		if (this.isSimulatingReady) return;
		this.isSimulatingReady = true;
		try {
			let pokemons = this.allPokemons;
			if (pokemons.length === 0) {
				pokemons = await firstValueFrom(this.pokemonService.loadAll());
			}
			if (pokemons.length === 0) return;
			const randomPokemon = pokemons[Math.floor(Math.random() * pokemons.length)];
			await this.gameService.simulateOpponentReady(this.roomId(), randomPokemon.id);
			// Navigation directe : simulateOpponentReady passe toujours à 'playing'
			void this.router.navigate(['/game', this.roomId()]);
		} finally {
			this.isSimulatingReady = false;
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

	// ─── Modal Pokédex ───────────────────────────────────────────────────────────

	openPokemonDetails(pokemon: Pokemon): void {
		this.selectedPokemonDetails = pokemon;
	}

	closePokemonDetails(): void {
		this.selectedPokemonDetails = null;
	}

	selectFromDetails(pokemon: Pokemon): void {
		void this.selectPokemon(pokemon);
		this.closePokemonDetails();
	}

	// ─── Modal d'annulation ──────────────────────────────────────────────────────
	
	promptCancel(): void {
		this.showCancelModal.set(true);
	}

	closeCancelModal(): void {
		this.showCancelModal.set(false);
	}

	confirmCancel(): void {
		this.closeCancelModal();
		this.cancelRoom();
	}
}
