import { Component, Input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';

@Component({
	selector: 'app-draft-help-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	template: `
		<div
			class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
			(click)="close.emit()"
			[@modalAnimation]
		>
			<div
				class="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5 modal-content max-h-[90vh] overflow-y-auto relative"
				(click)="$event.stopPropagation()"
			>
				<button (click)="close.emit()" class="absolute top-4 right-4 z-10 bg-slate-900/60 hover:bg-red-600 rounded-full w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white transition-colors">
					<iconify-icon [icon]="ICONS.close" class="text-lg"></iconify-icon>
				</button>

				<!-- En-tête -->
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-xl bg-yellow-600/20 flex items-center justify-center border border-yellow-500/30 shrink-0">
						<iconify-icon [icon]="ICONS.help" class="text-2xl text-yellow-400"></iconify-icon>
					</div>
					<div>
						<h2 class="text-lg font-bold text-white uppercase tracking-wider">Aide</h2>
						<p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">
							Team Builder {{ mode === 'duo' ? 'Duo' : mode === 'trainer' ? 'vs Dresseur' : 'Solo' }} — règles et calcul des notes
						</p>
					</div>
				</div>

				<!-- Comment jouer -->
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="flex-1 h-px bg-slate-700"></div>
						<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Comment jouer</span>
						<div class="flex-1 h-px bg-slate-700"></div>
					</div>

					<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
						<ol class="space-y-3 text-sm text-slate-300 list-none">
							<li class="flex gap-3">
								<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">1.</span>
								<span>Six Pokémon sont tirés au hasard : un <strong class="text-green-400">Starter</strong>, quatre classiques, et un <strong class="text-yellow-400">Légendaire</strong>.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">2.</span>
								@if (mode === 'duo' || mode === 'trainer') {
									<span>Tu as <strong class="text-white">10 secondes</strong> pour cliquer sur un Pokémon et le garder dans ton équipe. Sans action, un Pokémon est automatiquement sélectionné pour toi.</span>
								} @else {
									<span><strong class="text-white">Clique sur un Pokémon</strong> pour le garder dans ton équipe. Les cinq autres sont remplacés par de nouveaux tirages.</span>
								}
							</li>
							<li class="flex gap-3">
								<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">3.</span>
								<span>Répète jusqu'à avoir <strong class="text-white">verrouillé 6 Pokémon</strong>. Une fois tous sélectionnés, ton équipe est évaluée.</span>
							</li>
							@if (mode === 'duo') {
								<li class="flex gap-3">
									<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">4.</span>
									<span>Tu n'as <strong class="text-white">pas besoin d'attendre</strong> ton adversaire pour sélectionner tes Pokémon. Tu vois sa progression en temps réel. Les résultats s'affichent quand les deux joueurs ont terminé.</span>
								</li>
							} @else if (mode === 'trainer') {
								<li class="flex gap-3">
									<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">4.</span>
									<span>Le dresseur adverse a déjà son équipe prête. Ton but est de construire une équipe supérieure à la sienne, tant en statistiques qu'en couverture de types.</span>
								</li>
							} @else {
								<li class="flex gap-3">
									<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">4.</span>
									<span>Consulte la fiche d'un Pokémon avec la <strong class="text-white">loupe</strong> qui apparaît sur chaque carte verrouillée.</span>
								</li>
							}
						</ol>
					</div>
				</div>

				<!-- Note Base Stats -->
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="flex-1 h-px bg-slate-700"></div>
						<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Note Base Stats</span>
						<div class="flex-1 h-px bg-slate-700"></div>
					</div>

					<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
						<p class="text-sm text-slate-300">
							Mesure la puissance brute de ton équipe en comparant les statistiques totales de chaque Pokémon à l'ensemble des Pokémon existants.
						</p>
						<div class="space-y-2">
							<div class="flex items-start gap-2">
								<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 mt-0.5">Étape 1</span>
								<p class="text-xs text-slate-300">La <strong class="text-white">somme des 6 stats de base</strong> (PV + Att + Déf + Att.Spé + Déf.Spé + Vit) est calculée pour chaque Pokémon.</p>
							</div>
							<div class="flex items-start gap-2">
								<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 mt-0.5">Étape 2</span>
								<p class="text-xs text-slate-300">Ce total est <strong class="text-white">normalisé sur 0–10</strong> selon les valeurs min et max de tous les Pokémon du jeu.</p>
							</div>
							<div class="flex items-start gap-2">
								<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 mt-0.5">Étape 3</span>
								<p class="text-xs text-slate-300">La note finale est la <strong class="text-white">moyenne</strong> des 6 notes individuelles.</p>
							</div>
						</div>
						<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
							<div class="text-slate-400 font-bold mb-1">Formule :</div>
							<div class="font-mono text-slate-200">note = (total − min) / (max − min) × 10</div>
						</div>
					</div>
				</div>

				<!-- Note Couverture de types -->
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="flex-1 h-px bg-slate-700"></div>
						<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Note Couverture de types</span>
						<div class="flex-1 h-px bg-slate-700"></div>
					</div>

					<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
						<p class="text-sm text-slate-300">
							Évalue l'efficacité offensive de ton équipe <strong class="text-white">contre les types de l'équipe adverse</strong>. Plus tu couvres les types de l'adversaire, meilleure est ta note — et moins bonne sera la sienne.
						</p>

						<div class="space-y-2">
							<div class="flex items-start gap-3 bg-slate-800/60 rounded-lg p-3">
								<span class="text-[10px] font-black text-orange-400 uppercase tracking-wider shrink-0 mt-0.5 w-8 text-right">50%</span>
								<div>
									<div class="text-xs font-bold text-white mb-0.5">Couverture offensive</div>
									<p class="text-xs text-slate-400">% des types adverses que tu peux toucher en super-efficace avec les types de ton équipe.</p>
								</div>
							</div>

							<div class="flex items-start gap-3 bg-slate-800/60 rounded-lg p-3">
								<span class="text-[10px] font-black text-red-400 uppercase tracking-wider shrink-0 mt-0.5 w-8 text-right">30%</span>
								<div>
									<div class="text-xs font-bold text-white mb-0.5">Pokémon exploités</div>
									<p class="text-xs text-slate-400">% des Pokémon adverses que tu peux toucher super-efficacement avec au moins un type de ton équipe.</p>
								</div>
							</div>

							<div class="flex items-start gap-3 bg-slate-800/60 rounded-lg p-3">
								<span class="text-[10px] font-black text-blue-400 uppercase tracking-wider shrink-0 mt-0.5 w-8 text-right">20%</span>
								<div>
									<div class="text-xs font-bold text-white mb-0.5">Résilience défensive</div>
									<p class="text-xs text-slate-400">% des types de l'adversaire auxquels au moins un de tes Pokémon résiste.</p>
								</div>
							</div>
						</div>

						@if (mode === 'solo') {
							<div class="flex gap-2 items-center bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1">
								<iconify-icon [icon]="ICONS.alert" class="text-amber-500 text-sm"></iconify-icon>
								<p class="text-[10px] font-bold text-amber-500 uppercase tracking-wide">Note : Cette évaluation n'est pas utilisée dans le mode solo</p>
							</div>
						}
					</div>
				</div>

				<!-- Note finale -->
				<div class="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 flex gap-2 items-start">
					<iconify-icon [icon]="ICONS.alert" class="text-amber-400 text-base shrink-0 mt-0.5"></iconify-icon>
					@if (mode === 'duo' || mode === 'trainer') {
						<p class="text-xs text-amber-300">
							La <strong class="text-white">note finale</strong> est la moyenne de la note Base Stats et de la note Couverture de types. Le joueur avec la meilleure note finale remporte la partie.
						</p>
					} @else {
						<p class="text-xs text-amber-300">
							La <strong class="text-white">note finale</strong> correspond uniquement à ta note de Base Stats dans ce mode.
						</p>
					}
				</div>

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
export class DraftHelpModalComponent {
	@Input() mode: 'solo' | 'duo' | 'trainer' = 'solo';
	close = output<void>();

	protected readonly ICONS = ICONS;
}
