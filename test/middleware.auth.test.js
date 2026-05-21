jest.mock("../src/utils/tokenUtils", () => ({
    verifyAccessToken: jest.fn()
}));

const auth = require("../src/middleware/auth");
const { verifyAccessToken } = require("../src/utils/tokenUtils");

function createRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
    };
}

describe("auth middleware", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("returns 401 when authorization header is missing", () => {
        const req = { headers: {} };
        const res = createRes();
        const next = jest.fn();

        auth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "No token provided" });
        expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 when token format is invalid", () => {
        const req = { headers: { authorization: "BadToken" } };
        const res = createRes();
        const next = jest.fn();

        auth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Invalid token format" });
        expect(next).not.toHaveBeenCalled();
    });

    test("returns 401 when token verification fails", () => {
        verifyAccessToken.mockImplementation(() => {
            throw new Error("boom");
        });

        const req = { headers: { authorization: "Bearer bad-token" } };
        const res = createRes();
        const next = jest.fn();

        auth(req, res, next);

        expect(verifyAccessToken).toHaveBeenCalledWith("bad-token");
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
        expect(next).not.toHaveBeenCalled();
    });

    test("attaches user and calls next for a valid token", () => {
        const decoded = { userId: "u1", username: "alice" };
        verifyAccessToken.mockReturnValue(decoded);

        const req = { headers: { authorization: "Bearer valid-token" } };
        const res = createRes();
        const next = jest.fn();

        auth(req, res, next);

        expect(verifyAccessToken).toHaveBeenCalledWith("valid-token");
        expect(req.user).toEqual(decoded);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});
