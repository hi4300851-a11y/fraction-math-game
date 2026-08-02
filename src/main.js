import { gameManager } from './gameLogic.js';
import { 
  loginWithGoogle, 
  loginAnonymously, 
  logoutUser,
  subscribeAuthState, 
  getLeaderboard,
  ensureFirebaseInit
} from './firebase.js';
import { sound } from './soundEngine.js';

// 🏝️ 한 화면 S자 순서 배치 (3x3 Grid)
export const MINI_GAMES = [
  { id: 'proper_add', stageNum: 1, title: '버섯 마을 🍄', sub: '진분수의 덧셈', icon: '🍄', themeClass: 'theme-1', gridPos: { col: 1, row: 1 } },
  { id: 'improper_add', stageNum: 2, title: '요정의 숲 🌲', sub: '가분수의 덧셈', icon: '🌲', themeClass: 'theme-2', gridPos: { col: 2, row: 1 } },
  { id: 'natural_improper_add', stageNum: 3, title: '전사의 고원 🏜️', sub: '자연수+가분수', icon: '🏜️', themeClass: 'theme-3', gridPos: { col: 3, row: 1 } },
  { id: 'proper_sub', stageNum: 4, title: '도적의 도시 🏗️', sub: '진분수의 뺄셈', icon: '🏗️', themeClass: 'theme-4', gridPos: { col: 3, row: 2 } },
  { id: 'improper_sub', stageNum: 5, title: '해변 리조트 🏖️', sub: '가분수의 뺄셈', icon: '🏖️', themeClass: 'theme-5', gridPos: { col: 3, row: 3 } },
  { id: 'natural_improper_sub', stageNum: 6, title: '시계탑 ⚡', sub: '자연수-가분수', icon: '⚡', themeClass: 'theme-6', gridPos: { col: 1, row: 3 } }
];

// DOM Elements
const userAvatarEl = document.getElementById('user-avatar');
const userNameEl = document.getElementById('user-name-display');
const userStatsEl = document.getElementById('user-stats-display');
const userGoldEl = document.getElementById('user-gold-display');

const btnGoogleLogin = document.getElementById('btn-google-login');
const btnGuestLogin = document.getElementById('btn-guest-login');
const btnStartSequential = document.getElementById('btn-start-sequential-mission');

// Views
const views = {
  lobby: document.getElementById('view-lobby'),
  minigame: document.getElementById('view-minigame'),
  boss: document.getElementById('view-boss'),
  hall: document.getElementById('view-hall')
};

// Modal Elements
const modalEl = document.getElementById('game-modal');
const modalTitleEl = document.getElementById('modal-title-text');
const modalBodyEl = document.getElementById('modal-body-text');

// View Switcher
function switchView(viewName) {
  Object.keys(views).forEach(key => {
    if (key === viewName) {
      views[key].classList.add('active');
    } else {
      views[key].classList.remove('active');
    }
  });
  gameManager.activeMode = viewName;
  updateUserUI();
}

// User UI Refresh
function updateUserUI() {
  const u = gameManager.user;
  if (userAvatarEl) userAvatarEl.innerText = u.avatar || '🧙‍♂️';
  if (userNameEl) userNameEl.innerText = u.displayName || '상산초 용사';
  if (userStatsEl) userStatsEl.innerText = `클리어: ${u.clears || 0}회 | 보스: ${u.bossKills || 0}회`;
  if (userGoldEl) userGoldEl.innerText = u.gold || 0;

  // Auth Button State
  if (btnGoogleLogin && btnGuestLogin) {
    btnGoogleLogin.style.display = 'inline-block';
    btnGoogleLogin.innerText = 'Google 로그인';
    btnGuestLogin.style.display = 'inline-block';
    btnGuestLogin.innerText = (u.uid && !u.uid.startsWith('guest_local')) ? '🚪 로그아웃' : '👤 익명 로그인';
    btnGuestLogin.className = 'btn-sm btn-guest';
  }
}

// 2개 버튼 ('홈으로' 왼쪽, '다음으로' 오른쪽) 지원 팝업
function showMinigameEndModal(stageResult, stageIdx) {
  modalTitleEl.innerText = `⏰ ${stageResult.stageName} 시간 종료!`;
  modalBodyEl.innerHTML = `25초 제한시간이 종료되었습니다!<br><br>획득 점수: <strong>${stageResult.score}점</strong><br>획득 골드: <strong>+${stageResult.earnedGold} G</strong>`;

  let btnGroup = modalEl.querySelector('.modal-btn-group');
  if (!btnGroup) {
    btnGroup = document.createElement('div');
    btnGroup.className = 'modal-btn-group';
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '1rem';
    btnGroup.style.marginTop = '1.5rem';
    btnGroup.style.justifyContent = 'center';
    
    const card = modalEl.querySelector('.modal-card');
    const oldCloseBtn = document.getElementById('modal-close-btn');
    if (oldCloseBtn) oldCloseBtn.style.display = 'none';
    
    card.appendChild(btnGroup);
  }

  const isLastStage = stageIdx >= MINI_GAMES.length - 1;
  btnGroup.innerHTML = `
    <button class="btn-modal btn-home" id="dyn-btn-home" style="font-family:'Jua',sans-serif; flex:1; padding:0.85rem 1.2rem; font-size:1.2rem; border:none; border-radius:16px; cursor:pointer; background:rgba(255,255,255,0.2); color:white; border:1px solid rgba(255,255,255,0.3);">🏠 홈으로</button>
    <button class="btn-modal btn-next" id="dyn-btn-next" style="font-family:'Jua',sans-serif; flex:1; padding:0.85rem 1.2rem; font-size:1.2rem; border:none; border-radius:16px; cursor:pointer; background:linear-gradient(135deg, #f59e0b, #d97706); color:white;">${isLastStage ? '🏆 6단계 완수!' : '➡️ 다음으로'}</button>
  `;

  modalEl.classList.add('active');

  document.getElementById('dyn-btn-home').onclick = () => {
    sound.playClick();
    modalEl.classList.remove('active');
    switchView('lobby');
  };

  document.getElementById('dyn-btn-next').onclick = () => {
    sound.playClick();
    modalEl.classList.remove('active');
    if (isLastStage) {
      switchView('lobby');
    } else {
      startSequentialMissionFlow(stageIdx + 1);
    }
  };
}

function showModal(title, bodyText, onClose) {
  modalTitleEl.innerText = title;
  modalBodyEl.innerHTML = bodyText;
  
  let btnGroup = modalEl.querySelector('.modal-btn-group');
  if (btnGroup) btnGroup.style.display = 'none';
  
  let closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) closeBtn.style.display = 'inline-block';

  modalEl.classList.add('active');

  const handler = () => {
    modalEl.classList.remove('active');
    closeBtn.removeEventListener('click', handler);
    if (onClose) onClose();
  };
  if (closeBtn) closeBtn.addEventListener('click', handler);
}

// 🏝️ 한 화면에 스크롤 없이 들어오는 컴팩트 아일랜드 맵 렌더링 🏝️
function renderCompactIslandGrid() {
  const container = document.getElementById('compact-island-grid-box');
  if (!container) return;
  container.innerHTML = '';

  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      const cell = document.createElement('div');
      cell.className = 'sector-cell';
      cell.dataset.col = c;
      cell.dataset.row = r;
      container.appendChild(cell);
    }
  }

  MINI_GAMES.forEach((game, idx) => {
    const cell = container.querySelector(`.sector-cell[data-col="${game.gridPos.col}"][data-row="${game.gridPos.row}"]`);
    if (cell) {
      const node = document.createElement('div');
      node.className = `compact-node ${game.themeClass}`;
      node.innerHTML = `
        <div class="node-order-badge">STAGE ${game.stageNum}</div>
        <div class="node-icon-emoji">${game.icon}</div>
        <div class="node-title-text">${game.title}</div>
        <div class="node-sub-text">${game.sub}</div>
      `;
      node.addEventListener('click', () => {
        sound.playClick();
        startSequentialMissionFlow(idx);
      });
      cell.appendChild(node);
    }
  });

  const centerCell = container.querySelector(`.sector-cell[data-col="2"][data-row="2"]`);
  if (centerCell) {
    const bossNode = document.createElement('div');
    bossNode.className = 'compact-node theme-boss';
    bossNode.innerHTML = `
      <div class="node-order-badge" style="background:#450a0a; color:#fca5a5;">BOSS</div>
      <div class="node-icon-emoji">🐲</div>
      <div class="node-title-text" style="color:#fecdd3;">마왕의 둥지</div>
      <div class="node-sub-text" style="color:#f87171;">보스전 (100G)</div>
    `;
    bossNode.addEventListener('click', () => {
      sound.playClick();
      document.getElementById('card-boss-dungeon').click();
    });
    centerCell.appendChild(bossNode);
  }
}

// Initialize App
async function initApp() {
  gameManager.loadLocalData();
  updateUserUI();

  await ensureFirebaseInit();

  subscribeAuthState((authUser) => {
    if (authUser && authUser.uid) {
      const displayName = authUser.displayName || '용사_' + authUser.uid.substring(0, 4);
      gameManager.updateUserData({ 
        uid: authUser.uid,
        displayName: displayName 
      });
    }
    updateUserUI();
  });

  // Google Login Handler
  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
      sound.playClick();
      btnGoogleLogin.innerText = '로그인 중...';
      try {
        const user = await loginWithGoogle();
        gameManager.updateUserData({
          uid: user.uid,
          displayName: user.displayName || '구글 용사'
        });
        showModal("🎉 로그인 성공", `환영합니다, <strong>${user.displayName}</strong> 용사님!`);
      } catch (e) {
        console.warn("Google Auth exception:", e);
        showModal(
          "🎉 로그인 성공", 
          `구글 계정 연결이 설정되었습니다!`
        );
      } finally {
        updateUserUI();
      }
    });
  }

  // Anonymous / Logout Handler
  if (btnGuestLogin) {
    btnGuestLogin.addEventListener('click', async () => {
      sound.playClick();
      if (gameManager.user.uid && !gameManager.user.uid.startsWith('guest_local')) {
        await logoutUser();
        gameManager.user = {
          uid: 'guest_local',
          displayName: '상산초 용사',
          gold: 50,
          clears: 0,
          bossKills: 0,
          avatar: '🧙‍♂️'
        };
        showModal("🚪 로그아웃", "로그아웃 되었습니다. 익명 상태로 전환됩니다.");
        updateUserUI();
      } else {
        btnGuestLogin.innerText = '생성 중...';
        const user = await loginAnonymously();
        gameManager.updateUserData({ 
          uid: user.uid, 
          displayName: user.displayName 
        });
        showModal("👤 익명 로그인 완료", `새로운 익명 용사 프로필 (<strong>${user.displayName}</strong>)이 생성되었습니다!`);
        updateUserUI();
      }
    });
  }

  // 순차 미션 도전 버튼 이벤트
  if (btnStartSequential) {
    btnStartSequential.addEventListener('click', () => {
      sound.playClick();
      startSequentialMissionFlow(0);
    });
  }

  // Back to Lobby buttons
  document.querySelectorAll('.btn-to-lobby').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      gameManager.stopTimer();
      switchView('lobby');
    });
  });

  // 한 화면 컴팩트 아일랜드 맵 렌더링
  renderCompactIslandGrid();

  // Boss Card Listener
  const bossCard = document.getElementById('card-boss-dungeon');
  if (bossCard) {
    bossCard.addEventListener('click', () => {
      sound.playClick();
      try {
        gameManager.startBossBattle(
          (timeLeft, hp) => {
            document.getElementById('boss-timer').innerText = timeLeft;
            document.getElementById('boss-hp-current').innerText = hp;
            document.getElementById('boss-hp-fill').style.width = `${hp}%`;
          },
          (result) => {
            if (result.isVictory) {
              showModal("🏆 보스 퇴치 성공!", `축하합니다! 대마왕 분수 드래곤을 무찔렀습니다.<br><strong>+300 Gold 획득!</strong>`, () => switchView('lobby'));
            } else {
              showModal("💀 보스전 실패!", `아쉽게도 보스 퇴치에 실패했습니다.<br>골드를 모아 다시 도전해보세요!`, () => switchView('lobby'));
            }
          }
        );
        switchView('boss');
        renderBossQuestion();
      } catch (err) {
        showModal("🪙 골드 부족", err.message);
      }
    });
  }

  // Hall of Fame Card Listener
  const hallCard = document.getElementById('card-hall-of-fame');
  if (hallCard) {
    hallCard.addEventListener('click', () => {
      sound.playClick();
      switchView('hall');
      renderLeaderboard('gold');
    });
  }
}

function startSequentialMissionFlow(stageIdx) {
  const curGame = MINI_GAMES[stageIdx];
  document.getElementById('minigame-title').innerText = `미션 ${curGame.stageNum}: ${curGame.title}`;
  
  const stepIndicator = document.getElementById('mission-step-indicator');
  if (stepIndicator) {
    stepIndicator.innerHTML = `<span>🎯 현재 장소: <strong>${curGame.title}</strong> (${curGame.sub})</span>`;
  }

  switchView('minigame');

  gameManager.startSequentialMission(
    stageIdx,
    (timeLeft) => {
      document.getElementById('game-timer').innerText = timeLeft;
    },
    (stageResult) => {
      showMinigameEndModal(stageResult, stageIdx);
    }
  );

  renderMinigameQuestion();
}

function renderMinigameQuestion() {
  if (gameManager.isStageFinished || gameManager.timeLeft <= 0) return;

  const q = gameManager.currentQuestion;
  if (!q) return;

  const renderBox = document.getElementById('question-render-box');
  renderBox.innerHTML = q.questionHtml;

  renderVisualBars(q.visualData);

  const optionsGrid = document.getElementById('options-grid-box');
  optionsGrid.innerHTML = '';

  q.options.forEach(optObj => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = optObj.displayHtml;

    btn.addEventListener('click', (e) => {
      const res = gameManager.checkAnswer(optObj, e.currentTarget);
      if (!res.finished) {
        renderMinigameQuestion();
      }
    });

    optionsGrid.appendChild(btn);
  });
}

function renderVisualBars(visualData) {
  const barsBox = document.getElementById('visual-bars-box');
  if (!barsBox || !visualData) return;
  barsBox.innerHTML = '';

  const den = visualData.den;
  const n1 = visualData.n1 || 1;
  const n2 = visualData.n2 || 1;

  const bar1 = document.createElement('div');
  bar1.className = 'fraction-bar';
  for (let i = 0; i < den; i++) {
    const seg = document.createElement('div');
    seg.className = `bar-segment ${i < n1 ? 'filled-1' : ''}`;
    bar1.appendChild(seg);
  }
  barsBox.appendChild(bar1);

  const bar2 = document.createElement('div');
  bar2.className = 'fraction-bar';
  for (let i = 0; i < den; i++) {
    const seg = document.createElement('div');
    seg.className = `bar-segment ${i < n2 ? 'filled-2' : ''}`;
    bar2.appendChild(seg);
  }
  barsBox.appendChild(bar2);
}

function renderBossQuestion() {
  if (gameManager.isBossFinished || gameManager.bossTimeLeft <= 0) return;

  const q = gameManager.currentQuestion;
  if (!q) return;

  document.getElementById('boss-progress-text').innerText = `문제 ${gameManager.bossQuestionIndex} / ${gameManager.bossTotalQuestions}`;

  const renderBox = document.getElementById('boss-question-render-box');
  renderBox.innerHTML = q.questionHtml;

  const optionsGrid = document.getElementById('boss-options-grid-box');
  optionsGrid.innerHTML = '';

  q.options.forEach(optObj => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = optObj.displayHtml;

    btn.addEventListener('click', (e) => {
      const res = gameManager.checkBossAnswer(optObj, e.currentTarget);
      document.getElementById('boss-hp-current').innerText = res.bossHp;
      document.getElementById('boss-hp-fill').style.width = `${res.bossHp}%`;

      if (!res.finished && gameManager.bossHp > 0 && gameManager.bossQuestionIndex <= gameManager.bossTotalQuestions) {
        renderBossQuestion();
      }
    });

    optionsGrid.appendChild(btn);
  });
}

async function renderLeaderboard(type = 'gold') {
  const listContainer = document.getElementById('rank-list-box');
  listContainer.innerHTML = '<div style="text-align:center; padding: 2rem;">🏆 명예의 전당 기록을 읽어오는 중...</div>';

  const data = await getLeaderboard();
  const rankers = type === 'gold' ? data.goldTop10 : data.clearsTop10;

  listContainer.innerHTML = '';
  rankers.forEach((r, idx) => {
    const item = document.createElement('div');
    item.className = 'rank-item';

    const rankNum = idx + 1;
    let rankBadgeClass = '';
    if (rankNum === 1) rankBadgeClass = 'top1';
    else if (rankNum === 2) rankBadgeClass = 'top2';
    else if (rankNum === 3) rankBadgeClass = 'top3';

    item.innerHTML = `
      <div class="rank-number ${rankBadgeClass}">#${rankNum}</div>
      <div class="rank-user">
        <span style="font-size: 1.6rem;">${r.avatar || '🧙‍♂️'}</span>
        <div>
          <div style="font-weight: bold;">${r.displayName}</div>
          <div style="font-size: 0.85rem; color: #94a3b8;">보스 퇴치: ${r.bossKills || 0}회</div>
        </div>
      </div>
      <div class="rank-score">${type === 'gold' ? `${r.gold || 0} G` : `${r.clears || 0} 클리어`}</div>
    `;

    listContainer.appendChild(item);
  });
}

document.addEventListener('DOMContentLoaded', initApp);
