import { Component, output, input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';

@Component({
	selector: 'app-cancel-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	template: `
		<div
			class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4"
			(click)="cancel.emit()"
			[@modalAnimation]
		>
			<div
				class="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-center modal-content"
				(click)="$event.stopPropagation()"
			>
				<iconify-icon [icon]="ICONS.alert" class="text-5xl text-red-500 mx-auto"></iconify-icon>
				<h2 class="text-xl font-bold text-white uppercase tracking-wider">{{ title() }}</h2>
				<p class="text-slate-300 text-sm">{{ message() }}</p>
				<div class="flex flex-col-reverse sm:flex-row gap-3 mt-4">
					<button
						(click)="cancel.emit()"
						class="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium text-white transition-colors"
					>
						{{ cancelLabel() }}
					</button>
					<button
						(click)="confirm.emit()"
						[disabled]="isCancelling()"
						class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white transition-colors"
					>
						{{ isCancelling() ? loadingLabel() : confirmLabel() }}
					</button>
				</div>
			</div>
		</div>
	`,
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
