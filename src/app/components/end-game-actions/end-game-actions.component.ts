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
	template: `
		<div
			class="flex flex-col gap-3 w-full mx-auto shrink-0"
			[class.max-w-xs]="maxWidth() === 'xs'"
			[class.max-w-sm]="maxWidth() === 'sm'"
		>
			@if (showReplay()) {
				<button
					(click)="replay.emit()"
					[disabled]="isMultiReplay() && (iWantReplay() || opponentLeft())"
					class="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-70 disabled:cursor-not-allowed rounded-2xl font-bold text-white transition-all active:scale-95 shadow-lg shadow-blue-900/20 flex flex-col items-center justify-center gap-0.5"
				>
					<div class="flex items-center gap-2">
						<iconify-icon [icon]="ICONS.dice" class="text-xl"></iconify-icon>
						<span>
							@if (isMultiReplay() && iWantReplay()) {
								En attente...
							} @else if (isMultiReplay() && opponentWantsReplay()) {
								L'adversaire veut rejouer !
							} @else {
								Rejouer
							}
						</span>
					</div>
					@if (isMultiReplay() && opponentLeft()) {
						<span class="text-[9px] font-medium uppercase tracking-wider opacity-80 italic">L'adversaire a quitté la partie</span>
					} @else if (isMultiReplay() && iWantReplay() && !opponentWantsReplay()) {
						<span class="text-[9px] font-medium uppercase tracking-wider opacity-80 italic">En attente de l'adversaire</span>
					}
				</button>
			}

			@if (showHome()) {
				<button
					(click)="goHome.emit()"
					class="w-full py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-bold text-white transition-all active:scale-95 shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
				>
					<iconify-icon [icon]="ICONS.home" class="text-xl"></iconify-icon>
					Retour au menu
				</button>
			}
		</div>
	`,
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
