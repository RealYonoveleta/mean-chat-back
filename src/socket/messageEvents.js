const Message = require("../models/Message");
const Chat = require("../models/Chat");

module.exports = (socket, io) => {
    socket.on("chat-message", async (payload) => {
        const chatId = socket.chatId;
        const senderId = socket.user.userId;
        const senderUsername = socket.user.username;

        // Accept plain string (legacy) or { content, type } object
        const content = (typeof payload === "object" && payload !== null) ? payload.content : payload;
        const type = (typeof payload === "object" && payload !== null && payload.type) ? payload.type : "text";

        if (!chatId || !senderId || !content) {
            return socket.emit("error", "Invalid message payload or not in a chat");
        }

        try {
            const newMessage = await Message.create({
                chat: chatId,
                sender: senderId,
                content,
                type
            });

            await newMessage.populate("sender", "-passwordHash -__v");

            // Update chat lastMessage and updatedAt
            const lastMessageText = type === "location" ? `${senderUsername}: 📍 Location` : `${senderUsername}: ${content}`;
            const updatedChat = await Chat.findByIdAndUpdate(chatId, {
                lastMessage: lastMessageText,
                updatedAt: new Date()
            }, { new: true });

            // Notify all members so their chat list updates in real-time
            if (updatedChat) {
                updatedChat.members.forEach((memberId) => {
                    const memberSockets = [...io.sockets.sockets.values()]
                        .filter((s) => s.user?.userId?.toString() === memberId.toString());
                    memberSockets.forEach((s) => s.emit("chat-updated", {
                        _id: chatId,
                        lastMessage: lastMessageText,
                        updatedAt: updatedChat.updatedAt,
                    }));
                });
            }

            console.log(`Message from ${senderUsername} in ${chatId}: ${content}`);

            // Emit to ALL users in the room including the sender
            io.to(chatId).emit("chat-message", {
                _id: newMessage._id,
                chat: chatId,
                sender: newMessage.sender,
                content: newMessage.content,
                type: newMessage.type,
                createdAt: newMessage.createdAt,
            });
        } catch (err) {
            console.error("Error saving message:", err);
            socket.emit("error", "Could not save message");
        }
    });
};
