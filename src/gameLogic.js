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
    this.isStageFinished = false;

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
  // 미니게임 25초 시한성 실행 (Stage 1 ~ 6)
  // =============================================
  startSequentialMission(stageIndex = 0, onTick, onStageFinish) {
    this.stopTimer(); // 기존 타이머 완벽 제거

    this.currentStageIndex = stageIndex;
    this.currentMinigame = MINI_GAMES[this.currentStageIndex];
    this.activeMode = 'minigame';
    this.timeLeft = 25;
    this.score = 0;
    this.combo = 0;
    this.earnedGoldInSession = 0;
    this.isStageFinished = false;

    this._onStageFinishCallback = onStageFinish;

    this.nextQuestion();

    // 1초 주기로 차감
    this.timer = setInterval(() => {
      if (this.isStageFinished) {
        this.stopTimer();
        return;
      }

      this.timeLeft = Math.max(0, this.timeLeft - 1);
      
      if (onTick) onTick(this.timeLeft);

      // 0초 이하가 되는 순간 타이머 멈추고 팝업 호출!
      if (this.timeLeft <= 0) {
        this.stopTimer();
        this.finishStage();
      }
    }, 1000);
  }

  nextQuestion() {
    if (!this.currentMinigame || this.isStageFinished || this.timeLeft <= 0) return;
    this.currentQuestion = generateQuestion(this.currentMinigame.id);
  }

  // 답안 체크 (시간 지났으면 클릭 철저히 방어!)
  checkAnswer(selectedAnsObj, eventTargetEl) {
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

    if (this.timeLeft > 0 && !this.isStageFinished) {
      this.nextQuestion();
    }
    
    return { correct: isCorrect, finished: this.isStageFinished || this.timeLeft <= 0 };
  }

  // 시간종료 및 결과 팝업 트리거
  finishStage() {
    if (this.isStageFinished) return;
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

    this.stopTimer();
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

    this.timer = setInterval(() => {
      if (this.isBossFinished) {
        this.stopTimer();
        return;
      }

      this.bossTimeLeft = Math.max(0, this.bossTimeLeft - 1);
      if (onTick) onTick(this.bossTimeLeft, this.bossHp);

      if (this.bossTimeLeft <= 0 || this.bossHp <= 0 || this.bossQuestionIndex > this.bossTotalQuestions) {
        this.stopTimer();
        this.finishBossBattle();
      }
    }, 1000);
  }

  nextBossQuestion() {
    if (this.isBossFinished || this.bossTimeLeft <= 0) return;
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
      setTimeout(() => this.finishBossBattle(), 200);
    } else {
      this.nextBossQuestion();
    }
    return { correct: isCorrect, bossHp: this.bossHp, finished: this.isBossFinished || this.bossTimeLeft <= 0 };
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
