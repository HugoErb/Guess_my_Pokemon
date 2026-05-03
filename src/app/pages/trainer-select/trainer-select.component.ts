import { Component, OnInit, inject, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { Trainer } from '../draft-trainer/draft-trainer.component';
import { ICONS } from '../../constants/icons';
import { PokemonService } from '../../services/pokemon.service';
import { SupabaseService } from '../../services/supabase.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-trainer-select',
  imports: [NgClass],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './trainer-select.component.html'
})
export class TrainerSelectComponent implements OnInit {
  protected readonly ICONS = ICONS;
  private readonly router = inject(Router);
  private readonly pokemonService = inject(PokemonService);

  private readonly supabaseService = inject(SupabaseService);

  readonly trainers = signal<Trainer[]>([]);
  readonly defeatedIndices = signal<number[]>([]);
  readonly isLoading = signal(true);
  
  private readonly allPokemon = toSignal(this.pokemonService.loadAll(), {
    initialValue: []
  });

  async ngOnInit() {
    try {
      const res = await fetch('/assets/trainers.json');
      const data = await res.json() as Trainer[];
      this.trainers.set(data);

      const user = this.supabaseService.getCurrentUser();
      if (user) {
        const defeated = await this.supabaseService.getDefeatedTrainers(user.id);
        this.defeatedIndices.set(defeated);
      }
    } catch {
      // error
    } finally {
      this.isLoading.set(false);
    }
  }

  isLocked(index: number): boolean {
    if (index === 0) return false;
    // Un dresseur est verrouillé si le précédent n'a pas été battu
    return !this.defeatedIndices().includes(index - 1);
  }

  isDefeated(index: number): boolean {
    return this.defeatedIndices().includes(index);
  }

  getPokemonSprite(id: number): string {
    const p = this.allPokemon().find(p => p.id === id);
    return p ? p.sprite : '';
  }

  getPokemonName(id: number): string {
    const p = this.allPokemon().find(p => p.id === id);
    return p ? p.name : 'Inconnu';
  }

  selectTrainer(index: number) {
    if (this.isLocked(index)) return;
    void this.router.navigate(['/draft-trainer', index]);
  }

  goBack() {
    void this.router.navigate(['/draft']);
  }
}
