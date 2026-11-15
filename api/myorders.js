const { db } = require("../lib/db");
const { getUser } = require("../lib/auth");

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Please sign in" });

  try {
    const snap = await db.collection("orders").where("uid", "==", user.uid).limit(50).get();
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt - a.createdAt);
    res.status(200).json(list);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
};
