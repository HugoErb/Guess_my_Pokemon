import { Component, Input } from '@angular/core';

@Component({
	selector: 'app-draft-help-section-title',
	standalone: true,
	templateUrl: './draft-help-section-title.component.html',
})
export class DraftHelpSectionTitleComponent {
	@Input({ required: true }) label = '';
}
