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
    this.currentStageIndex = 0;

    // 미니게임 상태
    this.timer = null;
    this.timeLeft = 25;
    this.score = 0;
    this.combo = 0;
    this.earnedGoldInSession = 0;
    this.currentQuestion = null;
    this.isStageFinished = false; // ★ 이미 게임이 끝났는지 여부 상태 플래그

    // 콜백 저장 변수
    this._onStageFinishCallback = null;
    this._onBossFinishCallback = null;

    // 보스전 상태
    this.bossMaxHp = 100;
    this.bossHp = 100;
    this.bossQuestionIndex = 0;
    this.bossTotalQuestions = 10;
    this.bossCorrectCount = 0;
    this.bossTimeLeft = 60;
    this.isBossFinished = false;
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

  // =============================================
  // 순차 미션 (미니게임 6단계)
  // =============================================
  startSequentialMission(stageIndex = 0, onTick, onStageFinish) {
    this.currentStageIndex = stageIndex;
    this.currentMinigame = MINI_GAMES[this.currentStageIndex];
    this.activeMode = 'minigame';
    this.timeLeft = 25;
    this.score = 0;
    this.combo = 0;
    this.earnedGoldInSession = 0;
    this.isStageFinished = false; // ★ 미션 시작 시 종료 플래그 초기화!

    this._onStageFinishCallback = onStageFinish;

    this.nextQuestion();

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.isStageFinished) return;

      this.timeLeft--;
      if (onTick) onTick(this.timeLeft);

      // 시간이 0 이하가 되는 순간 타이머 정지 & 미션 완료 처리!
      if (this.timeLeft <= 0) {
        this.stopTimer();
        this.finishStage();
      }
    }, 1000);
  }

  nextQuestion() {
    if (!this.currentMinigame) return;
    this.currentQuestion = generateQuestion(this.currentMinigame.id);
  }

  // 답안 체크 (시간이 끝났으면 아무것도 안 함!)
  checkAnswer(selectedAnsObj, eventTargetEl) {
    // ★ 이미 시간이 지났거나 미션이 종료된 경우 클릭 차단!
    if (this.isStageFinished || this.timeLeft <= 0) {
      return { correct: false, finished: true };
    }

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
    return { correct: isCorrect, finished: false };
  }

  // 미션 종료 처리
  finishStage() {
    if (this.isStageFinished) return; // 중복 호출 방지
    this.isStageFinished = true;
    this.stopTimer();

    this.user.clears += 1;
    this.updateUserData({ clears: this.user.clears });
    sound.playFanfare();
    triggerVictoryConfetti();

    if (this._onStageFinishCallback) {
      this._onStageFinishCallback({
        stageNum: this.currentStageIndex + 1,
        stageName: this.currentMinigame.title,
        score: this.score,
        earnedGold: this.earnedGoldInSession
      });
    }
  }

  // =============================================
  // 보스전
  // =============================================
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
    this.isBossFinished = false;

    this._onBossFinishCallback = onFinish;

    this.nextBossQuestion();

    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.isBossFinished) return;

      this.bossTimeLeft--;
      if (onTick) onTick(this.bossTimeLeft, this.bossHp);

      if (this.bossTimeLeft <= 0 || this.bossHp <= 0 || this.bossQuestionIndex > this.bossTotalQuestions) {
        this.stopTimer();
        this.finishBossBattle();
      }
    }, 1000);
  }

  nextBossQuestion() {
    this.bossQuestionIndex++;
    this.currentQuestion = generateQuestion('boss_random');
  }

  checkBossAnswer(selectedAnsObj, eventTargetEl) {
    if (this.isBossFinished || this.bossTimeLeft <= 0) {
      return { correct: false, bossHp: this.bossHp, finished: true };
    }

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
      this.stopTimer();
      setTimeout(() => this.finishBossBattle(), 300);
    } else {
      this.nextBossQuestion();
    }
    return { correct: isCorrect, bossHp: this.bossHp, finished: false };
  }

  finishBossBattle() {
    if (this.isBossFinished) return;
    this.isBossFinished = true;
    this.stopTimer();

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

    if (this._onBossFinishCallback) {
      this._onBossFinishCallback({
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
