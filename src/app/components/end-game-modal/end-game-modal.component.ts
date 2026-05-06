import { Component, input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';
import { Pokemon } from '../../models/pokemon.model';
import { EndGameActionsComponent } from '../end-game-actions/end-game-actions.component';

@Component({
	selector: 'app-end-game-modal',
	standalone: true,
	imports: [EndGameActionsComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	templateUrl: './end-game-modal.component.html',
})
export class EndGameModalComponent {
	isWinner = input<boolean>(false);
	opponentPokemon = input<Pokemon | null>(null);
	iWantReplay = input<boolean>(false);
	opponentWantsReplay = input<boolean>(false);
	opponentLeft = input<boolean>(false);

	replay = output<void>();
	goHome = output<void>();

	protected readonly ICONS = ICONS;
}
