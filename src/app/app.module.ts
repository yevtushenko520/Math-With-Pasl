import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, NgModule } from '@angular/core';
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular';
import { SplashScreen } from '@ionic-native/splash-screen';
import { StatusBar } from '@ionic-native/status-bar';
import { AngularFireModule } from 'angularfire2';
import { AngularFireDatabaseModule } from 'angularfire2/database';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';
import { UserProvider } from '../providers/user/user';
import { LoaderComponent } from '../pages/home/loader.component';
import { Facebook } from '@ionic-native/facebook';
import { AdMobPro } from '@ionic-native/admob-pro';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';

const firebase = {
  apiKey: 'AIzaSyClBHece8e_aAc-x1sXAI3BcnhQQRa4cQU',
  authDomain: 'simple-math-54431.firebaseapp.com',
  databaseURL: 'https://simple-math-54431.firebaseio.com',
  projectId: 'simple-math-54431',
  storageBucket: 'simple-math-54431.appspot.com',
  messagingSenderId: '555593773045'
};

@NgModule({
  declarations: [MyApp, HomePage, LoaderComponent],
  imports: [BrowserModule, IonicModule.forRoot(MyApp), AngularFireModule.initializeApp(firebase), AngularFireAuthModule, AngularFireDatabaseModule],
  bootstrap: [IonicApp],
  entryComponents: [MyApp, HomePage],
  providers: [StatusBar, SplashScreen, FirebaseAnalytics, { provide: ErrorHandler, useClass: IonicErrorHandler }, UserProvider, Facebook, AdMobPro, GoogleAnalytics]
})
export class AppModule {}
