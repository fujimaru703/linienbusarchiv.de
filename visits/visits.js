// サムネイル写真が未配置でも、壊れた画像アイコンを出さずに仮表示にします。
document.querySelectorAll('.city-photo').forEach((img) => {
  const markUnavailable = () => img.classList.add('is-unavailable');
  img.addEventListener('error', markUnavailable, { once: true });
  if (img.complete && img.naturalWidth === 0) markUnavailable();
});
