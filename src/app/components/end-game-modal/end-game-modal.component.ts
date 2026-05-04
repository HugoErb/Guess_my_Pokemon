import { Component, input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';
import { Pokemon } from '../../models/pokemon.model';

@Component({
	selector: 'app-end-game-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	template: `
		<div class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" [@modalAnimation]>
			<div
				class="bg-slate-800 border border-slate-600 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-6 text-center modal-content"
			>
				<div class="flex flex-col items-center gap-2">
					@if (isWinner()) {
						<iconify-icon [icon]="ICONS.trophy" class="text-6xl text-yellow-400 animate-bounce"></iconify-icon>
						<h2 class="text-2xl font-bold text-yellow-400 uppercase tracking-tight">Victoire !</h2>
						<p class="text-slate-300">Tu as trouvé le Pokémon de ton adversaire !</p>
					} @else {
						<iconify-icon [icon]="ICONS.skull" class="text-6xl text-red-500 animate-pulse"></iconify-icon>
						<h2 class="text-2xl font-bold text-red-500 uppercase tracking-tight">Défaite</h2>
						<p class="text-slate-300">Ton adversaire a trouvé ton Pokémon !</p>
					}
				</div>

				@if (opponentPokemon()) {
					<div class="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex flex-col items-center gap-2">
						@if (!isWinner()) {
							<p class="text-slate-400 text-sm">Le pokémon de l'adversaire était :</p>
						}
						<div class="flex flex-col items-center gap-1">
							<img [src]="opponentPokemon()!.sprite" [alt]="opponentPokemon()!.name" class="w-24 h-24 object-contain" />
							<h3 class="text-lg font-bold text-white capitalize">{{ opponentPokemon()!.name }}</h3>
						</div>
					</div>
				}

				<div class="w-full flex flex-col gap-2">
					<button
						(click)="replay.emit()"
						[disabled]="iWantReplay() || opponentLeft()"
						class="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-70 disabled:cursor-not-allowed rounded-2xl font-bold text-white transition-all active:scale-95 shadow-lg shadow-blue-900/20 flex flex-col items-center justify-center gap-0.5"
					>
						<div class="flex items-center gap-2">
							<iconify-icon [icon]="ICONS.dice" class="text-xl"></iconify-icon>
							<span>
								@if (iWantReplay()) {
									En attente...
								} @else if (opponentWantsReplay()) {
									L'adversaire veut rejouer !
								} @else {
									Rejouer
								}
							</span>
						</div>
						@if (opponentLeft()) {
							<span class="text-[9px] font-medium uppercase tracking-wider opacity-80 italic">L'adversaire a quitté la partie</span>
						} @else if (iWantReplay() && !opponentWantsReplay()) {
							<span class="text-[9px] font-medium uppercase tracking-wider opacity-80 italic">En attente de l'adversaire</span>
						}
					</button>

					<button
						(click)="goHome.emit()"
						class="w-full py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-bold text-white transition-all active:scale-95 shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
					>
						<iconify-icon [icon]="ICONS.home" class="text-xl"></iconify-icon>
						Retour au menu
					</button>
				</div>
			</div>
		</div>
	`,
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
