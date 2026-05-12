const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

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

        // Create JWT Token
        const token = jwt.sign(
            { userId: user._id, username: user.username, name: user.name, surname: user.surname, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({ accessToken });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
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