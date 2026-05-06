import { Component, input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';
import { GameSettings } from '../../models/room.model';

@Component({
	selector: 'app-game-settings-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	templateUrl: './game-settings-modal.component.html',
})
export class GameSettingsModalComponent {
	settings = input.required<GameSettings>();
	close = output<void>();

	protected readonly ICONS = ICONS;
}
