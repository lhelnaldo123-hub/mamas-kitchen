const { db } = require("../lib/db");
const { getUser } = require("../lib/auth");
const MENU = require("../lib/menu");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in first" });

  const { customer, note, items } = req.body || {};
  if (!customer || !note || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing details" });
  }

  const lines = [];
  let total = 0;
  for (const i of items) {
    const m = MENU.find((x) => x.id === i.id);
    const qty = parseInt(i.qty);
    if (!m || !(qty > 0) || qty > 50) {
      return res.status(400).json({ error: "Bad item in order" });
    }
    lines.push({ name: m.name, qty, price: m.price });
    total += m.price * qty;
  }

  try {
    const ref = await db.collection("orders").add({
      uid: user.uid,
      customer: String(customer).slice(0, 60),
      contact: user.email || user.phone_number || "",
      note: String(note).slice(0, 120),
      items: lines,
      total,
      status: "new",
      createdAt: Date.now(),
    });
    res.status(201).json({ id: ref.id, total });
  } catch (e) {
    res.status(500).json({ error: "Could not save order" });
  }
};
