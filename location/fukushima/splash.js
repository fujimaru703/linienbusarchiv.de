(() => {
  "use strict";

  const SPLASH_ID = "appSplash";
  const MIN_VISIBLE_MS = 900;
  const FORCE_HIDE_MS = 8000;

  const startedAt = performance.now();
  let hidden = false;
  let readyRequested = false;

  function getSplash() {
    return document.getElementById(SPLASH_ID);
  }

  function removeAfterFade(splash) {
    window.setTimeout(() => {
      splash?.remove();
    }, 450);
  }

  function hideSplash() {
    if (hidden) return;
    hidden = true;

    const splash = getSplash();
    if (!splash) return;

    splash.classList.add("app-splash-hide");
    removeAfterFade(splash);
  }

  function requestHide() {
    if (readyRequested) return;
    readyRequested = true;

    const elapsed = performance.now() - startedAt;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

    window.setTimeout(hideSplash, wait);
  }

  // 既存アプリ側から明示的に呼べるよう公開。
  // 地図や初回データ取得の完了時に:
  //   window.FukushimaBusSplash.ready();
  window.FukushimaBusSplash = {
    ready: requestHide,
    hide: hideSplash
  };

  // 何も手を入れなくても動く初期版:
  // window.load 完了後に自動で閉じる。
  window.addEventListener("load", requestHide, { once: true });

  // 外部API障害等でも永遠に残らない安全弁。
  window.setTimeout(requestHide, FORCE_HIDE_MS);
})();
