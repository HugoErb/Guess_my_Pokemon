import { Component, CUSTOM_ELEMENTS_SCHEMA, input, output } from '@angular/core';
import { ICONS } from '../../constants/icons';

@Component({
	selector: 'app-end-game-actions',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: [`
		:host {
			display: block;
			width: 100%;
		}
	`],
	templateUrl: './end-game-actions.component.html',
})
export class EndGameActionsComponent {
	showReplay = input<boolean>(true);
	showHome = input<boolean>(true);
	replayMode = input<'solo' | 'multi'>('solo');
	maxWidth = input<'xs' | 'sm'>('sm');
	iWantReplay = input<boolean>(false);
	opponentWantsReplay = input<boolean>(false);
	opponentLeft = input<boolean>(false);

	replay = output<void>();
	goHome = output<void>();

	protected readonly ICONS = ICONS;

	protected isMultiReplay(): boolean {
		return this.replayMode() === 'multi';
	}
}
