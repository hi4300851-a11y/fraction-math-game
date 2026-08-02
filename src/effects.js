// Confetti particle effect module with CDN & NPM fallback
export function triggerConfetti() {
  try {
    if (window.confetti) {
      window.confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
    }
  } catch (e) {
    console.log("Confetti triggered");
  }
}

export function triggerVictoryConfetti() {
  try {
    if (window.confetti) {
      const duration = 2.5 * 1000;
      const end = Date.now() + duration;

      (function frame() {
        window.confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
        window.confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    }
  } catch (e) {
    console.log("Victory confetti triggered");
  }
}

export function showFloatingText(text, x, y, color = '#ffd700') {
  const el = document.createElement('div');
  el.className = 'floating-text';
  el.innerText = text;
  el.style.left = `${x || window.innerWidth / 2}px`;
  el.style.top = `${y || window.innerHeight / 2}px`;
  el.style.color = color;
  document.body.appendChild(el);

  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 1000);
}
