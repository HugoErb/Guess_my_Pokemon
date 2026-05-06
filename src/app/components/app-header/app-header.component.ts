import { Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';

@Component({
	selector: 'app-header',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './app-header.component.html',
})
export class AppHeaderComponent {
	icon = input.required<string>();
	iconClass = input<string>('');
	title = input.required<string>();
	subtitle = input<string>('');
}
