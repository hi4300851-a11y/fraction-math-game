    const MINI_GAMES = [
      { id: 'proper_add', stageNum: 1, title: '미션 1: 진분수의 덧셈', icon: '➕', desc: '분모가 같은 진분수끼리 더해요!', color: '#4facfe' },
      { id: 'improper_add', stageNum: 2, title: '미션 2: 가분수의 덧셈', icon: '🚀', desc: '1보다 큰 가분수들을 신나게 더해요!', color: '#00f2fe' },
      { id: 'natural_improper_add', stageNum: 3, title: '미션 3: 자연수+가분수 덧셈', icon: '👑', desc: '자연수와 가분수를 변환해서 더해요!', color: '#43e97b' },
      { id: 'proper_sub', stageNum: 4, title: '미션 4: 진분수의 뺄셈', icon: '➖', desc: '분모는 그대로, 분자끼리 빼요!', color: '#ff0844' },
      { id: 'improper_sub', stageNum: 5, title: '미션 5: 가분수의 뺄셈', icon: '🔥', desc: '가분수의 뺄셈을 정복해요!', color: '#ffb199' },
      { id: 'natural_improper_sub', stageNum: 6, title: '미션 6: 자연수-가분수 뺄셈', icon: '⚡', desc: '자연수를 분수로 바꾸어 빼요!', color: '#f6d365' }
    ];

    let userData = {
      gold: 50,
      clears: 0,
      bossKills: 0,
      displayName: '상산초 용사'
    };

    let minigameTimer = null;
    let timeLeft = 25;
    let currentScore = 0;
    let earnedGoldSession = 0;
    let isMinigameActive = false;
    let currentQuestion = null;
    let currentStageIdx = 0;

    function getRandomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function createFractionHtml(num, den) {
      return `<div class="fraction-box"><span class="num">${num}</span><span class="den">${den}</span></div>`;
    }

    function createMixedFractionHtml(whole, num, den) {
      if (whole === 0) return createFractionHtml(num, den);
      return `<div class="mixed-fraction"><span class="whole">${whole}</span>${createFractionHtml(num, den)}</div>`;
    }

    function formatAnswer(num, den) {
      const whole = Math.floor(num / den);
      const rem = num % den;
      return {
        num, den, whole, rem,
        improperText: rem === 0 ? `${whole}` : `${num}/${den}`,
        mixedText: whole > 0 ? (rem === 0 ? `${whole}` : `${whole}와 ${rem}/${den}`) : `${num}/${den}`,
        displayHtml: rem === 0 ? `<span class="whole-only">${whole}</span>` : (whole > 0 ? createMixedFractionHtml(whole, rem, den) : createFractionHtml(num, den))
      };
    }

    function generateOptions(correctAnswer, den) {
      const options = [correctAnswer];
      const used = new Set([correctAnswer.improperText]);
      while (options.length < 4) {
        let fakeNum = correctAnswer.num + getRandomInt(-4, 4);
        if (fakeNum <= 0 || fakeNum === correctAnswer.num) {
          fakeNum = correctAnswer.num + (options.length + 1);
        }
        const fakeAns = formatAnswer(fakeNum, den);
        if (!used.has(fakeAns.improperText)) {
          used.add(fakeAns.improperText);
          options.push(fakeAns);
        }
      }
      return options.sort(() => Math.random() - 0.5);
    }

    function generateQuestion(type) {
      const den = getRandomInt(3, 9);
      let num1, num2, op, questionHtml, visualData, correctNum;

      switch (type) {
        case 'proper_add':
          num1 = getRandomInt(1, den - 1); num2 = getRandomInt(1, den - 1); op = '+'; correctNum = num1 + num2;
          questionHtml = `<div class="math-expr">${createFractionHtml(num1, den)}<span class="operator">+</span>${createFractionHtml(num2, den)}</div>`;
          visualData = { den, n1: num1, n2: num2, op }; break;
        case 'improper_add':
          num1 = getRandomInt(den, den * 2); num2 = getRandomInt(den, den * 2); op = '+'; correctNum = num1 + num2;
          questionHtml = `<div class="math-expr">${createFractionHtml(num1, den)}<span class="operator">+</span>${createFractionHtml(num2, den)}</div>`;
          visualData = { den, n1: num1, n2: num2, op }; break;
        case 'natural_improper_add':
          const nAdd = getRandomInt(1, 3); num2 = getRandomInt(den + 1, den * 2); num1 = nAdd * den; op = '+'; correctNum = num1 + num2;
          questionHtml = `<div class="math-expr"><span class="whole-num">${nAdd}</span><span class="operator">+</span>${createFractionHtml(num2, den)}</div>`;
          visualData = { den, n1: num1, n2: num2, op }; break;
        case 'proper_sub':
          num1 = getRandomInt(2, den - 1); num2 = getRandomInt(1, num1 - 1); op = '-'; correctNum = num1 - num2;
          questionHtml = `<div class="math-expr">${createFractionHtml(num1, den)}<span class="operator">-</span>${createFractionHtml(num2, den)}</div>`;
          visualData = { den, n1: num1, n2: num2, op }; break;
        case 'improper_sub':
          num2 = getRandomInt(den, den * 2 - 2); num1 = num2 + getRandomInt(1, den); op = '-'; correctNum = num1 - num2;
          questionHtml = `<div class="math-expr">${createFractionHtml(num1, den)}<span class="operator">-</span>${createFractionHtml(num2, den)}</div>`;
          visualData = { den, n1: num1, n2: num2, op }; break;
        case 'natural_improper_sub':
          const nSub = getRandomInt(2, 4); num1 = nSub * den; num2 = getRandomInt(den + 1, num1 - 1); op = '-'; correctNum = num1 - num2;
          questionHtml = `<div class="math-expr"><span class="whole-num">${nSub}</span><span class="operator">-</span>${createFractionHtml(num2, den)}</div>`;
          visualData = { den, n1: num1, n2: num2, op }; break;
        case 'boss_random': default:
          const types = ['proper_add', 'improper_add', 'natural_improper_add', 'proper_sub', 'improper_sub', 'natural_improper_sub'];
          return generateQuestion(types[Math.floor(Math.random() * types.length)]);
      }

      const correctAnswer = formatAnswer(correctNum, den);
      return { type, questionHtml, correctAnswer, options: generateOptions(correctAnswer, den), visualData };
    }

    function showView(viewId) {
      document.querySelectorAll('.view-screen').forEach(el => el.classList.remove('active'));
      document.getElementById(viewId).classList.add('active');
      updateUserUI();
    }

    function updateUserUI() {
      document.getElementById('user-name-display').innerText = userData.displayName;
      document.getElementById('user-stats-display').innerText = `클리어: ${userData.clears}회 | 보스: ${userData.bossKills}회`;
      document.getElementById('user-gold-display').innerText = userData.gold;
    }

    function clearTimer() {
      if (minigameTimer) {
        clearInterval(minigameTimer);
        minigameTimer = null;
      }
    }

    function startMinigame(stageIdx) {
      clearTimer();
      currentStageIdx = stageIdx;
      const gameObj = MINI_GAMES[stageIdx];

      document.getElementById('minigame-title').innerText = gameObj.title;
      document.getElementById('mission-step-indicator').innerHTML = `<span>🎯 미션: <strong>${gameObj.title}</strong></span>`;

      timeLeft = 25;
      currentScore = 0;
      earnedGoldSession = 0;
      isMinigameActive = true;

      document.getElementById('game-timer').innerText = timeLeft;
      showView('view-minigame');

      nextMinigameQuestion();

      minigameTimer = setInterval(() => {
        if (!isMinigameActive) {
          clearTimer();
          return;
        }

        timeLeft--;
        document.getElementById('game-timer').innerText = Math.max(0, timeLeft);

        if (timeLeft <= 0) {
          endMinigameAndShowModal();
        }
      }, 1000);
    }

    function nextMinigameQuestion() {
      if (!isMinigameActive || timeLeft <= 0) return;

      const gameObj = MINI_GAMES[currentStageIdx];
      currentQuestion = generateQuestion(gameObj.id);

      const renderBox = document.getElementById('question-render-box');
      renderBox.innerHTML = currentQuestion.questionHtml;

      renderVisualBars(currentQuestion.visualData);

      const optionsGrid = document.getElementById('options-grid-box');
      optionsGrid.innerHTML = '';

      currentQuestion.options.forEach(optObj => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = optObj.displayHtml;

        btn.addEventListener('click', (e) => {
          if (!isMinigameActive || timeLeft <= 0) return;

          const isCorrect = (optObj.num === currentQuestion.correctAnswer.num && optObj.den === currentQuestion.correctAnswer.den) ||
                            (String(optObj.improperText).trim() === String(currentQuestion.correctAnswer.improperText).trim());

          if (isCorrect) {
            currentScore += 100;
            earnedGoldSession += 10;
            userData.gold += 10;
            try { window.confetti({ particleCount: 50, spread: 60 }); } catch(err) {}
          }

          updateUserUI();

          if (isMinigameActive && timeLeft > 0) {
            nextMinigameQuestion();
          }
        });

        optionsGrid.appendChild(btn);
      });
    }

    function renderVisualBars(visualData) {
      const barsBox = document.getElementById('visual-bars-box');
      if (!barsBox || !visualData) return;
      barsBox.innerHTML = '';
      const den = visualData.den; const n1 = visualData.n1 || 1; const n2 = visualData.n2 || 1;

      const bar1 = document.createElement('div'); bar1.className = 'fraction-bar';
      for (let i = 0; i < den; i++) {
        const seg = document.createElement('div'); seg.className = `bar-segment ${i < n1 ? 'filled-1' : ''}`;
        bar1.appendChild(seg);
      }
      barsBox.appendChild(bar1);

      const bar2 = document.createElement('div'); bar2.className = 'fraction-bar';
      for (let i = 0; i < den; i++) {
        const seg = document.createElement('div'); seg.className = `bar-segment ${i < n2 ? 'filled-2' : ''}`;
        bar2.appendChild(seg);
      }
      barsBox.appendChild(bar2);
    }

    // 🌟 25초 미니게임 종료 후 팝업 및 ['홈으로'(왼쪽), '다음으로'(오른쪽)] 2개 버튼 동적 바인딩 🌟
    function endMinigameAndShowModal() {
      isMinigameActive = false;
      clearTimer();

      userData.clears += 1;
      updateUserUI();

      try { window.confetti({ particleCount: 100, spread: 80 }); } catch(e){}

      const gameObj = MINI_GAMES[currentStageIdx];
      const modalEl = document.getElementById('game-modal');
      const titleEl = document.getElementById('modal-title-text');
      const bodyEl = document.getElementById('modal-body-text');

      titleEl.innerText = `⏰ ${gameObj.title} 완료!`;
      bodyEl.innerHTML = `25초 제한시간이 끝났습니다!<br><br>획득 점수: <strong>${currentScore}점</strong><br>획득 골드: <strong>+${earnedGoldSession} G</strong>`;

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

      const isLastStage = currentStageIdx >= MINI_GAMES.length - 1;
      btnGroup.innerHTML = `
        <button class="btn-modal btn-home" id="dyn-btn-home" style="font-family:'Jua',sans-serif; flex:1; padding:0.85rem 1.2rem; font-size:1.2rem; border:none; border-radius:16px; cursor:pointer; background:rgba(255,255,255,0.2); color:white; border:1px solid rgba(255,255,255,0.3);">🏠 홈으로</button>
        <button class="btn-modal btn-next" id="dyn-btn-next" style="font-family:'Jua',sans-serif; flex:1; padding:0.85rem 1.2rem; font-size:1.2rem; border:none; border-radius:16px; cursor:pointer; background:linear-gradient(135deg, #f59e0b, #d97706); color:white;">${isLastStage ? '🏆 6단계 완수!' : '➡️ 다음으로'}</button>
      `;

      modalEl.classList.add('active');

      document.getElementById('dyn-btn-home').onclick = () => {
        modalEl.classList.remove('active');
        showView('view-lobby');
      };

      document.getElementById('dyn-btn-next').onclick = () => {
        modalEl.classList.remove('active');
        if (isLastStage) {
          showView('view-lobby');
        } else {
          startMinigame(currentStageIdx + 1);
        }
      };
    }

    document.addEventListener('DOMContentLoaded', () => {
      updateUserUI();

      const gridContainer = document.getElementById('minigame-grid-container');
      if (gridContainer) {
        gridContainer.innerHTML = '';
        MINI_GAMES.forEach((game, idx) => {
          const card = document.createElement('div');
          card.className = 'game-card';
          card.innerHTML = `
            <div class="stage-badge">단계 ${game.stageNum}</div>
            <div class="game-card-icon">${game.icon}</div>
            <div class="game-card-title">${game.title}</div>
            <div class="game-card-desc">${game.desc}</div>
            <div class="game-card-tag" style="background:${game.color}44; border: 1px solid ${game.color};">25초 미션 ${idx + 1}</div>
          `;
          card.addEventListener('click', () => {
            startMinigame(idx);
          });
          gridContainer.appendChild(card);
        });
      }

      const btnSeq = document.getElementById('btn-start-sequential-mission');
      if (btnSeq) {
        btnSeq.addEventListener('click', () => {
          startMinigame(0);
        });
      }

      document.querySelectorAll('.btn-to-lobby').forEach(btn => {
        btn.addEventListener('click', () => {
          isMinigameActive = false;
          clearTimer();
          showView('view-lobby');
        });
      });
    });
