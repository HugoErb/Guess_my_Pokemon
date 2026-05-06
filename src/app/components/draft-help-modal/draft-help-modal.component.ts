import { Component, Input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';

import { DraftHelpSectionTitleComponent } from './draft-help-section-title.component';
import { DraftHelpCardComponent } from './draft-help-card.component';

@Component({
	selector: 'app-draft-help-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	imports: [DraftHelpSectionTitleComponent, DraftHelpCardComponent],
	templateUrl: './draft-help-modal.component.html',
})
export class DraftHelpModalComponent {
	@Input() mode: 'solo' | 'duo' | 'trainer' = 'solo';
	close = output<void>();

	protected readonly ICONS = ICONS;
}
