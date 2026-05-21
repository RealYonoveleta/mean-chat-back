const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const auth = require("../middleware/auth");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../utils/tokenUtils");

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueTokens(user, tokenToRotate = null) {
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const refreshPayload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    await RefreshToken.create({
        user: user._id,
        tokenHash,
        expiresAt: new Date(refreshPayload.exp * 1000)
    });

    if (tokenToRotate) {
        tokenToRotate.revokedAt = new Date();
        tokenToRotate.replacedByTokenHash = tokenHash;
        await tokenToRotate.save();
    }

    return { token, refreshToken };
}

// Register new User
router.post("/register", async (req, res) => {
    try {
        const { username, password, name, surname, email } = req.body;

        if (!username || !password || !name || !email) {
            return res.status(400).json({ error: "username, password, name and email are required" });
        }

        // Check if username or email already exists
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            if (existingUser.username === username) return res.status(400).json({ error: "Username already exists" });
            return res.status(400).json({ error: "Email already in use" });
        }

        // Hash password
        const passwordHash = await User.hashPassword(password);

        // Create and save user
        const newUser = new User({ username, passwordHash, name, surname: surname || '', email });
        await newUser.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Login User
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ error: "Invalid username or password" });

        // Check password
        const validPassword = await user.isValidPassword(password);
        if (!validPassword) return res.status(401).json({ error: "Invalid username or password" });

        const tokens = await issueTokens(user);

        res.json(tokens);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Rotate refresh token and issue a new access token
router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: "refreshToken is required" });
        }

        let payload;
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch {
            return res.status(401).json({ error: "Invalid or expired refresh token" });
        }

        const tokenHash = hashToken(refreshToken);
        const storedToken = await RefreshToken.findOne({ tokenHash }).populate("user");

        if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
            return res.status(401).json({ error: "Invalid or expired refresh token" });
        }

        if (storedToken.user._id.toString() !== payload.userId) {
            return res.status(401).json({ error: "Invalid refresh token" });
        }

        const tokens = await issueTokens(storedToken.user, storedToken);
        return res.json(tokens);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
});

router.post("/logout", async (req, res) => {
    try {
        const { refreshToken } = req.body || {};

        if (!refreshToken) {
            return res.status(204).send();
        }

        const tokenHash = hashToken(refreshToken);
        await RefreshToken.findOneAndUpdate(
            { tokenHash, revokedAt: null },
            { revokedAt: new Date() }
        );

        return res.status(204).send();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
});

// Get current user profile from token
router.get("/me", auth, (req, res) => {
    const { userId, username, name, surname, email } = req.user;
    res.json({ userId, username, name, surname, email });
});

// Get all users except current user
router.get("/users", auth, async (req, res) => {
    try {
        const users = await User.find(
            { _id: { $ne: req.user.userId } },
            { passwordHash: 0, __v: 0 }
        );
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;