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
    <div class="flex flex-col gap-4 h-full">

      <!-- Titre -->
      <h2 class="text-lg font-bold text-white tracking-wide uppercase">Pokédex</h2>

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

      <!-- Filtres génération -->
      <div>
        <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">Génération</p>
        <div class="flex flex-wrap gap-1">
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

      <!-- Filtres type -->
      <div>
        <p class="text-xs text-slate-400 uppercase tracking-wider mb-2">Type</p>
        <div class="flex flex-wrap gap-1">
          @for (type of allTypes; track type) {
            <button
              (click)="toggleType(type)"
              [class]="isTypeSelected(type)
                ? 'px-2 py-0.5 rounded-full text-xs font-semibold text-white ring-2 ring-white transition-all ' + getTypeColor(type)
                : 'px-2 py-0.5 rounded-full text-xs font-semibold text-white opacity-50 hover:opacity-80 transition-all ' + getTypeColor(type)"
            >
              {{ type }}
            </button>
          }
        </div>
      </div>

      <!-- Résultats -->
      <div class="flex flex-col gap-2 min-h-0 flex-1">
        <p class="text-xs text-slate-400">
          Résultats ({{ filteredPokemons.length }} Pokémon)
        </p>

        <!-- Grille scrollable -->
        <div class="flex-1 overflow-y-auto min-h-0" style="max-height: 320px;">
          <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5 pb-2">
            @for (pokemon of displayedPokemons; track pokemon.id) {
              <div class="relative w-full h-full">
                <button
                  (click)="openPokemonDetails(pokemon)"
                  [class]="selectedPokemonDetails?.id === pokemon.id
                    ? 'w-full h-full flex flex-col items-center gap-1 p-1.5 rounded-xl bg-red-900/40 border-2 border-red-500 transition-all'
                    : 'w-full h-full flex flex-col items-center gap-1 p-1.5 rounded-xl bg-slate-700/60 border-2 border-transparent hover:bg-slate-700 hover:border-slate-500 transition-all'"
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

          @if (filteredPokemons.length === 0 && allPokemons.length > 0) {
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

        <!-- Bouton "Charger plus" -->
        @if (filteredPokemons.length > displayedPokemons.length) {
          <button
            (click)="loadMore()"
            class="w-full py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
          >
            Charger plus ({{ filteredPokemons.length - displayedPokemons.length }} restants)
          </button>
        }
      </div>

      <!-- Modal Pokédex -->
      @if (selectedPokemonDetails) {
        <div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" (click)="closePokemonDetails()">
          <div class="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-md w-full shadow-2xl relative flex flex-col gap-4 max-h-[90vh]" (click)="$event.stopPropagation()">
            
            <!-- Header -->
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold flex items-center gap-2">
                <span class="text-slate-400">#{{ selectedPokemonDetails.id.toString().padStart(3, '0') }}</span>
                <span class="capitalize text-white">{{ selectedPokemonDetails.name }}</span>
              </h2>
              <button (click)="closePokemonDetails()" class="text-slate-400 hover:text-white transition-colors p-1">
                <iconify-icon [icon]="ICONS.close" class="text-2xl"></iconify-icon>
              </button>
            </div>

            <!-- Contenu scrollable -->
            <div class="overflow-y-auto pr-2">
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
  selectedPokemon: Pokemon | null = null;
  selectedPokemonDetails: Pokemon | null = null;

  searchQuery = '';
  selectedGenerations: number[] = [];
  selectedTypes: string[] = [];

  displayedPokemons: Pokemon[] = [];
  pageSize = 60;

  readonly generations = GENERATIONS;
  readonly allTypes = ALL_TYPES;

  ngOnInit(): void {
    this.pokemonService.loadAll().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(pokemons => {
      this.allPokemons = pokemons;
      this.filteredPokemons = pokemons;
      this.displayedPokemons = pokemons.slice(0, this.pageSize);
    });
  }

  applyFilters(): void {
    this.pokemonService.filter({
      query: this.searchQuery,
      generations: this.selectedGenerations,
      types: this.selectedTypes,
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(results => {
      this.filteredPokemons = results;
      this.displayedPokemons = results.slice(0, this.pageSize);
    });
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
      this.selectedTypes = [...this.selectedTypes, type];
    }
    this.applyFilters();
  }

  isTypeSelected(type: string): boolean {
    return this.selectedTypes.includes(type);
  }

  getTypeColor(type: string): string {
    return TYPE_COLORS[type] ?? 'bg-gray-500';
  }

  selectPokemon(pokemon: Pokemon): void {
    this.selectedPokemon = pokemon.id === this.selectedPokemon?.id ? null : pokemon;
  }

  loadMore(): void {
    const currentCount = this.displayedPokemons.length;
    const next = this.filteredPokemons.slice(0, currentCount + this.pageSize);
    this.displayedPokemons = next;
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
