import { Component, output, input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';

@Component({
	selector: 'app-cancel-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	templateUrl: './cancel-modal.component.html',
})
export class CancelModalComponent {
	isCancelling = input<boolean>(false);
	title = input<string>('Quitter la partie ?');
	message = input<string>("Es-tu sûr de vouloir revenir à l'accueil ? Cela annulera définitivement la partie en cours pour les deux joueurs.");
	cancelLabel = input<string>('Non, rester');
	confirmLabel = input<string>('Oui, quitter');
	loadingLabel = input<string>('Annulation...');
	confirm = output<void>();
	cancel = output<void>();

	protected readonly ICONS = ICONS;
}
