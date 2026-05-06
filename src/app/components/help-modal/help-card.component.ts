import { Component, input } from '@angular/core';

@Component({
	selector: 'app-help-card',
	standalone: true,
	templateUrl: './help-card.component.html',
})
export class HelpCardComponent {
	title = input.required<string>();
	text = input.required<string>();
	example = input<string>('');
}
