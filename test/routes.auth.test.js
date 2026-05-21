jest.mock("../src/models/User", () => {
    const User = jest.fn();
    User.findOne = jest.fn();
    User.find = jest.fn();
    User.hashPassword = jest.fn();
    return User;
});

jest.mock("../src/models/RefreshToken", () => ({
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn()
}));

jest.mock("../src/utils/tokenUtils", () => ({
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
    verifyAccessToken: jest.fn()
}));

const express = require("express");
const request = require("supertest");
const User = require("../src/models/User");
const RefreshToken = require("../src/models/RefreshToken");
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    verifyAccessToken
} = require("../src/utils/tokenUtils");
const authRouter = require("../src/routes/auth");

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRouter);
    return app;
}

describe("auth routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();

        User.hashPassword.mockResolvedValue("hashed-password");
        User.find.mockResolvedValue([]);
        User.mockImplementation((payload) => ({
            ...payload,
            save: jest.fn().mockResolvedValue(undefined)
        }));

        generateAccessToken.mockReturnValue("access-token");
        generateRefreshToken.mockReturnValue("refresh-token");
        verifyRefreshToken.mockReturnValue({ userId: "u1", exp: Math.floor(Date.now() / 1000) + 3600 });
        verifyAccessToken.mockReturnValue({
            userId: "u1",
            username: "alice",
            name: "Alice",
            surname: "Doe",
            email: "alice@example.com"
        });

        RefreshToken.create.mockResolvedValue({});
        RefreshToken.findOneAndUpdate.mockResolvedValue({});
    });

    test("POST /auth/register returns 400 for missing required fields", async () => {
        const app = buildApp();

        const res = await request(app).post("/auth/register").send({ username: "alice" });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/required/i);
    });

    test("POST /auth/register returns 400 when username already exists", async () => {
        const app = buildApp();
        User.findOne.mockResolvedValue({ username: "alice", email: "existing@example.com" });

        const res = await request(app).post("/auth/register").send({
            username: "alice",
            password: "secret",
            name: "Alice",
            email: "alice@example.com"
        });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Username already exists" });
    });

    test("POST /auth/register returns 400 when email already exists", async () => {
        const app = buildApp();
        User.findOne.mockResolvedValue({ username: "other-user", email: "alice@example.com" });

        const res = await request(app).post("/auth/register").send({
            username: "alice",
            password: "secret",
            name: "Alice",
            email: "alice@example.com"
        });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Email already in use" });
    });

    test("POST /auth/register returns 201 when user is created", async () => {
        const app = buildApp();
        User.findOne.mockResolvedValue(null);

        const res = await request(app).post("/auth/register").send({
            username: "alice",
            password: "secret",
            name: "Alice",
            email: "alice@example.com"
        });

        expect(User.hashPassword).toHaveBeenCalledWith("secret");
        expect(User).toHaveBeenCalledWith({
            username: "alice",
            passwordHash: "hashed-password",
            name: "Alice",
            surname: "",
            email: "alice@example.com"
        });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ message: "User registered successfully" });
    });

    test("POST /auth/login returns 401 when user does not exist", async () => {
        const app = buildApp();
        User.findOne.mockResolvedValue(null);

        const res = await request(app).post("/auth/login").send({ username: "ghost", password: "secret" });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid username or password" });
    });

    test("POST /auth/login returns tokens on success", async () => {
        const app = buildApp();

        const dbUser = {
            _id: "u1",
            username: "alice",
            name: "Alice",
            surname: "Doe",
            email: "alice@example.com",
            isValidPassword: jest.fn().mockResolvedValue(true)
        };
        User.findOne.mockResolvedValue(dbUser);

        const res = await request(app).post("/auth/login").send({ username: "alice", password: "secret" });

        expect(dbUser.isValidPassword).toHaveBeenCalledWith("secret");
        expect(generateAccessToken).toHaveBeenCalledWith(dbUser);
        expect(generateRefreshToken).toHaveBeenCalledWith(dbUser);
        expect(RefreshToken.create).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ token: "access-token", refreshToken: "refresh-token" });
    });

    test("POST /auth/login returns 401 when password is invalid", async () => {
        const app = buildApp();

        const dbUser = {
            _id: "u1",
            username: "alice",
            isValidPassword: jest.fn().mockResolvedValue(false)
        };
        User.findOne.mockResolvedValue(dbUser);

        const res = await request(app).post("/auth/login").send({ username: "alice", password: "bad" });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid username or password" });
    });

    test("POST /auth/refresh returns 400 when refreshToken is missing", async () => {
        const app = buildApp();

        const res = await request(app).post("/auth/refresh").send({});

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "refreshToken is required" });
    });

    test("POST /auth/refresh returns new tokens when refresh token is valid", async () => {
        const app = buildApp();

        const storedToken = {
            revokedAt: null,
            expiresAt: new Date(Date.now() + 3600 * 1000),
            user: {
                _id: { toString: () => "u1" },
                username: "alice"
            },
            save: jest.fn().mockResolvedValue(undefined)
        };

        RefreshToken.findOne.mockReturnValue({
            populate: jest.fn().mockResolvedValue(storedToken)
        });

        const res = await request(app).post("/auth/refresh").send({ refreshToken: "valid-refresh" });

        expect(verifyRefreshToken).toHaveBeenCalled();
        expect(storedToken.save).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ token: "access-token", refreshToken: "refresh-token" });
    });

    test("POST /auth/refresh returns 401 when refresh token cannot be verified", async () => {
        const app = buildApp();
        verifyRefreshToken.mockImplementation(() => {
            throw new Error("invalid refresh");
        });

        const res = await request(app).post("/auth/refresh").send({ refreshToken: "bad-refresh" });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid or expired refresh token" });
    });

    test("POST /auth/refresh returns 401 when stored refresh token is missing", async () => {
        const app = buildApp();
        RefreshToken.findOne.mockReturnValue({
            populate: jest.fn().mockResolvedValue(null)
        });

        const res = await request(app).post("/auth/refresh").send({ refreshToken: "valid-refresh" });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid or expired refresh token" });
    });

    test("POST /auth/refresh returns 401 when token user does not match payload", async () => {
        const app = buildApp();

        const storedToken = {
            revokedAt: null,
            expiresAt: new Date(Date.now() + 3600 * 1000),
            user: {
                _id: { toString: () => "u2" },
                username: "alice"
            },
            save: jest.fn().mockResolvedValue(undefined)
        };

        RefreshToken.findOne.mockReturnValue({
            populate: jest.fn().mockResolvedValue(storedToken)
        });

        const res = await request(app).post("/auth/refresh").send({ refreshToken: "valid-refresh" });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid refresh token" });
    });

    test("POST /auth/logout returns 204 when no refresh token is provided", async () => {
        const app = buildApp();

        const res = await request(app).post("/auth/logout").send({});

        expect(RefreshToken.findOneAndUpdate).not.toHaveBeenCalled();
        expect(res.status).toBe(204);
    });

    test("POST /auth/logout revokes refresh token and returns 204", async () => {
        const app = buildApp();

        const res = await request(app).post("/auth/logout").send({ refreshToken: "valid-refresh" });

        expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(204);
    });

    test("POST /auth/logout returns 500 when revocation fails", async () => {
        const app = buildApp();
        RefreshToken.findOneAndUpdate.mockRejectedValue(new Error("db fail"));

        const res = await request(app).post("/auth/logout").send({ refreshToken: "valid-refresh" });

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Server error" });
    });

    test("GET /auth/me returns 401 without bearer token", async () => {
        const app = buildApp();

        const res = await request(app).get("/auth/me");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "No token provided" });
    });

    test("GET /auth/me returns current user with valid token", async () => {
        const app = buildApp();

        const res = await request(app)
            .get("/auth/me")
            .set("Authorization", "Bearer valid-token");

        expect(verifyAccessToken).toHaveBeenCalledWith("valid-token");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            userId: "u1",
            username: "alice",
            name: "Alice",
            surname: "Doe",
            email: "alice@example.com"
        });
    });

    test("GET /auth/users returns all users except current one", async () => {
        const app = buildApp();

        User.find.mockResolvedValue([{ _id: "u2", username: "bob" }]);

        const res = await request(app)
            .get("/auth/users")
            .set("Authorization", "Bearer valid-token");

        expect(User.find).toHaveBeenCalledWith(
            { _id: { $ne: "u1" } },
            { passwordHash: 0, __v: 0 }
        );
        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ _id: "u2", username: "bob" }]);
    });

    test("GET /auth/users returns 500 when user lookup fails", async () => {
        const app = buildApp();

        User.find.mockRejectedValue(new Error("db fail"));

        const res = await request(app)
            .get("/auth/users")
            .set("Authorization", "Bearer valid-token");

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: "Server error" });
    });
});
