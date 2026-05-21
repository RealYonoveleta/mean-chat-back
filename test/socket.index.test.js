jest.mock("jsonwebtoken", () => ({
    verify: jest.fn()
}));

jest.mock("../src/socket/userEvents", () => jest.fn());
jest.mock("../src/socket/messageEvents", () => jest.fn());
jest.mock("../src/socket/chatEvents", () => jest.fn());
jest.mock("../src/socket/disconnectEvents", () => jest.fn());

const jwt = require("jsonwebtoken");
const userEvents = require("../src/socket/userEvents");
const messageEvents = require("../src/socket/messageEvents");
const chatEvents = require("../src/socket/chatEvents");
const disconnectEvents = require("../src/socket/disconnectEvents");
const socketIndex = require("../src/socket");

function buildIo() {
    return {
        use: jest.fn(),
        on: jest.fn()
    };
}

describe("socket index", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("socket auth middleware rejects connection without token", () => {
        const io = buildIo();
        socketIndex(io);

        const middleware = io.use.mock.calls[0][0];
        const next = jest.fn();
        const socket = { handshake: { auth: {} } };

        middleware(socket, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toBe("No token provided");
    });

    test("socket auth middleware rejects invalid token", () => {
        const io = buildIo();
        jwt.verify.mockImplementation(() => {
            throw new Error("invalid");
        });

        socketIndex(io);

        const middleware = io.use.mock.calls[0][0];
        const next = jest.fn();
        const socket = { handshake: { auth: { token: "bad-token" } } };

        middleware(socket, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toBe("Invalid or expired token");
    });

    test("socket auth middleware attaches user for valid token", () => {
        const io = buildIo();
        jwt.verify.mockReturnValue({ userId: "u1", username: "alice" });

        socketIndex(io);

        const middleware = io.use.mock.calls[0][0];
        const next = jest.fn();
        const socket = { handshake: { auth: { token: "ok-token" } } };

        middleware(socket, next);

        expect(jwt.verify).toHaveBeenCalledWith("ok-token", process.env.JWT_SECRET);
        expect(socket.user).toEqual({ userId: "u1", username: "alice" });
        expect(next).toHaveBeenCalledWith();
    });

    test("registers all event modules and emits user-left on disconnect", () => {
        const io = buildIo();
        socketIndex(io);

        const connectionHandler = io.on.mock.calls.find(([event]) => event === "connection")[1];

        const roomEmitter = { emit: jest.fn() };
        const socket = {
            id: "socket-1",
            user: { _id: "u1", username: "alice" },
            on: jest.fn(),
            rooms: new Set(["socket-1", "chat1", "chat2"]),
            to: jest.fn(() => roomEmitter)
        };

        connectionHandler(socket);

        expect(userEvents).toHaveBeenCalledWith(socket, io);
        expect(messageEvents).toHaveBeenCalledWith(socket, io);
        expect(chatEvents).toHaveBeenCalledWith(socket, io);
        expect(disconnectEvents).toHaveBeenCalledWith(socket, io);

        const disconnectHandler = socket.on.mock.calls.find(([event]) => event === "disconnect")[1];
        disconnectHandler();

        expect(socket.to).toHaveBeenCalledWith("chat1");
        expect(socket.to).toHaveBeenCalledWith("chat2");
        expect(roomEmitter.emit).toHaveBeenCalledWith("user-left", {
            userId: "u1",
            username: "alice",
            socketId: "socket-1"
        });
    });
});
