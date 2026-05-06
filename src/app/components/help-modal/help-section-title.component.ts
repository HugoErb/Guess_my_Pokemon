import { Component, input } from '@angular/core';

@Component({
	selector: 'app-help-section-title',
	standalone: true,
	templateUrl: './help-section-title.component.html',
})
export class HelpSectionTitleComponent {
	label = input.required<string>();
}
