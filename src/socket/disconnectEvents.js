module.exports = (socket, io) => {
    socket.on("disconnect", () => {
        const username = socket.user?.username;
        const chatId = socket.chatId;
        if (username && chatId) {
            socket.to(chatId).emit("user-left", { username, socketId: socket.id });
            console.log(`${username} left room ${chatId}`);
        }
    });
};
