jest.mock("../src/models/Chat", () => ({
    findById: jest.fn()
}));

const Chat = require("../src/models/Chat");
const chatEvents = require("../src/socket/chatEvents");

function buildSocket() {
    const handlers = {};
    const roomEmitter = { emit: jest.fn() };

    const socket = {
        id: "socket-1",
        user: { userId: "u1", username: "alice" },
        chatId: undefined,
        on: jest.fn((event, cb) => {
            handlers[event] = cb;
        }),
        emit: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        to: jest.fn(() => roomEmitter),
        handlers,
        roomEmitter
    };

    return socket;
}

describe("socket chatEvents", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("join-chat emits error when chatId is missing", async () => {
        const socket = buildSocket();

        chatEvents(socket, {});

        await socket.handlers["join-chat"]({});

        expect(socket.emit).toHaveBeenCalledWith("error", "chatId required");
    });

    test("join-chat emits not found when chat does not exist", async () => {
        const socket = buildSocket();
        Chat.findById.mockResolvedValue(null);

        chatEvents(socket, {});

        await socket.handlers["join-chat"]({ chatId: "chat1" });

        expect(socket.emit).toHaveBeenCalledWith("error", "Chat not found");
    });

    test("join-chat denies access for non-members", async () => {
        const socket = buildSocket();
        Chat.findById.mockResolvedValue({ members: ["u2", "u3"] });

        chatEvents(socket, {});

        await socket.handlers["join-chat"]({ chatId: "chat1" });

        expect(socket.emit).toHaveBeenCalledWith("error", "Access denied");
    });

    test("join-chat joins room and notifies others for members", async () => {
        const socket = buildSocket();
        Chat.findById.mockResolvedValue({ members: ["u1", "u2"] });

        chatEvents(socket, {});

        await socket.handlers["join-chat"]({ chatId: "chat1" });

        expect(socket.join).toHaveBeenCalledWith("chat1");
        expect(socket.chatId).toBe("chat1");
        expect(socket.to).toHaveBeenCalledWith("chat1");
        expect(socket.roomEmitter.emit).toHaveBeenCalledWith("user-joined", {
            username: "alice",
            socketId: "socket-1"
        });
    });

    test("leave-chat leaves room and emits user-left", () => {
        const socket = buildSocket();
        socket.chatId = "chat1";

        chatEvents(socket, {});

        socket.handlers["leave-chat"]();

        expect(socket.leave).toHaveBeenCalledWith("chat1");
        expect(socket.to).toHaveBeenCalledWith("chat1");
        expect(socket.roomEmitter.emit).toHaveBeenCalledWith("user-left", {
            username: "alice",
            socketId: "socket-1"
        });
        expect(socket.chatId).toBeUndefined();
    });

    test("leave-chat does nothing when there is no active chat", () => {
        const socket = buildSocket();
        socket.chatId = undefined;

        chatEvents(socket, {});

        socket.handlers["leave-chat"]();

        expect(socket.leave).not.toHaveBeenCalled();
        expect(socket.to).not.toHaveBeenCalled();
    });

    test("join-chat emits server error when model throws", async () => {
        const socket = buildSocket();
        Chat.findById.mockRejectedValue(new Error("db fail"));

        chatEvents(socket, {});

        await socket.handlers["join-chat"]({ chatId: "chat1" });

        expect(socket.emit).toHaveBeenCalledWith("error", "Server error");
    });
});
