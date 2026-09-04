/*
  将来のWeb Push通知用「準備工事」

  現時点では呼び出しても通知購読しません。
  将来以下を追加するとき、このファイルを拡張します。

  1. Notification.requestPermission()
  2. registration.pushManager.subscribe(...)
  3. VAPID公開鍵
  4. PushSubscriptionをCloudflare WorkerへPOST
  5. D1へ購読情報保存
  6. WorkerからWeb Push送信

  iPhone/iPadではホーム画面に追加したPWAから通知許可を求める運用を想定。
*/

window.FukushimaBusPush = {
  supported() {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  },

  async status() {
    return {
      supported: this.supported(),
      permission:
        "Notification" in window
          ? Notification.permission
          : "unsupported",
      configured: false
    };
  },

  // 将来ここへ実装。
  async subscribe() {
    throw new Error(
      "Web Pushは準備工事のみです。現在は購読機能を有効化していません。"
    );
  }
};
