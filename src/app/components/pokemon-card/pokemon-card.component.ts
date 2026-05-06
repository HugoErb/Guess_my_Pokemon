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
  templateUrl: './pokemon-card.component.html',
})
export class PokemonCardComponent {
  readonly pokemon = input.required<Pokemon>();
  readonly variant = input<'modal' | 'sidebar'>('modal');

  /** Retourne la classe CSS Tailwind de couleur de fond pour un type Pokémon donné. */
  getTypeColor(type: string): string {
    return TYPE_COLORS[type] ?? 'bg-gray-500';
  }

  /** Calcule la largeur de la barre de statistique en pourcentage (max = 200 → 100%). */
  getStatWidth(value: number): string {
    return `${Math.min(100, Math.round((value / 200) * 100))}%`;
  }

  getTotalStats(stats: Pokemon['stats']): number {
    return stats.pv + stats.attaque + stats.defense + stats.atq_spe + stats.def_spe + stats.vitesse;
  }
}
