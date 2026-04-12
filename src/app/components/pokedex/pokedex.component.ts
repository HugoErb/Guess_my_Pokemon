import { Component, OnInit, DestroyRef, inject, input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { PokemonService } from '../../services/pokemon.service';
import { Pokemon } from '../../models/pokemon.model';
import { PokemonCardComponent } from '../pokemon-card/pokemon-card.component';
import { ICONS } from '../../constants/icons';

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
  template: `
    <div class="flex flex-col gap-5 h-full">

      <!-- Titre + Reset -->
      <div class="flex justify-between items-end">
        <h2 class="text-lg font-bold text-white tracking-wide uppercase">Pokédex</h2>
        <button 
          (click)="clearFilters()"
          class="text-xs text-slate-400 hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors pb-0.5"
        >
          <iconify-icon [icon]="ICONS.refresh"></iconify-icon>
          Réinitialiser
        </button>
      </div>

      <!-- Barre de recherche -->
      <div class="relative">
        <iconify-icon [icon]="ICONS.search" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></iconify-icon>
        <input
          type="text"
          placeholder="Rechercher un Pokémon..."
          [(ngModel)]="searchQuery"
          (ngModelChange)="applyFilters()"
          class="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <!-- Filtres principaux -->
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
             <input type="number" [(ngModel)]="minWeight" (input)="applyFilters()" placeholder="Min" class="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500" />
             <span class="text-slate-600 text-xs">à</span>
             <input type="number" [(ngModel)]="maxWeight" (input)="applyFilters()" placeholder="Max" class="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500" />
          </div>
        </div>

        <!-- Taille -->
        <div class="shrink-0">
          <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">Taille (m)</p>
          <div class="flex items-center gap-2">
             <input type="number" [(ngModel)]="minHeight" (input)="applyFilters()" placeholder="Min" class="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500" />
             <span class="text-slate-600 text-xs">à</span>
             <input type="number" [(ngModel)]="maxHeight" (input)="applyFilters()" placeholder="Max" class="w-20 bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500" />
          </div>
        </div>
      </div>

      <!-- Filtres type -->
      <div>
        <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">
          Type @if (onlyDualType) { (2 max) }
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
          
          <!-- Délimiteur et bouton spécial -->
          <div class="h-6 w-px bg-slate-600 mx-2"></div>
          
          <button
            (click)="toggleOnlyDualType()"
            [class]="onlyDualType
              ? 'px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white border border-indigo-500 shadow-lg shadow-indigo-500/20 transition-all'
              : 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-all'"
          >
            Double type seulement
          </button>
        </div>
      </div>

      <!-- Résultats -->
      <div class="flex flex-col gap-2 min-h-0 flex-1">
        <p class="text-xs text-slate-400">
          Résultats ({{ filteredPokemons.length }} Pokémon)
          @if (visiblePokemons.length < filteredPokemons.length) {
            — {{ visiblePokemons.length }} affichés
          }
        </p>

        <!-- Grille scrollable -->
        <div class="flex-1 overflow-y-auto pr-2" (scroll)="onGridScroll($event)">
          <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 pb-2">
            @for (pokemon of visiblePokemons; track pokemon.id) {
              <div class="relative w-full h-full">
                <button
                  (click)="openPokemonDetails(pokemon)"
                  [class]="selectedPokemonDetails?.id === pokemon.id
                    ? 'w-full h-full flex flex-col items-center gap-1 p-2 rounded-xl bg-red-900/40 border-2 border-red-500 transition-all'
                    : 'w-full h-full flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-700/60 border-2 border-transparent hover:bg-slate-700 hover:border-slate-500 transition-all'"
                >
                  <img
                    [src]="pokemon.sprite"
                    [alt]="pokemon.name"
                    class="w-12 h-12 object-contain"
                    loading="lazy"
                  />
                  <span class="text-xs text-center capitalize leading-tight text-slate-300 truncate w-full">
                    {{ pokemon.name }}
                  </span>
                </button>
              </div>
            }
          </div>

          @if (visiblePokemons.length === 0 && allPokemons.length > 0) {
            <div class="text-center text-slate-500 py-8 text-sm">
              Aucun Pokémon trouvé
            </div>
          }
          @if (allPokemons.length === 0) {
            <div class="flex justify-center py-8">
              <div class="w-8 h-8 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          }
        </div>
      </div>

      <!-- Modal Pokédex -->
      @if (selectedPokemonDetails) {
        <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" (click)="closePokemonDetails()">
          <div class="bg-slate-800 border border-slate-600 rounded-2xl p-3 max-w-md w-full shadow-2xl relative flex flex-col gap-3 max-h-[95vh]" (click)="$event.stopPropagation()">
            
            <!-- Bouton Fermer Absolu -->
            <button (click)="closePokemonDetails()" class="absolute top-5 right-5 z-10 bg-slate-900/60 hover:bg-red-600 rounded-full w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white transition-colors backdrop-blur-sm">
              <iconify-icon [icon]="ICONS.close" class="text-lg"></iconify-icon>
            </button>

            <!-- Contenu scrollable -->
            <div class="overflow-y-auto flex-1">
              <app-pokemon-card [pokemon]="selectedPokemonDetails" />
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
  guess = output<number>();

  allPokemons: Pokemon[] = [];
  filteredPokemons: Pokemon[] = [];
  visiblePokemons: Pokemon[] = [];
  selectedPokemon: Pokemon | null = null;
  selectedPokemonDetails: Pokemon | null = null;

  searchQuery = '';
  selectedGenerations: number[] = [];
  selectedTypes: string[] = [];
  selectedCategories: string[] = [];
  selectedEvoStages: number[] = [];
  minWeight: number | null = 0;
  maxWeight: number | null = null;
  minHeight: number | null = 0;
  maxHeight: number | null = null;
  onlyDualType = false;

  private displayedCount = 100;
  private readonly PAGE_SIZE = 100;

  readonly generations = GENERATIONS;
  readonly allTypes = ALL_TYPES;
  readonly categories = [
    { id: 'normal', label: 'Normal' },
    { id: 'starter', label: 'Starter' },
    { id: 'légendaire', label: 'Légendaire' },
    { id: 'fabuleux', label: 'Fabuleux' },
  ];
  readonly evoStages = [1, 2, 3];

  ngOnInit(): void {
    this.pokemonService.loadAll().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(pokemons => {
      // Pré-calculer le stade pour optimiser les filtres
      this.allPokemons = pokemons.map(p => ({
        ...p,
        _stage: parseInt(p.evolution_stage?.split('/')[0] || '1')
      } as any));
      
      this.applyFilters();
    });
  }

  applyFilters(): void {
    const q = this.searchQuery ? this.searchQuery.trim().toLowerCase() : '';
    const hasGens = this.selectedGenerations.length > 0;
    const hasTypes = this.selectedTypes.length > 0;
    const hasCats = this.selectedCategories.length > 0;
    const hasEvos = this.selectedEvoStages.length > 0;
    
    // On travaille sur le minWeight/minHeight tels quels
    const minW = this.minWeight;
    const maxW = this.maxWeight;
    const minH = this.minHeight;
    const maxH = this.maxHeight;

    this.filteredPokemons = this.allPokemons.filter(p => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (hasGens && !this.selectedGenerations.includes(p.generation)) return false;
      
      if (this.onlyDualType) {
        // Afficher seulement les Pokémon avec 2 types
        if (p.types.length !== 2) return false;
        
        if (hasTypes) {
          if (this.selectedTypes.length === 2) {
            // Doit avoir EXACTEMENT ces deux types
            if (!this.selectedTypes.every(t => p.types.includes(t))) return false;
          } else {
            // Doit avoir au moins le type sélectionné (et on sait déjà qu'il en a 2)
            if (!p.types.some(t => this.selectedTypes.includes(t))) return false;
          }
        }
      } else if (hasTypes) {
        // Mode classique : n'importe lequel des types
        if (!p.types.some(t => this.selectedTypes.includes(t))) return false;
      }

      if (hasCats && !this.selectedCategories.includes(p.category)) return false;
      
      if (hasEvos && !this.selectedEvoStages.includes((p as any)._stage)) return false;

      if (minW !== null && p.weight < minW) return false;
      if (maxW !== null && p.weight > maxW) return false;
      if (minH !== null && p.height < minH) return false;
      if (maxH !== null && p.height > maxH) return false;

      return true;
    });
    
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

  toggleGeneration(gen: number): void {
    const idx = this.selectedGenerations.indexOf(gen);
    if (idx >= 0) {
      this.selectedGenerations = this.selectedGenerations.filter(g => g !== gen);
    } else {
      this.selectedGenerations = [...this.selectedGenerations, gen];
    }
    this.applyFilters();
  }

  isGenSelected(gen: number): boolean {
    return this.selectedGenerations.includes(gen);
  }

  toggleType(type: string): void {
    const idx = this.selectedTypes.indexOf(type);
    if (idx >= 0) {
      this.selectedTypes = this.selectedTypes.filter(t => t !== type);
    } else {
      if (this.onlyDualType && this.selectedTypes.length >= 2) return; // Limite à 2 types seulement en mode dual
      this.selectedTypes = [...this.selectedTypes, type];
    }
    this.applyFilters();
  }

  toggleOnlyDualType(): void {
    this.onlyDualType = !this.onlyDualType;
    this.selectedTypes = []; // Vide les types sélectionnés lors du changement de mode
    this.applyFilters();
  }

  isTypeSelected(type: string): boolean {
    return this.selectedTypes.includes(type);
  }

  toggleCategory(catId: string): void {
    const idx = this.selectedCategories.indexOf(catId);
    if (idx >= 0) {
      this.selectedCategories = this.selectedCategories.filter(c => c !== catId);
    } else {
      this.selectedCategories = [...this.selectedCategories, catId];
    }
    this.applyFilters();
  }

  isCategorySelected(catId: string): boolean {
    return this.selectedCategories.includes(catId);
  }

  toggleEvoStage(stage: number): void {
    const idx = this.selectedEvoStages.indexOf(stage);
    if (idx >= 0) {
      this.selectedEvoStages = this.selectedEvoStages.filter(s => s !== stage);
    } else {
      this.selectedEvoStages = [...this.selectedEvoStages, stage];
    }
    this.applyFilters();
  }

  isEvoStageSelected(stage: number): boolean {
    return this.selectedEvoStages.includes(stage);
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedGenerations = [];
    this.selectedTypes = [];
    this.selectedCategories = [];
    this.selectedEvoStages = [];
    this.minWeight = 0;
    this.maxWeight = null;
    this.minHeight = 0;
    this.maxHeight = null;
    this.onlyDualType = false;
    this.applyFilters();
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
