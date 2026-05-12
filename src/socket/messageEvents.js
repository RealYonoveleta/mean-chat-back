const Message = require("../models/Message");
const Chat = require("../models/Chat");

module.exports = (socket, io) => {
    socket.on("chat-message", async (content) => {
        const chatId = socket.chatId;
        const senderId = socket.user.userId;
        const senderUsername = socket.user.username;

        if (!chatId || !senderId || !content) {
            return socket.emit("error", "Invalid message payload or not in a chat");
        }

        try {
            const newMessage = await Message.create({
                chat: chatId,
                sender: senderId,
                content
            });

            await newMessage.populate("sender", "-passwordHash -__v");

            // Update chat lastMessage and updatedAt
            await Chat.findByIdAndUpdate(chatId, {
                lastMessage: `${senderUsername}: ${content}`,
                updatedAt: new Date()
            });

            console.log(`Message from ${senderUsername} in ${chatId}: ${content}`);

            // Emit to ALL users in the room including the sender
            io.to(chatId).emit("chat-message", {
                _id: newMessage._id,
                chat: chatId,
                sender: newMessage.sender,
                content: newMessage.content,
                createdAt: newMessage.createdAt,
            });
        } catch (err) {
            console.error("Error saving message:", err);
            socket.emit("error", "Could not save message");
        }
    });
};
