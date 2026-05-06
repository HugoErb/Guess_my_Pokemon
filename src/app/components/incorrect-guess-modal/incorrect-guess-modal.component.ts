import { Component, input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';
import { Pokemon } from '../../models/pokemon.model';

@Component({
	selector: 'app-incorrect-guess-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	templateUrl: './incorrect-guess-modal.component.html',
})
export class IncorrectGuessModalComponent {
	lastGuessedPokemon = input<Pokemon | null>(null);
	close = output<void>();

	protected readonly ICONS = ICONS;
}
