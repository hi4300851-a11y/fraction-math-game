import { gameManager, MINI_GAMES } from './gameLogic.js';
import { 
  loginWithGoogle, 
  loginAnonymously, 
  logoutUser,
  subscribeAuthState, 
  getLeaderboard,
  ensureFirebaseInit
} from './firebase.js';
import { sound } from './soundEngine.js';

// DOM Elements
const userAvatarEl = document.getElementById('user-avatar');
const userNameEl = document.getElementById('user-name-display');
const userStatsEl = document.getElementById('user-stats-display');
const userGoldEl = document.getElementById('user-gold-display');

const btnGoogleLogin = document.getElementById('btn-google-login');
const btnGuestLogin = document.getElementById('btn-guest-login');

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
const modalCloseBtn = document.getElementById('modal-close-btn');

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
  userAvatarEl.innerText = u.avatar || '🧙‍♂️';
  userNameEl.innerText = u.displayName || '분수 용사';
  userStatsEl.innerText = `클리어: ${u.clears || 0}회 | 보스: ${u.bossKills || 0}회`;
  userGoldEl.innerText = u.gold || 0;

  // Auth Button State
  if (u.uid && !u.uid.startsWith('guest_local')) {
    btnGoogleLogin.style.display = 'none';
    btnGuestLogin.innerText = '🚪 로그아웃';
    btnGuestLogin.className = 'btn-sm btn-guest';
  } else {
    btnGoogleLogin.style.display = 'inline-block';
    btnGoogleLogin.innerText = 'Google 로그인';
    btnGuestLogin.innerText = '👤 익명 로그인';
    btnGuestLogin.className = 'btn-sm btn-guest';
  }
}

// Modal Utility
function showModal(title, bodyText, onClose) {
  modalTitleEl.innerText = title;
  modalBodyEl.innerHTML = bodyText;
  modalEl.classList.add('active');

  const handler = () => {
    modalEl.classList.remove('active');
    modalCloseBtn.removeEventListener('click', handler);
    if (onClose) onClose();
  };
  modalCloseBtn.addEventListener('click', handler);
}

// Initialize App
async function initApp() {
  gameManager.loadLocalData();
  updateUserUI();

  // Async Firebase Initializer
  await ensureFirebaseInit();

  // Auth Subscription
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

  // 1. Google Login Handler
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
        "ℹ️ 구글 로그인 안내", 
        `현재 Firebase API 키가 아직 설정되지 않아 로컬 익명 모드로 작동합니다.<br><br>‘익명 로그인’을 클릭하시면 언제든 게임 기록이 즉시 저장됩니다!`
      );
    } finally {
      updateUserUI();
    }
  });

  // 2. Anonymous / Logout Handler
  btnGuestLogin.addEventListener('click', async () => {
    sound.playClick();
    if (gameManager.user.uid && !gameManager.user.uid.startsWith('guest_local')) {
      // Logout
      await logoutUser();
      gameManager.user = {
        uid: 'guest_local',
        displayName: '분수 용사',
        gold: 50,
        clears: 0,
        bossKills: 0,
        avatar: '🧙‍♂️'
      };
      showModal("🚪 로그아웃", "로그아웃 되었습니다. 익명 상태로 전환됩니다.");
      updateUserUI();
    } else {
      // Anonymous Login
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

  // Back to Lobby buttons
  document.querySelectorAll('.btn-to-lobby').forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playClick();
      gameManager.stopTimer();
      switchView('lobby');
    });
  });

  // Render Mini-Game Selection Grid
  renderMinigameGrid();

  // Boss Card Listener
  document.getElementById('card-boss-dungeon').addEventListener('click', () => {
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

  // Hall of Fame Card Listener
  document.getElementById('card-hall-of-fame').addEventListener('click', () => {
    sound.playClick();
    switchView('hall');
    renderLeaderboard('gold');
  });

  // Hall of Fame Tabs
  const tabGold = document.getElementById('tab-gold-rank');
  const tabClears = document.getElementById('tab-clears-rank');

  tabGold.addEventListener('click', () => {
    sound.playClick();
    tabGold.classList.add('active');
    tabClears.classList.remove('active');
    renderLeaderboard('gold');
  });

  tabClears.addEventListener('click', () => {
    sound.playClick();
    tabClears.classList.add('active');
    tabGold.classList.remove('active');
    renderLeaderboard('clears');
  });
}

// Render Mini-Game Grid Cards
function renderMinigameGrid() {
  const container = document.getElementById('minigame-grid-container');
  container.innerHTML = '';

  MINI_GAMES.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="game-card-icon">${game.icon}</div>
      <div class="game-card-title">${game.title}</div>
      <div class="game-card-desc">${game.desc}</div>
      <div class="game-card-tag" style="background:${game.color}44; border: 1px solid ${game.color};">25초 쾌속 플레이</div>
    `;

    card.addEventListener('click', () => {
      sound.playClick();
      startMinigameFlow(game.id);
    });

    container.appendChild(card);
  });
}

// Start Minigame Flow
function startMinigameFlow(gameId) {
  document.getElementById('minigame-title').innerText = MINI_GAMES.find(g => g.id === gameId).title;
  switchView('minigame');

  gameManager.startMinigame(
    gameId,
    (timeLeft) => {
      document.getElementById('game-timer').innerText = timeLeft;
    },
    (result) => {
      showModal(
        "🎉 미니게임 완료!",
        `수고하셨습니다!<br>획득 점수: <strong>${result.score}점</strong><br>획득 골드: <strong>+${result.earnedGold} G</strong>`,
        () => switchView('lobby')
      );
    }
  );

  renderMinigameQuestion();
}

// Render Question & Options for Minigame
function renderMinigameQuestion() {
  const q = gameManager.currentQuestion;
  const renderBox = document.getElementById('question-render-box');
  renderBox.innerHTML = q.questionHtml;

  // Render Visual Fraction Bar Hint
  renderVisualBars(q.visualData);

  // Render Option Buttons
  const optionsGrid = document.getElementById('options-grid-box');
  optionsGrid.innerHTML = '';

  q.options.forEach(optObj => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = optObj.displayHtml;

    btn.addEventListener('click', (e) => {
      const res = gameManager.checkAnswer(optObj, e.currentTarget);
      if (res.correct) {
        renderMinigameQuestion();
      } else {
        btn.style.borderColor = '#ef4444';
        btn.style.background = 'rgba(239, 68, 68, 0.3)';
      }
    });

    optionsGrid.appendChild(btn);
  });
}

// Visual Fraction Bar Generator
function renderVisualBars(visualData) {
  const barsBox = document.getElementById('visual-bars-box');
  if (!barsBox || !visualData) return;
  barsBox.innerHTML = '';

  const den = visualData.den;
  const n1 = visualData.n1 || 1;
  const n2 = visualData.n2 || 1;

  // Create Bar 1
  const bar1 = document.createElement('div');
  bar1.className = 'fraction-bar';
  for (let i = 0; i < den; i++) {
    const seg = document.createElement('div');
    seg.className = `bar-segment ${i < n1 ? 'filled-1' : ''}`;
    bar1.appendChild(seg);
  }
  barsBox.appendChild(bar1);

  // Create Bar 2
  const bar2 = document.createElement('div');
  bar2.className = 'fraction-bar';
  for (let i = 0; i < den; i++) {
    const seg = document.createElement('div');
    seg.className = `bar-segment ${i < n2 ? 'filled-2' : ''}`;
    bar2.appendChild(seg);
  }
  barsBox.appendChild(bar2);
}

// Render Boss Question
function renderBossQuestion() {
  const q = gameManager.currentQuestion;
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

      if (gameManager.bossHp > 0 && gameManager.bossQuestionIndex <= gameManager.bossTotalQuestions) {
        renderBossQuestion();
      }
    });

    optionsGrid.appendChild(btn);
  });
}

// Render Leaderboard (Hall of Fame)
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

// Start application when DOM ready
document.addEventListener('DOMContentLoaded', initApp);
