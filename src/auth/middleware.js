const { verifyJwt } = require("./jwt");

function requireAuth(req, res, next) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyJwt(token);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED" });
  }
}

module.exports = { requireAuth };

