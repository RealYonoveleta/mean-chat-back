jest.mock("../src/middleware/auth", () => (req, res, next) => {
    req.user = { userId: "u1", username: "alice" };
    next();
});

jest.mock("../src/models/Chat", () => {
    const Chat = jest.fn();
    Chat.find = jest.fn();
    Chat.findOne = jest.fn();
    return Chat;
});

jest.mock("../src/models/Message", () => ({
    find: jest.fn()
}));

const express = require("express");
const request = require("supertest");
const Chat = require("../src/models/Chat");
const Message = require("../src/models/Message");
const chatRouterFactory = require("../src/routes/chat");

function buildIoMock() {
    return {
        sockets: {
            sockets: new Map()
        }
    };
}

function buildApp(io) {
    const app = express();
    app.use(express.json());
    app.use("/chat", chatRouterFactory(io));
    return app;
}

describe("chat routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("POST /chat creates chat and emits chat-created to connected members", async () => {
        const io = buildIoMock();

        const memberSocket1 = { user: { userId: "u1" }, emit: jest.fn() };
        const memberSocket2 = { user: { userId: "u2" }, emit: jest.fn() };
        const unrelatedSocket = { user: { userId: "u3" }, emit: jest.fn() };

        io.sockets.sockets = new Map([
            ["s1", memberSocket1],
            ["s2", memberSocket2],
            ["s3", unrelatedSocket]
        ]);

        Chat.mockImplementation((payload) => ({
            ...payload,
            _id: "chat1",
            save: jest.fn().mockResolvedValue(undefined),
            populate: jest.fn().mockResolvedValue(undefined)
        }));

        const app = buildApp(io);

        const res = await request(app).post("/chat").send({
            members: ["u2"],
            name: "General",
            isGroup: true
        });

        expect(Chat).toHaveBeenCalledWith({
            members: ["u2", "u1"],
            name: "General",
            isGroup: true
        });

        expect(memberSocket1.emit).toHaveBeenCalledWith("chat-created", expect.any(Object));
        expect(memberSocket2.emit).toHaveBeenCalledWith("chat-created", expect.any(Object));
        expect(unrelatedSocket.emit).not.toHaveBeenCalled();
        expect(res.status).toBe(201);
    });

    test("POST /chat returns 500 if chat creation throws", async () => {
        const io = buildIoMock();

        Chat.mockImplementation(() => ({
            save: jest.fn().mockRejectedValue(new Error("db fail")),
            populate: jest.fn()
        }));

        const app = buildApp(io);

        const res = await request(app).post("/chat").send({
            members: ["u2"],
            name: "General",
            isGroup: true
        });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Server error" });
    });

    test("GET /chat returns chats sorted by updatedAt", async () => {
        const io = buildIoMock();

        const sort = jest.fn().mockResolvedValue([{ _id: "c1" }]);
        const populate = jest.fn().mockReturnValue({ sort });
        Chat.find.mockReturnValue({ populate });

        const app = buildApp(io);
        const res = await request(app).get("/chat");

        expect(Chat.find).toHaveBeenCalledWith({ members: "u1" });
        expect(populate).toHaveBeenCalledWith("members", "-passwordHash -__v");
        expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ _id: "c1" }]);
    });

    test("GET /chat/:id returns 404 when chat does not exist", async () => {
        const io = buildIoMock();

        Chat.findOne.mockReturnValue({
            populate: jest.fn().mockResolvedValue(null)
        });

        const app = buildApp(io);
        const res = await request(app).get("/chat/chat1");

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Chat not found" });
    });

    test("GET /chat/:id returns chat when it exists", async () => {
        const io = buildIoMock();

        Chat.findOne.mockReturnValue({
            populate: jest.fn().mockResolvedValue({ _id: "chat1", members: ["u1", "u2"] })
        });

        const app = buildApp(io);
        const res = await request(app).get("/chat/chat1");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ _id: "chat1", members: ["u1", "u2"] });
    });

    test("GET /chat/:id/messages returns paginated messages", async () => {
        const io = buildIoMock();

        Chat.findOne.mockResolvedValue({ _id: "chat1", members: ["u1", "u2"] });

        const limit = jest.fn().mockResolvedValue([{ _id: "m1" }, { _id: "m2" }]);
        const skip = jest.fn().mockReturnValue({ limit });
        const sort = jest.fn().mockReturnValue({ skip });
        const populate = jest.fn().mockReturnValue({ sort });
        Message.find.mockReturnValue({ populate });

        const app = buildApp(io);

        const res = await request(app).get("/chat/chat1/messages?page=2&limit=10");

        expect(Chat.findOne).toHaveBeenCalledWith({ _id: "chat1", members: "u1" });
        expect(Message.find).toHaveBeenCalledWith({ chat: "chat1" });
        expect(populate).toHaveBeenCalledWith("sender", "-passwordHash -__v");
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(skip).toHaveBeenCalledWith(10);
        expect(limit).toHaveBeenCalledWith(10);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ _id: "m1" }, { _id: "m2" }]);
    });

    test("GET /chat/:id/messages returns 404 for unauthorized chat", async () => {
        const io = buildIoMock();

        Chat.findOne.mockResolvedValue(null);

        const app = buildApp(io);

        const res = await request(app).get("/chat/chat1/messages");

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Chat not found" });
    });

    test("GET /chat returns 500 when query fails", async () => {
        const io = buildIoMock();
        Chat.find.mockImplementation(() => {
            throw new Error("db fail");
        });

        const app = buildApp(io);
        const res = await request(app).get("/chat");

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Server error" });
    });

    test("GET /chat/:id returns 500 on unexpected error", async () => {
        const io = buildIoMock();
        Chat.findOne.mockImplementation(() => {
            throw new Error("db fail");
        });

        const app = buildApp(io);
        const res = await request(app).get("/chat/chat1");

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Server error" });
    });

    test("GET /chat/:id/messages returns 500 when message query fails", async () => {
        const io = buildIoMock();

        Chat.findOne.mockResolvedValue({ _id: "chat1", members: ["u1", "u2"] });
        Message.find.mockImplementation(() => {
            throw new Error("db fail");
        });

        const app = buildApp(io);
        const res = await request(app).get("/chat/chat1/messages");

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Server error" });
    });
});
