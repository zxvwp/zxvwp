import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🎯 GANTIKAN ini dengan info projek anda
const supabase = createClient(
  "https://kjssvigtkhwefyaibsec.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqc3N2aWd0a2h3ZWZ5YWlic2VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2MDk2NTUsImV4cCI6MjA2NTE4NTY1NX0.rahqRaepNs_MLh0y0_za-r0P_h_Ve2936HvbW7OvEY8"
);

let sessionTag = null;
const input = document.getElementById("cliInput");
const output = document.getElementById("output");

const print = (text) => {
  output.innerText += "\n" + text;
  output.scrollTop = output.scrollHeight;
};

const commands = {
  help() {
    return `
📜 SENARAI ARAHAN
signup <password>         → daftar akaun
login <tag> <password>    → log masuk
stats                     → lihat info akaun
givebuzz <tag> <jumlah>   → beri buzz ke player lain
viewlog                  → lihat log transaksi
born                      → tarikh daftar
calendar                  → tarikh semasa
clock                     → waktu semasa
tier                      → status tier
bankpublic                → lihat buzz dalam bank umum
`;
  },

  async signup(password) {
    if (!password || password.length < 6) return "❌ Password mesti ≥ 6 aksara.";

    const { data: last, error: lastErr } = await supabase
      .from("accounts")
      .select("tag")
      .order("tag", { ascending: false })
      .limit(1);

    if (lastErr) return "❌ Gagal semak tag.";
    let lastTag = last[0]?.tag || "000";
    let nextTag = String(parseInt(lastTag) + 1).padStart(3, "0");

    const { error: accErr } = await supabase.from("accounts").insert({
      tag: nextTag,
      password,
    });
    if (accErr) return `❌ Signup gagal: ${accErr.message}`;

    await supabase.from("players").insert({
      tag: nextTag,
      buzz: 0,
      tier: "A",
      born: new Date().toISOString().split("T")[0],
    });

    sessionTag = nextTag;
    return `✅ Berjaya daftar. TAG anda: ${nextTag}`;
  },

  async login(tag, password) {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("tag", tag)
      .eq("password", password)
      .maybeSingle();

    if (error || !data) return "❌ Login gagal.";
    sessionTag = tag;
    return `✅ Selamat datang, TAG ${tag}`;
  },

  async stats() {
    if (!sessionTag) return "❌ Perlu login dahulu.";
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("tag", sessionTag)
      .single();
    return `📌 TAG: ${data.tag}\n⚡ BUZZ: ${data.buzz}\n🏅 TIER: ${data.tier}\n🗓️ BORN: ${data.born}`;
  },

  async born() {
    if (!sessionTag) return "❌ Login dahulu.";
    const { data } = await supabase
      .from("players")
      .select("born")
      .eq("tag", sessionTag)
      .single();
    return `🗓️ Anda daftar pada: ${data.born}`;
  },

  clock() {
    return `🕒 Jam: ${new Date().toLocaleTimeString()}`;
  },

  calendar() {
    return `📅 Tarikh: ${new Date().toLocaleDateString()}`;
  },

  async bankpublic() {
    const { data } = await supabase
      .from("bank_public")
      .select("balance")
      .eq("id", 1)
      .single();
    return `🏦 Bank Public: ${data.balance} BUZZ`;
  },

  async tier() {
    if (!sessionTag) return "❌ Login dahulu.";
    const { data } = await supabase
      .from("players")
      .select("tier, born")
      .eq("tag", sessionTag)
      .single();

    const daysSince = Math.floor((Date.now() - new Date(data.born)) / (1000 * 60 * 60 * 24));
    const nextTierIn = 30 - (daysSince % 30);
    return `🏅 TIER: ${data.tier}\n📆 Hari ke-${daysSince}\n⏳ Lagi ${nextTierIn} hari ke tier seterusnya.`;
  },

  async givebuzz(toTag, amount) {
    if (!sessionTag) return "❌ Login dahulu.";
    amount = parseInt(amount);
    if (!toTag || isNaN(amount) || amount <= 0) return "❌ Format: givebuzz <tag> <jumlah>";

    const { data: me } = await supabase
      .from("players")
      .select("buzz")
      .eq("tag", sessionTag)
      .single();
    if (me.buzz < amount) return "❌ BUZZ tidak mencukupi.";

    await supabase.rpc("transfer_buzz", {
      from_tag: sessionTag,
      to_tag: toTag,
      buzz_amount: amount,
    });

    return `✅ ${amount} BUZZ dihantar ke ${toTag}`;
  },

  async viewlog() {
    if (!sessionTag) return "❌ Login dahulu.";
    const { data } = await supabase
      .from("buzz_logs")
      .select("*")
      .or(`from_tag.eq.${sessionTag},to_tag.eq.${sessionTag}`)
      .order("timestamp", { ascending: false })
      .limit(5);
    return data.map(log => `📦 ${log.from_tag} → ${log.to_tag} : ${log.amount}`).join("\n") || "Tiada transaksi.";
  },
};

input.addEventListener("keydown", async (e) => {
  if (e.key === "Enter") {
    const commandLine = input.value.trim();
    print(`\n> ${commandLine}`);
    input.value = "";

    const [cmd, ...args] = commandLine.split(" ");
    if (!commands[cmd]) return print("❌ Command tidak wujud.");
    const result = await commands[cmd](...args);
    if (result) print(result);
  }
});
