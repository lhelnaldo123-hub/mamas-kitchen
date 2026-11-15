const MENU = require("../lib/menu");

module.exports = (req, res) => {
  res.status(200).json(MENU);
};
