const { db } = require("../lib/db");
const { getUser, isAdmin } = require("../lib/auth");

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in" });
  if (!isAdmin(user)) {
    return res.status(403).json({ error: "This account is not allowed to view the kitchen" });
  }

  try {
    if (req.method === "POST") {
      const { id, status } = req.body || {};
      if (!id || !["new", "preparing", "done"].includes(status)) {
        return res.status(400).json({ error: "Bad request" });
      }
      await db.collection("orders").doc(id).update({ status });
      return res.status(200).json({ ok: true });
    }
    const snap = await db.collection("orders").orderBy("createdAt", "desc").limit(50).get();
    res.status(200).json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};
