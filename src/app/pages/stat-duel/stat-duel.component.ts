import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA, inject, signal, computed } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PokemonService } from '../../services/pokemon.service';
import { SupabaseService } from '../../services/supabase.service';
import { Pokemon } from '../../models/pokemon.model';
import { StatDuelRoom, StatPick } from '../../models/room.model';
import { ICONS } from '../../constants/icons';
import { DuelIntroComponent } from '../../components/duel-intro/duel-intro.component';

type Phase = 'mode-select' | 'waiting' | 'playing' | 'result';

interface StatDef {
  key: keyof Pokemon['stats'];
  label: string;
  colorClass: string;
  bgClass: string;
}

const STAT_DEFS: StatDef[] = [
  { key: 'pv',      label: 'PV',    colorClass: 'text-green-400',  bgClass: 'bg-green-500' },
  { key: 'attaque', label: 'ATQ',   colorClass: 'text-red-400',    bgClass: 'bg-red-500' },
  { key: 'defense', label: 'DEF',   colorClass: 'text-blue-400',   bgClass: 'bg-blue-500' },
  { key: 'atq_spe', label: 'ATQ S', colorClass: 'text-purple-400', bgClass: 'bg-purple-500' },
  { key: 'def_spe', label: 'DEF S', colorClass: 'text-pink-400',   bgClass: 'bg-pink-500' },
  { key: 'vitesse', label: 'VIT',   colorClass: 'text-yellow-400', bgClass: 'bg-yellow-500' },
];

const ROUND_COUNT = 6;
const ROUND_DURATION_MS = 11_000; // 10s pick + 1s transition

@Component({
  selector: 'app-stat-duel',
  standalone: true,
  imports: [NgClass, DuelIntroComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './stat-duel.component.html',
  styles: [`
    @keyframes statPop {
      0%   { transform: scale(0.4); opacity: 0; }
      60%  { transform: scale(1.2); opacity: 1; }
      100% { transform: scale(1); }
    }
    .stat-pop { animation: statPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  `],
})
export class StatDuelComponent implements OnInit, OnDestroy {
  protected readonly ICONS = ICONS;
  protected readonly STAT_DEFS = STAT_DEFS;
  protected readonly ROUND_COUNT = ROUND_COUNT;
  protected readonly INDICES = [0, 1, 2, 3, 4, 5];

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pokemonService = inject(PokemonService);
  private readonly supabaseService = inject(SupabaseService);

  // ─── Phase & mode ────────────────────────────────────────────────────────────
  phase = signal<Phase>('mode-select');
  isSolo = signal(true);
  isDevMode = signal(false);
  isPlayer1 = signal(false);
  roomId: string | null = null;

  // ─── Données de jeu ──────────────────────────────────────────────────────────
  pokemonList = signal<Pokemon[]>([]);
  currentRound = signal(0);
  timerValue = signal(10);
  timerProgress = signal(10);
  justPickedStat = signal<StatPick | null>(null);
  myPicks = signal<StatPick[]>([]);
  opponentPicks = signal<StatPick[]>([]);
  room = signal<StatDuelRoom | null>(null);
  revealedRound = signal(-1);
  waitingForReveal = signal(false);
  pendingMyPickStat = signal<string | null>(null);
  justRevealedOpponentPick = signal<StatPick | null>(null);

  // ─── Computed ────────────────────────────────────────────────────────────────
  currentPokemon = computed(() => this.pokemonList()[this.currentRound()] ?? null);
  pickedStatKeys = computed(() => new Set(this.myPicks().map(p => p.stat)));
  hasPickedThisRound = computed(() => this.myPicks().length > this.currentRound());
  myTotal = computed(() => this.myPicks().reduce((s, p) => s + p.value, 0));
  opponentTotal = computed(() => this.opponentPicks().reduce((s, p) => s + p.value, 0));
  myRevealedPicks = computed(() => this.myPicks().slice(0, this.revealedRound() + 1));
  opponentRevealedPicks = computed(() => this.opponentPicks().slice(0, this.revealedRound() + 1));
  isCurrentRoundRevealed = computed(() => this.revealedRound() >= this.currentRound());
  myRevealedTotal = computed(() => this.myRevealedPicks().reduce((s, p) => s + p.value, 0));

  // ─── Timer ───────────────────────────────────────────────────────────────────
  private clockInterval: ReturnType<typeof setInterval> | null = null;
  private roundStartTime = 0;

  // ─── Abonnements ─────────────────────────────────────────────────────────────
  private roomSub?: Subscription;
  private waitingPollInterval: ReturnType<typeof setInterval> | null = null;

  // ─── Dev mode bot ────────────────────────────────────────────────────────────
  private botPickedRounds = new Set<number>();

  // ─── Duel intro ──────────────────────────────────────────────────────────────
  showDuelIntro = signal(false);
  duelPlayer1 = signal<{ username: string; avatar_url?: string } | null>(null);
  duelPlayer2 = signal<{ username: string; avatar_url?: string } | null>(null);
  private duelShown = false;

  // ─── UI state ────────────────────────────────────────────────────────────────
  showHelpModal = signal(false);
  statsExpanded = signal(false);

  // ─── Partage lien ────────────────────────────────────────────────────────────
  inviteLink = '';
  linkCopied = signal(false);

  // ─── Type colors map ─────────────────────────────────────────────────────────
  protected readonly TYPE_COLORS: Record<string, string> = {
    'Normal': 'bg-gray-400', 'Feu': 'bg-orange-500', 'Eau': 'bg-blue-500',
    'Électrik': 'bg-yellow-400', 'Plante': 'bg-green-500', 'Glace': 'bg-cyan-400',
    'Combat': 'bg-red-700', 'Poison': 'bg-purple-500', 'Sol': 'bg-yellow-600',
    'Vol': 'bg-indigo-400', 'Psy': 'bg-pink-500', 'Insecte': 'bg-lime-500',
    'Roche': 'bg-yellow-700', 'Spectre': 'bg-violet-700', 'Dragon': 'bg-indigo-600',
    'Ténèbres': 'bg-gray-700', 'Acier': 'bg-slate-400', 'Fée': 'bg-pink-300',
  };

  ngOnInit(): void {
    this.roomId = this.route.snapshot.paramMap.get('roomId');
    if (this.route.snapshot.queryParams['dev'] === '1') {
      this.isDevMode.set(true);
    }
    if (this.roomId) {
      this.isSolo.set(false);
      this.phase.set('waiting');
      void this.initMulti(this.roomId);
    }
  }

  ngOnDestroy(): void {
    this.stopClock();
    this.roomSub?.unsubscribe();
    this.stopWaitingPoll();
  }

  // ─── Mode select ─────────────────────────────────────────────────────────────

  async startSolo(): Promise<void> {
    this.isSolo.set(true);
    const allPokemon = await this.loadAll();
    this.pokemonList.set(this.shuffle(allPokemon).slice(0, ROUND_COUNT));
    this.myPicks.set([]);
    this.currentRound.set(0);
    this.phase.set('playing');
    this.startSoloClock();
  }

  async createMultiRoom(): Promise<void> {
    const roomId = await this.supabaseService.createStatDuelRoom();
    void this.router.navigate(['/stat-duel', roomId]);
  }

  async startDevMode(): Promise<void> {
    const roomId = await this.supabaseService.createStatDuelRoom();
    void this.router.navigate(['/stat-duel', roomId], { queryParams: { dev: '1' } });
  }

  // ─── Multi init ──────────────────────────────────────────────────────────────

  private async initMulti(roomId: string): Promise<void> {
    const me = this.supabaseService.getCurrentUser();
    if (!me) return;

    this.inviteLink = `${window.location.origin}/stat-duel/${roomId}`;

    const room = await this.supabaseService.getStatDuelRoom(roomId);
    this.room.set(room);
    this.isPlayer1.set(room.player1_id === me.id);

    // Rejoindre en tant que P2 si la place est libre et qu'on n'est pas P1
    if (!room.player2_id && room.player1_id !== me.id) {
      await this.supabaseService.joinStatDuelRoom(roomId);
      const refreshed = await this.supabaseService.getStatDuelRoom(roomId);
      this.room.set(refreshed);
    }

    if (room.status === 'playing' || room.status === 'finished') {
      await this.loadPokemonAndStartMulti(room);
      if (room.status === 'finished') this.phase.set('result');
    }

    this.roomSub = this.supabaseService.subscribeToStatDuelRoom(roomId).subscribe(async (updated) => {
      this.room.set(updated);
      if (updated.player2_id) this.stopWaitingPoll();

      if (updated.status === 'playing' && this.phase() === 'waiting') {
        await this.loadPokemonAndStartMulti(updated);
      }

      if (updated.status === 'playing' && this.phase() === 'playing') {
        const me2 = this.supabaseService.getCurrentUser();
        if (!me2) return;
        const isP1 = updated.player1_id === me2.id;
        this.myPicks.set(isP1 ? updated.p1_picks : updated.p2_picks);
        this.opponentPicks.set(isP1 ? updated.p2_picks : updated.p1_picks);

        // Reveal simultané : dès que les deux ont choisi, on révèle
        if (this.waitingForReveal() && this.opponentPicks().length > this.currentRound()) {
          this.triggerReveal();
        }

        if (updated.p1_picks.length === ROUND_COUNT && updated.p2_picks.length === ROUND_COUNT) {
          this.endMultiGame(updated);
        }
      }
    });

    this.startWaitingPoll(roomId);
  }

  private startWaitingPoll(roomId: string): void {
    this.waitingPollInterval = setInterval(async () => {
      if (this.phase() !== 'waiting') {
        this.stopWaitingPoll();
        return;
      }
      const refreshed = await this.supabaseService.getStatDuelRoom(roomId);

      if (!this.room()?.player2_id && refreshed.player2_id) {
        this.room.set(refreshed);
      }

      if (refreshed.status === 'playing' && this.phase() === 'waiting') {
        this.room.set(refreshed);
        await this.loadPokemonAndStartMulti(refreshed);
      }
    }, 3000);
  }

  private stopWaitingPoll(): void {
    if (this.waitingPollInterval) {
      clearInterval(this.waitingPollInterval);
      this.waitingPollInterval = null;
    }
  }

  private async loadPokemonAndStartMulti(room: StatDuelRoom): Promise<void> {
    if (this.phase() === 'playing') return;
    const allPokemon = await this.loadAll();
    const pokemonMap = new Map(allPokemon.map(p => [p.id, p]));
    const list = room.pokemon_ids.map(id => pokemonMap.get(id)).filter((p): p is Pokemon => !!p);
    this.pokemonList.set(list);

    const me = this.supabaseService.getCurrentUser();
    if (!me) return;
    const isP1 = room.player1_id === me.id;
    this.myPicks.set(isP1 ? room.p1_picks : room.p2_picks);
    this.opponentPicks.set(isP1 ? room.p2_picks : room.p1_picks);

    // En cas de reconnexion mid-game, les manches terminées sont déjà révélées
    const completedRounds = Math.min(room.p1_picks.length, room.p2_picks.length) - 1;
    this.revealedRound.set(completedRounds);

    this.phase.set('playing');
    void this.triggerDuelIntro(room);
    this.startMultiClock(room.round_start_at!);

    if (this.isDevMode()) {
      this.botPickedRounds.clear();
      for (let r = 0; r < ROUND_COUNT; r++) {
        this.scheduleBotPick(r, room.round_start_at!);
      }
    }
  }

  // ─── Lancer la partie multi (P1) ─────────────────────────────────────────────

  private isLaunching = false;

  async launchMultiGame(): Promise<void> {
    if (this.isLaunching || !this.roomId) return;
    const currentRoom = this.room();
    if (!currentRoom) return;

    this.isLaunching = true;
    try {
      const allPokemon = await this.loadAll();
      const pokemonIds = this.shuffle(allPokemon).slice(0, ROUND_COUNT).map(p => p.id);
      const roundStartAt = new Date().toISOString();

      await this.supabaseService.updateStatDuelRoom(this.roomId, {
        status: 'playing',
        pokemon_ids: pokemonIds,
        round_start_at: roundStartAt,
      });

      // P1 transite directement — la subscription ne renvoie pas toujours l'écho
      // au client qui a émis le changement (comportement Supabase realtime)
      await this.loadPokemonAndStartMulti({
        ...currentRoom,
        status: 'playing',
        pokemon_ids: pokemonIds,
        round_start_at: roundStartAt,
        p1_picks: [],
        p2_picks: [],
      });
    } finally {
      this.isLaunching = false;
    }
  }

  // ─── Horloges ────────────────────────────────────────────────────────────────

  private startSoloClock(): void {
    this.stopClock();
    this.roundStartTime = Date.now();
    this.timerValue.set(10);
    this.timerProgress.set(10);
    this.clockInterval = setInterval(() => {
      const elapsed = Date.now() - this.roundStartTime;
      const remainingFloat = Math.max(0, 10 - elapsed / 1000);
      const remaining = Math.ceil(remainingFloat);
      this.timerValue.set(remaining);
      this.timerProgress.set(remainingFloat);
      if (remaining <= 0 && !this.hasPickedThisRound()) {
        this.autoPickStat();
      }
    }, 200);
  }

  private startMultiClock(roundStartAt: string): void {
    this.stopClock();
    const startMs = new Date(roundStartAt).getTime();
    let prevRound = -1;
    this.clockInterval = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const round = Math.min(Math.floor(elapsed / ROUND_DURATION_MS), ROUND_COUNT - 1);
      const elapsedInRound = elapsed % ROUND_DURATION_MS;
      const remainingFloat = Math.max(0, 10 - elapsedInRound / 1000);
      const remaining = Math.ceil(remainingFloat);

      // Transition de manche : révéler si on attendait
      if (round !== prevRound && prevRound >= 0 && this.waitingForReveal()) {
        this.triggerReveal();
      }
      prevRound = round;

      this.currentRound.set(round);
      this.timerValue.set(remaining);
      this.timerProgress.set(remainingFloat);

      if (remaining <= 0) {
        if (this.myPicks().length <= round) {
          this.autoPickStat();
        } else if (this.waitingForReveal() && !this.isCurrentRoundRevealed()) {
          this.triggerReveal();
        }
      }

      if (elapsed >= ROUND_COUNT * ROUND_DURATION_MS) {
        this.stopClock();
      }
    }, 200);
  }

  private stopClock(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  private triggerReveal(): void {
    this.waitingForReveal.set(false);
    this.pendingMyPickStat.set(null);
    const round = this.currentRound();
    this.revealedRound.set(round);
    const myPick = this.myPicks()[round];
    if (myPick) this.justPickedStat.set(myPick);
    const opPick = this.opponentPicks()[round];
    if (opPick) this.justRevealedOpponentPick.set(opPick);
    setTimeout(() => {
      this.justPickedStat.set(null);
      this.justRevealedOpponentPick.set(null);
    }, 2000);
  }

  // ─── Pick stat ───────────────────────────────────────────────────────────────

  pickStat(statKey: keyof Pokemon['stats']): void {
    if (this.hasPickedThisRound()) return;
    const pokemon = this.currentPokemon();
    if (!pokemon) return;

    const pick: StatPick = { stat: statKey, value: pokemon.stats[statKey] };
    this.myPicks.update(arr => [...arr, pick]);

    if (this.isSolo()) {
      this.stopClock();
      this.justPickedStat.set(pick);
      setTimeout(() => {
        this.justPickedStat.set(null);
        this.advanceSoloRound();
      }, 1500);
    } else {
      const me = this.supabaseService.getCurrentUser();
      if (!me || !this.roomId) return;
      const isP1 = this.room()?.player1_id === me.id;
      this.pendingMyPickStat.set(statKey);
      this.waitingForReveal.set(true);
      void this.supabaseService.appendStatPick(this.roomId, isP1 ? 'p1_picks' : 'p2_picks', pick);
      // Si l'adversaire a déjà choisi, on révèle immédiatement
      if (this.opponentPicks().length > this.currentRound()) {
        this.triggerReveal();
      }
    }
  }

  private autoPickStat(): void {
    const available = STAT_DEFS.map(s => s.key).filter(k => !this.pickedStatKeys().has(k));
    if (available.length === 0) return;
    const randomKey = available[Math.floor(Math.random() * available.length)];
    this.pickStat(randomKey);
  }

  // ─── Avancer (solo) ──────────────────────────────────────────────────────────

  private advanceSoloRound(): void {
    const next = this.currentRound() + 1;
    if (next >= ROUND_COUNT) {
      this.phase.set('result');
    } else {
      this.currentRound.set(next);
      this.startSoloClock();
    }
  }

  // ─── Fin de partie multi ─────────────────────────────────────────────────────

  private endMultiGame(room: StatDuelRoom): void {
    this.stopClock();
    if (!this.isPlayer1() || !this.roomId || room.status === 'finished') {
      this.phase.set('result');
      return;
    }
    const p1Total = room.p1_picks.reduce((s, p) => s + p.value, 0);
    const p2Total = room.p2_picks.reduce((s, p) => s + p.value, 0);
    const winner = p1Total > p2Total ? 'player1' : p2Total > p1Total ? 'player2' : 'draw';
    void this.supabaseService.updateStatDuelRoom(this.roomId, { status: 'finished', winner });
    this.phase.set('result');
  }

  // ─── Bot (dev mode) ──────────────────────────────────────────────────────────

  private scheduleBotPick(roundIndex: number, roundStartAt: string): void {
    const roundStartMs = new Date(roundStartAt).getTime() + roundIndex * ROUND_DURATION_MS;
    const botDelay = 1500 + Math.random() * 6500; // 1.5s–8s dans la manche
    const delayFromNow = Math.max(200, roundStartMs + botDelay - Date.now());

    setTimeout(async () => {
      if (this.phase() !== 'playing' || !this.roomId) return;
      if (this.botPickedRounds.has(roundIndex)) return;

      const botUsedStats = Array.from(this.botPickedRounds).length;
      if (botUsedStats !== roundIndex) return; // ordre strict

      const currentBotPicks = this.room()?.p2_picks ?? [];
      const available = STAT_DEFS.map(s => s.key).filter(k => !currentBotPicks.some(p => p.stat === k));
      if (available.length === 0) return;

      const pokemon = this.pokemonList()[roundIndex];
      if (!pokemon) return;

      const randomStat = available[Math.floor(Math.random() * available.length)];
      const value = pokemon.stats[randomStat];
      this.botPickedRounds.add(roundIndex);

      await this.supabaseService.appendStatPick(this.roomId, 'p2_picks', { stat: randomStat, value });
    }, delayFromNow);
  }

  // ─── Duel intro ──────────────────────────────────────────────────────────────

  private async triggerDuelIntro(room: StatDuelRoom): Promise<void> {
    if (!this.roomId) return;
    const introKey = `stat-duel-intro-shown-${this.roomId}`;
    if (this.duelShown || sessionStorage.getItem(introKey)) return;
    this.duelShown = true;
    sessionStorage.setItem(introKey, '1');
    try {
      const fetchProfile = (id: string | null) =>
        id
          ? this.supabaseService.getProfile(id).catch(() => ({ username: '?', avatar_url: undefined }))
          : Promise.resolve({ username: '?', avatar_url: undefined });
      const [p1, p2] = await Promise.all([fetchProfile(room.player1_id), fetchProfile(room.player2_id ?? null)]);
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

  // ─── Rejouer / Navigation ────────────────────────────────────────────────────

  replay(): void {
    this.myPicks.set([]);
    this.opponentPicks.set([]);
    this.pokemonList.set([]);
    this.currentRound.set(0);
    this.timerValue.set(10);
    this.revealedRound.set(-1);
    this.waitingForReveal.set(false);
    this.pendingMyPickStat.set(null);
    this.justRevealedOpponentPick.set(null);
    this.botPickedRounds.clear();
    this.roomSub?.unsubscribe();
    this.phase.set('mode-select');
    if (!this.isSolo()) {
      void this.router.navigate(['/stat-duel']);
    }
  }

  goHome(): void {
    void this.router.navigate(['/home']);
  }

  // ─── Partage lien multi ──────────────────────────────────────────────────────

  async copyRoomLink(): Promise<void> {
    if (!this.inviteLink) return;
    try {
      await navigator.clipboard.writeText(this.inviteLink);
    } catch {
      const el = document.createElement('input');
      el.value = this.inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    this.linkCopied.set(true);
    setTimeout(() => this.linkCopied.set(false), 2000);
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────────────

  private loadAll(): Promise<Pokemon[]> {
    return new Promise(resolve => {
      this.pokemonService.loadAll().subscribe(all => resolve(all));
    });
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  getStatBarWidth(value: number): string {
    return `${Math.min(100, Math.round((value / 200) * 100))}%`;
  }

  getTimerColor(): string {
    const t = this.timerValue();
    if (t <= 3) return 'text-red-400';
    if (t <= 6) return 'text-yellow-400';
    return 'text-green-400';
  }

  getTimerBg(): string {
    const t = this.timerValue();
    if (t <= 3) return 'bg-red-500';
    if (t <= 6) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  getStatButtonClass(statKey: keyof Pokemon['stats'], alreadyPicked: boolean): string {
    const base = 'flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all font-bold relative';
    if (!this.isSolo() && this.pendingMyPickStat() === statKey) return `${base} bg-blue-500/15 border-blue-500/50 cursor-not-allowed`;
    if (this.justPickedStat()?.stat === statKey) return `${base} bg-yellow-500/15 border-yellow-500 cursor-not-allowed`;
    if (alreadyPicked) return `${base} bg-slate-700/30 border-slate-700/30 opacity-30 cursor-not-allowed`;
    if (this.hasPickedThisRound()) return `${base} bg-slate-700/50 border-slate-700/50 opacity-50 cursor-not-allowed`;
    return `${base} bg-slate-700 border-slate-600 hover:border-yellow-500/60 hover:bg-slate-600 cursor-pointer active:scale-95`;
  }

  getResultLabel(): string {
    const me = this.supabaseService.getCurrentUser();
    const room = this.room();
    if (!me || !room?.winner) return '';
    if (room.winner === 'draw') return 'Égalité !';
    const isMeP1 = room.player1_id === me.id;
    const iWon = (room.winner === 'player1' && isMeP1) || (room.winner === 'player2' && !isMeP1);
    return iWon ? 'Victoire !' : 'Défaite !';
  }

  getResultColor(): string {
    const me = this.supabaseService.getCurrentUser();
    const room = this.room();
    if (!me || !room?.winner) return 'text-white';
    if (room.winner === 'draw') return 'text-yellow-400';
    const isMeP1 = room.player1_id === me.id;
    const iWon = (room.winner === 'player1' && isMeP1) || (room.winner === 'player2' && !isMeP1);
    return iWon ? 'text-yellow-400' : 'text-red-400';
  }

  getMyPickForStat(statKey: string): StatPick | undefined {
    return this.myPicks().find(p => p.stat === statKey);
  }

  getMyRevealedPickForStat(statKey: string): StatPick | undefined {
    return this.myRevealedPicks().find(p => p.stat === statKey);
  }

  getOpponentPickForStat(statKey: string): StatPick | undefined {
    return this.opponentPicks().find(p => p.stat === statKey);
  }
}
