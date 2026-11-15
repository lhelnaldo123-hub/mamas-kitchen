module.exports = (req, res) => {
  try {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).json(JSON.parse(process.env.FIREBASE_WEB_CONFIG));
  } catch (e) {
    res.status(500).json({ error: "FIREBASE_WEB_CONFIG missing or invalid" });
  }
};
