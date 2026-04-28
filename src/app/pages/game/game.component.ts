import { Component, OnInit, OnDestroy, computed, effect, inject, input, isDevMode, signal, untracked, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';

import { GameService } from '../../services/game.service';
import { PokemonService } from '../../services/pokemon.service';
import { SupabaseService } from '../../services/supabase.service';
import { Pokemon } from '../../models/pokemon.model';
import { PokemonCardComponent } from '../../components/pokemon-card/pokemon-card.component';
import { PokedexComponent } from '../../components/pokedex/pokedex.component';
import { CancelModalComponent } from '../../components/cancel-modal/cancel-modal.component';
import { EndGameModalComponent } from '../../components/end-game-modal/end-game-modal.component';
import { GameSettingsModalComponent } from '../../components/game-settings-modal/game-settings-modal.component';
import { HelpModalComponent } from '../../components/help-modal/help-modal.component';
import { IncorrectGuessModalComponent } from '../../components/incorrect-guess-modal/incorrect-guess-modal.component';
import { MyTurnModalComponent } from '../../components/my-turn-modal/my-turn-modal.component';
import { DuelIntroComponent } from '../../components/duel-intro/duel-intro.component';
import { ICONS } from '../../constants/icons';
import { environment } from '../../../environments/environment';
import confetti from 'canvas-confetti';

@Component({
	selector: 'app-game',
	imports: [PokemonCardComponent, PokedexComponent, CancelModalComponent, EndGameModalComponent, GameSettingsModalComponent, HelpModalComponent, IncorrectGuessModalComponent, MyTurnModalComponent, DuelIntroComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './game.component.html',
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

	private readonly allPokemon = toSignal(this.pokemonService.loadAll(), { initialValue: [] as Pokemon[] });
	opponentLastGuess = computed(() => {
		const id = this.room()?.last_guess ?? null;
		if (id === null) return null;
		return this.allPokemon().find(p => p.id === id) ?? null;
	});

	myPokemon: Pokemon | null = null;
	opponentPokemon: Pokemon | null = null;
	devOpponentPokemon: Pokemon | null = null;
	lastGuessedPokemon: Pokemon | null = null;
	activeTab = signal<'pokemon' | 'pokedex' | 'filtres'>('pokedex');

	showEndModal = false;
	showIncorrectModal = signal(false);
	showMyTurnModal = signal(false);
	pendingMyTurnModal = signal(false);
	isWinner = false;
	devOpponentTries = signal(0);
	private isSimulatingTurn = false;
	private isInitialized = false;
	private confettiInterval: ReturnType<typeof setInterval> | null = null;
	readonly isDev = environment.devMode && isDevMode();

	guessedPokemonIds = signal<number[]>([]);

	showCancelModal = signal(false);
	showGameSettingsModal = signal(false);
	showHelpModal = signal(false);

	showDuelIntro = signal(false);
	duelPlayer1 = signal<{ username: string; avatar_url?: string } | null>(null);
	duelPlayer2 = signal<{ username: string; avatar_url?: string } | null>(null);
	private duelShown = false;

	/** Ferme la modal "À ton tour" et réinitialise le dernier guess de l'adversaire. */
	onMyTurnModalClose(): void {
		this.showMyTurnModal.set(false);
	}

	/** Ferme la modal "Raté" et affiche la modal de tour si elle était en attente. */
	onIncorrectModalClose(): void {
		this.showIncorrectModal.set(false);
		if (this.pendingMyTurnModal()) {
			this.pendingMyTurnModal.set(false);
			this.showMyTurnModal.set(true);
		}
	}

	/** Ouvre la modal des paramètres de la partie. */
	openGameSettingsModal(): void { this.showGameSettingsModal.set(true); }
	/** Ferme la modal des paramètres de la partie. */
	closeGameSettingsModal(): void { this.showGameSettingsModal.set(false); }
	openHelpModal(): void { this.showHelpModal.set(true); }
	closeHelpModal(): void { this.showHelpModal.set(false); }
	isCancelling = false;

	opponentLeft = signal(false);

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

				// Déclencher la pop-up "À toi de jouer" depuis le signal DB (fiable même si broadcast manqué)
				if (this.isMyTurn() && !this.showEndModal) {
					// Ne pas reset opponentLastGuess ici : le broadcast l'a déjà rempli avant que l'effect se déclenche
					setTimeout(() => {
						if (!this.showMyTurnModal() && !this.showEndModal) {
							if (this.showIncorrectModal()) {
								this.pendingMyTurnModal.set(true);
							} else {
								this.showMyTurnModal.set(true);
							}
						}
					}, 250);
				}
			}

			// Animation de duel au démarrage de la partie (pas rejoué sur F5)
			const introKey = `duel-intro-shown-${this.roomId()}`;
			if (r?.status === 'playing' && !this.duelShown && !sessionStorage.getItem(introKey)) {
				untracked(() => { this.triggerDuelIntro(r.player1_id, r.player2_id ?? null); });
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

			// Redirection si la room a été supprimée pendant la session
			if (this.isInitialized && r === null) {
				untracked(() => {
					void this.router.navigate(['/home'], { queryParams: { roomNotFound: true } });
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

		});
	}

	/** Lifecycle Angular — initialise la page de jeu. */
	ngOnInit(): void {
		this.supabaseService.trackPresence('in_game');
		void this.init();
	}

	/** Charge les profils des deux joueurs et affiche l'animation de duel. */
	private async triggerDuelIntro(player1Id: string, player2Id: string | null): Promise<void> {
		this.duelShown = true;
		sessionStorage.setItem(`duel-intro-shown-${this.roomId()}`, '1');
		try {
			const fetchProfile = (id: string | null) =>
				id
					? this.supabaseService.getProfile(id).catch(() => ({ username: 'Bot', avatar_url: undefined }))
					: Promise.resolve({ username: 'Bot', avatar_url: undefined });

			const [p1, p2] = await Promise.all([fetchProfile(player1Id), fetchProfile(player2Id)]);
			const p1Data = { username: p1.username, avatar_url: p1.avatar_url };
			const p2Data = { username: p2.username, avatar_url: p2.avatar_url };
			await Promise.all(
				[p1Data, p2Data]
					.filter(p => p.avatar_url)
					.map(p => new Promise<void>(resolve => {
						const img = new Image();
						img.onload = img.onerror = () => resolve();
						img.src = p.avatar_url!;
					}))
			);
			this.duelPlayer1.set(p1Data);
			this.duelPlayer2.set(p2Data);
			this.showDuelIntro.set(true);
		} catch {
			// skip l'animation si les profils sont indisponibles
		}
	}

	/**
	 * Initialise la page de jeu : attend l'authentification, rejoint la room,
	 * charge le Pokémon du joueur et s'abonne aux broadcasts adverses.
	 */
	private async init(): Promise<void> {
		await firstValueFrom(this.supabaseService.authReady$);
		try {
			await this.gameService.joinAndWatch(this.roomId());
		} catch {
			void this.router.navigate(['/home'], { queryParams: { roomNotFound: true } });
			return;
		}

		const r = this.room();
		if (!r) {
			void this.router.navigate(['/home'], { queryParams: { roomNotFound: true } });
			return;
		}

		this.isInitialized = true;

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

		// Le dernier guess adverse est lu depuis room().last_guess (DB-synced via Realtime/polling)

		this.broadcastSub = this.gameService.broadcastEvents$.subscribe(({ event }) => {
			if (event === 'player_left') {
				this.opponentLeft.set(true);
			}
		});
	}

	/**
	 * Traite la fin de partie : détermine le vainqueur, charge le Pokémon adverse
	 * pour la modal de résultat et lance les confettis si le joueur a gagné.
	 */
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
		this.pendingMyTurnModal.set(false);

		if (this.isWinner) {
			this.launchConfetti();
		}
		this.showEndModal = true;
	}

	/** Lance l'animation de confettis pour célébrer la victoire. */
	private launchConfetti(): void {
		const colors = ['#ef4444', '#facc15', '#3b82f6', '#ffffff'];

		if (window.innerWidth < 768) {
			confetti({
				particleCount: 120,
				spread: 90,
				origin: { x: 0.5, y: 0.6 },
				colors,
			});
			return;
		}

		const duration = 3000;
		const end = Date.now() + duration;

		const fire = (originX: number) => {
			confetti({
				particleCount: 6,
				angle: originX === 0.1 ? 60 : 120,
				spread: 55,
				origin: { x: originX, y: 1 },
				colors,
			});
		};

		if (this.confettiInterval !== null) {
			clearInterval(this.confettiInterval);
			this.confettiInterval = null;
		}
		this.confettiInterval = setInterval(() => {
			if (Date.now() > end) {
				clearInterval(this.confettiInterval!);
				this.confettiInterval = null;
				return;
			}
			fire(0.1);
			fire(0.9);
		}, 50);
	}

	/**
	 * Traite le guess d'un Pokémon par le joueur.
	 * Si incorrect, ajoute le Pokémon à la liste des tentatives et affiche la modal "Raté".
	 */
	async onGuess(pokemonId: number): Promise<void> {
		if (!this.isMyTurn()) return;

		try {
			const result = await this.gameService.guess(this.roomId(), pokemonId);
			if (result === 'incorrect') {
				this.guessedPokemonIds.update(ids => [...ids, pokemonId]);
				const p = await firstValueFrom(this.pokemonService.getById(pokemonId));
				this.lastGuessedPokemon = p ?? null;
				this.showIncorrectModal.set(true);
			}
			// 'correct' → room signal switches to 'finished' → effect handles modal
		} catch {
			// ignore les erreurs de guess
		}
	}

	/** DEV : Simule le tour de l'adversaire fictif avec un délai et une logique de victoire progressive. */
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

			await this.gameService.simulateOpponentGuess(this.roomId(), targetPokemonId);
		} catch {
			// ignore les erreurs de simulation
		} finally {
			this.isSimulatingTurn = false;
		}
	}

	/** Navigue vers la page d'accueil et notifie l'adversaire. */
	async goHome(): Promise<void> {
		await this.supabaseService.broadcastPlayerLeft().catch(() => {});
		void this.router.navigate(['/home']);
	}

	/** Demande une revanche à l'adversaire. */
	async requestReplay(): Promise<void> {
		try {
			await this.gameService.requestReplay(this.roomId());
		} catch {
			// ignore les erreurs de revanche
		}
	}

	// ─── Annulation de partie ──────────────────────────────────────────────────

	/** Affiche la modal de confirmation d'annulation. */
	promptCancel(): void {
		this.showCancelModal.set(true);
	}

	/** Ferme la modal de confirmation d'annulation. */
	closeCancelModal(): void {
		this.showCancelModal.set(false);
	}

	/** Confirme l'annulation de la partie et navigue vers l'accueil. */
	confirmCancel(): void {
		if (this.isCancelling) return;
		this.isCancelling = true;
		void this.gameService.cancelRoom(this.roomId()).catch(() => {
			// ignore les erreurs d'annulation
		});
		void this.router.navigate(['/home']);
	}

	/** Lifecycle Angular — nettoie la présence, les confettis et les abonnements. */
	ngOnDestroy(): void {
		this.supabaseService.untrackPresence();
		if (this.confettiInterval !== null) {
			clearInterval(this.confettiInterval);
			this.confettiInterval = null;
		}
		this.gameService.stopWatching();
		this.pokemonSub?.unsubscribe();
		this.opponentSub?.unsubscribe();
		this.devOpponentSub?.unsubscribe();
		this.broadcastSub?.unsubscribe();
	}
}
