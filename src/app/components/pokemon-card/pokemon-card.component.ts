import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { Pokemon } from '../../models/pokemon.model';

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

@Component({
  selector: 'app-pokemon-card',
  imports: [NgClass],
  template: `
    <div class="bg-slate-800 rounded-2xl p-4 border border-slate-700 flex flex-col gap-4">

      <!-- Sprite + Nom + Types -->
      <div class="flex flex-col items-center gap-2">
        <img
          [src]="pokemon().sprite"
          [alt]="pokemon().name"
          class="w-40 h-40 object-contain pixelated"
          style="image-rendering: pixelated; image-rendering: crisp-edges;"
        />
        <div class="text-center">
          <p class="text-xs text-slate-400">#{{ pokemon().id.toString().padStart(3, '0') }}</p>
          <h2 class="text-lg font-bold text-white capitalize">{{ pokemon().name }}</h2>
        </div>
        <div class="flex flex-wrap gap-1 justify-center">
          @for (type of pokemon().types; track type) {
            <span
              class="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              [ngClass]="getTypeColor(type)"
            >
              {{ type }}
            </span>
          }
        </div>
      </div>

      <!-- Stats -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <span class="w-12 text-xs text-slate-400 text-right shrink-0">PV</span>
          <div class="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-green-500 rounded-full transition-all"
              [style.width]="getStatWidth(pokemon().stats.pv)"
            ></div>
          </div>
          <span class="w-8 text-xs text-slate-300 text-right shrink-0">{{ pokemon().stats.pv }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-12 text-xs text-slate-400 text-right shrink-0">ATQ</span>
          <div class="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-red-500 rounded-full transition-all"
              [style.width]="getStatWidth(pokemon().stats.attaque)"
            ></div>
          </div>
          <span class="w-8 text-xs text-slate-300 text-right shrink-0">{{ pokemon().stats.attaque }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-12 text-xs text-slate-400 text-right shrink-0">DEF</span>
          <div class="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-blue-500 rounded-full transition-all"
              [style.width]="getStatWidth(pokemon().stats.defense)"
            ></div>
          </div>
          <span class="w-8 text-xs text-slate-300 text-right shrink-0">{{ pokemon().stats.defense }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-12 text-xs text-slate-400 text-right shrink-0">ATQ S</span>
          <div class="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-purple-500 rounded-full transition-all"
              [style.width]="getStatWidth(pokemon().stats.atq_spe)"
            ></div>
          </div>
          <span class="w-8 text-xs text-slate-300 text-right shrink-0">{{ pokemon().stats.atq_spe }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-12 text-xs text-slate-400 text-right shrink-0">DEF S</span>
          <div class="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-indigo-500 rounded-full transition-all"
              [style.width]="getStatWidth(pokemon().stats.def_spe)"
            ></div>
          </div>
          <span class="w-8 text-xs text-slate-300 text-right shrink-0">{{ pokemon().stats.def_spe }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-12 text-xs text-slate-400 text-right shrink-0">VIT</span>
          <div class="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              class="h-full bg-yellow-400 rounded-full transition-all"
              [style.width]="getStatWidth(pokemon().stats.vitesse)"
            ></div>
          </div>
          <span class="w-8 text-xs text-slate-300 text-right shrink-0">{{ pokemon().stats.vitesse }}</span>
        </div>
      </div>

      <!-- Taille & Poids -->
      <div class="flex justify-around text-sm border-t border-slate-700 pt-3">
        <div class="text-center">
          <p class="text-slate-400 text-xs">Taille</p>
          <p class="text-white font-medium">{{ (pokemon().height / 10).toFixed(1) }}m</p>
        </div>
        <div class="text-center">
          <p class="text-slate-400 text-xs">Poids</p>
          <p class="text-white font-medium">{{ (pokemon().weight / 10).toFixed(1) }}kg</p>
        </div>
      </div>

      <!-- Capacités -->
      @if (pokemon().abilities && pokemon().abilities.length > 0) {
        <div class="border-t border-slate-700 pt-3">
          <p class="text-xs text-slate-400 mb-1">Capacités</p>
          <p class="text-sm text-white">{{ pokemon().abilities.join(', ') }}</p>
        </div>
      }

      <!-- Description -->
      @if (pokemon().description) {
        <div class="border-t border-slate-700 pt-3">
          <p class="text-xs text-slate-400 italic">"{{ pokemon().description }}"</p>
        </div>
      }

    </div>
  `,
})
export class PokemonCardComponent {
  readonly pokemon = input.required<Pokemon>();

  getTypeColor(type: string): string {
    return TYPE_COLORS[type] ?? 'bg-gray-500';
  }

  getStatWidth(value: number): string {
    return `${Math.round((value / 255) * 100)}%`;
  }
}
