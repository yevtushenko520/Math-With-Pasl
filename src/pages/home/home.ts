import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { NavController, Platform, ToastController } from 'ionic-angular';
import { translation } from './translation';
import { generateLevel, rand, calcELO, makeid } from './generator';
import { UserProvider } from '../../providers/user/user';
import { Facebook } from '@ionic-native/facebook';
import { AdMobPro } from '@ionic-native/admob-pro';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage implements OnInit, OnDestroy {
  @HostListener('window:beforeunload')
  onLeave() {
    this.auth.removeFromPool();
    this.auth.removeFromMatch();
    this.leaving = true;
  }

  constructor(
    public navCtrl: NavController,
    public auth: UserProvider,
    public fb: Facebook,
    private admob: AdMobPro,
    private platform: Platform,
    private toastCtrl: ToastController,
    private ga: GoogleAnalytics,
    public fba: FirebaseAnalytics
  ) {
    platform.ready().then(() => {

      // back button

      this.fba.logEvent('loaded', {loaded: true})
      .then((res: any) => {console.log(res);})
      .catch((error: any) => console.error(error));

      if (platform.is('ios')) this.plt = 'ios';
      else this.plt = 'android';

      platform.registerBackButtonAction(() => {
        if (this.state !== 'inMenu') this.toMenu();
        if (this.state == 'inMultiplayer') {
          this.auth.removeFromPool().catch();
          this.auth.removeFromMatch();
        }
        if (this.searching) {
          this.auth.loader.displayed = false;
          this.auth.removeFromPool().catch();
          clearTimeout(this.auth.timeoutVar);
          this.searching = false;
        }
      });

      //current lang
      this.currentLanguage = translation[JSON.parse(localStorage.getItem('lang'))] || translation.en;

      // on banner ad fail
      this.admob.onAdFailLoad().subscribe(res => {
        this.auth.loader.displayed = false;
        this.admob.hideBanner();
      });

      // create banner
      this.admob
        .createBanner({
          adId: this.admobids[this.plt].banner,
          isTesting: false,
          autoShow: true,
          position: this.admob.AD_POSITION.BOTTOM_CENTER
        })
        .then(e => {
          console.log(e);
        })
        .catch(e => {
          console.log(e);
        });

      // to fix music bug
      this.onPause = this.platform.pause.subscribe(() => {
        if (this.auth.getAudioState('bg')) {
          this.toggleSounds('bg', false);
          this.audioWasOn = true;
        }
        if (this.searching) {
          this.auth.loader.displayed = false;
          this.auth.removeFromPool().catch();
          clearTimeout(this.auth.timeoutVar);
          this.searching = false;
        }
        if (this.state == 'inMultiplayer') {
          this.auth.removeFromPool().catch();
          this.auth.removeFromMatch();
        }
      });
      this.onResume = this.platform.resume.subscribe(() => {
        if (this.audioWasOn) this.toggleSounds('bg', true);
      });
    });
  }

  // to fix music bug
  private onPause: any;
  private onResume: any;
  audioWasOn: boolean = false;
  ionViewWillUnload() {
    this.onPause.unsubscribe();
    this.onResume.unsubscribe();
  }

  showInterstitialAd() {
    return new Promise((resolve, reject) => {
      this.auth.loader.displayed = true;
      this.auth.loader.text = 'Loading';
      this.auth.loader.buttonText = '';
      this.admob
        .prepareInterstitial({
          adId: this.admobids[this.plt].interstitial,
          isTesting: false,
          autoShow: true
        })
        .then(res => {
          console.log(res);
          let adfail = this.admob.onAdFailLoad().subscribe(res => {
            this.auth.loader.displayed = false;
            adfail.unsubscribe();
            this.auth.loader.displayed = false;
            if (res.error == 2) {
              reject('No internet connection');
            } else if (res.reason == 'No fill' || res.error == 9) {
              reject('No ads to show');
            }
          });
          let ad = this.admob.onAdDismiss().subscribe((e) => {
            console.log(e);
            ad.unsubscribe();
            this.auth.loader.displayed = false;
            resolve();
          });
        });
    });
  }

  showRewardAd() {
    return new Promise((resolve, reject) => {
      this.auth.loader.displayed = true;
      this.auth.loader.text = 'Loading';
      if (this.platform.is('ios'))
        this.showInterstitialAd()
          .then(k => {
            resolve(k);
          })
          .catch(err => {
            reject(err);
          });
      else {
        this.auth.loader.buttonText = '';
        this.admob
          .prepareRewardVideoAd({
            adId: this.admobids[this.plt].reward,
            isTesting: false,
            autoShow: true
          })
          .then(res => {
            let adfail = this.admob.onAdFailLoad().subscribe(res => {
              console.log(JSON.stringify(res));
              this.auth.loader.displayed = false;
              adfail.unsubscribe();
              // reject(res);
              this.showInterstitialAd()
                .then(k => {
                  resolve(k);
                })
                .catch(err => {
                  reject(err);
                });
            });
            let ad = this.admob.onAdDismiss().subscribe(e => {
              console.log(JSON.stringify(e));
              ad.unsubscribe();
              this.auth.loader.displayed = false;
              resolve(e);
            });
          })
          .catch(res => {
            this.auth.loader.displayed = false;
            if (res.error == 2) {
              reject('No internet connection');
            } else if (res.reason == 'No fill' || res.error == 9) {
              reject('No ads to show');
            }
            console.log(res);
          });
      }
    });
  }

  onClick() {
    // this.showInterstitialAd().catch(err => {
    //   console.log(err);
    //   if (err.error == 2) {
    //     this.showToast('No internet connection');
    //   } else if (err.reason == 'No fill' || err.error == 9) {
    //     this.showToast('No ads to show');
    //   }
    //   this.auth.loader.displayed = false;
    // });
  }

  showToast(mes) {
    let toast = this.toastCtrl.create({
      message: mes,
      duration: 1500,
      position: 'bottom'
    });
    toast.present();
  }

  plt;
  admobids = {
    android: {
      id: 'ca-app-pub-2102774073898327~3698527548',
      interstitial: 'ca-app-pub-9803194321703345/5888003779',
      banner: 'ca-app-pub-9803194321703345/7580359395',
      reward: 'ca-app-pub-9803194321703345/5265596365'
    },
    ios: {
      interstitial: 'ca-app-pub-9803194321703345/5504860396',
      banner: 'ca-app-pub-9803194321703345/6430929259',
      reward: 'ca-app-pub-9803194321703345/6892828216'
    }
  };
  
  gaIds = {
    trackerID: 'UA-120848487-1'
  }

  currentLanguage = translation.en;
  prefOpened = false; //                       if setting are opened
  paused = false; //                           if paused
  multiplayerPaused = false; //                           if paused
  state = 'inMenu'; //                         state of the app
  currentLevel; //                             level that is currentrly played. All level info are here
  currentScore = 0; //                         score that player has right now
  selectedTiles = []; //                       tiles that are selected right now
  advisedTiles; //                             tiles that are suggested right now
  levels = []; //                              array with levels (numbers noly)
  timePassed = 0; //                           time passed on current level
  timer: any; //                               setinterval obj
  timeSpent = 0; //                               time spent on lvl
  usedClue = false; //                         if clue was used
  result = {
    lost: false,
    won: false,
    revive: false
  }; //                                        round results
  tutorial = {
    step: '',
    displayed: false,
    highlight: '',
    callback: Function
  }; // message to be displayed in tutorial + if displayed
  disconnectAlert = false;
  user: any = null; //                          user info for multiplayer
  userPic = ''; //                           user pic
  leaving = false;
  searching = false;

  customPopup = {
    message: '',
    displayed: false
  };

  MPTIMER = 18500;
  POPUPDELAY = 5000;

  bgAudio: any;
  clickSound: any;
  audioState: any = {};
  botCases = [false, false, false];

  path = {
    arr: Array(),
    get last() {
      return this.arr[this.arr.length - 1] ? this.arr[this.arr.length - 1] : { i: null, j: null };
    },

    get prevLast() {
      return this.arr[this.arr.length - 2] ? this.arr[this.arr.length - 2] : { i: null, j: null };
    }
  };

  adsCount = {
    play_to_level: 0,
    restart_to_level: 0,
    pause_to_menu: 0,
    win_to_next: 0,
    global: 0,
    up(type) {
      return new Promise((resolve, reject) => {
        let showAds = false;
        switch (type) {
          case 'play':
            this.play_to_level++;
            if (this.play_to_level == 3) {
              this.play_to_level = 0;
              showAds = true;
            }
            break;
          case 'restart':
            this.restart_to_level++;
            if (this.restart_to_level == 3) {
              this.restart_to_level = 0;
              showAds = true;
            }
            break;
          case 'menu':
            this.pause_to_menu++;
            if (this.pause_to_menu == 3) {
              this.pause_to_menu = 0;
              showAds = true;
            }
            break;
          case 'win':
            this.win_to_next++;
            if (this.win_to_next == 3) {
              this.win_to_next = 0;
              showAds = true;
            }
            break;
        }
        this.global++;
        if (this.global == 5) {
          this.global = 0;
          showAds = true;
        }
        showAds ? resolve() : reject();
      });
    }
  };

  logged = false;

  ngOnInit() {
    var start = () => {
      this.init();
      this.auth.loader.displayed = false;
    };

    this.auth.currentUserObservable.subscribe(profileInfo => {
      if (profileInfo) {
        this.userPic = profileInfo.photoURL;
        this.auth.getUser(profileInfo).then(user => {
          this.user = user;
          this.currentLevel = this.user.level;
          localStorage.user = JSON.stringify(this.user);
          localStorage.userPic = JSON.stringify(profileInfo.photoURL);
          this.logged = true;
          start();
        });
      } else {
        this.logged = false;
        if (!localStorage.user) {
          let user = {
            name: 'Player' + makeid(),
            score: 0,
            level: 1
          };
          localStorage.setItem('user', JSON.stringify(user));
          this.user = JSON.parse(localStorage.user);
          start();
        } else {
          this.user = JSON.parse(localStorage.user);
          this.user.level = JSON.parse(localStorage.currentLevel);
          start();
        }
      }
    });

    this.bgAudio = new Audio('./assets/Music_3.mp3');
    this.clickSound = new Audio('./assets/Button_Press.mp3');

    this.bgAudio.addEventListener(
      'ended',
      function() {
        this.currentTime = 0;
        this.play();
      },
      false
    );
    let c = this.auth.getAudioState('click');
    let b = this.auth.getAudioState('bg');

    this.audioState = {
      click: c,
      bg: b
    };

    if (this.audioState.bg) {
      this.bgAudio.play();
    }
  }

  signIn() {
    this.fb
      .login(['email'])
      .then(res => {
        try {
          this.auth.signInCred(res.authResponse.accessToken).catch(() => {
            this.showToast('Connection problem, please try again');
          });
        } catch {
          this.showToast('Connection problem, please try again');
        }
      })
      .catch(e => {
        console.log('error', e);
        if (e.errorCode != '4201') {
          this.showToast('No internet connection');
        }
        // this.auth.signIn();
      });
  }

  toggleSounds(type, on) {
    if (type == 'bg') {
      this.audioState.bg = on;
      this.auth.setAudioState(type, on);
      on ? this.bgAudio.play() : this.bgAudio.pause();
    } else {
      this.audioState.click = on;
      this.auth.setAudioState(type, on);
      this.clickSound.play();
    }
  }

  playSound() {
    if (this.audioState.click) this.clickSound.play();
  }

  fillDB() {
    this.auth.addToPool({ name: 'enemy' + rand(1, 15), score: rand(20, 100), state: 'listen' });
    this.auth.addToPool({ name: 'enemy' + rand(1, 15), score: rand(20, 100), state: 'listen' });
    this.auth.addToPool({ name: 'enemy' + rand(1, 15), score: rand(20, 100), state: 'listen' });
    this.auth.addToPool({ name: 'enemy' + rand(1, 15), score: rand(20, 100), state: 'listen' });
    this.auth.addToPool({ name: 'enemy' + rand(1, 15), score: rand(20, 100), state: 'listen' });
    this.auth.addToPool({ name: 'enemy' + rand(1, 15), score: rand(20, 100), state: 'listen' });
  }

  init() {
    this.levels = [];
    let cl = this.getCurrentLvl();
    if (this.user) {
      cl > this.user.level ? (this.logged ? this.auth.setUserInfo(this.user, 'level', cl) : (this.user.level = cl)) : (cl = this.user.level);
    }
    for (let i = 1; i <= cl; i++) this.levels.push(i);
    this.levels.reverse();
  }

  jump(q) {
    // localStorage.currentLevel = q;
    // this.init();
    this.fillDB();
  }

  setTimer(time = this.MPTIMER) {
    this.stopTimer();

    const SMOOTHNESS = 50;

    this.timeSpent = 0;
    let w = screen.width * (this.state == 'inMultiplayer' || this.state == 'inMultiplayerBot' ? 0.64 : 0.78);
    let ww = screen.width * 1.5;

    this.timePassed = ww * -1;

    let step = w / (time / SMOOTHNESS);

    this.timer = setInterval(() => {
      this.timeSpent += SMOOTHNESS;
      this.paused ? [] : (this.timePassed += step);
      if (this.timePassed > ww * -1 + w) {
        if (this.state == 'inMultiplayer' || this.state == 'inMultiplayerBot') this.drawMultiplayer();
        else this.lost();
        this.stopTimer();
      }
    }, SMOOTHNESS);
  }

  stopTimer() {
    clearInterval(this.timer);
  }
  continueTimer(time?: number) {
    this.timer = setInterval(() => {
      this.paused ? [] : this.timePassed++;
      if (this.timePassed > -35) {
        this.lost();
        this.stopTimer();
      }
    }, time ? time / 410 : 30);
  }

  drawMultiplayer() {
    if (this.auth.multiplayerGameState.gamesPlayed == 3) {
      let oppI = this.auth.matchInfo.i == 1 ? 2 : 1;
      let myI = this.auth.matchInfo.i == 1 ? 1 : 2;
      if (this.auth.multiplayerGameState['player' + myI] > this.auth.multiplayerGameState['player' + oppI]) {
        let newScore = calcELO(this.user.score, this.auth.opponent.field.playerGlobalScore).new1;
        let scoreWon = newScore - this.user.score;
        this.customPopup = {
          message: this.currentLanguage.youWon + '<br>' + this.currentLanguage.ratingEarned + ' ' + scoreWon + '<br>' + this.currentLanguage.newRating + newScore,
          displayed: true
        };
        this.user.score = newScore;
        this.logged ? this.auth.setUserInfo(this.user, 'score', this.user.score) : (localStorage.user = JSON.stringify(this.user));
      } else if (this.auth.multiplayerGameState['player' + myI] < this.auth.multiplayerGameState['player' + oppI]) {
        let newScore = calcELO(this.auth.opponent.field.playerGlobalScore, this.user.score).new2;
        let scoreLost = Math.abs(newScore - this.user.score);
        this.customPopup = {
          message: this.currentLanguage.youLost + '<br>' + this.currentLanguage.ratingLost + ' ' + scoreLost + '<br>' + this.currentLanguage.newRating + newScore,
          displayed: true
        };
        this.user.score = newScore;
        this.logged ? this.auth.setUserInfo(this.user, 'score', this.user.score) : (localStorage.user = JSON.stringify(this.user));
      } else {
        this.customPopup = { displayed: true, message: this.currentLanguage.draw };
      }
      setTimeout(() => {
        this.currentScore = 0;
        this.auth.multiplayerGameState = {
          player1: 0,
          player2: 0,
          gamesPlayed: 1
        };
        this.state = 'inMenu';
        this.admob.showBanner(this.admob.AD_POSITION.BOTTOM_CENTER);
        this.auth.removeFromMatch();
        this.auth.removeFromPool().catch();
      }, 1000);
    } else {
      this.auth.result.draw = true;
      this.auth.multiplayerGameState.gamesPlayed++;
      if (this.state == 'inMultiplayerBot') {
        clearInterval(this.botInterval);
        setTimeout(() => {
          this.auth.result.draw = false;
          this.restartBotMatch();
        }, this.POPUPDELAY);
      } else {
        setTimeout(() => {
          if (this.state == 'inMultiplayer') {
            this.auth.result.draw = false;
            this.restartMultiplayer();
          }
        }, this.POPUPDELAY);
      }
    }
  }

  play(lvl) {
    this.state = 'inGame';
    this.admob.hideBanner();
    this.currentScore = 0;
    this.path.arr = [];
    this.currentLevel = generateLevel(lvl);
    this.usedClue = false;
    this.setTimer(this.MPTIMER);

    switch (lvl) {
      case 1:
        setTimeout(() => {
          this.startTutorial(this.currentLanguage.sumUpToReachGoal, 'score', () => {
            return () => {};
          });
          this.halp();
        }, 700);
        break;
      case 2:
        setTimeout(() => {
          this.startTutorial(this.currentLanguage.limitedTime, 'timebar', () => {
            return () => {
              this.startTutorial(this.currentLanguage.mayGetAClue, 'clue', () => {
                return () => {
                  this.continueTimer(this.MPTIMER);
                };
              });
            };
          });
          this.stopTimer();
        }, 700);
        break;
      case 5:
        setTimeout(() => {
          this.startTutorial(this.currentLanguage.makeAPath, 'score', () => {
            return () => {};
          });
          this.halp();
        }, 700);
        break;
    }
  }

  transitToLevel(item) {
    this.adsCount
      .up('play')
      .then(() => {
        this.showInterstitialAd()
          .then(() => {
            this.play(item);
          })
          .catch(err => {
            this.auth.loader.displayed = false;
            this.showToast(err);
            this.play(item);
          });
      })
      .catch(() => {
        this.play(item);
      });
  }

  restart() {
    let rs = () => {
      this.play(this.currentLevel.level);
      this.paused = false;
      this.result.lost = false;
      this.currentScore = 0;
      this.path.arr = [];
    };

    this.adsCount
      .up('restart')
      .then(() => {
        this.showInterstitialAd()
          .then(() => {
            rs();
          })
          .catch(err => {
            this.auth.loader.displayed = false;
            this.showToast(err);
            rs();
          });
      })
      .catch(() => {
        rs();
      });
  }

  continue() {
    this.showInterstitialAd()
      .then(() => {
        this.paused = false;
        this.result.lost = false;
      })
      .catch(err => {
        this.auth.loader.displayed = false;
        this.showToast(err);
        this.paused = false;
        this.result.lost = false;
      });
  }

  toMenuMulti() {
    this.multiplayerPaused = false;
    let index = this.auth.matchInfo.i == 1 ? 2 : 1;
    let state = this.auth.multiplayerGameState;
    if (state['player' + index] > state['player' + this.auth.matchInfo.i]) {
      let newScore = calcELO(this.auth.opponent.field.playerGlobalScore, this.user.score).new2;
      let scoreLost = Math.abs(this.user.score - newScore);
      this.customPopup = {
        message: this.currentLanguage.youLost + '<br>' + this.currentLanguage.ratingLost + ' ' + scoreLost + '<br>' + this.currentLanguage.newRating + newScore,
        displayed: true
      };
      this.user.score = newScore;
      this.auth.setUserInfo(this.user, 'score', this.user.score);
      this.currentScore = 0;
      this.auth.multiplayerGameState = {
        player1: 0,
        player2: 0,
        gamesPlayed: 1
      };
    }
    if (this.state == 'inMultiplayer') {
      this.auth.removeFromMatch();
    } else {
      clearInterval(this.botInterval);
    }
    this.toMenu();
  }

  toMenu() {
    let tm = () => {
      this.lost();
      this.stopTimer();
      this.paused = false;
      this.result.lost = false;
      this.state = 'inMenu';
      this.admob.showBanner(this.admob.AD_POSITION.BOTTOM_CENTER);
      this.currentScore = 0;
      this.init();
    };

    this.adsCount
      .up('menu')
      .then(() => {
        this.showInterstitialAd()
          .then(() => {
            tm();
          })
          .catch(err => {
            this.auth.loader.displayed = false;
            this.showToast(err);
            tm();
          });
      })
      .catch(() => {
        tm();
      });
  }

  startTutorial(type: string, highlight: string, cb: Function) {
    this.tutorial.step = type;
    this.tutorial.displayed = true;
    this.tutorial.highlight = highlight;
    this.tutorial.callback = cb();
  }

  lost() {
    if (this.state == 'inMultiplayerBot') {
      this.stopTimer();
      this.path.arr = [];
      let index = this.auth.matchInfo.i == 1 ? 2 : 1;
      let state = this.auth.multiplayerGameState;
      if (state['player' + index] + 1 == 2 || (state.gamesPlayed == 3 && state['player' + index] == 1)) {
        let newScore = calcELO(this.auth.opponent.field.playerGlobalScore, this.user.score).new2;
        let scoreLost = Math.abs(this.user.score - newScore);
        this.customPopup = {
          message: this.currentLanguage.youLost + '<br>' + this.currentLanguage.ratingLost + ' ' + scoreLost + '<br>' + this.currentLanguage.newRating + newScore,
          displayed: true
        };
        this.user.score = newScore;
        this.logged ? this.auth.setUserInfo(this.user, 'score', this.user.score) : (localStorage.user = JSON.stringify(this.user));
        this.auth.multiplayerGameState = {
          player1: 0,
          player2: 0,
          gamesPlayed: 1
        };
        this.state = 'inMenu';
        this.admob.showBanner(this.admob.AD_POSITION.BOTTOM_CENTER);
      } else {
        this.auth.result.lost = true;
        this.auth.multiplayerGameState['player' + index] += 1;
        this.auth.multiplayerGameState.gamesPlayed += 1;
        setTimeout(() => {
          this.restartBotMatch();
          this.auth.result.lost = false;
        }, this.POPUPDELAY);
      }
      this.stopTimer();
      this.currentScore = 0;
    } else this.result.lost = true;
  }

  win() {
    this.path.arr = [];
    if (this.state == 'inMultiplayer') this.winMP();
    else if (this.state == 'inMultiplayerBot') this.winMPBot();
    else {
      this.stopTimer();
      if (this.currentLevel.level == this.levels.length) {
        this.levels.push(this.levels.length);
        localStorage.setItem('currentLevel', this.currentLevel.level + 1);
        if (this.user) {
          this.user.level = this.currentLevel.level + 1;
          this.logged ? this.auth.setUserInfo(this.user, 'level', this.user.level) : [];
        }
      }
      this.timeSpent = parseFloat((this.timeSpent / 1000).toFixed(1));
      this.result.won = true;
      if (this.currentLevel.level > 30) {
        this.adsCount
          .up('win')
          .then(() => {
            this.showInterstitialAd().catch(err => {
              this.auth.loader.displayed = false;
              this.showToast(err);
            });
          })
          .catch(() => {});
      }
    }
  }

  winMP() {
    this.stopTimer();
    let state = this.auth.multiplayerGameState;
    let oppi = this.auth.matchInfo.i == 1 ? 2 : 1;
    if (state['player' + this.auth.matchInfo.i] + 1 == 2 || (state.gamesPlayed == 3 && state['player' + oppi] == 0)) {
      this.auth.multiplayerGameState['player' + this.auth.matchInfo.i] += 1;

      let newScore = calcELO(parseInt(this.user.score), this.auth.opponent.field.playerGlobalScore).new1;
      let scoreWon = newScore - parseInt(this.user.score);

      this.customPopup = {
        message: this.currentLanguage.youWon + '<br>' + this.currentLanguage.ratingEarned + ' ' + scoreWon + '<br>' + this.currentLanguage.newRating + newScore,
        displayed: true
      };
      this.user.score = newScore;

      this.logged ? this.auth.setUserInfo(this.user, 'score', parseInt(this.user.score)) : (localStorage.user = JSON.stringify(this.user));
      setTimeout(() => {
        this.auth.removeFromMatch();
      }, 1000);
      this.currentScore = 0;
    } else if (state.gamesPlayed == 3 && state['player' + oppi] == 1) {
      this.auth.multiplayerGameState['player' + this.auth.matchInfo.i] += 1;
      this.drawMultiplayer();
    } else {
      this.auth.result.won = true;
      this.auth.multiplayerGameState.gamesPlayed += 1;
      this.auth.multiplayerGameState['player' + this.auth.matchInfo.i] += 1;
      this.auth.updateGameStatus(this.auth.matchInfo.key);
      setTimeout(() => {
        this.restartMultiplayer();
        this.auth.result.won = false;
      }, this.POPUPDELAY);
    }
  }

  winMPBot() {
    this.stopTimer();
    clearInterval(this.botInterval);
    let state = this.auth.multiplayerGameState;
    let oppi = this.auth.matchInfo.i == 1 ? 2 : 1;
    if (state['player' + this.auth.matchInfo.i] + 1 == 2 || (state.gamesPlayed == 3 && state['player' + oppi] == 0)) {
      console.log(this.user.score, this.auth.opponent.field.playerGlobalScore);
      let newScore = calcELO(this.user.score, this.auth.opponent.field.playerGlobalScore).new1;
      let scoreWon = newScore - this.user.score;
      this.customPopup = {
        message: this.currentLanguage.youWon + '<br>' + this.currentLanguage.ratingEarned + ' ' + scoreWon + '<br>' + this.currentLanguage.newRating + newScore,
        displayed: true
      };
      this.user.score = newScore;
      this.logged ? this.auth.setUserInfo(this.user, 'score', this.user.score) : (localStorage.user = JSON.stringify(this.user));
      this.state = 'inMenu';
      this.admob.showBanner(this.admob.AD_POSITION.BOTTOM_CENTER);
      this.auth.multiplayerGameState = {
        player1: 0,
        player2: 0,
        gamesPlayed: 1
      };
    } else {
      this.auth.result.won = true;
      this.auth.multiplayerGameState['player' + this.auth.matchInfo.i] += 1;
      this.auth.multiplayerGameState.gamesPlayed += 1;
      setTimeout(() => {
        this.restartBotMatch();
        this.auth.result.won = false;
      }, this.POPUPDELAY);
    }
  }

  getCurrentLvl() {
    if (localStorage.getItem('currentLevel')) return JSON.parse(localStorage.getItem('currentLevel'));
    else {
      localStorage.setItem('currentLevel', '1');
    }
    return 1;
  }

  halp(ads?: boolean) {
    let help = () => {
      this.stopTimer();
      this.usedClue = true;
      this.currentLevel.grid.map(row => {
        row.map(cell => {
          cell.state === 'should be advised' ? (cell.state = 'advised') : [];
          cell.state === 'should be advised selected' ? (cell.state = 'advised selected') : [];
          cell.state === 'selected' ? (cell.state = 'selected wrong') : [];
        });
      });
    };

    if (ads) {
      this.stopTimer();
      this.usedClue = true;
      this.showRewardAd()
        .then(e => {
          console.log(e);
          help();
        })
        .catch(e => {
          this.showToast(e);
          this.continueTimer();
          this.auth.loader.displayed = false;
        });
    } else help();
  }

  selectTile(cell, i, j) {
    let clickReaction = () => {
      switch (cell.state) {
        case 'not selected':
          cell.state = 'selected';
          this.currentScore += parseInt(cell.val);
          break;
        case 'selected':
          if (this.currentLevel.type == 'select' || (this.path.prevLast.i == i && this.path.prevLast.j == j)) {
            cell.state = 'not selected';
            this.currentScore -= parseInt(cell.val);
            this.currentLevel.type == 'path' ? this.path.arr.splice(-2, 2) : [];
          } else this.path.arr.pop();
          break;
        case 'selected wrong':
          if (this.currentLevel.type == 'select' || (this.path.prevLast.i == i && this.path.prevLast.j == j)) {
            cell.state = 'not selected';
            this.currentScore -= parseInt(cell.val);
            this.currentLevel.type == 'path' ? this.path.arr.splice(-2, 2) : [];
          } else this.path.arr.pop();
          break;
        case 'advised':
          cell.state = 'advised selected';
          this.currentScore += parseInt(cell.val);
          break;
        case 'advised selected':
          if (this.currentLevel.type == 'select' || (this.path.prevLast.i == i && this.path.prevLast.j == j)) {
            cell.state = 'advised';
            this.currentScore -= parseInt(cell.val);
            this.currentLevel.type == 'path' ? this.path.arr.splice(-2, 2) : [];
          } else this.path.arr.pop();

          break;
        case 'should be advised':
          cell.state = 'should be advised selected';
          this.currentScore += parseInt(cell.val);
          break;
        case 'should be advised selected':
          if (this.currentLevel.type == 'select' || (this.path.prevLast.i == i && this.path.prevLast.j == j)) {
            cell.state = 'should be advised';
            this.currentLevel.type == 'path' ? this.path.arr.splice(-2, 2) : [];
            this.currentScore -= parseInt(cell.val);
          } else this.path.arr.pop();
          break;
      }
    };

    if (this.currentLevel.level == 1 || this.currentLevel.level == 5) {
      switch (cell.state) {
        case 'advised':
          cell.state = 'advised selected';
          this.currentScore += parseInt(cell.val);
          break;
      }
    } else {
      if (this.currentLevel.type != 'path') clickReaction();
      else {
        if (this.path.last.i != undefined && this.path.last.j != undefined) {
          if (Math.abs(this.path.last.i - i) + Math.abs(this.path.last.j - j) <= 1) {
            this.path.arr.push({ i: i, j: j });
            clickReaction();
          }
        } else {
          this.path.arr.push({ i: i, j: j });
          clickReaction();
        }
      }

      if (this.state == 'inMultiplayer') {
        this.auth.updateField(this.user.name, this.currentLevel, this.auth.matchInfo.key, this.auth.matchInfo.i, this.currentScore);
      }
    }

    if (this.currentScore == this.currentLevel.neededScore) this.win();
  }

  changeLang(lang) {
    this.currentLanguage = translation[lang];
    localStorage.setItem('lang', JSON.stringify(lang));
  }

  tryTostartMultiplayer() {
    this.auth.multiplayerGameState = {
      player1: 0,
      player2: 0,
      gamesPlayed: 1
    };
    this.auth.result.won = false;
    this.auth.result.lost = false;
    this.auth.result.draw = false;
    if (this.user.level > 10) this.startMultiplayer();
    else this.customPopup = { message: this.currentLanguage.completeLevel10, displayed: true };
  }

  botname = '';
  connectToBot() {
    this.currentScore = 0;
    this.botname = 'Player' + makeid();
    this.currentScore = 0;
    this.auth.multiplayerGameState = {
      player1: 0,
      player2: 0,
      gamesPlayed: 1
    };
    this.auth.matchInfo.i = 1;
    this.botCases = [false, false, false];
    this.state = 'inMultiplayerBot';
    this.admob.hideBanner();
    if (this.auth.multiplayerGameState.gamesPlayed % 2 == 0) this.currentLevel = generateLevel(null, this.user.score, 'path');
    else this.currentLevel = generateLevel(null, this.user.score, 'select');
    if (this.auth.multiplayerGameState.gamesPlayed % 2 == 0) this.auth.opponent.field = generateLevel(null, this.user.score, 'path');
    else this.auth.opponent.field = generateLevel(null, this.user.score, 'select');
    this.auth.opponent.field.playerGlobalScore = rand(this.user.score - 10, this.user.score + 10);
    this.auth.opponent.field.playerCurrentScore = 0;
    this.auth.opponent.field.playername = this.botname;
    this.setTimer(this.MPTIMER);
    let _case = rand(0, 2);
    this.startBot(_case);
    this.botCases[_case] = true;
  }

  startBot(type: Number) {
    let time;
    switch (type) {
      case 0:
        time = Math.ceil(this.MPTIMER / 5) * 2;
        break;
      case 1:
        time = Math.ceil(this.MPTIMER / 5) * 4;
        break;
      case 2:
        time = Math.ceil(this.MPTIMER / 5) * 6;
        break;
    }

    console.log(time);
    let interval = Math.ceil(time / this.auth.opponent.field.tilesCount);
    console.log(interval);

    let iterator = 0;
    this.botInterval = setInterval(() => {
      this.auth.opponent.field.wins.map((v, i, arr) => {
        if (i == iterator) {
          this.auth.opponent.field.grid[v[0]][v[1]].state = 'selected';
          this.auth.opponent.field.playerCurrentScore += Number(this.auth.opponent.field.grid[v[0]][v[1]].val);
          if (this.auth.opponent.field.playerCurrentScore == this.auth.opponent.field.neededScore) {
            clearInterval(this.botInterval);
            this.lost();
          }
        }
      });
      iterator++;
    }, interval);
  }

  botInterval: any;

  restartBotMatch() {
    this.currentScore = 0;
    let temp = this.auth.opponent.field.playerGlobalScore;
    if (this.auth.multiplayerGameState.gamesPlayed % 2 == 0) this.currentLevel = generateLevel(null, this.user.score, 'path');
    else this.currentLevel = generateLevel(null, this.user.score, 'select');
    if (this.auth.multiplayerGameState.gamesPlayed % 2 == 0) this.auth.opponent.field = generateLevel(null, this.user.score, 'path');
    else this.auth.opponent.field = generateLevel(null, this.user.score, 'select');
    this.auth.opponent.field.playerGlobalScore = temp;
    this.auth.opponent.field.playerCurrentScore = 0;
    this.auth.opponent.field.playername = this.botname;
    this.setTimer(this.MPTIMER);
    for (let i = 0; i < this.botCases.length; i++) {
      if (!this.botCases[i]) {
        this.botCases[i] = true;
        this.startBot(i);
        break;
      }
    }
  }

  lostObs: any;
  startMultiplayer() {
    this.currentScore = 0;
    this.stopTimer();
    if (!this.searching) {
      this.searching = true;
      this.lostObs ? this.lostObs.unsubscribe() : [];
      this.lostObs = this.auth.hasLost.subscribe(lost => {
        this.stopTimer();
        this.path.arr = [];
        let index = this.auth.matchInfo.i == 1 ? 2 : 1;
        let state = this.auth.multiplayerGameState;
        // if (state['player' + index] + 1 == 3 || (state.gamesPlayed == 4 && state['player' + index] == 1)) {
        if (state['player' + index] == 2 || (state.gamesPlayed == 4 && state['player' + index] == 1 && state['player' + this.auth.matchInfo.i] == 0)) {
          let newScore = calcELO(this.auth.opponent.field.playerGlobalScore, this.user.score).new2;
          let scoreLost = Math.abs(parseInt(this.user.score) - newScore);
          this.customPopup = {
            message: this.currentLanguage.youLost + '<br>' + this.currentLanguage.ratingLost + ' ' + scoreLost + '<br>' + this.currentLanguage.newRating + newScore,
            displayed: true
          };
          this.user.score -= scoreLost;
          this.logged ? this.auth.setUserInfo(this.user, 'score', this.user.score) : (localStorage.user = JSON.stringify(this.user));
          this.currentScore = 0;
          this.auth.multiplayerGameState = {
            player1: 0,
            player2: 0,
            gamesPlayed: 1
          };
          // this.auth.multiplayerGameState['player' + index]--;
        } else if (state.gamesPlayed == 4 && state['player' + index] == 1 && state['player' + this.auth.matchInfo.i] == 1) {
          this.auth.multiplayerGameState.gamesPlayed--;
          this.drawMultiplayer();
        } else {
          if (lost)
            setTimeout(() => {
              console.log('restart at lsot');
              this.restartMultiplayer();
            }, this.POPUPDELAY);
        }
      });

      let obs = this.auth.opponentDisconnected.subscribe(disc => {
        console.log(disc);
        if (obs) obs.unsubscribe();
        if (!this.disconnectAlert && !this.leaving) {
          if (disc == 'disconnect' && this.auth.multiplayerGameState['player' + this.auth.matchInfo.i] + 1 != 2) this.disconnectAlert = true;
          this.auth.enemyLoaded = false;
          this.auth.matchKey = '';
          this.auth.multiplayerState = '';
          this.auth.matchInfo = {};
          this.auth.result.won = false;
          this.auth.result.lost = false;
          this.auth.result.draw = false;
          this.stopTimer();
          setTimeout(() => {
            this.disconnectAlert = false;
            this.auth.multiplayerGameState = { gamesPlayed: 1, player1: 0, player2: 0 };
            this.state = 'inMenu';
            this.admob.showBanner(this.admob.AD_POSITION.BOTTOM_CENTER);
            this.searching = false;
            // start();
          }, 1000);
        }
      });

      let start = () => {
        // this.auth.opponentDisconnected.unsubscribe();
        this.state = 'inMenu';
        this.admob.showBanner(this.admob.AD_POSITION.BOTTOM_CENTER);
        this.auth.loader = {
          text: 'looking for an opponent',
          displayed: true,
          buttonText: 'Cancel',
          buttonHandler: () => {
            this.auth.loader.displayed = false;
            this.auth.removeFromPool().catch();
            clearTimeout(this.auth.timeoutVar);
            this.searching = false;
          }
        };

        this.auth
          .findMatch(this.user)
          .then((matchInfo: any) => {
            console.log('findenemy', matchInfo);
            this.auth.matchInfo = matchInfo;
            this.auth
              .listeningForMultiplayerMatchStart(this.user, matchInfo.key)
              .then(() => {
                this.auth.loader.buttonText = '';
                this.auth.loader.text = 'Connecting';
                if (this.auth.multiplayerGameState.gamesPlayed % 2 == 0) this.currentLevel = generateLevel(null, parseInt(this.user.score), 'path');
                else this.currentLevel = generateLevel(null, parseInt(this.user.score), 'select');
                this.auth.createMultiplayerGrid(this.user.name, this.currentLevel, matchInfo.i, matchInfo.key, parseInt(this.user.score));
              })
              .then(() => {
                this.auth
                  .listeningToFieldUpdates(matchInfo.key, matchInfo.i)
                  .then(() => {
                    this.auth.loader.displayed = false;
                    this.auth.result.lost = false;
                    this.state = 'inMultiplayer';
                    this.admob.hideBanner();
                    this.setTimer(this.MPTIMER);
                  })
                  .catch(err => {
                    start();
                  });
              });
          })
          .catch(() => {
            this.auth.loader.displayed = false;
            this.searching = false;
            this.connectToBot();
          });
      };
      start();
    }
  }

  restartMultiplayer() {
    console.log(this.auth.opponent);

    this.currentScore = 0;
    this.path.arr = [];
    if (this.auth.multiplayerGameState.gamesPlayed % 2 == 0) this.currentLevel = generateLevel(null, parseInt(this.user.score), 'path');
    else this.currentLevel = generateLevel(null, parseInt(this.user.score), 'select');
    this.auth.createMultiplayerGrid(this.user.name, this.currentLevel, this.auth.matchInfo.i, this.auth.matchInfo.key, parseInt(this.user.score)).then(() => {
      this.setTimer(this.MPTIMER);
    });
  }

  ngOnDestroy() {
    this.auth.lookingForEnemy.unsubscribe();
    this.auth.hasLost.unsubscribe();
    this.auth.opponentDisconnected.unsubscribe();
  }
}
