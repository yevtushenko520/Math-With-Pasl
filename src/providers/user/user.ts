import { Injectable } from '@angular/core';
import { AngularFireDatabase } from 'angularfire2/database';
import { AngularFireAuth } from 'angularfire2/auth';
import { rand, findClosestValue } from '../../pages/home/generator';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subject } from 'rxjs/Subject';
import firebase from 'firebase/app';
import 'firebase/auth';

@Injectable()
export class UserProvider {
  authState: any = null;
  multiPlayerKey = '';
  multiplayerState: string;
  opponent: any = {
    field: { grid: [], neededScore: 0, playerCurrentScore: 0 },
    score: 0
  };

  matchInfo: any = {}; //match key and field index

  enemyLoaded = false;
  bracket: number = 0;
  matchKey = '';
  TIMEOUT_TIME = rand(3000, 7000);
  timeoutVar: any;

  result = {
    won: false,
    lost: false,
    draw: false
  };

  multiplayerGameState = {
    player1: 0,
    player2: 0,
    gamesPlayed: 1
  };

  loader = {
    text: 'Loading',
    displayed: true,
    buttonText: '',
    buttonHandler: () => {}
  };

  hasLost: Subject<boolean> = new Subject<boolean>();
  lookingForEnemy: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  opponentDisconnected: Subject<String> = new Subject<String>();

  constructor(private afAuth: AngularFireAuth, private db: AngularFireDatabase) {
    this.lookingForEnemy.subscribe(res => {
      if (!res) {
        this.db.list('match').query.off();
        this.db.list('multiplayerPool').query.off();
      }
    });
  }

  get currentUserObservable(): any {
    return this.afAuth.authState;
  }

  getAudioState(type) {
    if (type == 'click')
      if (!localStorage.clicksound) return false;
      else return JSON.parse(localStorage.clicksound);
    else if (!localStorage.bgmusic) return false;
    else return JSON.parse(localStorage.bgmusic);
  }

  setAudioState(type, val) {
    if (type == 'click') localStorage.clicksound = JSON.stringify(val);
    else localStorage.bgmusic = JSON.stringify(val);
  }

  listeningForMultiplayerMatchStart(user, matchKey) {
    // connecting players
    return new Promise((resolve, reject) => {
      this.db
        .list('match/' + matchKey)
        .query.orderByChild('name')
        .equalTo(user.name)
        .on('value', snapshot => {
          if (snapshot.toJSON()) {
            console.log('match started');
            this.db.list('match').query.off();
            resolve('match started');
          }
        });
    });
  }

  listeningToFieldUpdates(matchKey, i) {
    //  sync fields
    console.log('listeningToFieldUpdates called');

    return new Promise((resolve, reject) => {
      let fieldIndex = i == 1 ? 2 : 1;

      setTimeout(() => {
        if (!this.enemyLoaded) {
          try {
            this.removeFromMatch().catch();
          } catch {}
          this.removeFromPool();
          reject('fucked up');
        }
      }, 2000);

      let obs = this.db
        .object('match/' + matchKey + '/field' + fieldIndex)
        .valueChanges()
        .subscribe((field: any) => {
          // console.log(matchKey, field); //          enemy field on update
          console.log(field);
          
          if (field) {
            this.enemyLoaded = true;
            resolve();
            if (field.neededScore == field.playerCurrentScore && !this.result.lost) {
              this.result.lost = true;
              this.multiplayerGameState.gamesPlayed++;
              if (this.matchInfo.i == 1) this.multiplayerGameState.player2++;
              else this.multiplayerGameState.player1++;
              this.hasLost.next(true);
              setTimeout(() => {
                this.result.lost = false;
              }, 5000);
            }
            this.opponent.field = field;
          }

          if (this.enemyLoaded && !field) {
            obs.unsubscribe();
            this.opponentDisconnected.next('disconnect');
            reject();
          }
        });
    });
  }

  updateField(name, grid, matchKey, i, playerCurrentScore) {
    // redraw field on tile click
    grid.playername = name;
    grid.playerCurrentScore = playerCurrentScore;
    console.log('update');
    console.log(grid);
    
    return new Promise((resolve, reject) => {
      this.db
        .list('/match/' + matchKey)
        .set('field' + i, grid)
        .then(res => {
          resolve();
        });
    });
  }

  updateGameStatus(matchKey) {
    return new Promise((resolve, reject) => {
      this.db
        .list('/match/' + matchKey)
        .set('wins', this.multiplayerGameState)
        .then(res => {
          resolve();
        });
    });
  }

  signIn() {
    const provider = new firebase.auth.FacebookAuthProvider();
    this.afAuth.auth.signInWithRedirect(provider).then(credential => {
      return credential;
    });
  }

  signInCred(token) {
    return new Promise((resolve, reject) => {
      const cred = firebase.auth.FacebookAuthProvider.credential(token);
      this.afAuth.auth.signInAndRetrieveDataWithCredential(cred).then(credential => {
        resolve(credential);
      });
    });
  }

  signOut() {
    this.afAuth.auth.signOut();
    this.removeFromPool();
    this.removeFromMatch();
    localStorage.setItem('user', '');
  }

  getUser(user) {
    return new Promise((resolve, reject) => {
      this.findUserByName(user.displayName)
        .then(foundedUser => {
          resolve(foundedUser);
        })
        .catch(err => {
          this.addUserToDatabase(user.displayName).then((res: any) => {
            resolve({ name: user.displayName, score: 0, level: 1, key: res.key });
          });
        });
    });
  }

  setUserInfo(user, field, value) {
    let obj = {};
    obj[field] = value;
    this.db.object('/users/' + user.key).update(obj);
    user[field] = value;
    localStorage.setItem('user', JSON.stringify(user));
  }

  addUserToDatabase(name) {
    return new Promise((resolve, reject) => {
      this.db
        .list('users')
        .push({
          name: name,
          level: 1,
          score: 0
        })
        .then(res => {
          resolve(res);
        });
    });
  }

  findUserByName(name) {
    return new Promise((resolve, reject) => {
      this.db
        .list('users')
        .query.orderByChild('name')
        .equalTo(name)
        .on('value', function(snapshot) {
          try {
            let asd: any = snapshot;
            let key = asd.node_.children_.root_.key;
            var temp: any = ObjectValues(ObjectValues(snapshot.toJSON()))[0];
            temp.key = key;
            if (key) resolve(temp);
          } catch {
            reject('err');
          }
        });
    });
  }

  findEnemy(user) {
    return new Promise((resolve, reject) => {
      this.addToPool(user).then(res => {
        this.multiPlayerKey = <string>res;
        if (this.multiplayerState == 'looking') {
          this.searchInARange(user, 1000)
            .then(res => {
              resolve({ key: res, i: 1 });
            })
            .catch(() => reject());
        } else if (this.multiplayerState) {
          this.listenWithoutKey(user)
            .then(mk => {
              resolve({ key: mk, i: 2 });
              this.matchKey = <string>mk;
            })
            .catch(() => reject());
        }
      });
    });
  }

  findMatch(user) {
    return new Promise((resolve, reject) => {
      this.findEnemy(user)
        .then(obj => {
          resolve(obj);
        })
        .catch(() => {
          repeat();
        });

      let repeat = () => {
        this.findEnemy(user)
          .then(obj => {
            resolve(obj);
          })
          .catch(() => {
            reject();
          });
      };
    });
  }

  listenWithoutKey(user) {
    return new Promise((resolve, reject) => {
      this.db.list('match').query.on('value', snap => {
        for (const key in snap.toJSON()) {
          let temp = ObjectValues(snap.toJSON()[key]);
          temp.forEach((el: any) => {
            if (el.name == user.name) {
              resolve(key);
            }
          });
        }
      });
      this.timeoutVar = setTimeout(() => {
        this.db.list('match').query.off();
        this.removeFromPool();
        reject();
      }, this.TIMEOUT_TIME);
    });
  }

  searchInARange(user, range) {
    return new Promise((resolve, reject) => {
      this.db
        .list('multiplayerPool')
        .query.orderByChild('score')
        .startAt(user.score - range)
        .endAt(user.score + range)
        .on('value', snapshot => {
          if (snapshot.toJSON()) {
            let keys = Object.keys(snapshot.toJSON());
            let vals = ObjectValues(snapshot.toJSON());

            if (vals) {
              findClosestValue(user, vals)
                .then((res: any) => {
                  // console.log(res);
                  this.db.list('multiplayerPool').query.off();
                  this.startMultiplayerMatch(keys[res.index], snapshot.toJSON()[keys[res.index]], user).then(mk => resolve(mk));
                })
                .catch(() => {});
            }
          }
        });
      this.timeoutVar = setTimeout(() => {
        this.db.list('multiplayerPool').query.off();
        this.removeFromPool();
        reject();
      }, this.TIMEOUT_TIME);
    });
  }

  startMultiplayerMatch(opponentKey, opponent, user) {
    return new Promise((resolve, reject) => {
      this.addToMatch(opponentKey, opponent).then(matchKey => {
        this.matchKey = <string>matchKey;
        this.addToMatch(this.multiPlayerKey, user, matchKey).then(res => {
          this.setMultiplayerGameState(matchKey);
          resolve(matchKey);
        });
      });
    });
  }

  addToMatch(key, user, matchKey?) {
    return new Promise((resolve, reject) => {
      let mk = matchKey ? matchKey : '';
      if (!mk) {
        this.removeFromPool(key).then(res => {
          this.db
            .list('match/' + mk)
            .push({})
            .push({
              name: user.name,
              score: user.score
            })
            .then(res => {
              resolve(res.parent.key);
            });
        });
      } else {
        this.removeFromPool(key).then(res => {
          this.db
            .list('match/' + mk)
            .push({
              name: user.name,
              score: user.score
            })
            .then(res => {
              resolve(res.parent.key);
            });
        });
      }
    });
  }

  addToPool(user) {
    return new Promise((resolve, reject) => {
      if (!this.multiplayerState) Math.random() >= 0.5 ? (this.multiplayerState = 'listen') : (this.multiplayerState = 'looking');
      else this.multiplayerState == 'listen' ? (this.multiplayerState = 'looking') : (this.multiplayerState = 'listen');

      this.db
        .list('multiplayerPool')
        .push({
          name: user.name,
          score: user.score,
          state: this.multiplayerState
        })
        .then(res => {
          resolve(res.key);
        });
    });
  }

  removeFromPool(key?) {
    if (!key) key = this.multiPlayerKey;
    return new Promise((resolve, reject) => {
      if (key) {
        this.db
          .object('/multiplayerPool/' + key)
          .remove()
          .then(res => {
            key = '';
            resolve('removed');
            clearTimeout(this.timeoutVar);
            this.lookingForEnemy.next(false);
          });
        // } else reject('not removed');
      }
    });
  }

  removeFromMatch(key?) {
    if (!key) key = this.matchKey;
    console.log(key);
    return new Promise((resolve, reject) => {
      if (key) {
        this.db
          .object('/match/' + key)
          .remove()
          .then(res => {
            key = '';
            this.multiplayerGameState = {
              player1: 0,
              player2: 0,
              gamesPlayed: 1
            };
            resolve('removed');
            clearTimeout(this.timeoutVar);
          });
        // } else reject('not removed');
      }
    });
  }

  setMultiplayerGameState(matchKey) {
    return new Promise((resolve, reject) => {
      this.db
        .list('/match/' + matchKey)
        .set('wins', this.multiplayerGameState)
        .then(res => {
          resolve();
        });
    });
  }

  createMultiplayerGrid(name, grid, i, matchKey, score) {
    grid.playerGlobalScore = score;
    grid.playername = name;
    return new Promise((resolve, reject) => {
      this.db
        .list('/match/' + matchKey)
        .set('field' + i, grid)
        .then(res => {
          resolve();
        });
    });
  }
}

function ObjectValues(obj) {
  var values = Object.keys(obj).map(function(e) {
    return obj[e];
  });
  return values;
}
