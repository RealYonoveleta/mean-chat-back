jest.mock("../src/models/Message", () => ({
    create: jest.fn()
}));

jest.mock("../src/models/Chat", () => ({
    findByIdAndUpdate: jest.fn()
}));

const Message = require("../src/models/Message");
const Chat = require("../src/models/Chat");
const messageEvents = require("../src/socket/messageEvents");

function buildSocket() {
    const handlers = {};
    return {
        id: "socket-1",
        user: { userId: "u1", username: "alice" },
        chatId: "chat1",
        on: jest.fn((event, cb) => {
            handlers[event] = cb;
        }),
        emit: jest.fn(),
        handlers
    };
}

function buildIo(memberSockets, roomEmitter) {
    return {
        sockets: {
            sockets: new Map(memberSockets)
        },
        to: jest.fn(() => ({ emit: roomEmitter }))
    };
}

describe("socket messageEvents", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("emits validation error when payload is invalid", async () => {
        const socket = buildSocket();
        socket.chatId = undefined;
        const io = buildIo([], jest.fn());

        messageEvents(socket, io);

        await socket.handlers["chat-message"]("hello");

        expect(socket.emit).toHaveBeenCalledWith("error", "Invalid message payload or not in a chat");
    });

    test("creates message, updates chat and emits events", async () => {
        const roomEmitter = jest.fn();
        const memberSocket1 = { user: { userId: "u1" }, emit: jest.fn() };
        const memberSocket2 = { user: { userId: "u2" }, emit: jest.fn() };
        const io = buildIo([
            ["s1", memberSocket1],
            ["s2", memberSocket2],
            ["s3", { user: { userId: "u3" }, emit: jest.fn() }]
        ], roomEmitter);

        const newMessage = {
            _id: "m1",
            sender: { userId: "u1", username: "alice" },
            content: "hola",
            type: "text",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            populate: jest.fn().mockResolvedValue(undefined)
        };

        Message.create.mockResolvedValue(newMessage);
        Chat.findByIdAndUpdate.mockResolvedValue({
            members: ["u1", "u2"],
            updatedAt: new Date("2026-01-01T00:00:10.000Z")
        });

        const socket = buildSocket();
        messageEvents(socket, io);

        await socket.handlers["chat-message"]({ content: "hola", type: "text" });

        expect(Message.create).toHaveBeenCalledWith({
            chat: "chat1",
            sender: "u1",
            content: "hola",
            type: "text"
        });
        expect(newMessage.populate).toHaveBeenCalledWith("sender", "-passwordHash -__v");
        expect(Chat.findByIdAndUpdate).toHaveBeenCalledWith(
            "chat1",
            expect.objectContaining({ lastMessage: "alice: hola" }),
            { new: true }
        );

        expect(memberSocket1.emit).toHaveBeenCalledWith("chat-updated", expect.any(Object));
        expect(memberSocket2.emit).toHaveBeenCalledWith("chat-updated", expect.any(Object));

        expect(io.to).toHaveBeenCalledWith("chat1");
        expect(roomEmitter).toHaveBeenCalledWith("chat-message", {
            _id: "m1",
            chat: "chat1",
            sender: { userId: "u1", username: "alice" },
            content: "hola",
            type: "text",
            createdAt: newMessage.createdAt
        });
    });

    test("formats location message for lastMessage text", async () => {
        const roomEmitter = jest.fn();
        const io = buildIo([], roomEmitter);

        const newMessage = {
            _id: "m2",
            sender: { userId: "u1", username: "alice" },
            content: { lat: 0, lon: 0 },
            type: "location",
            createdAt: new Date(),
            populate: jest.fn().mockResolvedValue(undefined)
        };

        Message.create.mockResolvedValue(newMessage);
        Chat.findByIdAndUpdate.mockResolvedValue(null);

        const socket = buildSocket();
        messageEvents(socket, io);

        await socket.handlers["chat-message"]({ content: { lat: 0, lon: 0 }, type: "location" });

        const updatePayload = Chat.findByIdAndUpdate.mock.calls[0][1];
        expect(updatePayload.lastMessage).toContain("Location");
    });

    test("emits error when saving message fails", async () => {
        const roomEmitter = jest.fn();
        const io = buildIo([], roomEmitter);

        Message.create.mockRejectedValue(new Error("db fail"));

        const socket = buildSocket();
        messageEvents(socket, io);

        await socket.handlers["chat-message"]("hello");

        expect(socket.emit).toHaveBeenCalledWith("error", "Could not save message");
    });
});
