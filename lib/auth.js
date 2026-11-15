const { admin } = require("./db");

async function getUser(req) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return null;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (e) {
    return null;
  }
}

function isAdmin(user) {
  if (!user || user.email_verified !== true) return false;
  const list = (process.env.ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes((user.email || "").toLowerCase());
}

module.exports = { getUser, isAdmin };
