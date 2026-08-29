export async function onRequest(context) {
  const { request, env } = context;

  // 1. 投稿一覧の読み込み (GETリクエスト)
  if (request.method === "GET") {
    try {
      const { results } = await env.DB.prepare(
        "SELECT * FROM posts ORDER BY id DESC"
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
      
      // 名前が空なら「名無しさん」にする
      const name = data.name.trim() || "ばなな";
      const message = data.message.trim();

      if (!message) {
        return new Response("メッセージが空です", { status: 400 });
      }

      // 簡易的なユーザーIDの自動割り当て (IPアドレスや日付を元に暗号化)
      // ※Cloudflareのハッシュ化関数(Web Crypto API)を使用
      const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
      const today = new Date().toISOString().slice(0, 10); // 例: 2026-08-29
      const baseString = ip + today;
      
      const msgUint8 = new TextEncoder().encode(baseString);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const userId = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").substring(0, 8); // 先頭8文字をID化

      // データベース(D1)に保存
      await env.DB.prepare(
        "INSERT INTO posts (name, user_id, message) VALUES (?, ?, ?)"
      ).bind(name, userId, message).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(err.message, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
