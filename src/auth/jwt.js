const jwt = require("jsonwebtoken");
const { env } = require("../env");

function signJwt(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "30d" });
}

function verifyJwt(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = { signJwt, verifyJwt };

