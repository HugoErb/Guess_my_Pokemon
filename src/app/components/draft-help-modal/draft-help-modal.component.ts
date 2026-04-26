import { Component, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
						<p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">Team Builder — règles et calcul des notes</p>
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
								<span><strong class="text-white">Clique sur un Pokémon</strong> pour le garder dans ton équipe. Les cinq autres sont remplacés par de nouveaux tirages.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">3.</span>
								<span>Répète jusqu'à avoir <strong class="text-white">verrouillé 6 Pokémon</strong>. Une fois tous sélectionnés, ton équipe est évaluée.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-yellow-400 font-bold text-base leading-snug shrink-0">4.</span>
								<span>Consulte la fiche d'un Pokémon avec la <strong class="text-white">loupe</strong> qui apparaît sur chaque carte verrouillée.</span>
							</li>
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
							Évalue l'équilibre défensif et offensif de ton équipe selon cinq critères pondérés.
						</p>

						<div class="space-y-2">
							<!-- Diversité -->
							<div class="flex items-start gap-3 bg-slate-800/60 rounded-lg p-3">
								<span class="text-[10px] font-black text-blue-400 uppercase tracking-wider shrink-0 mt-0.5 w-8 text-right">25%</span>
								<div>
									<div class="text-xs font-bold text-white mb-0.5">Diversité de types</div>
									<p class="text-xs text-slate-400">Ratio de types uniques dans l'équipe. Plus tes Pokémon ont des types variés, meilleur est le score.</p>
								</div>
							</div>

							<!-- Couverture offensive -->
							<div class="flex items-start gap-3 bg-slate-800/60 rounded-lg p-3">
								<span class="text-[10px] font-black text-orange-400 uppercase tracking-wider shrink-0 mt-0.5 w-8 text-right">30%</span>
								<div>
									<div class="text-xs font-bold text-white mb-0.5">Couverture offensive</div>
									<p class="text-xs text-slate-400">Nombre de types adverses que ton équipe peut toucher en super-efficace. Plus tu couvres de types, mieux c'est.</p>
								</div>
							</div>

							<!-- Faiblesse partagée -->
							<div class="flex items-start gap-3 bg-slate-800/60 rounded-lg p-3">
								<span class="text-[10px] font-black text-red-400 uppercase tracking-wider shrink-0 mt-0.5 w-8 text-right">25%</span>
								<div>
									<div class="text-xs font-bold text-white mb-0.5">Pénalité faiblesses partagées</div>
									<p class="text-xs text-slate-400">Pénalise les équipes où plusieurs Pokémon ont la même faiblesse. Une équipe vulnérable au même type est fragile.</p>
								</div>
							</div>

							<!-- Synergie défensive -->
							<div class="flex items-start gap-3 bg-slate-800/60 rounded-lg p-3">
								<span class="text-[10px] font-black text-green-400 uppercase tracking-wider shrink-0 mt-0.5 w-8 text-right">15%</span>
								<div>
									<div class="text-xs font-bold text-white mb-0.5">Synergie défensive</div>
									<p class="text-xs text-slate-400">Proportion des faiblesses de l'équipe qui sont compensées par une résistance d'un autre membre.</p>
								</div>
							</div>

							<!-- Immunités -->
							<div class="flex items-start gap-3 bg-slate-800/60 rounded-lg p-3">
								<span class="text-[10px] font-black text-purple-400 uppercase tracking-wider shrink-0 mt-0.5 w-8 text-right">5%</span>
								<div>
									<div class="text-xs font-bold text-white mb-0.5">Immunités</div>
									<p class="text-xs text-slate-400">Bonus pour les Pokémon totalement immunisés contre certains types (ex. Spectre immunisé Normal).</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Note finale -->
				<div class="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 flex gap-2 items-start">
					<iconify-icon [icon]="ICONS.alert" class="text-amber-400 text-base shrink-0 mt-0.5"></iconify-icon>
					<p class="text-xs text-amber-300">
						La <strong class="text-white">note finale</strong> est la moyenne de la note Base Stats et de la note Couverture de types.
					</p>
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
	close = output<void>();

	protected readonly ICONS = ICONS;
}
