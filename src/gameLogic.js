import { generateQuestion } from './mathGenerator.js';
import { sound } from './soundEngine.js';
import { triggerConfetti, triggerVictoryConfetti, showFloatingText } from './effects.js';
import { saveUserData, getLeaderboard } from './firebase.js';

export const MINI_GAMES = [
  { id: 'proper_add', stageNum: 1, title: '미션 1: 진분수의 덧셈', icon: '➕', desc: '분모가 같은 진분수끼리 더해요!', color: '#4facfe' },
  { id: 'improper_add', stageNum: 2, title: '미션 2: 가분수의 덧셈', icon: '🚀', desc: '1보다 큰 가분수들을 신나게 더해요!', color: '#00f2fe' },
  { id: 'natural_improper_add', stageNum: 3, title: '미션 3: 자연수+가분수 덧셈', icon: '👑', desc: '자연수와 가분수를 변환해서 더해요!', color: '#43e97b' },
  { id: 'proper_sub', stageNum: 4, title: '미션 4: 진분수의 뺄셈', icon: '➖', desc: '분모는 그대로, 분자끼리 빼요!', color: '#ff0844' },
  { id: 'improper_sub', stageNum: 5, title: '미션 5: 가분수의 뺄셈', icon: '🔥', desc: '가분수의 뺄셈을 정복해요!', color: '#ffb199' },
  { id: 'natural_improper_sub', stageNum: 6, title: '미션 6: 자연수-가분수 뺄셈', icon: '⚡', desc: '자연수를 분수로 바꾸어 빼요!', color: '#f6d365' }
];

export class GameManager {
  constructor() {
    this.user = {
      uid: 'guest_local',
      displayName: '상산초 용사',
      gold: 50,
      clears: 0,
      bossKills: 0,
      avatar: '🧙‍♂️'
    };

    this.activeMode = 'lobby';
    this.currentMinigame = null;
    this.currentStageIndex = 0; // 0 ~ 5 순차 미션 진행

    // 미니게임 상태
    this.timer = null;
    this.timeLeft = 25;
    this.score = 0;
    this.combo = 0;
    this.earnedGoldInSession = 0;
    this.currentQuestion = null;

    // 보스전 상태
    this.bossMaxHp = 100;
    this.bossHp = 100;
    this.bossQuestionIndex = 0;
    this.bossTotalQuestions = 10;
    this.bossCorrectCount = 0;
    this.bossTimeLeft = 60;
  }

  loadLocalData() {
    const saved = localStorage.getItem('fraction_hero_user_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.user = { ...this.user, ...parsed };
      } catch (e) {
        console.warn("Failed to load local data:", e);
      }
    }
  }

  updateUserData(updatedProps) {
    this.user = { ...this.user, ...updatedProps };
    saveUserData(this.user.uid, this.user);
  }

  addGold(amount) {
    this.user.gold = Math.max(0, this.user.gold + amount);
    this.updateUserData({ gold: this.user.gold });
  }

  // 순서대로 미션 도전 시작 (stageIndex: 0 ~ 5)
  startSequentialMission(stageIndex = 0, onTick, onStageFinish) {
    this.currentStageIndex = stageIndex;
    this.currentMinigame = MINI_GAMES[this.currentStageIndex];
    this.activeMode = 'minigame';
    this.timeLeft = 25;
    this.score = 0;
    this.combo = 0;
    this.earnedGoldInSession = 0;
    this.nextQuestion();

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.timeLeft--;
      if (onTick) onTick(this.timeLeft);

      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.finishStage(onStageFinish);
      }
    }, 1000);
  }

  nextQuestion() {
    if (!this.currentMinigame) return;
    this.currentQuestion = generateQuestion(this.currentMinigame.id);
  }

  // 1회 클릭 시 무조건 다음 문제 전진
  checkAnswer(selectedAnsObj, eventTargetEl) {
    const currAns = this.currentQuestion.correctAnswer;
    const isCorrect = (selectedAnsObj.num === currAns.num && selectedAnsObj.den === currAns.den) ||
                      (String(selectedAnsObj.improperText).trim() === String(currAns.improperText).trim()) ||
                      (String(selectedAnsObj.mixedText).trim() === String(currAns.mixedText).trim());

    const rect = eventTargetEl ? eventTargetEl.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2 };

    if (isCorrect) {
      sound.playCorrect();
      this.combo++;
      const baseGold = 10;
      const comboBonus = Math.floor(this.combo / 3) * 5;
      const earned = baseGold + comboBonus;

      this.score += 100 + (this.combo * 20);
      this.earnedGoldInSession += earned;
      this.addGold(earned);

      triggerConfetti();
      sound.playCoin();

      showFloatingText(`+${earned} G! (${this.combo} 콤보!)`, rect.left, rect.top - 20, '#ffd700');
    } else {
      sound.playWrong();
      this.combo = 0;
      showFloatingText(`❌ 땡!`, rect.left, rect.top - 20, '#ef4444');
    }

    this.nextQuestion();
    return { correct: isCorrect };
  }

  finishStage(onStageFinish) {
    this.user.clears += 1;
    this.updateUserData({ clears: this.user.clears });
    sound.playFanfare();
    triggerVictoryConfetti();

    const isAllMissionsComplete = this.currentStageIndex >= MINI_GAMES.length - 1;

    if (onStageFinish) {
      onStageFinish({
        stageNum: this.currentStageIndex + 1,
        stageName: this.currentMinigame.title,
        score: this.score,
        earnedGold: this.earnedGoldInSession,
        isAllMissionsComplete,
        nextStageIndex: this.currentStageIndex + 1
      });
    }
  }

  startBossBattle(onTick, onFinish) {
    const BOSS_ENTRY_FEE = 100;
    if (this.user.gold < BOSS_ENTRY_FEE) {
      throw new Error(`보스 전에 도전하려면 최소 ${BOSS_ENTRY_FEE} 골드가 필요합니다! (현재 ${this.user.gold} G)`);
    }

    this.addGold(-BOSS_ENTRY_FEE);

    this.activeMode = 'boss';
    this.bossHp = 100;
    this.bossMaxHp = 100;
    this.bossQuestionIndex = 0;
    this.bossCorrectCount = 0;
    this.bossTimeLeft = 60;

    this.nextBossQuestion();

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.bossTimeLeft--;
      if (onTick) onTick(this.bossTimeLeft, this.bossHp);

      if (this.bossTimeLeft <= 0 || this.bossHp <= 0 || this.bossQuestionIndex > this.bossTotalQuestions) {
        clearInterval(this.timer);
        this.finishBossBattle(onFinish);
      }
    }, 1000);
  }

  nextBossQuestion() {
    this.bossQuestionIndex++;
    this.currentQuestion = generateQuestion('boss_random');
  }

  checkBossAnswer(selectedAnsObj, eventTargetEl) {
    const currAns = this.currentQuestion.correctAnswer;
    const isCorrect = (selectedAnsObj.num === currAns.num && selectedAnsObj.den === currAns.den) ||
                      (String(selectedAnsObj.improperText).trim() === String(currAns.improperText).trim()) ||
                      (String(selectedAnsObj.mixedText).trim() === String(currAns.mixedText).trim());

    const rect = eventTargetEl ? eventTargetEl.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2 };

    if (isCorrect) {
      sound.playHit();
      this.bossCorrectCount++;
      const damage = 10;
      this.bossHp = Math.max(0, this.bossHp - damage);
      showFloatingText(`💥 BOOM! -10 HP`, rect.left, rect.top - 30, '#ff4757');
    } else {
      sound.playWrong();
      showFloatingText(`🛡️ 오답! (방어 성공)`, rect.left, rect.top - 30, '#888888');
    }

    if (this.bossHp <= 0 || this.bossQuestionIndex >= this.bossTotalQuestions) {
      clearInterval(this.timer);
      setTimeout(() => this.finishBossBattle(), 300);
    } else {
      this.nextBossQuestion();
    }
    return { correct: isCorrect, bossHp: this.bossHp };
  }

  finishBossBattle(onFinish) {
    const isVictory = this.bossHp <= 0 || this.bossCorrectCount >= 7;
    let rewardGold = 0;

    if (isVictory) {
      rewardGold = 300;
      this.user.bossKills += 1;
      this.addGold(rewardGold);
      sound.playFanfare();
      triggerVictoryConfetti();
    } else {
      sound.playWrong();
    }

    this.updateUserData({ bossKills: this.user.bossKills });

    if (onFinish) {
      onFinish({
        isVictory,
        correctCount: this.bossCorrectCount,
        rewardGold,
        bossKills: this.user.bossKills
      });
    }
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const gameManager = new GameManager();
