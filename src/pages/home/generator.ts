export function generateLevel(level: number, elo?: number, type?) {
  let neededScores = 0,
    tilesCount = 0;
  console.log(type);

  if (!type) type = Math.random() >= 0.5 ? 'path' : 'select';
  if (level) {
    if (level < 5) type = 'select';
    if (level == 5) type = 'path';
    neededScores = randScores(level);
    tilesCount = randTiles(level);
    let grid = generateTiles(neededScores, tilesCount, type);
    let object = {
      level: level,
      neededScore: neededScores,
      tilesCount: tilesCount,
      grid: grid[0],
      type: type,
      wins: grid[1]
    };
    return object;
  }

  if (elo || elo == 0) {
    elo == 0 ? (elo = 1) : [];
    neededScores = randScores(Math.ceil(elo / 20));
    tilesCount = randTiles(Math.ceil(elo / 20));
    let grid = generateTiles(neededScores, tilesCount, type);
    let object = {
      level: level,
      neededScore: neededScores,
      tilesCount: tilesCount,
      grid: grid[0],
      type: type,
      wins: grid[1]
    };
    return object;
  }
}

function randScores(level) {
  let min = Math.ceil(level / 10) * 10;
  let max = min + 10;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randTiles(level) {
  let min = 0,
    max = 0;
  if (level <= 60) min = 3;
  else if (level > 120) min = 5;
  else min = 4;

  if (level <= 30) max = 4;
  else if (level <= 90 && level > 30) max = 5;
  else if (level > 150) max = 7;
  else max = 6;

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTiles(score, count, type) {
  let winArray = new Array();
  let initScore = score;
  for (let i = 0; i < count - 1; i++) {
    let temp = Math.abs(Math.ceil(score / 2 - rand(Math.ceil(score / (count * 5)), score - 3 * Math.ceil(score / count))));
    if (temp == 0) temp++;
    score -= temp;
    winArray.push(temp);
  }
  if (score == 0) {
    winArray[0]--;
    score++;
  }
  winArray.push(score);
  let grid = new Array();
  for (let i = 0; i < 5; i++) {
    grid[i] = new Array();
    for (let j = 0; j < 5; j++) {
      grid[i][j] = createRandomGridElement(initScore, count);
    }
  }
  return placeWinningTiles(grid, winArray, type);
}

function placeWinningTiles(grid, winArray, type) {
  let usedIndexes = new Array();
  let used = false;
  let wins = [];
  let i = 0,
    j = 0;

  if (type == 'path') {
    i = rand(1, 3);
    j = rand(1, 3);
    let prevI = i;
    let prevJ = j;
    let arrow = '';
    wins.push([i, j]);
    grid[i][j] = { val: winArray[0], state: 'should be advised', num: 0 };
    usedIndexes.push({ i: i, j: j });
    for (let index = 1; index < winArray.length; index++, prevI = i, prevJ = j) {
      do {
        used = false;
        if (Math.random() >= 0.5) {
          if (prevI == 0) i = 1;
          else if (prevI == 4) i = 3;
          else i = randFromTwo(prevI - 1, prevI + 1);
          arrow = i > prevI ? 'down' : 'up';
        } else {
          if (prevJ == 0) j = 1;
          else if (prevJ == 4) j = 3;
          else j = randFromTwo(prevJ - 1, prevJ + 1);
          arrow = j > prevJ ? 'right' : 'left';
        }
        usedIndexes.map(item => {
          if (item.i == i && item.j == j) {
            used = true;
            j = prevJ;
            i = prevI;
          }
        });
      } while (used);
      usedIndexes.push({ i: i, j: j });
      wins.push([i, j]);
      grid[i][j] = { val: winArray[index], state: 'should be advised', num: index, next: '' };
      grid[prevI][prevJ].next = arrow;
    }
    return [grid, wins];
  } else {
    winArray.map(item => {
      item += '';
      do {
        used = false;
        i = rand(0, 4);
        j = rand(0, 4);
        usedIndexes.map(item => {
          if (item.i == i && item.j == j) used = true;
        });
      } while (used);
      usedIndexes.push({ i: i, j: j });
      wins.push([i, j]);

      grid[i][j] = { val: item, state: 'should be advised' };
    });
    return [grid, wins];
  }
}

function createRandomGridElement(s, c) {
  if (s < 60) {
    return { val: rand(1, Math.ceil(s / 3)), state: 'not selected' };
  } else {
    let temp = s / c;
    if (Math.random() >= 0.5) {
      temp += rand(s / 14, s / 9);
    } else temp -= rand(s / 14, s / 9);
    return { val: Math.abs(Math.ceil(temp)) + 1, state: 'not selected' };
  }
}

export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function findClosestValue(inititalValue, valuesToCompare) {
  return new Promise((resolve, reject) => {
    let min = 90000;
    let enemy: any = {};
    let index = 0;
    valuesToCompare.map((obj, ind) => {
      let diff = Math.abs(obj.score - inititalValue.score);
      if (diff < min && inititalValue.name != obj.name && obj.state != 'looking') {
        min = diff;
        enemy = obj;
        index = ind;
      }
    });

    let bracket = 0;
    if (min <= 2) bracket = 2;
    else if (min <= 5) bracket = 5;
    else bracket = Math.ceil(min / 10) * 10;

    if (min < 5000) resolve({ diff: min, enemy: enemy, bracket: bracket, index: index });
    else reject();
  });
}

export function getBracket(score1, score2) {
  let min = Math.abs(score1 - score2);
  let bracket = 0;
  if (min <= 2) bracket = 2;
  else if (min <= 5) bracket = 5;
  else bracket = Math.ceil(min / 10) * 10;
  return bracket;
}

function randFromTwo(one, two) {
  if (Math.random() >= 0.5) return one;
  else return two;
}

export function calcELO(s1, s2) {
  let r1 = Math.pow(10, s1 / 400);
  let r2 = Math.pow(10, s2 / 400);

  console.log(r1, r2);

  let e1 = parseFloat((r1 / (r1 + r2)).toFixed(2));
  let e2 = parseFloat((r2 / (r1 + r2)).toFixed(2));

  console.log(e1, e2);

  let elo1 = s1 + 32 * (1 - e1);
  let elo2 = s2 + 32 * (0 - e2);

  elo1 < 0 ? (elo1 = 0) : [];
  elo2 < 0 ? (elo2 = 0) : [];

  return { new1: Math.ceil(elo1), new2: Math.ceil(elo2) };
}

export function makeid() {
  var text = '';
  var possible1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  var possible2 = '0123456789'
  
  for (var i = 0; i < 2; i++) text += possible1.charAt(Math.floor(Math.random() * possible1.length));
  for (var i = 0; i < 5; i++) text += possible2.charAt(Math.floor(Math.random() * possible2.length));
  return text;
}
