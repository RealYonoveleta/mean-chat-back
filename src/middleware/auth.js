const { verifyAccessToken } = require("../utils/tokenUtils");

module.exports = function auth(req, res, next) {
    const authHeader = req.headers.authorization;

    // No Authorization header present
    if (!authHeader) {
        return res.status(401).json({ error: "No token provided" });
    }

    // Expected format: "Bearer <token>"
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Invalid token format" });
    }

    try {
        const decoded = verifyAccessToken(token);

        // Attach the decoded payload to req.user
        req.user = decoded;

        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};
