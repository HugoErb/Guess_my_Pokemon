import { Component, input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgClass } from '@angular/common';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';

@Component({
	selector: 'app-help-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	imports: [NgClass],
	template: `
		<div
			class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-3 md:p-4 overflow-y-auto"
			(click)="close.emit()"
			[@modalAnimation]
		>
			<div
				class="bg-slate-800 border border-slate-600 rounded-2xl p-4 md:p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 md:gap-5 modal-content max-h-[calc(100dvh-1.5rem)] md:max-h-[90vh] overflow-y-auto relative my-auto"
				(click)="$event.stopPropagation()"
			>
				<button (click)="close.emit()" class="absolute top-4 right-4 z-10 bg-slate-900/60 hover:bg-red-600 rounded-full w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white transition-colors">
					<iconify-icon [icon]="ICONS.close" class="text-lg"></iconify-icon>
				</button>

				<!-- En-tête -->
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
						 [ngClass]="mode() === 'guess' ? 'bg-cyan-600/20 border-cyan-500/30' : 'bg-yellow-600/20 border-yellow-500/30'">
						<iconify-icon [icon]="mode() === 'guess' ? ICONS.help : ICONS.statDuel" 
									  class="text-2xl"
									  [ngClass]="mode() === 'guess' ? 'text-cyan-400' : 'text-yellow-400'"></iconify-icon>
					</div>
					<div>
						<h2 class="text-lg font-bold text-white uppercase tracking-wider">
							{{ mode() === 'guess' ? 'Aide : Guess my Pokémon' : 'Aide : Duel de Base Stats' }}
						</h2>
						<p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">Règles du jeu</p>
					</div>
				</div>

				<!-- Règles du jeu -->
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="flex-1 h-px bg-slate-700"></div>
						<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Comment jouer ?</span>
						<div class="flex-1 h-px bg-slate-700"></div>
					</div>

					<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
						@if (mode() === 'guess') {
							<ol class="space-y-3 text-sm text-slate-300 list-none">
								<li class="flex gap-3">
									<span class="text-red-500 font-bold text-base leading-snug shrink-0">1.</span>
									<span>Chaque joueur choisit secrètement un Pokémon que son adversaire devra deviner.</span>
								</li>
								<li class="flex gap-3">
									<span class="text-red-500 font-bold text-base leading-snug shrink-0">2.</span>
									<span>À chaque tour, le joueur actif pose <strong class="text-white">une question à l'oral</strong> à son adversaire sur son Pokémon.</span>
								</li>
								<li class="flex gap-3">
									<span class="text-red-500 font-bold text-base leading-snug shrink-0">3.</span>
									<span>L'adversaire doit répondre <strong class="text-white">par oui ou par non</strong>, en disant la vérité.</span>
								</li>
								<li class="flex gap-3">
									<span class="text-red-500 font-bold text-base leading-snug shrink-0">4.</span>
									<span>Quand un joueur pense avoir trouvé, il tente sa chance en devinant le Pokémon.</span>
								</li>
								<li class="flex gap-3">
									<span class="text-red-500 font-bold text-base leading-snug shrink-0">5.</span>
									<span>Le <strong class="text-white">premier à deviner</strong> le Pokémon de son adversaire remporte la partie !</span>
								</li>
							</ol>
						} @else {
							<ol class="space-y-3 text-sm text-slate-300 list-none text-justify">
								<li class="flex gap-3">
									<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">1.</span>
									<span>
										Chaque manche, un Pokémon est révélé. Tu dois
										<strong class="text-white">choisir une de ses stats</strong>
										avant la fin du chrono (10 secondes).
									</span>
								</li>
								<li class="flex gap-3">
									<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">2.</span>
									<span>
										La
										<strong class="text-white">valeur de la stat choisie</strong>
										est ajoutée à ton score. Chaque stat ne peut être choisie qu'une seule fois sur l'ensemble de la partie.
									</span>
								</li>
								<li class="flex gap-3">
									<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">3.</span>
									<span>
										Si tu ne choisis pas à temps, une stat est sélectionnée
										<strong class="text-white">aléatoirement</strong>
										pour toi.
									</span>
								</li>
								<li class="flex gap-3">
									<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">4.</span>
									<span>
										À la fin de la partie, le joueur avec le
										<strong class="text-white">total le plus élevé</strong>
										remporte la partie !
									</span>
								</li>
							</ol>
						}
					</div>
				</div>

				@if (mode() === 'guess' && showFilters()) {
					<div class="space-y-3">
						<!-- Séparateur filtres -->
						<div class="flex items-center gap-3">
							<div class="flex-1 h-px bg-slate-700"></div>
							<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtres du Pokédex</span>
							<div class="flex-1 h-px bg-slate-700"></div>
						</div>

						<!-- Génération -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Génération</span>
							</div>
							<p class="text-sm text-slate-300">
								Filtre les Pokémon par génération (1 à 9).
							</p>
						</div>

						<!-- Catégorie -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Catégorie</span>
							</div>
							<p class="text-sm text-slate-300">Filtre par catégorie (Starter, Légendaire, etc.).</p>
						</div>

						<!-- Types -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Types</span>
							</div>
							<p class="text-sm text-slate-300">
								Décocher un type masque les Pokémon correspondants.
							</p>
						</div>
					</div>
				}

				<button
					(click)="close.emit()"
					class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-bold text-white transition-colors"
				>
					Fermer
				</button>
			</div>
		</div>
	`,
})
export class HelpModalComponent {
	mode = input<'guess' | 'stat-duel'>('guess');
	showFilters = input<boolean>(true);
	close = output<void>();

	protected readonly ICONS = ICONS;
}
