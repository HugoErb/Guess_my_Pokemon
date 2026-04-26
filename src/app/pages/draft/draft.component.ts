import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { PokemonService } from '../../services/pokemon.service';
import { Pokemon } from '../../models/pokemon.model';
import { ICONS } from '../../constants/icons';
import {
  lockAnimation,
  scoreRevealAnimation,
  slotStateAnimation,
  slotsGridAnimation,
} from '../../constants/animations';
import confetti from 'canvas-confetti';
import { PokemonCardComponent } from '../../components/pokemon-card/pokemon-card.component';

const TYPE_ICONS: Record<string, string> = {
  'Normal': 'mdi:circle-outline',
  'Feu': 'mdi:fire',
  'Eau': 'mdi:water',
  'Électrik': 'mdi:lightning-bolt',
  'Plante': 'mdi:leaf',
  'Glace': 'mdi:snowflake',
  'Combat': 'fa6-solid:hand-fist',
  'Poison': 'mdi:skull-crossbones',
  'Sol': 'mdi:terrain',
  'Vol': 'game-icons:liberty-wing',
  'Psy': 'mdi:eye',
  'Insecte': 'mdi:bug',
  'Roche': 'mdi:hexagon',
  'Spectre': 'mdi:ghost',
  'Dragon': 'game-icons:sea-dragon',
  'Ténèbres': 'ic:round-dark-mode',
  'Acier': 'mdi:shield',
  'Fée': 'mdi:star-four-points',
};

const TYPE_COLORS: Record<string, string> = {
  'Normal': 'bg-gray-400',
  'Feu': 'bg-orange-500',
  'Eau': 'bg-blue-500',
  'Électrik': 'bg-yellow-400',
  'Plante': 'bg-green-500',
  'Glace': 'bg-cyan-400',
  'Combat': 'bg-red-700',
  'Poison': 'bg-purple-500',
  'Sol': 'bg-yellow-600',
  'Vol': 'bg-indigo-400',
  'Psy': 'bg-pink-500',
  'Insecte': 'bg-lime-500',
  'Roche': 'bg-yellow-700',
  'Spectre': 'bg-violet-700',
  'Dragon': 'bg-indigo-600',
  'Ténèbres': 'bg-gray-700',
  'Acier': 'bg-slate-400',
  'Fée': 'bg-pink-300',
};

type SlotState = 'idle' | 'leaving' | 'entering';

@Component({
  selector: 'app-draft',
  imports: [NgClass, PokemonCardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  animations: [slotsGridAnimation, slotStateAnimation, lockAnimation, scoreRevealAnimation],
  templateUrl: './draft.component.html',
})
export class DraftComponent {
  protected readonly ICONS = ICONS;

  private readonly router = inject(Router);
  private readonly pokemonService = inject(PokemonService);

  private readonly allPokemon = toSignal(this.pokemonService.loadAll(), {
    initialValue: [] as Pokemon[],
  });

  private readonly statsRange = computed(() => {
    const all = this.allPokemon();
    if (all.length === 0) return { min: 0, max: 1 };
    const totals = all.map(p => this.computeTotal(p));
    return { min: Math.min(...totals), max: Math.max(...totals) };
  });

  readonly slots = signal<(Pokemon | null)[]>([null, null, null, null, null, null]);
  readonly lockedIndices = signal<Set<number>>(new Set());
  readonly lockedPokemon = signal<(Pokemon | null)[]>([null, null, null, null, null, null]);
  private readonly usedIds = signal<Set<number>>(new Set());
  readonly slotStates = signal<SlotState[]>(['idle', 'idle', 'idle', 'idle', 'idle', 'idle']);
  readonly phase = signal<'loading' | 'draft' | 'complete'>('loading');
  readonly showScore = signal(false);

  readonly lockedCount = computed(() => this.lockedIndices().size);
  readonly selectedPokemon = signal<Pokemon | null>(null);

  readonly finalScore = computed((): number => {
    const locked = this.lockedPokemon();
    const range = this.statsRange();
    const ratings = locked
      .filter((p): p is Pokemon => p !== null)
      .map(p => this.computeRating(p, range));
    if (ratings.length === 0) return 0;
    return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
  });

  readonly scoreColor = computed((): string => {
    const s = this.finalScore();
    if (s >= 8) return 'text-yellow-400';
    if (s >= 6) return 'text-green-400';
    if (s >= 4) return 'text-blue-400';
    return 'text-slate-400';
  });

  constructor() {
    effect(() => {
      const all = this.allPokemon();
      if (all.length > 0 && this.phase() === 'loading') {
        untracked(() => this.initDraft());
      }
    });

    effect(() => {
      if (this.showScore()) {
        untracked(() => this.launchConfetti());
      }
    });
  }

  private initDraft(): void {
    const pool = this.allPokemon();
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
    this.showScore.set(false);
    this.phase.set('draft');
  }

  onSlotClick(index: number): void {
    if (this.lockedIndices().has(index) || this.phase() !== 'draft') return;

    const picked = this.slots()[index];
    if (!picked) return;

    // Verrouiller le slot
    this.lockedIndices.update(s => new Set([...s, index]));
    this.lockedPokemon.update(arr => {
      const next = [...arr];
      next[index] = picked;
      return next;
    });
    this.usedIds.update(s => new Set([...s, picked.id]));

    const unlocked = [0, 1, 2, 3, 4, 5].filter(i => !this.lockedIndices().has(i));

    if (unlocked.length === 0) {
      this.phase.set('complete');
      setTimeout(() => this.showScore.set(true), 700);
      return;
    }

    // Animation sortie
    this.slotStates.update(states => {
      const next = [...states] as SlotState[];
      unlocked.forEach(i => (next[i] = 'leaving'));
      return next;
    });

    // Après l'animation de sortie, remplacer et animer l'entrée
    setTimeout(() => {
      const slot0Unlocked = unlocked.includes(0);
      const slot5Unlocked = unlocked.includes(5);
      const unlockedNormal = unlocked.filter(i => i !== 0 && i !== 5);

      const newStarter = slot0Unlocked ? this.pickOneStarter(this.allPokemon(), this.usedIds()) : null;
      const excludeForNormal = new Set([...this.usedIds(), ...(newStarter ? [newStarter.id] : [])]);
      const newNormal = this.pickNUnique(this.allPokemon(), excludeForNormal, unlockedNormal.length);
      const excludeForLegend = new Set([...excludeForNormal, ...newNormal.map(p => p.id)]);
      const newLegendary = slot5Unlocked ? this.pickOneLegendary(this.allPokemon(), excludeForLegend) : null;

      const allNew = [
        ...(newStarter ? [newStarter] : []),
        ...newNormal,
        ...(newLegendary ? [newLegendary] : []),
      ];
      this.usedIds.update(s => new Set([...s, ...allNew.map(p => p.id)]));

      this.slots.update(arr => {
        const next = [...arr];
        if (slot0Unlocked && newStarter) next[0] = newStarter;
        unlockedNormal.forEach((slotIdx, i) => (next[slotIdx] = newNormal[i]));
        if (slot5Unlocked && newLegendary) next[5] = newLegendary;
        return next;
      });

      // Stagger de l'animation d'entrée par slot
      unlocked.forEach((slotIdx, i) => {
        setTimeout(() => {
          this.slotStates.update(states => {
            const next = [...states] as SlotState[];
            next[slotIdx] = 'entering';
            return next;
          });
        }, i * 60);
      });

      // Remettre idle après la fin des animations
      setTimeout(() => {
        this.slotStates.update(states => {
          const next = [...states] as SlotState[];
          unlocked.forEach(i => (next[i] = 'idle'));
          return next;
        });
      }, unlocked.length * 60 + 400);
    }, 300);
  }

  replay(): void {
    this.phase.set('loading');
    // Laisser l'effect réinitialiser via la détection de phase='loading'
    setTimeout(() => {
      if (this.allPokemon().length > 0) {
        this.initDraft();
      }
    }, 50);
  }

  goHome(): void {
    void this.router.navigate(['/home']);
  }

  openPokemonDetails(pokemon: Pokemon): void {
    this.selectedPokemon.set(pokemon);
  }

  closePokemonDetails(): void {
    this.selectedPokemon.set(null);
  }

  // ─── Calculs rating ──────────────────────────────────────────────────────────

  private computeTotal(p: Pokemon): number {
    const s = p.stats;
    return s.pv + s.attaque + s.defense + s.atq_spe + s.def_spe + s.vitesse;
  }

  private computeRating(p: Pokemon, range: { min: number; max: number }): number {
    if (p.rating !== undefined) return p.rating;
    const total = this.computeTotal(p);
    const raw = 1 + ((total - range.min) / (range.max - range.min)) * 9;
    return Math.round(raw * 10) / 10;
  }

  getRating(p: Pokemon): number {
    return this.computeRating(p, this.statsRange());
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
    return `${((rating - 1) / 9) * 100}%`;
  }

  getTypeColor(type: string): string {
    return TYPE_COLORS[type] ?? 'bg-gray-500';
  }

  getTypeIcon(type: string): string {
    return TYPE_ICONS[type] ?? 'mdi:circle-outline';
  }

  // ─── Sélection aléatoire sans doublons ───────────────────────────────────────

  private pickOneStarter(pool: Pokemon[], exclude: Set<number>): Pokemon {
    const starters = pool.filter(p => p.category === 'starter' && !exclude.has(p.id));
    const fallback = pool.filter(p => !exclude.has(p.id));
    const source = starters.length > 0 ? starters : fallback;
    return source[Math.floor(Math.random() * source.length)];
  }

  private pickOneLegendary(pool: Pokemon[], exclude: Set<number>): Pokemon {
    const legends = pool.filter(p =>
      (p.category === 'légendaire' || p.category === 'fabuleux') && !exclude.has(p.id)
    );
    const fallback = pool.filter(p => !exclude.has(p.id));
    const source = legends.length > 0 ? legends : fallback;
    return source[Math.floor(Math.random() * source.length)];
  }

  private pickNUnique(pool: Pokemon[], exclude: Set<number>, n: number): Pokemon[] {
    const available = pool.filter(p => !exclude.has(p.id));
    // Fisher-Yates shuffle partiel
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return available.slice(0, n);
  }

  // ─── Confetti ────────────────────────────────────────────────────────────────

  private launchConfetti(): void {
    const colors = ['#ef4444', '#facc15', '#a855f7', '#3b82f6', '#ffffff'];
    confetti({ particleCount: 160, spread: 110, origin: { x: 0.5, y: 0.4 }, colors });
  }
}
