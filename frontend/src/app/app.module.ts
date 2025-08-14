import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { AppComponent } from './app.component';
import { ExchangeComponent } from './components/exchange/exchange.component';
import { HomeComponent } from './components/home/home.component';
import { ExchangeService } from './services/exchange.service';
import { WebSocketService } from './services/websocket.service';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'exchange', component: ExchangeComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  declarations: [
    AppComponent,
    ExchangeComponent,
    HomeComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    RouterModule.forRoot(routes)
  ],
  providers: [
    ExchangeService,
    WebSocketService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
