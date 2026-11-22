export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) return false;
  const res = await fetch(`https://api.telegram.org/bot${t}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return res.ok;
}
