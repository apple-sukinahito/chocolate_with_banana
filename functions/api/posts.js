export async function onRequest(context) {
  const { request, env } = context;

  // 1. 投稿一覧の読み込み (GETリクエスト)
  if (request.method === "GET") {
    try {
      // 返信も含めてすべての投稿を取得（IDが古い順＝上から下へ流れるように表示）
      const { results } = await env.DB.prepare(
        "SELECT * FROM posts ORDER BY id ASC"
      ).all();
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  // 2. 新しい投稿の書き込み (POSTリクエスト)
  if (request.method === "POST") {
    try {
      const data = await request.json();
      
      const name = data.name.trim() || "名無しさん";
      const message = data.message.trim();
      // 返信先のID（なければ null）
      const replyTo = data.reply_to ? parseInt(data.reply_to, 10) : null;

      if (!message) {
        return new Response("メッセージが空です", { status: 400 });
      }

      // ユーザーIDの自動割り当て (IPアドレス＋日付)
      const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
      const today = new Date().toISOString().slice(0, 10);
      const baseString = ip + today;
      
      const msgUint8 = new TextEncoder().encode(baseString);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const userId = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 8);

      // データベース(D1)に保存 (+9 hours して日本時間にする)
      await env.DB.prepare(
        "INSERT INTO posts (name, user_id, message, reply_to, created_at) VALUES (?, ?, ?, ?, datetime('now', '+9 hours'))"
      ).bind(name, userId, message, replyTo).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
