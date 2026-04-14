import { Component, OnInit, DestroyRef, inject, input, output, CUSTOM_ELEMENTS_SCHEMA, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { PokemonService } from '../../services/pokemon.service';
import { Pokemon } from '../../models/pokemon.model';
import { PokemonCardComponent } from '../pokemon-card/pokemon-card.component';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';

const ALL_TYPES = [
  'Normal', 'Feu', 'Eau', 'Électrik', 'Plante', 'Glace',
  'Combat', 'Poison', 'Sol', 'Vol', 'Psy', 'Insecte',
  'Roche', 'Spectre', 'Dragon', 'Ténèbres', 'Acier', 'Fée',
];

const TYPE_COLORS: Record<string, string> = {
  'Normal': 'bg-gray-400',
  'Feu': 'bg-orange-500',
  'Eau': 'bg-blue-500',
  'Électrik': 'bg-yellow-400',
  'Plante': 'bg-green-500',
  'Glace': 'bg-cyan-300',
  'Combat': 'bg-red-700',
  'Poison': 'bg-purple-500',
  'Sol': 'bg-yellow-600',
  'Vol': 'bg-indigo-400',
  'Psy': 'bg-pink-500',
  'Insecte': 'bg-lime-500',
  'Roche': 'bg-yellow-700',
  'Spectre': 'bg-purple-700',
  'Dragon': 'bg-indigo-600',
  'Ténèbres': 'bg-gray-700',
  'Acier': 'bg-gray-400',
  'Fée': 'bg-pink-300',
};

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

@Component({
  selector: 'app-pokedex',
  imports: [FormsModule, PokemonCardComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  animations: [modalAnimation],
  template: `
    <div class="flex flex-col gap-5 h-full">

      <!-- Titre + Reset -->
      <div class="flex justify-between items-end">
        <h2 class="text-lg font-bold text-white tracking-wide uppercase">Pokédex</h2>
        @if (!noSearch()) {
          <button 
            (click)="clearFilters()"
            class="flex items-center gap-2 px-2.5 py-1 bg-slate-700/50 hover:bg-slate-600 border border-slate-600/50 hover:border-slate-500 rounded-lg text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-wider transition-all duration-200 group"
          >
            <iconify-icon [icon]="ICONS.refresh" class="text-sm group-hover:rotate-180 transition-transform duration-500"></iconify-icon>
            <span>Réinitialiser les filtres</span>
          </button>
        }
      </div>

      <!-- Barre de recherche -->
      <div class="relative">
        <iconify-icon [icon]="ICONS.search" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></iconify-icon>
        <input
          type="text"
          placeholder="Rechercher un Pokémon..."
          [ngModel]="searchQuery()"
          (ngModelChange)="searchQuery.set($event)"
          class="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <!-- Filtres principaux -->
      @if (!noSearch()) {
      <div class="flex flex-wrap gap-x-8 gap-y-6">
        <!-- Génération -->
        <div class="shrink-0">
          <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">Génération</p>
          <div class="flex flex-nowrap gap-1">
            @for (gen of generations; track gen) {
              <button
                (click)="toggleGeneration(gen)"
                [class]="isGenSelected(gen)
                  ? 'px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white border border-blue-500 transition-colors'
                  : 'px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 transition-colors'"
              >
                {{ gen }}
              </button>
            }
          </div>
        </div>

        <!-- Stade Évo -->
        <div class="shrink-0">
          <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">Stade Évo.</p>
          <div class="flex gap-1">
            @for (stage of evoStages; track stage) {
              <button
                (click)="toggleEvoStage(stage)"
                [class]="isEvoStageSelected(stage)
                  ? 'px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white border border-purple-500 transition-colors'
                  : 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 transition-colors'"
              >
                {{ stage }}
              </button>
            }
          </div>
        </div>

        <!-- Catégorie -->
        <div class="shrink-0">
          <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">Catégorie</p>
          <div class="flex flex-wrap gap-1">
            @for (cat of categories; track cat.id) {
              <button
                (click)="toggleCategory(cat.id)"
                [class]="isCategorySelected(cat.id)
                  ? 'px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 text-white border border-amber-500 transition-colors'
                  : 'px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 transition-colors'"
              >
                {{ cat.label }}
              </button>
            }
          </div>
        </div>

        <!-- Poids -->
        <div class="shrink-0">
          <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">Poids (kg)</p>
          <div class="flex items-center gap-2">
             <input type="number" 
                    [ngModel]="minWeight()" 
                    (ngModelChange)="minWeight.set($event)"
                    placeholder="Min" class="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500" />
             <span class="text-slate-600 text-xs">à</span>
             <input type="number" 
                    [ngModel]="maxWeight()" 
                    (ngModelChange)="maxWeight.set($event)"
                    placeholder="Max" class="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500" />
          </div>
        </div>

        <!-- Taille -->
        <div class="shrink-0">
          <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">Taille (m)</p>
          <div class="flex items-center gap-2">
             <input type="number" 
                    [ngModel]="minHeight()" 
                    (ngModelChange)="minHeight.set($event)"
                    placeholder="Min" class="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500" />
             <span class="text-slate-600 text-xs">à</span>
             <input type="number" 
                    [ngModel]="maxHeight()" 
                    (ngModelChange)="maxHeight.set($event)"
                    placeholder="Max" class="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500" />
          </div>
        </div>
      </div>

      <!-- Filtres type -->
      <div>
        <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">
          Type
        </p>
        <div class="flex flex-wrap items-center gap-1">
          @for (type of allTypes; track type) {
            <button
              (click)="toggleType(type)"
              [class]="isTypeSelected(type)
                ? 'px-2.5 py-1 rounded-full text-xs font-semibold text-white ring-2 ring-white transition-all ' + getTypeColor(type)
                : 'px-2.5 py-1 rounded-full text-xs font-semibold text-white opacity-50 hover:opacity-80 transition-all ' + getTypeColor(type)"
            >
              {{ type }}
            </button>
          }
          
          <!-- Délimiteur et boutons spéciaux -->
          <div class="h-6 w-px bg-slate-600 mx-2"></div>

          <button
            (click)="toggleOnlyMonoType()"
            [class]="onlyMonoType()
              ? 'px-3 py-1 rounded-lg text-xs font-bold bg-teal-600 text-white border border-teal-500 shadow-lg shadow-teal-500/20 transition-all'
              : 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-all'"
          >
            Mono type seulement
          </button>

          <button
            (click)="toggleOnlyDualType()"
            [class]="onlyDualType()
              ? 'px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white border border-indigo-500 shadow-lg shadow-indigo-500/20 transition-all'
              : 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-all'"
          >
            Double type seulement
          </button>
        </div>
      </div>
      }

      <!-- Résultats -->
      <div class="flex flex-col gap-2 min-h-0 flex-1">
        <div class="flex justify-between items-center text-xs text-slate-400">
          <span>
            Résultats ({{ filteredPokemons().length }} Pokémon)
            @if (visiblePokemons().length < filteredPokemons().length) {
              — {{ visiblePokemons().length }} affichés
            }
          </span>
        </div>

        <!-- Grille scrollable -->
        <div class="flex-1 overflow-y-auto pr-2" (scroll)="onGridScroll($event)">
          <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 pb-2">
            @for (pokemon of visiblePokemons(); track pokemon.id) {
              <div class="relative w-full h-full">
                <button
                  (click)="openPokemonDetails(pokemon)"
                  [class]="selectedPokemonDetails?.id === pokemon.id
                    ? 'w-full h-full flex flex-col items-center gap-1 p-2 rounded-xl bg-red-900/40 border-2 border-red-500 transition-all'
                    : 'w-full h-full flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-700/60 border-2 border-transparent hover:bg-slate-700 hover:border-slate-500 transition-all'"
                >
                  @if (!noPokedex()) {
                    <img
                      [src]="pokemon.sprite"
                      [alt]="pokemon.name"
                      class="w-12 h-12 object-contain"
                      loading="lazy"
                    />
                  } @else {
                    <div class="w-12 h-12 flex items-center justify-center text-3xl text-slate-500">?</div>
                  }
                  <span class="text-xs text-center capitalize leading-tight text-slate-300 truncate w-full">
                    {{ pokemon.name }}
                  </span>
                </button>
              </div>
            }
          </div>

          @if (visiblePokemons().length === 0 && allPokemons().length > 0) {
            <div class="text-center text-slate-500 py-8 text-sm">
              Aucun Pokémon trouvé
            </div>
          }
          @if (allPokemons().length === 0) {
            <div class="flex justify-center py-8">
              <div class="w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          }
        </div>
      </div>

      <!-- Modal Pokédex -->
      @if (selectedPokemonDetails) {
        <div 
          class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" 
          (click)="closePokemonDetails()"
          [@modalAnimation]
        >
          <div 
            class="bg-slate-800 border border-slate-600 rounded-2xl p-3 max-w-md w-full shadow-2xl relative flex flex-col gap-3 max-h-[95vh] modal-content" 
            (click)="$event.stopPropagation()"
          >
            
            <!-- Bouton Fermer Absolu -->
            <button (click)="closePokemonDetails()" class="absolute top-5 right-5 z-10 bg-slate-900/60 hover:bg-red-600 rounded-full w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white transition-colors backdrop-blur-sm">
              <iconify-icon [icon]="ICONS.close" class="text-lg"></iconify-icon>
            </button>

            <!-- Contenu scrollable -->
            <div class="overflow-y-auto flex-1">
              @if (!noPokedex()) {
                <app-pokemon-card [pokemon]="selectedPokemonDetails" />
              } @else {
                <div class="flex flex-col items-center gap-3 py-6">
                  <div class="w-20 h-20 flex items-center justify-center text-6xl text-slate-500">?</div>
                  <p class="text-lg font-bold capitalize text-white">{{ selectedPokemonDetails.name }}</p>
                  <p class="text-xs text-slate-400">Mode Pokédex caché</p>
                </div>
              }
            </div>

            @if (showGuessButton()) {
              <button 
                (click)="onGuessFromDetails(selectedPokemonDetails)"
                class="w-full bg-red-600 hover:bg-red-500 py-3 rounded-xl font-bold text-white transition-colors mt-2 shadow-lg flex items-center justify-center gap-2"
              >
                <iconify-icon [icon]="ICONS.sword" class="text-xl"></iconify-icon>
                Deviner ce Pokémon
              </button>
            }
          </div>
        </div>
      }

    </div>
  `,
})
export class PokedexComponent implements OnInit {
  protected readonly ICONS = ICONS;
  private readonly pokemonService = inject(PokemonService);
  private readonly destroyRef = inject(DestroyRef);

  showGuessButton = input<boolean>(false);
  restrictedGenerations = input<number[]>([]);
  noPokedex = input<boolean>(false);
  noSearch = input<boolean>(false);
  guess = output<number>();

  allPokemons = signal<Pokemon[]>([]);
  
  // États des filtres (Signals)
  searchQuery = signal('');
  selectedGenerations = signal<number[]>([]);
  selectedTypes = signal<string[]>([]);
  selectedCategories = signal<string[]>([]);
  selectedEvoStages = signal<number[]>([]);
  minWeight = signal<number | null>(0);
  maxWeight = signal<number | null>(null);
  minHeight = signal<number | null>(0);
  maxHeight = signal<number | null>(null);
  onlyDualType = signal(false);
  onlyMonoType = signal(false);

  // Pagination (Signal)
  displayedCount = signal(100);
  private readonly PAGE_SIZE = 100;

  // Sélections
  selectedPokemon: Pokemon | null = null;
  selectedPokemonDetails: Pokemon | null = null;

  // Données constantes
  readonly generations = GENERATIONS;
  readonly allTypes = ALL_TYPES;
  readonly categories = [
    { id: 'normal', label: 'Normal' },
    { id: 'starter', label: 'Starter' },
    { id: 'légendaire', label: 'Légendaire' },
    { id: 'fabuleux', label: 'Fabuleux' },
  ];
  readonly evoStages = [1, 2, 3];

  // Logic de filtrage réactive (Computed)
  filteredPokemons = computed(() => {
    const list = this.allPokemons();
    const q = this.searchQuery().trim().toLowerCase();
    const restricted = this.restrictedGenerations();
    const gens = this.selectedGenerations();
    const types = this.selectedTypes();
    const cats = this.selectedCategories();
    const evos = this.selectedEvoStages();
    const isDualOnly = this.onlyDualType();
    const isMonoOnly = this.onlyMonoType();

    const minW = this.minWeight();
    const maxW = this.maxWeight();
    const minH = this.minHeight();
    const maxH = this.maxHeight();

    return list.filter(p => {
      if (restricted.length > 0 && !restricted.includes(p.generation)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (gens.length > 0 && !gens.includes(p.generation)) return false;

      if (isDualOnly && p.types.length !== 2) return false;

      if (isMonoOnly) {
        if (p.types.length !== 1) return false;
        if (types.length > 0 && !p.types.some(t => types.includes(t))) return false;
      } else if (types.length > 0) {
        if (!p.types.some(t => types.includes(t))) return false;
      }

      if (cats.length > 0 && !cats.includes(p.category)) return false;
      if (evos.length > 0 && !evos.includes((p as any)._stage)) return false;

      if (minW !== null && p.weight < minW) return false;
      if (maxW !== null && p.weight > maxW) return false;
      if (minH !== null && p.height < minH) return false;
      if (maxH !== null && p.height > maxH) return false;

      return true;
    });
  });

  visiblePokemons = computed(() => {
    return this.filteredPokemons().slice(0, this.displayedCount());
  });

  ngOnInit(): void {
    this.pokemonService.loadAll().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(pokemons => {
      this.allPokemons.set(pokemons.map(p => ({
        ...p,
        _stage: parseInt(p.evolution_stage?.split('/')[0] || '1')
      } as any)));
    });
  }

  onGridScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && this.displayedCount() < this.filteredPokemons().length) {
      this.displayedCount.update(c => c + this.PAGE_SIZE);
    }
  }

  toggleGeneration(gen: number): void {
    this.selectedGenerations.update(list => 
      list.includes(gen) ? list.filter(g => g !== gen) : [...list, gen]
    );
    this.displayedCount.set(this.PAGE_SIZE);
  }

  isGenSelected(gen: number): boolean {
    return this.selectedGenerations().includes(gen);
  }

  toggleType(type: string): void {
    this.selectedTypes.update(list => {
      if (list.includes(type)) return list.filter(t => t !== type);
      return [...list, type];
    });
    this.displayedCount.set(this.PAGE_SIZE);
  }

  toggleOnlyDualType(): void {
    this.onlyDualType.update(v => !v);
    this.selectedTypes.set([]);
    this.displayedCount.set(this.PAGE_SIZE);
  }

  toggleOnlyMonoType(): void {
    this.onlyMonoType.update(v => !v);
    this.displayedCount.set(this.PAGE_SIZE);
  }

  isTypeSelected(type: string): boolean {
    return this.selectedTypes().includes(type);
  }

  toggleCategory(catId: string): void {
    this.selectedCategories.update(list => 
      list.includes(catId) ? list.filter(c => c !== catId) : [...list, catId]
    );
    this.displayedCount.set(this.PAGE_SIZE);
  }

  isCategorySelected(catId: string): boolean {
    return this.selectedCategories().includes(catId);
  }

  toggleEvoStage(stage: number): void {
    this.selectedEvoStages.update(list => 
      list.includes(stage) ? list.filter(s => s !== stage) : [...list, stage]
    );
    this.displayedCount.set(this.PAGE_SIZE);
  }

  isEvoStageSelected(stage: number): boolean {
    return this.selectedEvoStages().includes(stage);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.selectedGenerations.set([]);
    this.selectedTypes.set([]);
    this.selectedCategories.set([]);
    this.selectedEvoStages.set([]);
    this.minWeight.set(0);
    this.maxWeight.set(null);
    this.minHeight.set(0);
    this.maxHeight.set(null);
    this.onlyDualType.set(false);
    this.onlyMonoType.set(false);
    this.displayedCount.set(this.PAGE_SIZE);
  }

  getTypeColor(type: string): string {
    return TYPE_COLORS[type] ?? 'bg-gray-500';
  }

  selectPokemon(pokemon: Pokemon): void {
    this.selectedPokemon = pokemon.id === this.selectedPokemon?.id ? null : pokemon;
  }

  onGuess(): void {
    if (this.selectedPokemon) {
      this.guess.emit(this.selectedPokemon.id);
    }
  }

  openPokemonDetails(pokemon: Pokemon): void {
    this.selectedPokemonDetails = pokemon;
  }

  closePokemonDetails(): void {
    this.selectedPokemonDetails = null;
  }

  onGuessFromDetails(pokemon: Pokemon): void {
    this.guess.emit(pokemon.id);
    this.closePokemonDetails();
  }
}
