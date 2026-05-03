import { Component, OnInit, inject, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { Trainer } from '../draft-trainer/draft-trainer.component';
import { ICONS } from '../../constants/icons';
import { PokemonService } from '../../services/pokemon.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-trainer-select',
  imports: [],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './trainer-select.component.html'
})
export class TrainerSelectComponent implements OnInit {
  protected readonly ICONS = ICONS;
  private readonly router = inject(Router);
  private readonly pokemonService = inject(PokemonService);

  readonly trainers = signal<Trainer[]>([]);
  readonly isLoading = signal(true);
  
  private readonly allPokemon = toSignal(this.pokemonService.loadAll(), {
    initialValue: []
  });

  async ngOnInit() {
    try {
      const res = await fetch('/assets/trainers.json');
      const data = await res.json() as Trainer[];
      this.trainers.set(data);
    } catch {
      // error
    } finally {
      this.isLoading.set(false);
    }
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
    void this.router.navigate(['/draft-trainer', index]);
  }

  goBack() {
    void this.router.navigate(['/draft']);
  }
}
