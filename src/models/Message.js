const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    type: { type: String, enum: ["text", "location"], default: "text" },
    createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", messageSchema);
module.exports = Message;