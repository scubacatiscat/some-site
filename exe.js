/* exe.js v2 - catch cat 추가 기능
   index.html 코드는 그대로 두고 이 파일이 덧붙여집니다.
   문제가 생기면 화면 아래 빨간 상자에 어느 부분인지 표시됩니다. */
(function () {
  // ================= 오류 안내 =================
  function diag(where, e) {
    try {
      var d = document.getElementById('exeErr');
      if (!d) {
        d = document.createElement('div');
        d.id = 'exeErr';
        d.style.cssText = 'position:fixed;left:8px;right:8px;bottom:70px;z-index:99998;padding:8px 10px;' +
          'background:#7a0016;color:#fff;font:12px/1.5 sans-serif;white-space:pre-wrap;word-break:break-all;' +
          'max-height:32vh;overflow:auto';
        d.addEventListener('click', function () { d.style.display = 'none'; });
        document.body.appendChild(d);
      }
      d.style.display = 'block';
      d.textContent += '[exe.js · ' + where + '] ' + (e && e.message ? e.message : e) + '\n';
    } catch (x) {}
  }
  window.addEventListener('error', function (ev) {
    if (ev && ev.filename && ev.filename.indexOf('exe.js') >= 0) {
      diag('실행 중', ev.message + ' (exe.js ' + ev.lineno + '줄)');
    }
  });

  // index.html에 필요한 항목이 모두 있는지 먼저 확인
  var NEED = [
    'PRICES', 'own', 'popLv', 'POP_MAX_LV', 'POP_UP_COST', 'DB', 'RANK_ROOT', 'CODE_DEFS',
    'BUST_IMGS', 'GUNITEM_IMGS', 'PIN_IMGS', 'REMOTE_IMGS', 'POP_CLOSED_IMG', 'BOOST_MUL', 'BOOST_MAX_USES',
    'THREAT_SCORE', 'HIT_STUN', 'MIN_SIZE',
    'cat', 'field', 'face', 'img', 'bubble', 'boostEl', 'boostFill', 'devRight', 'dock', 'popCountEl', 'popLvTxt',
    'upPopBtn', 'bustOwnEl', 'gunOwnEl', 'buyGunBtn', 'useGunBtn', 'pinOwnEl', 'remoteOwnEl', 'buyRemoteBtn',
    'resolveImg', 'vr', 'loadFirst', 'showToast', 'addScore', 'showNews', 'placeEl', 'clearClones', 'timed',
    'resetEffects', 'devRun', 'feedPost', 'updateBoostText', 'stopBoost', 'savePop', 'saveOwn', 'showTime',
    'moveCat', 'busy', 'baseFace', 'checkSweat', 'clearExtras', 'startGame', 'togglePop', 'codeId', 'runCode',
    'renderShop', 'buyItem', 'popPer', 'threatCat', 'hitCat', 'showAngryFace',
    'playing', 'stunned', 'stunTimer', 'moveTimer', 'escaped', 'held', 'boostActive', 'boostEnd', 'boostTotal',
    'boostTick', 'boostTimer', 'boostUses', 'remoteUses', 'gunUsed', 'popCount', 'time', 'unlimited', 'speedMul',
    'dumFast', 'botFast', 'feedPoll', 'tiny'
  ];
  var missing = [];
  NEED.forEach(function (n) {
    try { if (new Function('return typeof ' + n)() === 'undefined') missing.push(n); }
    catch (e) { missing.push(n); }
  });
  if (missing.length) {
    diag('준비 단계', 'index.html에서 찾지 못한 항목: ' + missing.join(', ') +
      '\n→ index.html이 최신 코드인지, <script src="exe.js"></script> 줄이 메인 </script> 뒤 / </body> 앞에 있는지 확인하십시오.');
    return;
  }

  // ================= 설정 (가격 / 확률은 여기서 바꿀 수 있음) =================
  var BOOST_STEPS = [5, 6, 7];                 // bust 지속 시간(초)
  var GUN_STEPS = [8, 9, 10];                  // gun 협박 점수
  var PIN_STEPS = [7500, 6500, 5000];          // pin 가격(pop)
  var REM_STEPS = [3, 4, 6];                   // 리모컨 한 판 사용 횟수
  var PER_STEPS = [5, 6, 8, 9, 10];            // 팝 캣 클릭당 pop (최대 레벨 이후)
  var UPMAX = { boost: 2, gun: 2, pin: 2, remote: 2, per: 4 };
  var TCOST = { boost: [60, 150], gun: [60, 150], pin: [80, 200], remote: [80, 200], per: [100, 250, 500, 1000] }; // 토큰 가격

  var LIGHTNING_CHANCE = 0.003;                // 번개 확률 0.3% (이동 1회당)
  var LIGHTNING_SCORE = 3;                     // 번개가 티캣에게 닿으면 +3점
  var LIGHTNING_WARN = 700;                    // 번개 경고 시간(ms)
  var ROD_WARN = 250;                          // 피뢰침 번개 시간(ms)
  var COFFEE_STUN = 2000;                      // 커피 기절(2초)
  var ZAP_COFFEE_SCORE = 5, ZAP_STUN = 4000;   // 커피 마시던 중 번개: +5점, 4초 기절
  var BOOM_SCORE = 5, BOOM_STUN = 4000;        // 과산화나트륨 + 커피 폭발: +5점, 4초 기절
  var GOLDEN_CHANCE = 0.012;                   // 황금 고양이 확률 1.2% (이동 1회당)
  var GOLDEN_TIME = 3000, GOLDEN_SCORE = 3;    // 3초 동안 클릭 시 3점
  var CLOCK_PER_GAME = 2;                      // 시계 한 판 사용 횟수
  var CHEER_PRICES = [6000, 14000];            // 응원냥 1마리째 / 2마리째 가격
  var CHEER_PER = 0.5;                         // 응원냥 한 마리당 클릭마다 추가 점수
  var FEED_SPEED = 90;                         // 억까 소식이 흐르는 속도(px/초)

  // 없는 요소를 찾아도 오류가 나지 않도록 빈 요소를 대신 돌려줌
  var g = function (id) { return document.getElementById(id) || document.createElement('span'); };
  function safe(name, fn) { try { fn(); } catch (e) { diag(name, e); } }

  // ================= 상태 =================
  var up = { boost: 0, gun: 0, pin: 0, remote: 0, per: 0 };
  var hintSeen = [];
  var stunEnd = 0, stunFreeze = false, coffeeActive = false, peroxideArmed = false;
  var lightningBusy = false, lightningTimer = null, zapTimer = null;
  var goldenActive = false, goldenTimer = null, cheerFrac = 0, clockUses = 0;
  var lightningCount = 0, goldenCount = 0, catching = false, rawAdd = null;
  var coffeeSrc = null, zapSrc = null, boomSrc = null, goldenSrc = null, cheerSrc = null;
  var feedBar = g('feedBar'), feedSeen = {}, feedQueue = [], feedFirst = true, nextFeedAt = 0;
  var refs = {}, tkRows = {}, tokenShop = null, tkCountEl = null;

  var bolt = document.createElement('div');
  bolt.id = 'bolt';
  bolt.innerHTML = '<svg viewBox="0 0 60 100" preserveAspectRatio="none"><polyline points="34,0 24,28 36,42 20,68 32,80 26,100" ' +
    'fill="none" stroke="#ffd600" stroke-width="6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  var cheers = document.createElement('div');
  cheers.id = 'cheers';
  var hintBox = document.createElement('div');
  hintBox.id = 'hintBox';

  function saveUp() { try { localStorage.setItem('catUp', JSON.stringify(up)); } catch (e) {} }
  function getTok() { try { return parseInt(localStorage.getItem('catToken')) || 0; } catch (e) { return 0; } }
  function setTok(n) { try { localStorage.setItem('catToken', String(n)); } catch (e) {} }
  function bt() { return BOOST_STEPS[up.boost] * 1000; }
  function gsc() { return GUN_STEPS[up.gun]; }
  function remLimit() { return REM_STEPS[up.remote]; }

  // ================= 저장값 불러오기 =================
  safe('저장값 불러오기', function () {
    PRICES.rod = 600; PRICES.coffee = 100; PRICES.peroxide = 10000; PRICES.clock = 3000; PRICES.hint = 20000;
    ['rod', 'coffee', 'hint', 'cheer'].forEach(function (k) { own[k] = 0; });
    own.peroxide = false; own.clock = false;
    var o = {};
    try { o = JSON.parse(localStorage.getItem('catOwn')) || {}; } catch (e) {}
    ['rod', 'coffee', 'hint', 'cheer'].forEach(function (k) { own[k] = Math.max(0, parseInt(o[k]) || 0); });
    own.peroxide = !!o.peroxide; own.clock = !!o.clock;
    own.cheer = Math.min(2, own.cheer);
    var u = {};
    try { u = JSON.parse(localStorage.getItem('catUp')) || {}; } catch (e) {}
    Object.keys(up).forEach(function (k) { up[k] = Math.min(UPMAX[k], Math.max(0, parseInt(u[k]) || 0)); });
    PRICES.pin = PIN_STEPS[up.pin];
    try { hintSeen = JSON.parse(localStorage.getItem('catHintSeen')) || []; } catch (e) {}
    window.popPer = function () { return popLv >= POP_MAX_LV ? PER_STEPS[up.per] : popLv; };
  });

  // ================= 추가 스타일 =================
  safe('스타일', function () {
    var st = document.createElement('style');
    st.textContent = '' +
    'html body { padding-top:42px; }' +
    '#feedBar { display:block; }' +
    '#feedLabel { position:absolute; left:0; right:0; text-align:center; opacity:.55; font-size:.8rem; }' +
    '.feedItem { position:absolute; top:0; left:0; white-space:nowrap; background:var(--card); padding:0 12px; font-weight:700;' +
    '  transform:translateX(-100%); animation:feedRun linear forwards; z-index:2; }' +
    '@keyframes feedRun { from { transform:translateX(-100%); } to { transform:translateX(100vw); } }' +
    '#quest { top:36px; }' +
    '#idle { top:36px; }' +
    '#idleSay { top:108px; }' +
    '#questText .qrow { display:flex; gap:10px; }' +
    '#questText .qcell { flex:1; white-space:nowrap; font-size:.8rem; }' +
    '@media (min-width:641px) { #quest { width:340px; } }' +
    '#cat.golden { filter:drop-shadow(0 0 10px #ffc107); }' +
    '#cat.coffee #bubble, #cat.zap #bubble, #cat.boom #bubble { display:block; }' +
    '#bolt { position:absolute; top:0; bottom:0; width:60px; display:none; z-index:9; pointer-events:none; }' +
    '#bolt svg { width:100%; height:100%; display:block; }' +
    '#bolt.warn { display:block; opacity:.28; }' +
    '#bolt.hit { display:block; opacity:1; filter:drop-shadow(0 0 8px #fff) drop-shadow(0 0 14px #ffeb3b); }' +
    '#field.flashbg { background:#fff8c4 !important; }' +
    '#cheers { position:absolute; left:6px; bottom:6px; display:none; gap:4px; z-index:3; pointer-events:none; }' +
    '#cheers img { width:46px; height:auto; display:block; animation:cheerbob .6s ease-in-out infinite alternate; }' +
    '@keyframes cheerbob { from { transform:translateY(0); } to { transform:translateY(-6px); } }' +
    '#hintBox { position:fixed; left:50%; top:40%; transform:translate(-50%,-50%); z-index:210; background:var(--bg); color:var(--fg);' +
    '  border:3px solid #8a4fff; padding:16px 22px; text-align:center; font-weight:800; display:none; max-width:90vw; cursor:pointer; }' +
    '#hintBox b { font-size:1.6rem; font-family:monospace; display:block; margin:6px 0; background:#fff3b0; color:#111; padding:2px 10px; }' +
    '.sitem .emoji { font-size:2rem; }' +
    '#tokenShop { position:fixed; left:8px; bottom:8px; z-index:18; width:340px; max-height:calc(100vh - 96px); overflow:auto;' +
    '  background:var(--bg); border:3px solid #8a4fff; padding:8px; display:none; }' +
    '#tokenShop.open { display:block; }' +
    '.tkhead { display:flex; align-items:center; justify-content:space-between; gap:8px; font-weight:800; margin-bottom:4px; }' +
    '.tkhint { font-size:.72rem; opacity:.75; margin-bottom:6px; }' +
    '.tkrow { display:flex; align-items:center; gap:8px; background:var(--card); padding:6px; margin-bottom:6px; }' +
    '.tkpic { width:46px; height:46px; flex:none; display:flex; align-items:center; justify-content:center; }' +
    '.tkpic img { max-width:100%; max-height:100%; object-fit:contain; display:block; }' +
    '.tkpic .emoji { font-size:1.8rem; }' +
    '.tkinfo { flex:1; min-width:0; font-size:.78rem; font-weight:700; line-height:1.35; }' +
    '.tkinfo .d { font-weight:600; opacity:.85; }' +
    '.tkrow button { padding:6px 8px; font-size:.74rem; min-height:34px; }' +
    '@media (min-width:901px) {' +
    '  #shop { display:grid; grid-template-columns:repeat(2,80px); gap:8px; max-height:calc(100vh - 100px); overflow-y:auto; align-content:start; }' +
    '  #devRight { top:74px !important; }' +
    '}' +
    '@media (max-width:900px) {' +
    '  body.dockOpen, body.tokOpen { padding-bottom:270px; }' +
    '  #dock { left:0; right:0; bottom:calc(60px + env(safe-area-inset-bottom)); background:var(--bg); border-top:3px solid #8a4fff;' +
    '    padding:6px; gap:6px; align-items:stretch; }' +
    '  #shop { display:flex; flex:1; min-width:0; overflow-x:auto; gap:6px; align-items:stretch; -webkit-overflow-scrolling:touch; }' +
    '  .sitem { flex:0 0 68px; width:68px; }' +
    '  .sitem .sname { font-size:.62rem; }' +
    '  #tokenShop { left:0; right:0; bottom:calc(60px + env(safe-area-inset-bottom)); width:auto; max-height:42vh; border-width:3px 0 0 0; }' +
    '}' +
    '@media (max-width:640px) {' +
    '  body.dockOpen #toast, body.tokOpen #toast { bottom:250px; }' +
    '  body.dockOpen #idle, body.tokOpen #idle, body.dockOpen #idleSay, body.tokOpen #idleSay { display:none !important; }' +
    '  h1 { font-size:1.3rem; margin:2px 0 4px; }' +
    '  .bar { gap:6px; font-size:.85rem; }' +
    '  .bar div { padding:4px 10px; }' +
    '  #feedBar { font-size:.75rem; }' +
    '  #questText .qcell { font-size:.68rem; }' +
    '  #questText { padding:6px 8px; }' +
    '  #news { margin-top:6px; }' +
    '  #newsPic { width:80px; }' +
    '}';
    document.head.appendChild(st);
  });

  // ================= 억까 소식 띠: 모든 유저에게 보이고 왼쪽 → 오른쪽으로 흘러 사라짐 =================
  safe('억까 소식', function () {
    feedBar.innerHTML = '<span id="feedLabel">억까 소식 대기 중...</span>';
    window.pollFeed = async function () {
      try {
        var r = await fetch(DB + '/' + RANK_ROOT + '/feed.json?orderBy=' + encodeURIComponent('"$key"') + '&limitToLast=12');
        if (!r.ok) throw new Error('feed');
        var d = (await r.json()) || {};
        var fresh = [];
        Object.keys(d).sort().forEach(function (k) {
          if (feedSeen[k]) return;
          feedSeen[k] = 1;
          var x = d[k];
          if (x && x.n && x.e) fresh.push(x.n + '님이 ' + x.e + '에 당하셨습니다!');
        });
        (feedFirst ? fresh.slice(-3) : fresh).forEach(function (t) { feedQueue.push(t); });
        feedFirst = false;
      } catch (e) {}
    };
    window.startFeed = function () { window.pollFeed(); clearInterval(feedPoll); feedPoll = setInterval(window.pollFeed, 5000); };
    window.stopFeed = function () {};
    setInterval(function () {
      if (feedQueue.length && Date.now() >= nextFeedAt) {
        var text = feedQueue.shift();
        var el = document.createElement('span');
        el.className = 'feedItem';
        el.textContent = text;
        feedBar.appendChild(el);
        var w = el.offsetWidth, vw = document.documentElement.clientWidth;
        el.style.animationDuration = ((vw + w) / FEED_SPEED) + 's';
        nextFeedAt = Date.now() + ((w + 50) / FEED_SPEED) * 1000;
        el.addEventListener('animationend', function () { el.remove(); });
      }
    }, 500);
  });

  // ================= 확률표: 2억까에 1줄 =================
  safe('확률표', function () {
    var qt = g('questText');
    if (!qt.parentNode) return;
    var sp = {};
    ['escCount', 'refCount', 'cloneCount', 'rotCount', 'handCount', 'sleepCount', 'dumCount', 'fakeCount', 'nyanCount',
      'knifeCount', 'ufoCount', 'sweatCount', 'hoodCount', 'smartCount', 'bossCount', 'gunCount', 'newsCount', 'newsRate']
      .forEach(function (id) { sp[id] = g(id); });
    ['lightningCount', 'goldenCount'].forEach(function (id) {
      var s = document.createElement('span'); s.id = id; s.textContent = '0'; sp[id] = s;
    });
    function cell(label, id, tail) {
      var c = document.createElement('span'); c.className = 'qcell';
      c.appendChild(document.createTextNode(label + ' ')); c.appendChild(sp[id]); c.appendChild(document.createTextNode(tail));
      return c;
    }
    var newsCell = document.createElement('span'); newsCell.className = 'qcell';
    newsCell.appendChild(document.createTextNode('뉴스 ')); newsCell.appendChild(sp.newsCount);
    newsCell.appendChild(document.createTextNode('번 (현재 ')); newsCell.appendChild(sp.newsRate);
    newsCell.appendChild(document.createTextNode('%)'));
    var cells = [
      cell('화면 밖 탈출', 'escCount', '번 (1%)'), cell('점수 거절', 'refCount', '번 (2%)'),
      cell('분신술', 'cloneCount', '번 (5%)'), cell('화면 회전', 'rotCount', '번 (2.5%)'),
      cell('신의 손', 'handCount', '번 (3.5%)'), cell('졸음', 'sleepCount', '번 (3%)'),
      cell('버그', 'dumCount', '번 (1%)'), cell('가짜 총', 'fakeCount', '번 (0.5%)'),
      cell('냥캣', 'nyanCount', '번 (0.3%)'), cell('칼 고양이', 'knifeCount', '번 (0.3%)'),
      cell('UFO', 'ufoCount', '번 (0.12%)'), cell('당황', 'sweatCount', '번 (10초 방치)'),
      cell('후드냥', 'hoodCount', '번 (0.125%)'), cell('똑똑한 고양이', 'smartCount', '번 (0.4%)'),
      cell('번개', 'lightningCount', '번 (0.3%)'), cell('황금 고양이', 'goldenCount', '번 (1.2%)'),
      cell('보스', 'bossCount', '번 (0.1%)'), cell('총 든 고양이', 'gunCount', '번 (0.12%)'),
      newsCell
    ];
    while (qt.firstChild) qt.removeChild(qt.firstChild);
    for (var i = 0; i < cells.length; i += 2) {
      var row = document.createElement('div'); row.className = 'qrow';
      row.appendChild(cells[i]);
      if (cells[i + 1]) row.appendChild(cells[i + 1]);
      qt.appendChild(row);
    }
  });

  // ================= 좀비냥 삭제 =================
  safe('좀비냥 삭제', function () {
    window.startZombies = function () {};
    Array.from(devRight.children).forEach(function (r) { if (r.textContent.indexOf('좀비냥') >= 0) r.remove(); });
  });

  // ================= 사진 =================
  safe('사진', function () {
    resolveImg(vr('커피냥이-removebg-preview.png'), function (u) { coffeeSrc = u; });
    resolveImg(vr('번개맞은냥이-removebg-preview.png'), function (u) { zapSrc = u; });
    resolveImg(vr('터짐-removebg-preview.png'), function (u) { boomSrc = u; });
    resolveImg(vr('황금_고양이-removebg-preview.png'), function (u) { goldenSrc = u; renderShop(); });
    resolveImg(vr('응원냐이-removebg-preview.png'), function (u) { cheerSrc = u; renderShop(); });
  });

  function setFace(src, cls) {
    if (cls) cat.classList.add(cls);
    if (src && face.contains(img)) { img.src = src; cat.classList.add('color'); return true; }
    return false;
  }
  function catVisible() { return cat.style.display !== 'none' && cat.style.visibility !== 'hidden' && !escaped; }

  // ================= 번개 요소 / 응원냥 표시 붙이기 =================
  safe('번개 요소', function () { field.appendChild(bolt); field.appendChild(cheers); });

  // ================= 기절(스턴) 관리 =================
  function setStun(ms, freeze) {
    var now = Date.now();
    stunned = true;
    stunEnd = Math.max(stunEnd, now + ms);
    if (freeze) { stunFreeze = true; clearTimeout(moveTimer); }
    clearTimeout(stunTimer);
    stunTimer = setTimeout(endStun, stunEnd - now);
  }
  function endStun() {
    stunned = false; stunEnd = 0; coffeeActive = false;
    var fr = stunFreeze;
    stunFreeze = false;
    cat.classList.remove('hurt', 'zap', 'coffee', 'boom');
    if (!playing) return;
    if (fr) {
      var sz = tiny ? MIN_SIZE : 80;
      cat.style.width = sz + 'px'; cat.style.height = sz + 'px';
      clearTimeout(moveTimer);
      moveCat();
    } else if (!busy()) {
      baseFace();
    }
  }
  safe('기절 처리', function () {
    var origBusy = window.busy;
    window.busy = function () { return origBusy() || stunned; };
    window.hitCat = function (who) {
      if (!playing) return;
      cat.classList.add('hurt');
      bubble.textContent = who + '에게 맞았습니다!';
      setStun(HIT_STUN, false);
    };
    var origCheckSweat = window.checkSweat;
    window.checkSweat = function () { if (stunned) return; origCheckSweat(); };
  });

  // ================= 황금 고양이 / 응원냥 / 점수 처리 =================
  function startGolden() {
    if (goldenActive) return;
    goldenActive = true;
    goldenCount++; g('goldenCount').textContent = goldenCount;
    cat.classList.add('golden');
    if (!busy() && goldenSrc && face.contains(img)) img.src = goldenSrc;
    showToast('황금 고양이! ' + (GOLDEN_TIME / 1000) + '초간 누를 때마다 ' + GOLDEN_SCORE + '점');
    clearTimeout(goldenTimer);
    goldenTimer = setTimeout(endGolden, GOLDEN_TIME);
  }
  function endGolden() {
    goldenActive = false;
    clearTimeout(goldenTimer);
    cat.classList.remove('golden');
    if (playing && !busy()) baseFace();
  }
  function cheerBonus() {
    if (!own.cheer) return;
    cheerFrac += CHEER_PER * own.cheer;
    var n = Math.floor(cheerFrac);
    if (n > 0) { cheerFrac -= n; (rawAdd || addScore)(n); }
  }
  function renderCheers() {
    cheers.innerHTML = '';
    cheers.style.display = (playing && own.cheer > 0) ? 'flex' : 'none';
    for (var i = 0; i < own.cheer; i++) {
      if (cheerSrc) { var im = new Image(); im.src = cheerSrc; im.draggable = false; cheers.appendChild(im); }
      else { var s = document.createElement('span'); s.style.fontSize = '2rem'; s.textContent = '📣'; cheers.appendChild(s); }
    }
  }
  safe('황금 고양이 / 점수 처리', function () {
    var origBaseFace = window.baseFace;
    window.baseFace = function () {
      if (goldenActive && goldenSrc && face.contains(img)) { img.src = goldenSrc; return; }
      origBaseFace();
    };
    // 원래의 고양이 클릭 처리는 그대로 두고, 클릭으로 점수가 들어갈 때만 황금 고양이 / 응원냥 효과를 덧붙임
    field.addEventListener('pointerdown', function (e) {
      if (cat.contains(e.target)) { catching = true; setTimeout(function () { catching = false; }, 0); }
    }, true);
    rawAdd = window.addScore;
    window.addScore = function (d) {
      if (catching && d > 0 && d === (boostActive ? BOOST_MUL : 1)) {
        rawAdd(goldenActive ? Math.max(d, GOLDEN_SCORE) : d);
        cheerBonus();
        return;
      }
      rawAdd(d);
    };
  });

  // ================= 번개 =================
  function placeBolt(cx) {
    var fw = field.clientWidth;
    bolt.style.left = Math.max(0, Math.min(fw - 60, cx - 30)) + 'px';
  }
  function startLightning(rod) {
    if (lightningBusy) return;
    lightningBusy = true;
    lightningCount++; g('lightningCount').textContent = lightningCount;
    placeBolt(cat.offsetLeft + cat.offsetWidth / 2);
    bolt.className = 'warn';
    clearTimeout(lightningTimer);
    lightningTimer = setTimeout(function () { strike(rod); }, rod ? ROD_WARN : LIGHTNING_WARN);
  }
  function strike(rod) {
    if (!playing) { endBolt(); return; }
    if (rod) placeBolt(cat.offsetLeft + cat.offsetWidth / 2);   // 피뢰침: 지금 고양이 위치로 명중
    bolt.className = 'hit';
    field.classList.add('flashbg');
    setTimeout(function () { field.classList.remove('flashbg'); }, 140);
    var bx = bolt.offsetLeft + 30;
    var cx = cat.offsetLeft + cat.offsetWidth / 2;
    if (catVisible() && (rod || Math.abs(cx - bx) < cat.offsetWidth / 2 + 14)) lightningHit();
    lightningTimer = setTimeout(endBolt, 320);
  }
  function endBolt() {
    lightningBusy = false;
    clearTimeout(lightningTimer);
    bolt.className = '';
    field.classList.remove('flashbg');
  }
  function lightningHit() {
    if (coffeeActive) {                                    // 커피를 마시던 중 번개에 맞음
      coffeeActive = false;
      addScore(ZAP_COFFEE_SCORE);
      cat.classList.remove('coffee');
      setFace(zapSrc, 'zap');
      cat.style.width = '92px'; cat.style.height = '88px';
      bubble.textContent = '커피를 마시다 번개에 맞았습니다! +' + ZAP_COFFEE_SCORE;
      showToast('커피 마시던 티캣이 번개에 맞았습니다! +' + ZAP_COFFEE_SCORE + '점, ' + (ZAP_STUN / 1000) + '초 기절');
      setStun(ZAP_STUN, true);
    } else {
      addScore(LIGHTNING_SCORE);
      showToast('번개가 티캣에게 명중했습니다! +' + LIGHTNING_SCORE + '점');
      if (!stunned) {
        setFace(zapSrc, 'zap');
        bubble.textContent = '번개! +' + LIGHTNING_SCORE;
        clearTimeout(zapTimer);
        zapTimer = setTimeout(function () {
          cat.classList.remove('zap');
          if (playing && !busy()) baseFace();
        }, 900);
      }
    }
  }

  // ================= 커피 / 과산화나트륨 =================
  function drink() {
    clearTimeout(moveTimer);
    clearClones();
    if (escaped) { escaped = false; placeEl(cat); }
    cat.style.display = 'block';
    cat.classList.remove('hit', 'angry', 'golden');
    if (peroxideArmed) { explode(); return; }
    coffeeActive = true;
    setFace(coffeeSrc, 'coffee');
    cat.style.width = '112px'; cat.style.height = '80px';
    bubble.textContent = '커피를 마시는 중... (방심)';
    setStun(COFFEE_STUN, true);
  }
  function explode() {
    peroxideArmed = false; coffeeActive = false;
    addScore(BOOM_SCORE);
    setFace(boomSrc, 'boom');
    cat.style.width = '104px'; cat.style.height = '96px';
    bubble.textContent = '펑! 폭발했습니다. +' + BOOM_SCORE;
    showToast('과산화나트륨과 커피가 반응해 폭발했습니다! +' + BOOM_SCORE + '점, ' + (BOOM_STUN / 1000) + '초 기절');
    feedPost('폭발');
    renderShop();
    setStun(BOOM_STUN, true);
  }

  // ================= bust / gun / 리모컨 업그레이드 반영 =================
  function startBoost2() {
    var now = Date.now(), T = bt();
    if (boostActive) boostEnd += T; else { boostActive = true; boostEnd = now + T; }
    boostTotal = Math.max(T, boostEnd - now);
    boostEl.classList.add('on');
    field.classList.add('boosted');
    boostFill.style.transition = 'none';
    clearInterval(boostTick);
    boostTick = setInterval(updateBoostText, 100);
    updateBoostText();
