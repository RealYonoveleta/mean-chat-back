const jwt = require("jsonwebtoken");

function generateAccessToken(user) {
    return jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
    );
}

function verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}

function verifyRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
}