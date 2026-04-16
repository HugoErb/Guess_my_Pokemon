import { Component, OnInit, OnDestroy, computed, effect, inject, input, signal, untracked, CUSTOM_ELEMENTS_SCHEMA, Injector } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, filter, take, Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { environment } from '../../../environments/environment';
import { GameService } from '../../services/game.service';
import { PokemonService } from '../../services/pokemon.service';
import { SupabaseService } from '../../services/supabase.service';
import { Pokemon } from '../../models/pokemon.model';
import { DEFAULT_SETTINGS, FirstPlayer, GameSettings } from '../../models/room.model';
import { PokemonCardComponent } from '../../components/pokemon-card/pokemon-card.component';
import { CancelModalComponent } from '../../components/cancel-modal/cancel-modal.component';
import { RulesModalComponent } from '../../components/rules-modal/rules-modal.component';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';

@Component({
	selector: 'app-lobby',
	imports: [FormsModule, PokemonCardComponent, CancelModalComponent, RulesModalComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	templateUrl: './lobby.component.html',
	styles: [],
})
export class LobbyComponent implements OnInit, OnDestroy {
	protected readonly ICONS = ICONS;
	roomId = input.required<string>();

	private readonly gameService = inject(GameService);
	private readonly pokemonService = inject(PokemonService);
	private readonly supabaseService = inject(SupabaseService);
	private readonly router = inject(Router);
	private readonly injector = inject(Injector);

	constructor() {
		// Re-applique le filtre dès que les settings de la room changent
		// (résout la race condition Realtime vs getRoomById)
		effect(() => {
			const s = this.gameService.settings();
			untracked(() => {
				this.gameSettings = { ...s };
				if (this.allPokemons.length > 0) this.onSearch();
			});
		});

	}

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

	// Configuration de partie (Player 1 uniquement, phase 'waiting'/'ready')
	gameSettings: GameSettings = { ...DEFAULT_SETTINGS };
	isLaunching = false;
	launchError = '';

	// Annulation / mode dev
	isCancelling = false;
	showRulesModal = signal(false);
	showCancelModal = signal(false);
	simulateError = '';

	/** Ouvre la modal des règles du jeu. */
	openRulesModal(): void {
		this.showRulesModal.set(true);
	}
	/** Ferme la modal des règles du jeu. */
	closeRulesModal(): void {
		this.showRulesModal.set(false);
	}
	isSimulating = false;
	isSimulatingReady = false;
	readonly devMode = environment.devMode;
	readonly firstPlayerOptions: { value: FirstPlayer; label: string }[] = [
		{ value: 'random', label: 'Aléatoire' },
		{ value: 'player1', label: 'Vous' },
		{ value: 'player2', label: 'Adversaire' },
	];

	private pokemonsSub?: Subscription;

	/** Lifecycle Angular — initialise le lobby. */
	ngOnInit(): void {
		void this.init();
	}

	/**
	 * Initialise le lobby : attend l'authentification, rejoint la room,
	 * construit le lien d'invitation, charge les Pokémon et observe le statut de la room.
	 */
	private async init(): Promise<void> {
		// 1. Attendre que l'auth soit prête
		await firstValueFrom(this.supabaseService.authReady$);

		// 2. Watcher Realtime mis en place AVANT joinAndWatch pour éviter la race condition :
		//    si la room passe à 'playing' pendant joinAndWatch, la navigation est garantie.
		toObservable(this.room, { injector: this.injector })
			.pipe(
				filter((r) => r?.status === 'playing'),
				take(1),
			)
			.subscribe(() => {
				this.router.navigate(['/game', this.roomId()]);
			});

		// 3. Lancer joinAndWatch (Realtime)
		await this.gameService.joinAndWatch(this.roomId());
		this.isLoading = false;

		// 4. Construire le lien d'invitation
		this.inviteLink = `${globalThis.location.origin}/invite/${this.roomId()}`;

		// 5. Charger tous les Pokémon
		this.pokemonsSub = this.pokemonService.loadAll().subscribe((pokemons) => {
			this.allPokemons = pokemons;
			this.onSearch(); // applique les restrictions dès le chargement
		});
	}

	/** Lifecycle Angular — arrête le watch de la room et les abonnements. */
	ngOnDestroy(): void {
		this.gameService.stopWatching();
		this.pokemonsSub?.unsubscribe();
	}

	// ─── Actions ─────────────────────────────────────────────────────────────────

	/** Sélectionne un Pokémon et l'enregistre en base si le joueur n'est pas encore prêt. */
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

	/** Sélectionne un Pokémon aléatoire parmi ceux autorisés par les paramètres de génération. */
	pickRandom(): void {
		if (this.isReady) return;
		const restrictedGens = this.gameService.settings().generations;
		const pool = restrictedGens.length > 0 ? this.allPokemons.filter((p) => restrictedGens.includes(p.generation)) : this.allPokemons;
		if (pool.length === 0) return;
		const random = pool[Math.floor(Math.random() * pool.length)];
		void this.selectPokemon(random);
	}

	/** Filtre la liste de Pokémon selon la recherche textuelle et les générations autorisées. */
	onSearch(): void {
		const q = this.searchQuery.toLowerCase();
		const restrictedGens = this.gameService.settings().generations;
		this.filteredPokemons = this.allPokemons.filter((p) => {
			if (q && !p.name.toLowerCase().includes(q)) return false;
			if (restrictedGens.length > 0 && !restrictedGens.includes(p.generation)) return false;
			return true;
		});
		this.displayedCount = this.PAGE_SIZE;
		this.visiblePokemons = this.filteredPokemons.slice(0, this.displayedCount);
	}

	/** Charge une nouvelle page de Pokémon lors du défilement vers le bas de la grille. */
	onGridScroll(event: Event): void {
		const el = event.target as HTMLElement;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && this.displayedCount < this.filteredPokemons.length) {
			this.displayedCount += this.PAGE_SIZE;
			this.visiblePokemons = this.filteredPokemons.slice(0, this.displayedCount);
		}
	}

	/**
	 * Marque le joueur comme prêt et navigue vers la page de jeu
	 * si la partie démarre immédiatement.
	 */
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

	/** Annule la room et navigue vers l'accueil. */
	cancelRoom(): void {
		if (this.isCancelling) return;
		this.isCancelling = true;
		void this.gameService.cancelRoom(this.roomId()).catch(() => {
			// ignore les erreurs d'annulation
		});
		void this.router.navigate(['/home']);
	}

	/** DEV : Simule un adversaire sans compte réel dans la room. */
	async simulateOpponent(): Promise<void> {
		if (this.isSimulating) return;
		this.isSimulating = true;
		this.simulateError = '';
		try {
			await this.gameService.simulateOpponent(this.roomId());
		} catch (err) {
			this.simulateError = `Erreur simulation: ${err instanceof Error ? err.message : JSON.stringify(err)}`;
		} finally {
			this.isSimulating = false;
		}
	}

	/** Lance la phase de sélection de Pokémon avec les paramètres configurés. */
	async launchGame(): Promise<void> {
		if (this.isLaunching) return;
		this.isLaunching = true;
		this.launchError = '';
		try {
			await this.gameService.launchGame(this.roomId(), this.gameSettings);
		} catch {
			this.launchError = 'Erreur lors du lancement. Réessaie.';
		} finally {
			this.isLaunching = false;
		}
	}

	/** Active ou désactive la restriction par génération (tout ou la génération 1 par défaut). */
	toggleGenMode(): void {
		if (this.isConfigLocked()) return;
		const wasActive = this.gameSettings.generations.length > 0;
		this.gameSettings = { ...this.gameSettings, generations: wasActive ? [] : [1] };
		void this.saveSettings();
	}

	/** Ajoute ou retire une génération de la liste des générations restreintes. */
	toggleGeneration(gen: number): void {
		if (this.isConfigLocked()) return;
		const gens = this.gameSettings.generations;
		const filtered = gens.filter((g) => g !== gen);
		const newGens = gens.includes(gen) ? (filtered.length === 0 ? [gen] : filtered) : [...gens, gen];
		this.gameSettings = { ...this.gameSettings, generations: newGens };
		void this.saveSettings();
	}

	/** Active ou désactive le mode Pokédex caché (sprites masqués). */
	toggleNoPokedex(): void {
		if (this.isConfigLocked()) return;
		this.gameSettings = { ...this.gameSettings, noPokedex: !this.gameSettings.noPokedex };
		void this.saveSettings();
	}

	/** Active ou désactive la restriction de recherche dans le Pokédex. */
	toggleNoSearch(): void {
		if (this.isConfigLocked()) return;
		this.gameSettings = { ...this.gameSettings, noSearch: !this.gameSettings.noSearch };
		void this.saveSettings();
	}

	/** Définit quel joueur commence la partie. */
	setFirstPlayer(value: FirstPlayer): void {
		if (this.isConfigLocked()) return;
		this.gameSettings = { ...this.gameSettings, firstPlayer: value };
		void this.saveSettings();
	}

	/** Retourne true si la configuration ne peut plus être modifiée (partie déjà lancée). */
    isConfigLocked(): boolean {
        return this.room()?.status === 'selecting' || this.room()?.status === 'playing';
    }

	/** Sauvegarde les paramètres de la partie en base de données. */
	private async saveSettings(): Promise<void> {
		try {
			await this.gameService.updateSettings(this.roomId(), this.gameSettings);
		} catch {
			// ignore les erreurs de sauvegarde des paramètres
		}
	}

	/**
	 * DEV : Simule l'adversaire en choisissant un Pokémon aléatoire et en passant prêt,
	 * puis navigue directement vers la page de jeu.
	 */
	async simulateOpponentReady(): Promise<void> {
		if (this.isSimulatingReady) return;
		this.isSimulatingReady = true;
		try {
			let pokemons = this.allPokemons;
			if (pokemons.length === 0) {
				pokemons = await firstValueFrom(this.pokemonService.loadAll());
			}

			// RESTRICTION: Filtrer par génération si nécessaire
			const restrictedGens = this.gameService.settings().generations;
			if (restrictedGens.length > 0) {
				pokemons = pokemons.filter((p) => restrictedGens.includes(p.generation));
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

	/** Copie le lien d'invitation dans le presse-papiers (avec fallback pour HTTP). */
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

	/** Ouvre la modal de détails d'un Pokémon. */
	openPokemonDetails(pokemon: Pokemon): void {
		this.selectedPokemonDetails = pokemon;
	}

	/** Ferme la modal de détails d'un Pokémon. */
	closePokemonDetails(): void {
		this.selectedPokemonDetails = null;
	}

	/** Sélectionne le Pokémon depuis la modal de détails et ferme celle-ci. */
	selectFromDetails(pokemon: Pokemon): void {
		void this.selectPokemon(pokemon);
		this.closePokemonDetails();
	}

	// ─── Modal d'annulation ──────────────────────────────────────────────────────

	/** Affiche la modal de confirmation d'annulation. */
	promptCancel(): void {
		this.showCancelModal.set(true);
	}

	/** Ferme la modal de confirmation d'annulation. */
	closeCancelModal(): void {
		this.showCancelModal.set(false);
	}

	/** Confirme l'annulation et quitte le lobby. */
	confirmCancel(): void {
		this.closeCancelModal();
		this.cancelRoom();
	}
}
