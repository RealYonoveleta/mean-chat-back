const disconnectEvents = require("../src/socket/disconnectEvents");

function buildSocket() {
    const handlers = {};
    const roomEmitter = { emit: jest.fn() };

    return {
        id: "socket-1",
        user: { username: "alice" },
        chatId: "chat1",
        on: jest.fn((event, cb) => {
            handlers[event] = cb;
        }),
        to: jest.fn(() => roomEmitter),
        handlers,
        roomEmitter
    };
}

describe("socket disconnectEvents", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("emits user-left on disconnect when user and chat are present", () => {
        const socket = buildSocket();

        disconnectEvents(socket, {});
        socket.handlers.disconnect();

        expect(socket.to).toHaveBeenCalledWith("chat1");
        expect(socket.roomEmitter.emit).toHaveBeenCalledWith("user-left", {
            username: "alice",
            socketId: "socket-1"
        });
    });

    test("does nothing on disconnect when chatId is missing", () => {
        const socket = buildSocket();
        socket.chatId = undefined;

        disconnectEvents(socket, {});
        socket.handlers.disconnect();

        expect(socket.to).not.toHaveBeenCalled();
        expect(socket.roomEmitter.emit).not.toHaveBeenCalled();
    });
});
