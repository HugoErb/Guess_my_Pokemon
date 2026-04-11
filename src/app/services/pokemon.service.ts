import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { Pokemon } from '../models/pokemon.model';

@Injectable({ providedIn: 'root' })
export class PokemonService {
  private http = inject(HttpClient);

  /** Cache partagé : le fichier JSON n'est chargé qu'une seule fois. */
  private all$: Observable<Pokemon[]> = this.http
    .get<Pokemon[]>('/assets/pokemon.json')
    .pipe(
      catchError(err => {
        console.error('[PokemonService] Impossible de charger pokemon.json', err);
        return of([]);
      }),
      shareReplay(1)
    );

  // ─── API publique ────────────────────────────────────────────────────────────

  loadAll(): Observable<Pokemon[]> {
    return this.all$;
  }

  getById(id: number): Observable<Pokemon | undefined> {
    return this.all$.pipe(
      map(pokemons => pokemons.find(p => p.id === id))
    );
  }

  random(): Observable<Pokemon> {
    return this.all$.pipe(
      map(pokemons => {
        if (pokemons.length === 0) throw new Error('[PokemonService] Aucun Pokémon disponible');
        return pokemons[Math.floor(Math.random() * pokemons.length)];
      })
    );
  }

  filter(options: {
    query?: string;
    generations?: number[];
    types?: string[];
    categories?: string[];
  }): Observable<Pokemon[]> {
    return this.all$.pipe(
      map(pokemons =>
        pokemons.filter(p => {
          // Filtre par nom (insensible à la casse)
          if (options.query && options.query.trim() !== '') {
            const q = options.query.trim().toLowerCase();
            if (!p.name.toLowerCase().includes(q)) return false;
          }

          // Filtre par génération
          if (options.generations && options.generations.length > 0) {
            if (!options.generations.includes(p.generation)) return false;
          }

          // Filtre par type
          if (options.types && options.types.length > 0) {
            const hasType = options.types.some(t => p.types.includes(t));
            if (!hasType) return false;
          }

          // Filtre par catégorie
          if (options.categories && options.categories.length > 0) {
            if (!options.categories.includes(p.category)) return false;
          }

          return true;
        })
      )
    );
  }
}
