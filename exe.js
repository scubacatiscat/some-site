/* exe.js - catch cat 추가 기능 (index.html 코드는 그대로 두고 이 파일이 덧붙여짐) */
(function () {
  const g = (id) => document.getElementById(id);

  // ================= 설정 (가격 / 확률은 여기서 바꿀 수 있음) =================
  const BOOST_STEPS = [5, 6, 7];                 // bust 지속 시간(초)
  const GUN_STEPS = [8, 9, 10];                  // gun 협박 점수
  const PIN_STEPS = [7500, 6500, 5000];          // pin 가격(pop)
  const REM_STEPS = [3, 4, 6];                   // 리모컨 한 판 사용 횟수
  const PER_STEPS = [5, 6, 8, 9, 10];            // 팝 캣 클릭당 pop (최대 레벨 이후)
  const UPMAX = { boost: 2, gun: 2, pin: 2, remote: 2, per: 4 };
  const TCOST = { boost: [60, 150], gun: [60, 150], pin: [80, 200], remote: [80, 200], per: [100, 250, 500, 1000] }; // 토큰 가격

  const LIGHTNING_CHANCE = 0.003;                // 번개 확률 0.3% (이동 1회당)
  const LIGHTNING_SCORE = 3;                     // 번개가 티캣에게 닿으면 +3점
  const LIGHTNING_WARN = 700;                    // 번개 경고 시간(ms)
  const ROD_WARN = 250;                          // 피뢰침 번개 시간(ms)
  const COFFEE_STUN = 2000;                      // 커피 기절(2초)
  const ZAP_COFFEE_SCORE = 5, ZAP_STUN = 4000;   // 커피 마시던 중 번개: +5점, 4초 기절
  const BOOM_SCORE = 5, BOOM_STUN = 4000;        // 과산화나트륨 + 커피 폭발: +5점, 4초 기절
  const GOLDEN_CHANCE = 0.012;                   // 황금 고양이 확률 1.2% (이동 1회당)
  const GOLDEN_TIME = 3000, GOLDEN_SCORE = 3;    // 3초 동안 클릭 시 3점
  const CLOCK_PER_GAME = 2;                      // 시계 한 판 사용 횟수
  const CHEER_PRICES = [6000, 14000];            // 응원냥 1마리째 / 2마리째 가격
  const CHEER_PER = 0.5;                         // 응원냥 한 마리당 클릭마다 추가 점수
  const FEED_SPEED = 90;                         // 억까 소식이 흐르는 속도(px/초)

  // pop 상점 가격 추가
  PRICES.rod = 600; PRICES.coffee = 100; PRICES.peroxide = 10000; PRICES.clock = 3000; PRICES.hint = 20000;

  // ================= 저장된 값 불러오기 =================
  ['rod', 'coffee', 'hint', 'cheer'].forEach((k) => { own[k] = 0; });
  own.peroxide = false; own.clock = false;
  try {
    const o = JSON.parse(localStorage.getItem('catOwn')) || {};
    ['rod', 'coffee', 'hint', 'cheer'].forEach((k) => { own[k] = Math.max(0, parseInt(o[k]) || 0); });
    own.peroxide = !!o.peroxide; own.clock = !!o.clock;
  } catch (e) {}
  own.cheer = Math.min(2, own.cheer);

  const up = { boost: 0, gun: 0, pin: 0, remote: 0, per: 0 };
  try {
    const o = JSON.parse(localStorage.getItem('catUp')) || {};
    Object.keys(up).forEach((k) => { up[k] = Math.min(UPMAX[k], Math.max(0, parseInt(o[k]) || 0)); });
  } catch (e) {}
  PRICES.pin = PIN_STEPS[up.pin];
  function saveUp() { try { localStorage.setItem('catUp', JSON.stringify(up)); } catch (e) {} }
  function getTok() { try { return parseInt(localStorage.getItem('catToken')) || 0; } catch (e) { return 0; } }
  function setTok(n) { try { localStorage.setItem('catToken', String(n)); } catch (e) {} }

  let hintSeen = [];
  try { hintSeen = JSON.parse(localStorage.getItem('catHintSeen')) || []; } catch (e) {}

  const bt = () => BOOST_STEPS[up.boost] * 1000;
  const gsc = () => GUN_STEPS[up.gun];
  const remLimit = () => REM_STEPS[up.remote];
  window.popPer = function () { return popLv >= POP_MAX_LV ? PER_STEPS[up.per] : popLv; };

  // ================= 추가 스타일 =================
  const st = document.createElement('style');
  st.textContent = `
  html body { padding-top:42px; }
  #feedBar { display:block; }
  #feedLabel { position:absolute; left:0; right:0; text-align:center; opacity:.55; font-size:.8rem; }
  .feedItem { position:absolute; top:0; left:0; white-space:nowrap; background:var(--card); padding:0 12px; font-weight:700;
    transform:translateX(-100%); animation:feedRun linear forwards; z-index:2; }
  @keyframes feedRun { from { transform:translateX(-100%); } to { transform:translateX(100vw); } }
  #quest { top:36px; }
  #idle { top:36px; }
  #idleSay { top:108px; }
  #questText .qrow { display:flex; gap:10px; }
  #questText .qcell { flex:1; white-space:nowrap; font-size:.8rem; }
  @media (min-width:641px) { #quest { width:340px; } }
  #cat.golden { filter:drop-shadow(0 0 10px #ffc107); }
  #cat.coffee #bubble, #cat.zap #bubble, #cat.boom #bubble { display:block; }
  #bolt { position:absolute; top:0; bottom:0; width:60px; display:none; z-index:9; pointer-events:none; }
  #bolt svg { width:100%; height:100%; display:block; }
  #bolt.warn { display:block; opacity:.28; }
  #bolt.hit { display:block; opacity:1; filter:drop-shadow(0 0 8px #fff) drop-shadow(0 0 14px #ffeb3b); }
  #field.flashbg { background:#fff8c4 !important; }
  #cheers { position:absolute; left:6px; bottom:6px; display:none; gap:4px; z-index:3; pointer-events:none; }
  #cheers img { width:46px; height:auto; display:block; animation:cheerbob .6s ease-in-out infinite alternate; }
  @keyframes cheerbob { from { transform:translateY(0); } to { transform:translateY(-6px); } }
  #hintBox { position:fixed; left:50%; top:40%; transform:translate(-50%,-50%); z-index:210; background:var(--bg); color:var(--fg);
    border:3px solid #8a4fff; padding:16px 22px; text-align:center; font-weight:800; display:none; max-width:90vw; cursor:pointer; }
  #hintBox b { font-size:1.6rem; font-family:monospace; display:block; margin:6px 0; background:#fff3b0; color:#111; padding:2px 10px; }
  .sitem .emoji { font-size:2rem; }
  #tokenShop { position:fixed; left:8px; bottom:8px; z-index:18; width:340px; max-height:calc(100vh - 96px); overflow:auto;
    background:var(--bg); border:3px solid #8a4fff; padding:8px; display:none; }
  #tokenShop.open { display:block; }
  .tkhead { display:flex; align-items:center; justify-content:space-between; gap:8px; font-weight:800; margin-bottom:4px; }
  .tkhint { font-size:.72rem; opacity:.75; margin-bottom:6px; }
  .tkrow { display:flex; align-items:center; gap:8px; background:var(--card); padding:6px; margin-bottom:6px; }
  .tkpic { width:46px; height:46px; flex:none; display:flex; align-items:center; justify-content:center; }
  .tkpic img { max-width:100%; max-height:100%; object-fit:contain; display:block; }
  .tkpic .emoji { font-size:1.8rem; }
  .tkinfo { flex:1; min-width:0; font-size:.78rem; font-weight:700; line-height:1.35; }
  .tkinfo .d { font-weight:600; opacity:.85; }
  .tkrow button { padding:6px 8px; font-size:.74rem; min-height:34px; }
  @media (min-width:901px) {
    #shop { display:grid; grid-template-columns:repeat(2,80px); gap:8px; max-height:calc(100vh - 100px); overflow-y:auto; align-content:start; }
    #devRight { top:74px !important; }
  }
  @media (max-width:900px) {
    body.dockOpen, body.tokOpen { padding-bottom:270px; }
    #dock { left:0; right:0; bottom:calc(60px + env(safe-area-inset-bottom)); background:var(--bg); border-top:3px solid #8a4fff;
      padding:6px; gap:6px; align-items:stretch; }
    #shop { display:flex; flex:1; min-width:0; overflow-x:auto; gap:6px; align-items:stretch; -webkit-overflow-scrolling:touch; }
    .sitem { flex:0 0 68px; width:68px; }
    .sitem .sname { font-size:.62rem; }
    #tokenShop { left:0; right:0; bottom:calc(60px + env(safe-area-inset-bottom)); width:auto; max-height:42vh; border-width:3px 0 0 0; }
  }
  @media (max-width:640px) {
    body.dockOpen #toast, body.tokOpen #toast { bottom:250px; }
    body.dockOpen #idle, body.tokOpen #idle, body.dockOpen #idleSay, body.tokOpen #idleSay { display:none !important; }
    h1 { font-size:1.3rem; margin:2px 0 4px; }
    .bar { gap:6px; font-size:.85rem; }
    .bar div { padding:4px 10px; }
    #feedBar { font-size:.75rem; }
    #questText .qcell { font-size:.68rem; }
    #questText { padding:6px 8px; }
    #news { margin-top:6px; }
    #newsPic { width:80px; }
  }`;
  document.head.appendChild(st);

  // ================= 억까 소식 띠: 모든 유저에게 보이고 왼쪽 → 오른쪽으로 흘러 사라짐 =================
  const feedBar = g('feedBar');
  feedBar.innerHTML = '<span id="feedLabel">억까 소식 대기 중...</span>';
  const feedSeen = {}; const feedQueue = []; let feedFirst = true; let nextFeedAt = 0;
  window.pollFeed = async function () {
    try {
      const r = await fetch(DB + '/' + RANK_ROOT + '/feed.json?orderBy=' + encodeURIComponent('"$key"') + '&limitToLast=12');
      if (!r.ok) throw new Error('feed');
      const d = (await r.json()) || {};
      const fresh = [];
      Object.keys(d).sort().forEach((k) => {
        if (feedSeen[k]) return;
        feedSeen[k] = 1;
        const x = d[k];
        if (x && x.n && x.e) fresh.push(x.n + '님이 ' + x.e + '에 당하셨습니다!');
      });
      (feedFirst ? fresh.slice(-3) : fresh).forEach((t) => feedQueue.push(t));
      feedFirst = false;
    } catch (e) {}
  };
  window.startFeed = function () { window.pollFeed(); clearInterval(feedPoll); feedPoll = setInterval(window.pollFeed, 5000); };
  window.stopFeed = function () {};
  function spawnFeed(text) {
    const el = document.createElement('span');
    el.className = 'feedItem';
    el.textContent = text;
    feedBar.appendChild(el);
    const w = el.offsetWidth, vw = document.documentElement.clientWidth;
    el.style.animationDuration = ((vw + w) / FEED_SPEED) + 's';
    nextFeedAt = Date.now() + ((w + 50) / FEED_SPEED) * 1000;
    el.addEventListener('animationend', () => { el.remove(); });
  }
  setInterval(() => { if (feedQueue.length && Date.now() >= nextFeedAt) spawnFeed(feedQueue.shift()); }, 500);

  // ================= 확률표: 2억까에 1줄 =================
  (function reorganizeQuest() {
    const qt = g('questText');
    const sp = {};
    ['escCount', 'refCount', 'cloneCount', 'rotCount', 'handCount', 'sleepCount', 'dumCount', 'fakeCount', 'nyanCount',
      'knifeCount', 'ufoCount', 'sweatCount', 'hoodCount', 'smartCount', 'bossCount', 'gunCount', 'newsCount', 'newsRate']
      .forEach((id) => { sp[id] = g(id); });
    ['lightningCount', 'goldenCount'].forEach((id) => {
      const s = document.createElement('span'); s.id = id; s.textContent = '0'; sp[id] = s;
    });
    function cell(label, id, tail) {
      const c = document.createElement('span'); c.className = 'qcell';
      c.appendChild(document.createTextNode(label + ' ')); c.appendChild(sp[id]); c.appendChild(document.createTextNode(tail));
      return c;
    }
    const newsCell = document.createElement('span'); newsCell.className = 'qcell';
    newsCell.appendChild(document.createTextNode('뉴스 ')); newsCell.appendChild(sp.newsCount);
    newsCell.appendChild(document.createTextNode('번 (현재 ')); newsCell.appendChild(sp.newsRate);
    newsCell.appendChild(document.createTextNode('%)'));
    const cells = [
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
    for (let i = 0; i < cells.length; i += 2) {
      const row = document.createElement('div'); row.className = 'qrow';
      row.appendChild(cells[i]);
      if (cells[i + 1]) row.appendChild(cells[i + 1]);
      qt.appendChild(row);
    }
  })();

  // ================= 좀비냥 삭제 =================
  window.startZombies = function () {};
  Array.from(devRight.children).forEach((r) => { if (r.textContent.indexOf('좀비냥') >= 0) r.remove(); });

  // ================= 사진 =================
  let coffeeSrc = null, zapSrc = null, boomSrc = null, goldenSrc = null, cheerSrc = null;
  resolveImg(vr('커피냥이-removebg-preview.png'), (u) => { coffeeSrc = u; });
  resolveImg(vr('번개맞은냥이-removebg-preview.png'), (u) => { zapSrc = u; });
  resolveImg(vr('터짐-removebg-preview.png'), (u) => { boomSrc = u; });
  resolveImg(vr('황금_고양이-removebg-preview.png'), (u) => { goldenSrc = u; renderShop(); });
  resolveImg(vr('응원냐이-removebg-preview.png'), (u) => { cheerSrc = u; renderShop(); });

  function setFace(src, cls) {
    if (cls) cat.classList.add(cls);
    if (src && face.contains(img)) { img.src = src; cat.classList.add('color'); return true; }
    return false;
  }

  // ================= 번개 요소 / 응원냥 표시 =================
  const bolt = document.createElement('div');
  bolt.id = 'bolt';
  bolt.innerHTML = '<svg viewBox="0 0 60 100" preserveAspectRatio="none"><polyline points="34,0 24,28 36,42 20,68 32,80 26,100" ' +
    'fill="none" stroke="#ffd600" stroke-width="6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  field.appendChild(bolt);
  const cheers = document.createElement('div');
  cheers.id = 'cheers';
  field.appendChild(cheers);

  // ================= 상태 =================
  let stunEnd = 0, stunFreeze = false, stunKind = null, coffeeActive = false, peroxideArmed = false;
  let lightningBusy = false, lightningTimer = null, zapTimer = null;
  let goldenActive = false, goldenTimer = null, cheerFrac = 0, clockUses = 0;
  let lightningCount = 0, goldenCount = 0;

  // ================= 기절(스턴) 관리 =================
  function setStun(ms, freeze, kind) {
    const now = Date.now();
    stunned = true;
    stunEnd = Math.max(stunEnd, now + ms);
    if (freeze) { stunFreeze = true; clearTimeout(moveTimer); }
    if (kind) stunKind = kind;
    clearTimeout(stunTimer);
    stunTimer = setTimeout(endStun, stunEnd - now);
  }
  function endStun() {
    stunned = false; stunEnd = 0; coffeeActive = false;
    const fr = stunFreeze;
    stunFreeze = false; stunKind = null;
    cat.classList.remove('hurt', 'zap', 'coffee', 'boom');
    if (!playing) return;
    if (fr) {
      const sz = tiny ? MIN_SIZE : 80;
      cat.style.width = sz + 'px'; cat.style.height = sz + 'px';
      clearTimeout(moveTimer);
      moveCat();
    } else if (!busy()) {
      baseFace();
    }
  }
  const origBusy = window.busy;
  window.busy = function () { return origBusy() || stunned; };
  window.hitCat = function (who) {
    if (!playing) return;
    cat.classList.add('hurt');
    bubble.textContent = who + '에게 맞았습니다!';
    setStun(HIT_STUN, false, 'hurt');
  };
  const origCheckSweat = window.checkSweat;
  window.checkSweat = function () { if (stunned) return; origCheckSweat(); };

  // ================= 황금 고양이 (1.2%, 3초 동안 클릭 시 3점) =================
  const origBaseFace = window.baseFace;
  window.baseFace = function () {
    if (goldenActive && goldenSrc && face.contains(img)) { img.src = goldenSrc; return; }
    origBaseFace();
  };
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
  function catchPts() { return Math.max(boostActive ? BOOST_MUL : 1, goldenActive ? GOLDEN_SCORE : 1); }

  // ================= 응원냥: 클릭마다 0.5점 (모아서 정수로) =================
  function cheerBonus() {
    if (!own.cheer) return;
    cheerFrac += CHEER_PER * own.cheer;
    const n = Math.floor(cheerFrac);
    if (n > 0) { cheerFrac -= n; addScore(n); }
  }
  function renderCheers() {
    cheers.innerHTML = '';
    cheers.style.display = (playing && own.cheer > 0) ? 'flex' : 'none';
    for (let i = 0; i < own.cheer; i++) {
      if (cheerSrc) { const im = new Image(); im.src = cheerSrc; im.draggable = false; cheers.appendChild(im); }
      else { const s = document.createElement('span'); s.style.fontSize = '2rem'; s.textContent = '📣'; cheers.appendChild(s); }
    }
  }

  // ================= 클릭 처리 (기존 catchCat에 기절 / 황금 / 응원냥을 반영) =================
  window.catchCat = function (e) {
    if (!playing) return;
    e.preventDefault();
    lastTap = Date.now();
    if (bossActive) { hitBoss(); return; }
    if (stunned) return;
    if (botPhase === 'calc') return;
    if (hoodActive) { hoodClick(); return; }
    if (refusing || held) return;
    if (dumPhase === 'still' || pinActive) {
      addScore(catchPts()); cheerBonus();
      cat.classList.add('hit');
      setTimeout(() => { cat.classList.remove('hit'); }, 80);
      return;
    }
    clearTimeout(moveTimer);
    if (cakeMode) {
      cakeMode = false; cakeEl.textContent = '';
      addScore(CAKE_SCORE);
      bubble.textContent = '케이크 감사합니다. +' + CAKE_SCORE;
      moveTimer = setTimeout(moveCat, 900);
      return;
    }
    if (sweatMode) {
      sweatMode = false; clearTimeout(sweatStayTimer);
      addScore(SWEAT_SCORE);
      bubble.textContent = '감사합니다. +' + SWEAT_SCORE;
      moveTimer = setTimeout(moveCat, 900);
      return;
    }
    if (sleeping) {
      sleeping = false; refusing = true;
      addScore(-SLEEP_PENALTY);
      bubble.textContent = '깨우지 마십시오. -' + SLEEP_PENALTY;
      cat.classList.add('angry');
      showAngryFace(true);
      moveTimer = setTimeout(moveCat, WAKE_ANGRY_TIME);
      return;
    }
    if (Math.random() < refuseChance) { refuseCat(); return; }
    if (smartActive) { givePop(SMART_POP); say('pop +' + SMART_POP, 450); }
    else { addScore(catchPts()); cheerBonus(); }
    escaped = false; clearClones();
    cat.classList.add('hit');
    reshapeCat();
    moveTimer = setTimeout(moveCat, 120);
  };
  // 고양이를 누르는 동작은 기존 코드가 함수를 직접 연결해 두었으므로, 먼저 가로채서 위 함수로 보냄
  field.addEventListener('pointerdown', function (e) {
    if (cat.contains(e.target)) { e.stopPropagation(); window.catchCat(e); }
  }, true);

  // ================= 번개 =================
  function placeBolt(cx) {
    const fw = field.clientWidth;
    bolt.style.left = Math.max(0, Math.min(fw - 60, cx - 30)) + 'px';
  }
  function catVisible() { return cat.style.display !== 'none' && cat.style.visibility !== 'hidden' && !escaped; }
  function startLightning(rod) {
    if (lightningBusy) return;
    lightningBusy = true;
    lightningCount++; g('lightningCount').textContent = lightningCount;
    placeBolt(cat.offsetLeft + cat.offsetWidth / 2);
    bolt.className = 'warn';
    clearTimeout(lightningTimer);
    lightningTimer = setTimeout(() => { strike(rod); }, rod ? ROD_WARN : LIGHTNING_WARN);
  }
  function strike(rod) {
    if (!playing) { endBolt(); return; }
    if (rod) placeBolt(cat.offsetLeft + cat.offsetWidth / 2);   // 피뢰침: 지금 고양이 위치로 명중
    bolt.className = 'hit';
    field.classList.add('flashbg');
    setTimeout(() => { field.classList.remove('flashbg'); }, 140);
    const bx = bolt.offsetLeft + 30;
    const cx = cat.offsetLeft + cat.offsetWidth / 2;
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
      setStun(ZAP_STUN, true, 'zap');
    } else {
      addScore(LIGHTNING_SCORE);
      showToast('번개가 티캣에게 명중했습니다! +' + LIGHTNING_SCORE + '점');
      if (!stunned) {
        setFace(zapSrc, 'zap');
        bubble.textContent = '번개! +' + LIGHTNING_SCORE;
        clearTimeout(zapTimer);
        zapTimer = setTimeout(() => {
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
    setStun(COFFEE_STUN, true, 'coffee');
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
    setStun(BOOM_STUN, true, 'boom');
  }

  // ================= 사용 버튼들 =================
  function useBust2() {
    if (!playing) { showToast('bust는 게임 중에만 사용할 수 있습니다.'); return; }
    if (own.bust <= 0) { showToast('보유한 bust가 없습니다. 상점에서 구매하십시오.'); return; }
    if (boostUses >= BOOST_MAX_USES) { showToast('bust는 한 판에 ' + BOOST_MAX_USES + '번까지만 사용할 수 있습니다.'); return; }
    own.bust--; boostUses++; saveOwn(); renderShop();
    window.startBoost();
    showToast('bust ' + boostUses + '/' + BOOST_MAX_USES + ': ' + (bt() / 1000) + '초가 더해졌습니다.');
  }
  window.startBoost = function () {
    const now = Date.now(), T = bt();
    if (boostActive) boostEnd += T; else { boostActive = true; boostEnd = now + T; }
    boostTotal = Math.max(T, boostEnd - now);
    boostEl.classList.add('on');
    field.classList.add('boosted');
    boostFill.style.transition = 'none';
    clearInterval(boostTick);
    boostTick = setInterval(updateBoostText, 100);
    updateBoostText();
    clearTimeout(boostTimer);
    boostTimer = setTimeout(stopBoost, boostEnd - now);
  };
  window.threatCat = function () {
    clearTimeout(moveTimer);
    clearClones();
    escaped = false; refusing = false; sleeping = false; cakeMode = false; sweatMode = false;
    held = true;
    cat.classList.remove('hit', 'angry', 'held', 'cake', 'gun', 'boss', 'sweat');
    showAngryFace(false);
    cakeEl.textContent = '';
    placeEl(cat);
    cat.style.display = 'block';
    cat.classList.add('threat', 'color');
    addScore(gsc());
    bubble.textContent = '살려 주십시오. +' + gsc();
    moveTimer = setTimeout(moveCat, THREAT_TIME);
  };
  function useRemote2() {
    if (!playing) { showToast('리모컨은 게임 중에만 사용할 수 있습니다.'); return; }
    if (!own.remote) { showToast('리모컨을 먼저 구매해야 합니다.'); return; }
    if (remoteUses >= remLimit()) { showToast('리모컨은 한 판에 ' + remLimit() + '번까지만 사용할 수 있습니다.'); return; }
    remoteUses++; renderShop(); showNews(null, true);
  }
  function useRod() {
    if (!playing) { showToast('피뢰침은 게임 중에만 사용할 수 있습니다.'); return; }
    if (own.rod <= 0) { showToast('보유한 피뢰침이 없습니다. pop 상점에서 구매하십시오.'); return; }
    if (!catVisible()) { showToast('지금은 티캣이 보이지 않아 사용할 수 없습니다.'); return; }
    if (lightningBusy) { showToast('번개가 이미 내리는 중입니다.'); return; }
    own.rod--; saveOwn(); renderShop();
    startLightning(true);
  }
  function useCoffee() {
    if (!playing) { showToast('커피는 게임 중에만 사용할 수 있습니다.'); return; }
    if (own.coffee <= 0) { showToast('보유한 커피가 없습니다. pop 상점에서 구매하십시오.'); return; }
    if (!catVisible() || busy()) { showToast('지금은 사용할 수 없습니다. 잠시 후 다시 시도하십시오.'); return; }
    own.coffee--; saveOwn(); renderShop();
    drink();
  }
  function usePeroxide() {
    if (!own.peroxide) { showToast('과산화나트륨을 먼저 구매해야 합니다.'); return; }
    if (!playing) { showToast('과산화나트륨은 게임 중에만 사용할 수 있습니다.'); return; }
    peroxideArmed = true;
    renderShop();
    showToast('아무 일도 일어나지 않았습니다.');
  }
  const CLOCK_BUFFS = [
    ['점수 +5', () => { addScore(5); }],
    ['제한 시간 +3초', () => { if (unlimited) addScore(3); else { time += 3; showTime(); } }],
    ['6초간 고양이가 느려집니다', () => { timed('slow', () => { speedMul = 2.5; }, () => { speedMul = 1; }, 6000); }],
    ['황금 고양이', () => { startGolden(); }],
    ['억까 효과 해제 +2점', () => { resetEffects(); dumFast = false; botFast = false; addScore(2); }]
  ];
  function useClock() {
    if (!own.clock) { showToast('시계를 먼저 구매해야 합니다.'); return; }
    if (!playing) { showToast('시계는 게임 중에만 사용할 수 있습니다.'); return; }
    if (clockUses >= CLOCK_PER_GAME) { showToast('시계는 한 판에 ' + CLOCK_PER_GAME + '번까지만 사용할 수 있습니다.'); return; }
    clockUses++; renderShop();
    const b = CLOCK_BUFFS[Math.floor(Math.random() * CLOCK_BUFFS.length)];
    showToast('시계(' + clockUses + '/' + CLOCK_PER_GAME + '): ' + b[0]);
    b[1]();
  }

  // 코드 힌트권: 처음에는 반드시 exe.shop
  const HINT_POOL = ['catgle', 'popcat', 'code', 'tree', 'gold2s', 'catke', 'dog', '모아이', 'bot cat', 'x', 'no_over', 'super pop'];
  const hintBox = document.createElement('div');
  hintBox.id = 'hintBox';
  document.body.appendChild(hintBox);
  let hintTimer = null;
  hintBox.addEventListener('click', () => { hintBox.style.display = 'none'; });
  function showHint(code) {
    hintBox.innerHTML = '코드 힌트<b></b>코드창에 입력해 보십시오. (누르면 닫힙니다)';
    hintBox.querySelector('b').textContent = code;
    hintBox.style.display = 'block';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hintBox.style.display = 'none'; }, 9000);
  }
  function useHint() {
    if (own.hint <= 0) { showToast('보유한 힌트권이 없습니다. pop 상점에서 구매하십시오.'); return; }
    let code = null;
    if (hintSeen.indexOf('exe.shop') < 0) code = 'exe.shop';
    else {
      const left = HINT_POOL.filter((c) => hintSeen.indexOf(c) < 0);
      if (!left.length) { showToast('더 알려 줄 코드가 없습니다.'); return; }
      code = left[Math.floor(Math.random() * left.length)];
    }
    own.hint--; hintSeen.push(code);
    try { localStorage.setItem('catHintSeen', JSON.stringify(hintSeen)); } catch (e) {}
    saveOwn(); renderShop();
    showHint(code);
  }

  // ================= pop 상점: 새 아이템 =================
  const shopEl = g('shop');
  const refs = {};
  function addItem(id, imgs, emoji, buyFn, useFn) {
    const d = document.createElement('div'); d.className = 'sitem';
    const price = document.createElement('div'); price.className = 'price';
    const pic = document.createElement('div'); pic.className = 'spic';
    const name = document.createElement('div'); name.className = 'sname';
    const acts = document.createElement('div'); acts.className = 'sacts';
    if (imgs && imgs.length) {
      const im = new Image();
      loadFirst(im, imgs, () => { pic.innerHTML = '<span class="emoji">' + emoji + '</span>'; });
      pic.appendChild(im);
    } else { pic.innerHTML = '<span class="emoji">' + emoji + '</span>'; }
    const b = document.createElement('button'); b.textContent = '구매'; b.addEventListener('click', buyFn); acts.appendChild(b);
    let u = null;
    if (useFn) { u = document.createElement('button'); u.textContent = '사용'; u.addEventListener('click', useFn); acts.appendChild(u); }
    d.appendChild(price); d.appendChild(pic); d.appendChild(name); d.appendChild(acts);
    shopEl.appendChild(d);
    refs[id] = { price: price, name: name, buy: b, use: u };
  }
  addItem('rod', vr('피뢰침-removebg-preview.png'), '⚡', () => { buyItem('rod'); }, useRod);
  addItem('coffee', vr('커피-removebg-preview.png'), '☕', () => { buyItem('coffee'); }, useCoffee);
  addItem('peroxide', vr('과산화나트륨-removebg-preview.png'), '🧪', () => { buyItem('peroxide'); }, usePeroxide);
  addItem('clock', vr('흘러내리는시계-removebg-preview.png'), '🕰️', () => { buyItem('clock'); }, useClock);
  addItem('cheer', vr('응원냐이-removebg-preview.png'), '📣', () => { buyItem('cheer'); }, null);
  addItem('hint', null, '🎫', () => { buyItem('hint'); }, useHint);

  const ITEM_NAMES = { bust: 'bust', gun: 'gun', pin: 'pin', remote: '리모컨', rod: '피뢰침', coffee: '커피',
    peroxide: '과산화나트륨', clock: '시계', cheer: '응원냥', hint: '코드 힌트권' };
  window.buyItem = function (id) {
    if (id === 'gun' && own.gun) { showToast('gun은 이미 보유 중입니다.'); return; }
    if (id === 'remote' && own.remote) { showToast('리모컨은 이미 보유 중입니다.'); return; }
    if (id === 'peroxide' && own.peroxide) { showToast('과산화나트륨은 이미 보유 중입니다.'); return; }
    if (id === 'clock' && own.clock) { showToast('시계는 이미 보유 중입니다.'); return; }
    let price;
    if (id === 'cheer') {
      if (own.cheer >= 2) { showToast('응원냥은 최대 2마리까지입니다.'); return; }
      price = CHEER_PRICES[own.cheer];
    } else price = PRICES[id];
    if (popCount < price) {
      showToast('pop이 부족합니다. (필요 ' + price.toLocaleString() + ' / 보유 ' + popCount.toLocaleString() + ')');
      return;
    }
    popCount -= price;
    if (id === 'gun') own.gun = true;
    else if (id === 'remote') own.remote = true;
    else if (id === 'peroxide') own.peroxide = true;
    else if (id === 'clock') own.clock = true;
    else own[id] = (own[id] || 0) + 1;
    savePop(); saveOwn(); renderShop();
    showToast(ITEM_NAMES[id] + ' 구매가 완료되었습니다.');
  };

  window.renderShop = function () {
    popCountEl.textContent = popCount;
    popLvTxt.textContent = (popLv >= POP_MAX_LV ? 'MAX ' : '') + 'Lv ' + popLv + ' · 클릭당 +' + popPer();
    if (popLv >= POP_MAX_LV) { upPopBtn.textContent = 'MAX'; upPopBtn.disabled = true; }
    else { upPopBtn.textContent = 'UP ' + POP_UP_COST[popLv - 1].toLocaleString() + 'pop'; upPopBtn.disabled = false; }
    bustOwnEl.textContent = '×' + own.bust;
    gunOwnEl.textContent = own.gun ? '보유' : '';
    buyGunBtn.textContent = own.gun ? '보유중' : '구매'; buyGunBtn.disabled = own.gun;
    useGunBtn.textContent = (playing && gunUsed) ? '사용됨' : '사용';
    pinOwnEl.textContent = '×' + own.pin;
    g('pricePin').textContent = PRICES.pin.toLocaleString() + 'pop';
    remoteOwnEl.textContent = own.remote ? (Math.max(0, remLimit() - remoteUses) + '/' + remLimit()) : '';
    buyRemoteBtn.textContent = own.remote ? '보유중' : '구매'; buyRemoteBtn.disabled = own.remote;
    // 새 아이템
    refs.rod.price.textContent = '600pop'; refs.rod.name.textContent = '피뢰침 ×' + own.rod;
    refs.coffee.price.textContent = '100pop'; refs.coffee.name.textContent = '커피 ×' + own.coffee;
    refs.peroxide.price.textContent = '10,000pop'; refs.peroxide.name.textContent = own.peroxide ? '과산화나트륨 (보유)' : '과산화나트륨';
    refs.peroxide.buy.textContent = own.peroxide ? '보유중' : '구매'; refs.peroxide.buy.disabled = own.peroxide;
    refs.peroxide.use.textContent = peroxideArmed ? '사용됨' : '사용';
    refs.clock.price.textContent = '3,000pop'; refs.clock.name.textContent = own.clock ? ('시계 ' + Math.max(0, CLOCK_PER_GAME - clockUses) + '/' + CLOCK_PER_GAME) : '시계';
    refs.clock.buy.textContent = own.clock ? '보유중' : '구매'; refs.clock.buy.disabled = own.clock;
    refs.cheer.price.textContent = own.cheer >= 2 ? 'MAX' : CHEER_PRICES[own.cheer].toLocaleString() + 'pop';
    refs.cheer.name.textContent = '응원냥 ' + own.cheer + '/2';
    refs.cheer.buy.textContent = own.cheer >= 2 ? 'MAX' : '구매'; refs.cheer.buy.disabled = own.cheer >= 2;
    refs.hint.price.textContent = '20,000pop'; refs.hint.name.textContent = '힌트권 ×' + own.hint;
    renderCheers();
    renderToken();
  };

  // ================= 토큰 샵 (exe.shop) =================
  const tokenShop = document.createElement('div');
  tokenShop.id = 'tokenShop';
  tokenShop.innerHTML = '<div class="tkhead"><b>TOKEN SHOP</b><span>🪙 <b id="tkCount">0</b></span>' +
    '<button id="tkClose" class="sub small">닫기</button></div>' +
    '<div class="tkhint">토큰은 랭킹 페이지의 캣피디아(+ 버튼)에서 모을 수 있습니다.</div><div id="tkList"></div>';
  document.body.appendChild(tokenShop);

  const UPDEFS = [
    { k: 'boost', name: 'bust 지속 시간', imgs: BUST_IMGS, emoji: '🥫', steps: BOOST_STEPS, fmt: (v) => v + '초' },
    { k: 'gun', name: 'gun 협박 점수', imgs: GUNITEM_IMGS, emoji: '🔫', steps: GUN_STEPS, fmt: (v) => v + '점' },
    { k: 'pin', name: 'pin 가격', imgs: PIN_IMGS, emoji: '📌', steps: PIN_STEPS, fmt: (v) => v.toLocaleString() + 'pop' },
    { k: 'remote', name: '리모컨 사용 횟수 (한 판)', imgs: REMOTE_IMGS, emoji: '📺', steps: REM_STEPS, fmt: (v) => v + '번' },
    { k: 'per', name: '팝 캣 클릭당 pop', imgs: [POP_CLOSED_IMG], emoji: '😺', steps: PER_STEPS, fmt: (v) => '+' + v }
  ];
  const tkRows = {};
  UPDEFS.forEach((d) => {
    const row = document.createElement('div'); row.className = 'tkrow';
    const pic = document.createElement('div'); pic.className = 'tkpic';
    const im = new Image();
    loadFirst(im, d.imgs, () => { pic.innerHTML = '<span class="emoji">' + d.emoji + '</span>'; });
    pic.appendChild(im);
    const info = document.createElement('div'); info.className = 'tkinfo';
    const nm = document.createElement('div');
    const ds = document.createElement('div'); ds.className = 'd';
    info.appendChild(nm); info.appendChild(ds);
    const b = document.createElement('button');
    b.addEventListener('click', () => { upgrade(d.k); });
    row.appendChild(pic); row.appendChild(info); row.appendChild(b);
    g('tkList').appendChild(row);
    tkRows[d.k] = { nm: nm, ds: ds, btn: b };
  });
  function renderToken() {
    g('tkCount').textContent = getTok().toLocaleString();
    UPDEFS.forEach((d) => {
      const r = tkRows[d.k], lv = up[d.k], max = UPMAX[d.k];
      r.nm.textContent = d.name + '  Lv ' + lv + '/' + max;
      if (lv >= max) { r.ds.textContent = 'MAX · ' + d.fmt(d.steps[lv]); r.btn.textContent = 'MAX'; r.btn.disabled = true; }
      else {
        r.ds.textContent = d.fmt(d.steps[lv]) + ' → ' + d.fmt(d.steps[lv + 1]);
        r.btn.disabled = false;
        r.btn.textContent = (d.k === 'per' && popLv < POP_MAX_LV) ? '팝 캣 Lv5 필요' : (TCOST[d.k][lv] + ' 🪙');
      }
    });
  }
  function upgrade(k) {
    const lv = up[k];
    if (lv >= UPMAX[k]) { showToast('이미 최대 레벨입니다.'); return; }
    if (k === 'per' && popLv < POP_MAX_LV) { showToast('팝 캣을 pop으로 최대 레벨(Lv ' + POP_MAX_LV + ')까지 올려야 합니다.'); return; }
    const cost = TCOST[k][lv], have = getTok();
    if (have < cost) { showToast('토큰이 부족합니다. (필요 ' + cost + ' / 보유 ' + have + ')'); return; }
    setTok(have - cost);
    up[k]++;
    saveUp();
    if (k === 'pin') PRICES.pin = PIN_STEPS[up.pin];
    renderShop();
    showToast('업그레이드 완료!');
  }
  function openToken(on) {
    tokenShop.classList.toggle('open', on);
    document.body.classList.toggle('tokOpen', on);
    if (on) {
      dock.classList.remove('open');
      document.body.classList.remove('dockOpen');
      renderToken();
    }
  }
  function toggleToken() {
    const on = !tokenShop.classList.contains('open');
    openToken(on);
    showToast(on ? '토큰 샵이 나타났습니다.' : '토큰 샵이 사라졌습니다.');
  }
  g('tkClose').addEventListener('click', () => { openToken(false); });
  const origTogglePop = window.togglePop;
  window.togglePop = function () {
    if (tokenShop.classList.contains('open')) openToken(false);
    origTogglePop();
  };

  // ================= 코드창: exe.shop 추가 =================
  CODE_DEFS.push(['exeshop', 'exe.shop', '토큰 샵 (업그레이드)']);
  const origCodeId = window.codeId;
  window.codeId = function (v) { return v === 'exe.shop' ? 'exeshop' : origCodeId(v); };
  const origRun = window.runCode;
  window.runCode = function (v) {
    if (v === 'exe.shop') { toggleToken(); return; }
    const v2 = v.replace(/\s+/g, '');
    if ((v === 'catke' || v2 === 'botcat' || v2 === 'x') && stunned) {
      showToast('티캣이 기절해 있어 지금은 사용할 수 없습니다.');
      return;
    }
    origRun(v);
  };

  // ================= 기존 버튼을 새 함수로 연결 (기존 코드가 함수를 직접 연결해 둔 것들) =================
  document.addEventListener('click', function (e) {
    const id = e.target && e.target.id;
    if (id === 'useBust') { e.stopPropagation(); useBust2(); }
    else if (id === 'useRemote') { e.stopPropagation(); useRemote2(); }
    else if (id === 'useGun' && stunned) { e.stopPropagation(); showToast('티캣이 기절해 있어 지금은 사용할 수 없습니다.'); }
  }, true);

  // ================= 이동 시 번개 / 황금 고양이 확률 굴림 =================
  const origMove = window.moveCat;
  window.moveCat = function () {
    if (!playing) return;
    if (!goldenActive && Math.random() < GOLDEN_CHANCE) startGolden();
    if (!lightningBusy && !escaped && Math.random() < LIGHTNING_CHANCE) startLightning(false);
    origMove();
  };

  // ================= 정리 / 판 시작 초기화 =================
  const origClear = window.clearExtras;
  window.clearExtras = function () {
    origClear();
    stunEnd = 0; stunFreeze = false; stunKind = null; coffeeActive = false;
    clearTimeout(zapTimer);
    endBolt();
    goldenActive = false; clearTimeout(goldenTimer);
    cat.classList.remove('zap', 'coffee', 'boom', 'golden');
  };
  const origStart = window.startGame;
  window.startGame = function () {
    if (!playing) {
      clockUses = 0; peroxideArmed = false; cheerFrac = 0; lightningCount = 0; goldenCount = 0;
      g('lightningCount').textContent = 0; g('goldenCount').textContent = 0;
    }
    origStart();
  };

  // ================= 개발자 패널에 새 이벤트 버튼 추가 =================
  [['번개 내리기', () => { startLightning(false); }, false], ['황금 고양이', () => { startGolden(); }, false]].forEach((a) => {
    const row = document.createElement('div'); row.className = 'drow';
    const sp = document.createElement('span'); sp.textContent = a[0];
    const b = document.createElement('button'); b.textContent = '실행';
    b.addEventListener('click', () => { devRun(a[1], a[2]); });
    row.appendChild(sp); row.appendChild(b);
    devRight.appendChild(row);
  });

  // ================= 시작 =================
  renderShop();
  window.startFeed();
})();
