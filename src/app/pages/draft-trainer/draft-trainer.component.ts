import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { PokemonService } from '../../services/pokemon.service';
import { SupabaseService } from '../../services/supabase.service';
import { Pokemon } from '../../models/pokemon.model';
import { ICONS } from '../../constants/icons';
import { TYPE_COLORS, TYPE_ICONS, TYPE_OFFENSIVE, effectiveMultiplier } from '../../constants/type-chart';
import {
  lockAnimation,
  scoreRevealAnimation,
  slotStateAnimation,
  slotsGridAnimation,
} from '../../constants/animations';
import confetti from 'canvas-confetti';
import { PokemonCardComponent } from '../../components/pokemon-card/pokemon-card.component';
import { DraftHelpModalComponent } from '../../components/draft-help-modal/draft-help-modal.component';

export interface Trainer {
  nom: string;
  region: string;
  generation: number | string;
  role: string;
  version: string;
  image: string;
  pokemons: number[];
}

type Phase = 'loading' | 'playing' | 'complete';
type SlotState = 'idle' | 'leaving' | 'entering';

@Component({
  selector: 'app-draft-trainer',
  imports: [NgClass, PokemonCardComponent, DraftHelpModalComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  animations: [slotsGridAnimation, slotStateAnimation, lockAnimation, scoreRevealAnimation],
  templateUrl: './draft-trainer.component.html',
})
export class DraftTrainerComponent implements OnInit, OnDestroy {
  protected readonly ICONS = ICONS;
  protected readonly TYPE_COLORS = TYPE_COLORS;
  protected readonly TYPE_ICONS = TYPE_ICONS;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly pokemonService = inject(PokemonService);
  private readonly supabaseService = inject(SupabaseService);

  private readonly allPokemon = toSignal(this.pokemonService.loadAll(), {
    initialValue: [] as Pokemon[],
  });

  private readonly trainerPool = computed(() => {
    const all = this.allPokemon();
    const trainer = this.trainer();
    if (!trainer) return all;

    const genValue = trainer.generation;

    // Cas spéciaux (Pato, etc.)
    if (genValue === 'Toutes' || genValue === 'Toutes régions' || trainer.nom === 'Pato') {
      return all;
    }

    // Cas spécial Red (Gen 1 + Gen 2)
    if (trainer.nom === 'Red') {
      return all.filter(p => p.generation === 1 || p.generation === 2);
    }

    // Gestion des nombres
    if (typeof genValue === 'number') {
      return all.filter(p => p.generation === genValue);
    }

    // Gestion des chaînes (ex: "1, 2" ou "1-2")
    if (typeof genValue === 'string') {
      if (genValue.includes(',') || genValue.includes('-')) {
        const parts = genValue.split(/[,\-]/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (parts.length > 0) {
          if (genValue.includes('-') && parts.length === 2) {
            // Range (ex: "1-3")
            return all.filter(p => p.generation >= parts[0] && p.generation <= parts[1]);
          }
          // Liste (ex: "1, 2")
          return all.filter(p => parts.includes(p.generation));
        }
      }
      
      const gen = parseInt(genValue, 10);
      if (!isNaN(gen)) return all.filter(p => p.generation === gen);
    }

    return all;
  });

  private readonly statsRange = computed(() => {
    const all = this.trainerPool();
    if (all.length === 0) return { min: 0, max: 1 };
    const totals = all.map(p => this.computeTotal(p));
    return { min: Math.min(...totals), max: Math.max(...totals) };
  });

  readonly phase = signal<Phase>('loading');
  readonly trainer = signal<Trainer | null>(null);
  readonly showHelpModal = signal(false);
  readonly selectedPokemon = signal<Pokemon | null>(null);

  readonly slots = signal<(Pokemon | null)[]>([null, null, null, null, null, null]);
  readonly lockedIndices = signal<Set<number>>(new Set());
  readonly lockedPokemon = signal<(Pokemon | null)[]>([null, null, null, null, null, null]);
  private readonly usedIds = signal<Set<number>>(new Set());
  readonly slotStates = signal<SlotState[]>(['idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
  readonly lockedCount = computed(() => this.lockedIndices().size);

  readonly timerValue = signal(10);
  readonly timerProgress = signal(1.0);
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  readonly timerColor = computed(() => {
    const v = this.timerValue();
    if (v > 6) return 'text-green-400';
    if (v > 3) return 'text-yellow-400';
    return 'text-red-400';
  });
  readonly timerBarColor = computed(() => {
    const v = this.timerValue();
    if (v > 6) return 'bg-green-400';
    if (v > 3) return 'bg-yellow-400';
    return 'bg-red-400';
  });

  readonly myTeamPokemons = signal<Pokemon[]>([]);
  readonly opponentTeamPokemons = computed(() => {
    const t = this.trainer();
    const all = this.allPokemon();
    if (!t || all.length === 0) return [];
    const byId = new Map(all.map(p => [p.id, p]));
    return t.pokemons.map(id => byId.get(id)).filter((p): p is Pokemon => !!p);
  });
  readonly showScores = signal(false);

  readonly myStatsScore = computed(() => this.computeStatsScore(this.myTeamPokemons()));
  readonly opponentStatsScore = computed(() => this.computeStatsScore(this.opponentTeamPokemons()));

  readonly myCoverageScore = computed(() =>
    this.computeDuoCoverageScore(this.myTeamPokemons(), this.opponentTeamPokemons())
  );
  readonly opponentCoverageScore = computed(() =>
    this.computeDuoCoverageScore(this.opponentTeamPokemons(), this.myTeamPokemons())
  );

  readonly myFinalScore = computed(() => {
    const s = this.myStatsScore();
    const c = this.myCoverageScore();
    if (s === 0 && c === 0) return 0;
    return Math.round(((s + c) / 2) * 10) / 10;
  });
  readonly opponentFinalScore = computed(() => {
    const s = this.opponentStatsScore();
    const c = this.opponentCoverageScore();
    if (s === 0 && c === 0) return 0;
    return Math.round(((s + c) / 2) * 10) / 10;
  });

  readonly winner = computed((): 'me' | 'opponent' | 'draw' => {
    const my = this.myFinalScore();
    const opp = this.opponentFinalScore();
    if (my > opp) return 'me';
    if (opp > my) return 'opponent';
    return 'draw';
  });

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch('/assets/trainers.json');
      const trainers = await res.json() as Trainer[];
      const idParam = this.route.snapshot.paramMap.get('id');
      const id = idParam ? parseInt(idParam, 10) : 0;
      
      const selectedTrainer = trainers[id] || trainers[0];
      this.trainer.set(selectedTrainer);

      if (this.allPokemon().length === 0) {
        const unsub = this.pokemonService.loadAll().subscribe(all => {
          if (all.length > 0) {
            unsub.unsubscribe();
            this.initDraft();
          }
        });
      } else {
        this.initDraft();
      }
    } catch {
      this.router.navigate(['/home']);
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private initDraft(): void {
    const pool = this.trainerPool();
    const starter = this.pickOneStarter(pool, new Set());
    const legendary = this.pickOneLegendary(pool, new Set(starter ? [starter.id] : []));
    const excludeForNormal = new Set([
      ...(starter ? [starter.id] : []),
      ...(legendary ? [legendary.id] : []),
    ]);
    const normal = this.pickNUnique(pool, excludeForNormal, 4);
    const initial: (Pokemon | null)[] = [starter, ...normal, legendary];
    this.usedIds.set(new Set(initial.filter((p): p is Pokemon => p !== null).map(p => p.id)));
    this.slots.set(initial);
    this.lockedIndices.set(new Set());
    this.lockedPokemon.set([null, null, null, null, null, null]);
    this.slotStates.set(['idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
    
    this.phase.set('playing');
    this.startTimer();
  }

  async onSlotClick(index: number): Promise<void> {
    if (this.lockedIndices().has(index) || this.phase() !== 'playing') return;
    const picked = this.slots()[index];
    if (!picked) return;
    await this.lockPokemon(index, picked);
  }

  private async autoPickSlot(): Promise<void> {
    const unlocked = [0, 1, 2, 3, 4, 5].filter(i => !this.lockedIndices().has(i));
    if (unlocked.length === 0) return;
    const randomIndex = unlocked[Math.floor(Math.random() * unlocked.length)];
    const picked = this.slots()[randomIndex];
    if (picked) await this.lockPokemon(randomIndex, picked);
  }

  private async lockPokemon(index: number, picked: Pokemon): Promise<void> {
    this.stopTimer();

    this.lockedIndices.update(s => new Set([...s, index]));
    this.lockedPokemon.update(arr => {
      const next = [...arr];
      next[index] = picked;
      return next;
    });
    this.usedIds.update(s => new Set([...s, picked.id]));

    const unlocked = [0, 1, 2, 3, 4, 5].filter(i => !this.lockedIndices().has(i));

    if (unlocked.length === 0) {
      await this.enterCompletePhase();
      return;
    }

    this.slotStates.update(states => {
      const next = [...states] as SlotState[];
      unlocked.forEach(i => (next[i] = 'leaving'));
      return next;
    });

    const slot0Unlocked = unlocked.includes(0);
    const slot5Unlocked = unlocked.includes(5);
    const unlockedNormal = unlocked.filter(i => i !== 0 && i !== 5);

    const newStarter = slot0Unlocked ? this.pickOneStarter(this.trainerPool(), this.usedIds()) : null;
    const excludeForNormal = new Set([...this.usedIds(), ...(newStarter ? [newStarter.id] : [])]);
    const newNormal = this.pickNUnique(this.trainerPool(), excludeForNormal, unlockedNormal.length);
    const excludeForLegend = new Set([...excludeForNormal, ...newNormal.map(p => p.id)]);
    const newLegendary = slot5Unlocked ? this.pickOneLegendary(this.trainerPool(), excludeForLegend) : null;

    const allNew = [
      ...(newStarter ? [newStarter] : []),
      ...newNormal,
      ...(newLegendary ? [newLegendary] : []),
    ];
    this.usedIds.update(s => new Set([...s, ...allNew.map(p => p.id)]));

    const newBySlot = new Map<number, Pokemon>();
    if (slot0Unlocked && newStarter) newBySlot.set(0, newStarter);
    unlockedNormal.forEach((slotIdx, i) => newBySlot.set(slotIdx, newNormal[i]));
    if (slot5Unlocked && newLegendary) newBySlot.set(5, newLegendary);

    const leavingDone = new Promise<void>(resolve => setTimeout(resolve, 300));
    const spritesDone = this.preloadImages(allNew.map(p => p.sprite));

    void Promise.all([leavingDone, spritesDone]).then(() => {
      unlocked.forEach((slotIdx, i) => {
        setTimeout(() => {
          const newPokemon = newBySlot.get(slotIdx);
          if (newPokemon) {
            this.slots.update(arr => {
              const next = [...arr];
              next[slotIdx] = newPokemon;
              return next;
            });
          }
          this.slotStates.update(states => {
            const next = [...states] as SlotState[];
            next[slotIdx] = 'entering';
            return next;
          });
        }, i * 60);
      });

      setTimeout(() => {
        this.slotStates.update(states => {
          const next = [...states] as SlotState[];
          unlocked.forEach(i => (next[i] = 'idle'));
          return next;
        });
        if (this.phase() === 'playing') this.startTimer();
      }, unlocked.length * 60 + 400);
    });
  }

  private startTimer(): void {
    this.stopTimer();
    const start = Date.now();
    const duration = 10_000;
    this.timerValue.set(10);
    this.timerProgress.set(1.0);

    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const rem = Math.max(0, duration - elapsed);
      this.timerValue.set(Math.ceil(rem / 1000));
      this.timerProgress.set(rem / duration);

      if (rem <= 0) {
        this.stopTimer();
        void this.autoPickSlot();
      }
    }, 200);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async enterCompletePhase(): Promise<void> {
    this.stopTimer();
    
    const myTeam = this.lockedPokemon().filter((p): p is Pokemon => p !== null);
    this.myTeamPokemons.set(myTeam);

    this.phase.set('complete');

    setTimeout(() => {
      this.showScores.set(true);
      if (this.winner() === 'me') {
        this.launchConfetti();
        
        // Enregistrer la victoire
        const user = this.supabaseService.getCurrentUser();
        const idParam = this.route.snapshot.paramMap.get('id');
        if (user && idParam) {
          const trainerIndex = parseInt(idParam, 10);
          this.supabaseService.recordTrainerDefeat(user.id, trainerIndex).catch(console.error);
        }
      }
    }, 800);
  }

  async goHome(): Promise<void> {
    void this.router.navigate(['/home']);
  }

  async replay(): Promise<void> {
    this.phase.set('loading');
    this.showScores.set(false);
    this.myTeamPokemons.set([]);
    
    // Petit délai pour l'effet visuel
    setTimeout(() => {
      this.initDraft();
    }, 500);
  }

  async goToTrainerSelect(): Promise<void> {
    void this.router.navigate(['/trainer-select']);
  }

  private computeTotal(p: Pokemon): number {
    const s = p.stats;
    return s.pv + s.attaque + s.defense + s.atq_spe + s.def_spe + s.vitesse;
  }

  private computeRating(p: Pokemon): number {
    if (p.rating !== undefined) return p.rating;
    const range = this.statsRange();
    const total = this.computeTotal(p);
    const raw = ((total - range.min) / (range.max - range.min)) * 10;
    return Math.round(raw * 10) / 10;
  }

  private computeStatsScore(team: Pokemon[]): number {
    if (team.length === 0) return 0;
    const ratings = team.map(p => this.computeRating(p));
    return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
  }

  private computeDuoCoverageScore(myTeam: Pokemon[], opponentTeam: Pokemon[]): number {
    if (myTeam.length === 0 || opponentTeam.length === 0) return 0;

    const myTypes = new Set(myTeam.flatMap(p => p.types));
    const opponentTypes = new Set(opponentTeam.flatMap(p => p.types));

    let coveredOpponentTypes = 0;
    for (const oppType of opponentTypes) {
      const canHit = [...myTypes].some(myType => (TYPE_OFFENSIVE[myType] ?? []).includes(oppType));
      if (canHit) coveredOpponentTypes++;
    }
    const offensiveScore = opponentTypes.size > 0
      ? (coveredOpponentTypes / opponentTypes.size) * 10
      : 0;

    let exploitedPokemon = 0;
    for (const oppPokemon of opponentTeam) {
      const canHit = [...myTypes].some(myType =>
        oppPokemon.types.some(oppType => (TYPE_OFFENSIVE[myType] ?? []).includes(oppType))
      );
      if (canHit) exploitedPokemon++;
    }
    const pokemonScore = (exploitedPokemon / opponentTeam.length) * 10;

    let resistedTypes = 0;
    for (const oppType of opponentTypes) {
      const iResist = myTeam.some(p => effectiveMultiplier(p.types, oppType) < 1);
      if (iResist) resistedTypes++;
    }
    const defensiveScore = opponentTypes.size > 0
      ? (resistedTypes / opponentTypes.size) * 10
      : 0;

    // Special case for Arceus (id 493): perfect coverage
    const hasArceus = myTeam.some(p => p.id === 493);
    const raw = hasArceus ? 10 : (0.5 * offensiveScore + 0.3 * pokemonScore + 0.2 * defensiveScore);
    return Math.round(raw * 10) / 10;
  }

  getRating(p: Pokemon): number {
    return this.computeRating(p);
  }

  getRatingColor(rating: number): string {
    if (rating >= 8) return 'text-yellow-400';
    if (rating >= 6) return 'text-green-400';
    if (rating >= 4) return 'text-blue-400';
    return 'text-slate-400';
  }

  getRatingBarColor(rating: number): string {
    if (rating >= 8) return 'bg-yellow-400';
    if (rating >= 6) return 'bg-green-400';
    if (rating >= 4) return 'bg-blue-400';
    return 'bg-slate-500';
  }

  getRatingWidth(rating: number): string {
    return `${(rating / 10) * 100}%`;
  }

  getScoreColor(score: number): string {
    if (score >= 8) return 'text-yellow-400';
    if (score >= 6) return 'text-green-400';
    if (score >= 4) return 'text-blue-400';
    return 'text-slate-400';
  }

  getScoreBarColor(score: number): string {
    if (score >= 8) return 'bg-yellow-400';
    if (score >= 6) return 'bg-green-400';
    if (score >= 4) return 'bg-blue-400';
    return 'bg-slate-500';
  }

  getTypeColor(type: string): string {
    return TYPE_COLORS[type] ?? 'bg-gray-500';
  }

  getTypeIcon(type: string): string {
    return TYPE_ICONS[type] ?? 'mdi:circle-outline';
  }

  openPokemonDetails(pokemon: Pokemon): void {
    this.selectedPokemon.set(pokemon);
  }

  closePokemonDetails(): void {
    this.selectedPokemon.set(null);
  }

  private pickOneStarter(pool: Pokemon[], exclude: Set<number>): Pokemon {
    const starters = pool.filter(p => p.category === 'starter');
    if (starters.length === 0) {
      // Fallback total si aucun starter dans le pool (ne devrait pas arriver)
      const fallback = pool.filter(p => !exclude.has(p.id));
      return (fallback.length > 0 ? fallback : pool)[0];
    }

    const available = starters.filter(p => !exclude.has(p.id));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }

    // Si épuisé, on pioche dans tous les starters en évitant l'affichage actuel si possible
    const currentIds = new Set(this.slots().filter(p => p !== null).map(p => p!.id));
    const secondary = starters.filter(p => !currentIds.has(p.id));
    const finalSource = secondary.length > 0 ? secondary : starters;
    return finalSource[Math.floor(Math.random() * finalSource.length)];
  }

  private pickOneLegendary(pool: Pokemon[], exclude: Set<number>): Pokemon {
    const legends = pool.filter(p => p.category === 'légendaire' || p.category === 'fabuleux');
    if (legends.length === 0) {
      // Fallback total si aucune légende dans le pool
      const fallback = pool.filter(p => !exclude.has(p.id));
      return (fallback.length > 0 ? fallback : pool)[0];
    }

    const available = legends.filter(p => !exclude.has(p.id));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }

    // Si épuisé, on pioche dans toutes les légendes en évitant l'affichage actuel si possible
    const currentIds = new Set(this.slots().filter(p => p !== null).map(p => p!.id));
    const secondary = legends.filter(p => !currentIds.has(p.id));
    const finalSource = secondary.length > 0 ? secondary : legends;
    return finalSource[Math.floor(Math.random() * finalSource.length)];
  }

  private pickNUnique(pool: Pokemon[], exclude: Set<number>, n: number): Pokemon[] {
    const available = pool.filter(p => !exclude.has(p.id));
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return available.slice(0, n);
  }

  private preloadImages(urls: string[]): Promise<void[]> {
    return Promise.all(
      urls.map(url => new Promise<void>(resolve => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      }))
    );
  }

  private launchConfetti(): void {
    const colors = ['#ef4444', '#facc15', '#a855f7', '#3b82f6', '#ffffff'];
    confetti({ particleCount: 160, spread: 110, origin: { x: 0.5, y: 0.4 }, colors });
  }
}
