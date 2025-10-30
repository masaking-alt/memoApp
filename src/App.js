import React, { useEffect, useState } from 'react';
import './App.css';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  deleteUser,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const USERNAME_EMAIL_SUFFIX = '@memo-app.local';

const toNormalizedUsername = (value) => value.trim().toLowerCase();
const toPseudoEmail = (normalizedUsername) => `${normalizedUsername}${USERNAME_EMAIL_SUFFIX}`;

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [memos, setMemos] = useState([]);
  const [memoLoading, setMemoLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [usernameForDisplay, setUsernameForDisplay] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      setUsername('');
      setPassword('');
      setError('');
      if (!firebaseUser) {
        setUsernameForDisplay('');
        setProfileLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!statusMessage) {
      return undefined;
    }
    const timeoutId = setTimeout(() => {
      setStatusMessage('');
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let isMounted = true;
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const snapshot = await getDoc(doc(db, 'userProfiles', user.uid));
        if (!isMounted) {
          return;
        }

        if (snapshot.exists()) {
          const data = snapshot.data();
          setUsernameForDisplay(
            typeof data.username === 'string' && data.username.trim().length > 0
              ? data.username.trim()
              : '',
          );
        } else {
          const fallback =
            user.displayName?.trim() || user.email?.replace(USERNAME_EMAIL_SUFFIX, '') || '';
          setUsernameForDisplay(fallback);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          const fallback =
            user.displayName?.trim() || user.email?.replace(USERNAME_EMAIL_SUFFIX, '') || '';
          setUsernameForDisplay(fallback);
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMemos([]);
      setMemoLoading(false);
      return undefined;
    }

    setMemoLoading(true);
    const memosRef = collection(db, 'memos');
    const memosQuery = query(memosRef, where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(
      memosQuery,
      (snapshot) => {
        const nextMemos = snapshot.docs
          .map((docSnapshot) => {
            const data = docSnapshot.data();
            return {
              id: docSnapshot.id,
              content: data.content ?? '',
              createdAtSeconds: data.createdAt?.seconds ?? 0,
            };
          })
          .sort((a, b) => b.createdAtSeconds - a.createdAtSeconds)
          .map(({ id, content }) => ({ id, content }));

        setMemos(nextMemos);
        setMemoLoading(false);
      },
      (err) => {
        console.error(err);
        setError('メモの取得中に問題が発生しました。');
        setMemoLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const handleAuthModeChange = (mode) => {
    setAuthMode(mode);
    setError('');
    setStatusMessage('');
    setUsername('');
    setPassword('');
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatusMessage('');

    const trimmedUsername = username.trim();
    const normalizedUsername = toNormalizedUsername(username);

    if (!trimmedUsername || !password) {
      setError('ユーザー名とパスワードを入力してください。');
      return;
    }

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError('ユーザー名は半角英数字とアンダースコアで3〜20文字にしてください。');
      return;
    }

    const pseudoEmail = toPseudoEmail(normalizedUsername);

    let createdUser = null;
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, pseudoEmail, password);
        setStatusMessage('ログインしました。');
      } else {
        const credential = await createUserWithEmailAndPassword(auth, pseudoEmail, password);
        createdUser = credential.user;
        await setDoc(doc(db, 'userProfiles', createdUser.uid), {
          username: trimmedUsername,
          normalizedUsername,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'usernames', normalizedUsername), {
          uid: createdUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setStatusMessage('アカウントを作成しました。');
      }
    } catch (err) {
      console.error('Authentication error', err);
      if (authMode === 'register' && createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupErr) {
          console.error('Failed to rollback user creation', cleanupErr);
        }
      }
      const message =
        err.code === 'auth/email-already-in-use'
          ? 'このユーザー名はすでに利用されています。'
          : err.code === 'auth/invalid-email'
            ? 'ユーザー名の形式が正しくありません。'
            : err.code === 'auth/weak-password'
              ? 'パスワードは 6 文字以上にしてください。'
              : err.code === 'auth/operation-not-allowed'
                ? 'Email/Password 認証が無効になっています。Firebase コンソールで有効化してください。'
                : err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
                  ? 'ユーザー名またはパスワードが正しくありません。'
                  : '認証中にエラーが発生しました。';
      setError(message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUsernameForDisplay('');
      setProfileLoading(false);
      setStatusMessage('ログアウトしました。');
    } catch (err) {
      console.error(err);
      setError('ログアウトに失敗しました。');
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setStatusMessage('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const signedInUser = result.user;
      const profileRef = doc(db, 'userProfiles', signedInUser.uid);
      const snapshot = await getDoc(profileRef);
      if (!snapshot.exists()) {
        await setDoc(profileRef, {
          username: signedInUser.displayName ?? '',
          normalizedUsername: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(profileRef, {
          updatedAt: serverTimestamp(),
        });
      }
      setStatusMessage('Googleでログインしました。');
    } catch (err) {
      console.error('Google sign-in error', err);
      const message =
        err.code === 'auth/popup-closed-by-user'
          ? 'ログインがキャンセルされました。'
          : err.code === 'auth/popup-blocked'
            ? 'ポップアップがブロックされました。ブラウザの設定を確認してください。'
            : 'Google ログインに失敗しました。';
      setError(message);
    }
  };

  const handleAddMemo = async () => {
    if (!user) return;

    setError('');
    try {
      await addDoc(collection(db, 'memos'), {
        content: '',
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setError('メモの追加に失敗しました。');
    }
  };

  const handleMemoChange = async (memoId, value) => {
    setError('');
    setMemos((prevMemos) =>
      prevMemos.map((memo) => (memo.id === memoId ? { ...memo, content: value } : memo)),
    );

    try {
      const memoRef = doc(db, 'memos', memoId);
      await updateDoc(memoRef, {
        content: value,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      setError('メモの更新に失敗しました。');
    }
  };

  const handleRemoveMemo = async (memoId) => {
    setError('');
    try {
      const memoRef = doc(db, 'memos', memoId);
      await deleteDoc(memoRef);
    } catch (err) {
      console.error(err);
      setError('メモの削除に失敗しました。');
    }
  };

  return (
    <div className="container">
      <div className="App">
        {statusMessage && (
          <div className="status-toast" role="status" aria-live="polite">
            {statusMessage}
          </div>
        )}
        <header className="App-header">
          <h1>Memo Pad</h1>
          {authLoading ? (
            <p>読み込み中...</p>
          ) : user ? (
            <>
              <div className="user-info">
                <span>
                  ログイン中:{' '}
                  {profileLoading
                    ? 'ユーザー情報を読み込み中...'
                    : usernameForDisplay ||
                      user.displayName ||
                      user.email?.replace(USERNAME_EMAIL_SUFFIX, '')}
                </span>
                <button type="button" onClick={handleSignOut}>
                  ログアウト
                </button>
              </div>
              <button type="button" onClick={handleAddMemo} disabled={memoLoading}>
                メモを追加
              </button>
              {error && <p className="error-message">{error}</p>}
              {memoLoading ? (
                <p>メモを読み込み中です...</p>
              ) : (
                <ul className="memo-list">
                  {memos.map((memo) => (
                    <li key={memo.id}>
                      <textarea
                        value={memo.content}
                        onChange={(event) => handleMemoChange(memo.id, event.target.value)}
                      />
                      <button type="button" onClick={() => handleRemoveMemo(memo.id)}>
                        ×
                      </button>
                    </li>
                  ))}
                  {memos.length === 0 && <p>まだメモがありません。追加してみましょう。</p>}
                </ul>
              )}
            </>
          ) : (
            <div className="auth-card">
              <div className="auth-toggle">
                <button
                  type="button"
                  className={authMode === 'login' ? 'active' : ''}
                  onClick={() => handleAuthModeChange('login')}
                >
                  ログイン
                </button>
                <button
                  type="button"
                  className={authMode === 'register' ? 'active' : ''}
                  onClick={() => handleAuthModeChange('register')}
                >
                  新規登録
                </button>
              </div>
              <form className="auth-form" onSubmit={handleAuthSubmit}>
                <label htmlFor="username">ユーザー名</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="例: masaking"
                  autoComplete="username"
                />
                <label htmlFor="password">パスワード</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="6文字以上"
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                />
                <button type="submit">{authMode === 'login' ? 'ログイン' : '登録'}</button>
              </form>
              <div className="auth-separator">
                <span>または</span>
              </div>
              <button type="button" className="google-button" onClick={handleGoogleSignIn}>
                <span className="google-icon" aria-hidden="true">
                  G
                </span>
                Google でログイン
              </button>
              {error && <p className="error-message">{error}</p>}
            </div>
          )}
        </header>
        <footer>
          <p
            dangerouslySetInnerHTML={{
              __html:
                '&copy; <a href="https://masaking.pages.dev/" target="_blank" rel="noopener noreferrer">masaking</a>',
            }}
          />
        </footer>
      </div>
    </div>
  );
}

export default App;
