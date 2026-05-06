import { Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';

@Component({
	selector: 'app-header',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<header class="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-700">
			<div class="flex items-center gap-3 min-w-0">
				<iconify-icon [icon]="icon()" [class]="'text-2xl shrink-0 ' + iconClass()"></iconify-icon>
				<span class="text-lg md:text-xl font-bold tracking-wide truncate whitespace-nowrap">
					{{ title() }}@if (subtitle()) { <span class="hidden sm:inline"> - {{ subtitle() }}</span> }
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
