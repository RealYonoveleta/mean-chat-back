const jwt = require("jsonwebtoken");

const eventModules = [
    { name: "UserEvents", module: require("./userEvents") },
    { name: "MessageEvents", module: require("./messageEvents") },
    { name: "ChatEvents", module: require("./chatEvents") },
    { name: "DisconnectEvents", module: require("./disconnectEvents") }
];

function registerModules(socket, io) {
    eventModules.forEach(({ name, module }) => {
        module(socket, io);
    });
}

module.exports = (io) => {
    // AUTH MIDDLEWARE
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error("No token provided"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Attach user data to the socket
            socket.user = decoded;

            next();
        } catch (err) {
            next(new Error("Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        console.log("Connected socket:", socket.id, "User:", socket.user);

        // Register all event modules
        registerModules(socket, io);

        socket.on("disconnect", () => {
            console.log("User disconnected: ", socket.user.username);

            // Emit to all rooms the user was part of
            socket.rooms.forEach((roomId) => {
                if (roomId !== socket.id) { // skip private room
                    socket.to(roomId).emit("user-left", {
                        userId: socket.user._id,
                        username: socket.user.username,
                        socketId: socket.id
                    });
                }
            });
        });
    });
}