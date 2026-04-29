import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-mode-select',
  standalone: true,
  imports: [NgClass],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="flex flex-col items-center gap-8 px-4">
      <div class="flex items-center gap-3">
        <iconify-icon [icon]="icon" [ngClass]="[iconSize, iconColor]"></iconify-icon>
        <h2 class="text-4xl font-black text-white tracking-wide">{{ title }}</h2>
      </div>
      <div class="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
        <ng-content />
      </div>
    </div>
  `,
})
export class ModeSelectComponent {
  @Input() title = '';
  @Input() icon = '';
  @Input() iconColor = 'text-white';
  @Input() iconSize = 'text-6xl';
}
