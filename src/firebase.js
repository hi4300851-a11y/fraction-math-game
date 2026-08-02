// Firebase Auth & Firestore Service with Safe Async Initialization

let auth = null;
let db = null;
let isFirebaseActive = false;
let initPromise = null;

// Dynamic Safe Firebase Init
export function ensureFirebaseInit() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const firebaseConfig = {
      apiKey: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) || "",
      authDomain: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || "",
      projectId: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_PROJECT_ID) || "",
      storageBucket: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || "",
      messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || "",
      appId: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_APP_ID) || ""
    };

    if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== "your_api_key_here") {
      try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseActive = true;
        console.log("🔥 Firebase SDK initialized successfully!");
      } catch (e) {
        console.warn("Firebase SDK init fallback to LocalStorage mode:", e);
      }
    } else {
      console.log("ℹ️ Firebase config is default/missing. Using LocalStorage profile mode.");
    }
  })();

  return initPromise;
}

// 1. Google Login
export async function loginWithGoogle() {
  await ensureFirebaseInit();
  if (!isFirebaseActive || !auth) {
    throw new Error("Firebase API 키가 설정되지 않았습니다. 현재는 로컬 익명 모드로 동작 중입니다.");
  }
  const { GoogleAuthProvider, signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

// 2. Anonymous Login
export async function loginAnonymously() {
  await ensureFirebaseInit();
  if (!isFirebaseActive || !auth) {
    const guestUser = {
      uid: 'guest_' + Math.random().toString(36).substring(2, 9),
      displayName: '상산초_' + Math.floor(Math.random() * 8999 + 1000),
      isAnonymous: true
    };
    saveUserData(guestUser.uid, guestUser);
    return guestUser;
  }
  const { signInAnonymously: fSignInAnon } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const result = await fSignInAnon(auth);
  return result.user;
}

// 3. Logout
export async function logoutUser() {
  await ensureFirebaseInit();
  if (isFirebaseActive && auth) {
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    await signOut(auth);
  }
  localStorage.removeItem('fraction_hero_user_data');
}

// 4. Auth State Listener
export async function subscribeAuthState(callback) {
  await ensureFirebaseInit();
  if (isFirebaseActive && auth) {
    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        const localData = getSavedLocalUser();
        callback({
          uid: user.uid,
          displayName: user.displayName || localData.displayName || '상산초 용사',
          email: user.email
        });
      } else {
        callback(null);
      }
    });
  } else {
    const localData = getSavedLocalUser();
    callback(localData);
    return () => {};
  }
}

export function getSavedLocalUser() {
  const localUserStr = localStorage.getItem('fraction_hero_user_data');
  if (localUserStr) {
    try { return JSON.parse(localUserStr); } catch(e) {}
  }
  return {
    uid: 'guest_local',
    displayName: '상산초 용사',
    gold: 50,
    clears: 0,
    bossKills: 0,
    avatar: '🧙‍♂️'
  };
}

// 5. Save User Data
export async function saveUserData(uid, data) {
  const current = getSavedLocalUser();
  const updatedData = {
    ...current,
    ...data,
    uid: uid || current.uid,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem('fraction_hero_user_data', JSON.stringify(updatedData));

  if (isFirebaseActive && db && uid && !uid.startsWith('guest_')) {
    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, updatedData, { merge: true });
    } catch (e) {
      console.warn("Firestore save error:", e);
    }
  }
  return updatedData;
}

// 6. Leaderboard Top 10
export async function getLeaderboard() {
  const defaultNpcRankers = [
    { displayName: '분수 마스터 피타고라스', gold: 1200, clears: 35, bossKills: 8, avatar: '👑' },
    { displayName: '계산왕 라이프니츠', gold: 950, clears: 28, bossKills: 6, avatar: '🧙‍♂️' },
    { displayName: '속셈의 가우스', gold: 800, clears: 24, bossKills: 5, avatar: '⚡' },
    { displayName: '분수 요정 아르키메데스', gold: 650, clears: 19, bossKills: 4, avatar: '🧚‍♀️' },
    { displayName: '파스칼 장군', gold: 500, clears: 15, bossKills: 3, avatar: '🛡️' },
    { displayName: '상산초 수학 탐정', gold: 380, clears: 12, bossKills: 2, avatar: '🕵️' },
    { displayName: '상산초 분수 병아리', gold: 240, clears: 8, bossKills: 1, avatar: '🐥' }
  ];

  const localUser = getSavedLocalUser();

  return {
    goldTop10: mergeAndSort([localUser], defaultNpcRankers, 'gold'),
    clearsTop10: mergeAndSort([localUser], defaultNpcRankers, 'clears')
  };
}

function mergeAndSort(users, npcs, key) {
  const combined = [...users, ...npcs];
  const map = new Map();
  combined.forEach(item => {
    if (!map.has(item.displayName) || map.get(item.displayName)[key] < item[key]) {
      map.set(item.displayName, item);
    }
  });
  const uniqueList = Array.from(map.values());
  uniqueList.sort((a, b) => (b[key] || 0) - (a[key] || 0));
  return uniqueList.slice(0, 10);
}
