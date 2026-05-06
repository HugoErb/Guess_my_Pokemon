import { Component, input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';
import { Pokemon } from '../../models/pokemon.model';

@Component({
	selector: 'app-my-turn-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	templateUrl: './my-turn-modal.component.html',
})
export class MyTurnModalComponent {
	opponentLastGuess = input<Pokemon | null>(null);
	close = output<void>();

	protected readonly ICONS = ICONS;
}
