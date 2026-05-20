const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const auth = require("../middleware/auth");

module.exports = (io) => {
    router.use(auth);

    // Create a new chat
    router.post("/", async (req, res) => {
        try {
            const { members, name, isGroup } = req.body;

            const allMembers = Array.from(new Set([...members, req.user.userId]));

            const chat = new Chat({
                members: allMembers,
                name,
                isGroup,
            });

            await chat.save();

            // Populate members for the response
            await chat.populate("members", "-passwordHash -__v");

            // Notify all members via socket
            allMembers.forEach((memberId) => {
                const memberSockets = [...io.sockets.sockets.values()]
                    .filter((s) => s.user?.userId?.toString() === memberId.toString());
                memberSockets.forEach((s) => s.emit("chat-created", chat));
            });

            res.status(201).json(chat);
        } catch (err) {
            console.error("Error creating chat: ", err);
            res.status(500).json({ error: "Server error" });
        }
    });

    // Get all chats for the current user
    router.get("/", async (req, res) => {
        try {
            const chats = await Chat.find({ members: req.user.userId })
                .populate("members", "-passwordHash -__v")
                .sort({ updatedAt: -1 });
            res.json(chats);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    });

    // Get a single chat by ID
    router.get("/:id", async (req, res) => {
        try {
            const chat = await Chat.findOne({ _id: req.params.id, members: req.user.userId })
                .populate("members", "-passwordHash -__v");
            if (!chat) return res.status(404).json({ error: "Chat not found" });
            res.json(chat);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    });

    // Get paginated messages for a chat
    router.get("/:id/messages", async (req, res) => {
        try {
            const { id } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 30;
            const skip = (page - 1) * limit;

            const chat = await Chat.findOne({ _id: id, members: req.user.userId });
            if (!chat) return res.status(404).json({ error: "Chat not found" });

            const messages = await Message.find({ chat: id })
                .populate("sender", "-passwordHash -__v")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            res.json(messages);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server error" });
        }
    });

    return router;
};
