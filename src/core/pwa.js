/* ===========================================================
   pwa.js · Service Worker 注册

   ⚠ 安全上下文限制：Service Worker 只在 https 或 localhost/127.0.0.1
      下可用。手机通过 http://192.168.x.x:4173 访问时是不安全上下文，
      注册会失败——这里是静默降级，网站功能完全不受影响，
      只是没有离线能力。

   开发提示：SW 会把旧版本留在缓存里。改了代码却看不到效果时，
   到 DevTools → Application → Service Workers 点 Unregister，
   或勾选 "Bypass for network"。
   =========================================================== */

export function initPWA() {
  if (!('serviceWorker' in navigator)) return false;

  if (!window.isSecureContext) {
    console.info('[pwa] 当前不是安全上下文（局域网 IP 访问），跳过 Service Worker 注册；'
      + '网站功能不受影响，仅离线能力不可用。');
    return false;
  }

  const register = () => {
    /* 用相对路径注册，scope 交给浏览器按脚本位置推导（'./sw.js' → 同级目录）。
       早先写死了 '/sw.js' + scope:'/'——只有部署在域名根目录才能跑，
       放到 GitHub Pages 的项目页（用户名.github.io/仓库名/）会直接 404。 */
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.info('[pwa] Service Worker 已注册，scope =', reg.scope);
        reg.addEventListener('updatefound', () => {
          console.info('[pwa] 检测到新版本，正在后台更新，下次打开即为新版。');
        });
      })
      .catch((err) => {
        /* 注册失败不该影响占卜流程，只记录 */
        console.warn('[pwa] Service Worker 注册失败：', err?.message || err);
      });
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
  return true;
}
