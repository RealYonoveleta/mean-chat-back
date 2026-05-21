const jwt = require("jsonwebtoken");

let warnedRefreshFallback = false;

function getAccessSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return secret;
}

function getRefreshSecret() {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

    if (!refreshSecret) {
        throw new Error("JWT_REFRESH_SECRET is not configured and JWT_SECRET fallback is unavailable");
    }

    if (!process.env.JWT_REFRESH_SECRET && !warnedRefreshFallback) {
        console.warn("JWT_REFRESH_SECRET is missing. Falling back to JWT_SECRET for refresh tokens.");
        warnedRefreshFallback = true;
    }

    return refreshSecret;
}

function generateAccessToken(user) {
    return jwt.sign(
        { userId: user._id, username: user.username, name: user.name, surname: user.surname, email: user.email },
        getAccessSecret(),
        { expiresIn: "1h" }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { userId: user._id, username: user.username },
        getRefreshSecret(),
        { expiresIn: "7d" }
    );
}

function verifyAccessToken(token) {
    return jwt.verify(token, getAccessSecret());
}

function verifyRefreshToken(token) {
    return jwt.verify(token, getRefreshSecret());
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
}