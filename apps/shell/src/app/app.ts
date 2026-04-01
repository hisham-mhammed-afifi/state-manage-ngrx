import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { AuthStore, UserStore, AppStore } from '@org/state-core';

@Component({
  imports: [RouterModule, HeaderComponent],
  selector: 'shell-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly authStore = inject(AuthStore);
  private readonly userStore = inject(UserStore);
  private readonly appStore = inject(AppStore);

  constructor() {
    this.appStore.markInitialized();
  }
}
