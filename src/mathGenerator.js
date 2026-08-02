// 4학년 분수 문제 생성기
// 6가지 미니게임 유형 및 보스전 지원

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 헬퍼: 분수 HTML 템플릿
export function createFractionHtml(num, den) {
  return `<div class="fraction-box"><span class="num">${num}</span><span class="den">${den}</span></div>`;
}

export function createMixedFractionHtml(whole, num, den) {
  if (whole === 0) return createFractionHtml(num, den);
  return `<div class="mixed-fraction"><span class="whole">${whole}</span>${createFractionHtml(num, den)}</div>`;
}

// 정답 객체를 비교가 용이한 텍스트/대분수/가분수 포맷으로 정형화
function formatAnswer(num, den) {
  // 가분수 그대로와 대분수 형태 모두 지원
  const whole = Math.floor(num / den);
  const rem = num % den;
  
  return {
    num,
    den,
    whole,
    rem,
    improperText: rem === 0 ? `${whole}` : `${num}/${den}`,
    mixedText: whole > 0 ? (rem === 0 ? `${whole}` : `${whole}와 ${rem}/${den}`) : `${num}/${den}`,
    displayHtml: rem === 0 ? `<span class="whole-only">${whole}</span>` : (whole > 0 ? createMixedFractionHtml(whole, rem, den) : createFractionHtml(num, den))
  };
}

// 보조: 오답선택지 3개 생성
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

  // 셔플
  return options.sort(() => Math.random() - 0.5);
}

export function generateQuestion(type) {
  // 분모 3 ~ 9 설정 (4학년 수준)
  const den = getRandomInt(3, 9);
  let num1, num2, n1, n2, op, questionHtml, visualData;
  let correctNum;

  switch (type) {
    case 'proper_add': {
      // 진분수 + 진분수 (분자 < 분모)
      num1 = getRandomInt(1, den - 1);
      num2 = getRandomInt(1, den - 1);
      op = '+';
      correctNum = num1 + num2;

      questionHtml = `
        <div class="math-expr">
          ${createFractionHtml(num1, den)}
          <span class="operator">+</span>
          ${createFractionHtml(num2, den)}
        </div>
      `;
      visualData = { den, n1: num1, n2: num2, op };
      break;
    }

    case 'improper_add': {
      // 가분수 + 가분수 (분자 >= 분모)
      num1 = getRandomInt(den, den * 2);
      num2 = getRandomInt(den, den * 2);
      op = '+';
      correctNum = num1 + num2;

      questionHtml = `
        <div class="math-expr">
          ${createFractionHtml(num1, den)}
          <span class="operator">+</span>
          ${createFractionHtml(num2, den)}
        </div>
      `;
      visualData = { den, n1: num1, n2: num2, op };
      break;
    }

    case 'natural_improper_add': {
      // 자연수 + 가분수
      const natural = getRandomInt(1, 3);
      num2 = getRandomInt(den + 1, den * 2);
      num1 = natural * den; // 자연수를 가분수로 환산 시 분자
      op = '+';
      correctNum = num1 + num2;

      questionHtml = `
        <div class="math-expr">
          <span class="whole-num">${natural}</span>
          <span class="operator">+</span>
          ${createFractionHtml(num2, den)}
        </div>
      `;
      visualData = { den, n1: num1, n2: num2, op, natural1: natural };
      break;
    }

    case 'proper_sub': {
      // 진분수 - 진분수 (결과가 0보다 큰 진분수)
      num1 = getRandomInt(2, den - 1);
      num2 = getRandomInt(1, num1 - 1);
      op = '-';
      correctNum = num1 - num2;

      questionHtml = `
        <div class="math-expr">
          ${createFractionHtml(num1, den)}
          <span class="operator">-</span>
          ${createFractionHtml(num2, den)}
        </div>
      `;
      visualData = { den, n1: num1, n2: num2, op };
      break;
    }

    case 'improper_sub': {
      // 가분수 - 가분수
      num2 = getRandomInt(den, den * 2 - 2);
      num1 = num2 + getRandomInt(1, den);
      op = '-';
      correctNum = num1 - num2;

      questionHtml = `
        <div class="math-expr">
          ${createFractionHtml(num1, den)}
          <span class="operator">-</span>
          ${createFractionHtml(num2, den)}
        </div>
      `;
      visualData = { den, n1: num1, n2: num2, op };
      break;
    }

    case 'natural_improper_sub': {
      // 자연수 - 가분수
      const natural = getRandomInt(2, 4);
      num1 = natural * den;
      // num2는 natural * den 보다 작고 (natural-1)*den 보다는 크거나 같은 가분수
      num2 = getRandomInt(den + 1, num1 - 1);
      op = '-';
      correctNum = num1 - num2;

      questionHtml = `
        <div class="math-expr">
          <span class="whole-num">${natural}</span>
          <span class="operator">-</span>
          ${createFractionHtml(num2, den)}
        </div>
      `;
      visualData = { den, n1: num1, n2: num2, op, natural1: natural };
      break;
    }

    case 'boss_random':
    default: {
      // 보스전: 6가지 중 무작위 1개 선택
      const types = ['proper_add', 'improper_add', 'natural_improper_add', 'proper_sub', 'improper_sub', 'natural_improper_sub'];
      const randomType = types[Math.floor(Math.random() * types.length)];
      return generateQuestion(randomType);
    }
  }

  const correctAnswer = formatAnswer(correctNum, den);
  const options = generateOptions(correctAnswer, den);

  return {
    type,
    questionHtml,
    correctAnswer,
    options,
    visualData
  };
}
