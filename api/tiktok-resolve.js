const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36";

function validTikTokUrl(value) {
  try {
    const u = new URL(value);
    const h = u.hostname.toLowerCase();
    return h === "tiktok.com" || h.endsWith(".tiktok.com");
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST uniquement" });

  const input = String(req.body?.url || "").trim();
  if (!input || !validTikTokUrl(input)) {
    return res.status(400).json({ ok:false, error:"URL TikTok invalide" });
  }

  try {
    const endpoint = "https://www.tikwm.com/api/?hd=1";
    const body = new URLSearchParams({ url: input, hd: "1" });

    const r = await fetch(endpoint, {
      method:"POST",
      headers:{
        "user-agent":UA,
        "accept":"application/json",
        "content-type":"application/x-www-form-urlencoded; charset=UTF-8"
      },
      body
    });

    const json = await r.json().catch(() => null);
    if (!r.ok || !json || json.code !== 0 || !json.data) {
      return res.status(422).json({
        ok:false,
        error: json?.msg || "Impossible de résoudre cette vidéo TikTok."
      });
    }

    const d = json.data;
    const videoUrl = d.hdplay || d.play || d.wmplay || null;

    return res.status(200).json({
      ok:true,
      source:"tikwm-fallback",
      id:String(d.id || ""),
      title:d.title || "",
      author:d.author?.unique_id || d.author?.nickname || "",
      authorName:d.author?.nickname || "",
      cover:d.cover || d.origin_cover || "",
      videoUrl,
      duration:d.duration ?? null,
      stats:{
        plays:d.play_count ?? null,
        likes:d.digg_count ?? null,
        comments:d.comment_count ?? null,
        shares:d.share_count ?? null
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok:false,
      error:error?.message || "Erreur interne"
    });
  }
};