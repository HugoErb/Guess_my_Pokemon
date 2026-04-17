import { Component, input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';
import { Pokemon } from '../../models/pokemon.model';

@Component({
	selector: 'app-my-turn-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	template: `
		<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-[110] p-4" [@modalAnimation]>
			<div
				class="bg-slate-800 border border-slate-600 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6 text-center modal-content"
			>
				<div class="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
					<iconify-icon [icon]="ICONS.pokeball" class="text-4xl text-red-500 animate-bounce"></iconify-icon>
				</div>

				<div class="space-y-2">
					<h2 class="text-2xl font-bold text-red-400 uppercase tracking-tight">À toi de jouer !</h2>
					@if (opponentLastGuess()) {
						<p class="text-slate-300">
							L'adversaire a tenté
							<strong class="text-white capitalize">{{ opponentLastGuess()!.name }}</strong>
							... C'est raté ! C'est ton tour.
						</p>
					}
					<p class="text-slate-300">Pose maintenant une question à ton adversaire !</p>
				</div>

				<button
					(click)="close.emit()"
					class="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2"
				>
					Prêt !
				</button>
			</div>
		</div>
	`,
})
export class MyTurnModalComponent {
	opponentLastGuess = input<Pokemon | null>(null);
	close = output<void>();

	protected readonly ICONS = ICONS;
}
