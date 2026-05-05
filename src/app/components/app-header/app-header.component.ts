import { Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';

@Component({
	selector: 'app-header',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<header class="flex items-center justify-between px-6 py-4 border-b border-slate-700">
			<div class="flex items-center gap-3">
				<iconify-icon [icon]="icon()" [class]="'text-2xl ' + iconClass()"></iconify-icon>
				<span class="text-xl font-bold tracking-wide">
					{{ title() }}@if (subtitle()) { - {{ subtitle() }} }
				</span>
			</div>
		</header>
	`,
})
export class AppHeaderComponent {
	icon = input.required<string>();
	iconClass = input<string>('');
	title = input.required<string>();
	subtitle = input<string>('');
}
