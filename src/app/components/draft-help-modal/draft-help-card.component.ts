import { Component, Input } from '@angular/core';

@Component({
	selector: 'app-draft-help-card',
	standalone: true,
	templateUrl: './draft-help-card.component.html',
})
export class DraftHelpCardComponent {
	@Input({ required: true }) title = '';
	@Input({ required: true }) text = '';
}
