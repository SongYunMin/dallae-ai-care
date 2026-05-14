export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>화면을 불러오지 못했어요</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>화면을 불러오지 못했어요</h1>
      <p>잠시 후 다시 시도하거나 홈으로 돌아가 주세요.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">다시 시도</button>
        <a class="secondary" href="/">홈으로</a>
      </div>
    </div>
  </body>
</html>`;
}
