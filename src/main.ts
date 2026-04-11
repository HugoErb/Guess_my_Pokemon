import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { addCollection } from 'iconify-icon';
import mdiIcons from '@iconify-json/mdi/icons.json';
addCollection(mdiIcons as any);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
