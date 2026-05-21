const ORIGINAL_ENV = process.env;

function loadTokenUtils() {
    return require("../src/utils/tokenUtils");
}

describe("token utils", () => {
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    test("throws when JWT_SECRET is missing for access token", () => {
        delete process.env.JWT_SECRET;

        const tokenUtils = loadTokenUtils();

        expect(() => tokenUtils.generateAccessToken({ _id: "u1", username: "alice" }))
            .toThrow("JWT_SECRET is not configured");
    });

    test("generates and verifies access token", () => {
        process.env.JWT_SECRET = "access-secret";
        process.env.JWT_REFRESH_SECRET = "refresh-secret";

        const tokenUtils = loadTokenUtils();

        const token = tokenUtils.generateAccessToken({
            _id: "u1",
            username: "alice",
            name: "Alice",
            surname: "Doe",
            email: "alice@example.com"
        });

        const payload = tokenUtils.verifyAccessToken(token);

        expect(payload.userId).toBe("u1");
        expect(payload.username).toBe("alice");
        expect(payload.email).toBe("alice@example.com");
    });

    test("generates and verifies refresh token with dedicated refresh secret", () => {
        process.env.JWT_SECRET = "access-secret";
        process.env.JWT_REFRESH_SECRET = "refresh-secret";

        const tokenUtils = loadTokenUtils();

        const token = tokenUtils.generateRefreshToken({ _id: "u2", username: "bob" });
        const payload = tokenUtils.verifyRefreshToken(token);

        expect(payload.userId).toBe("u2");
        expect(payload.username).toBe("bob");
    });

    test("falls back to JWT_SECRET for refresh token and warns only once", () => {
        process.env.JWT_SECRET = "fallback-secret";
        delete process.env.JWT_REFRESH_SECRET;

        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        const tokenUtils = loadTokenUtils();

        const firstToken = tokenUtils.generateRefreshToken({ _id: "u3", username: "carol" });
        const secondToken = tokenUtils.generateRefreshToken({ _id: "u3", username: "carol" });

        const firstPayload = tokenUtils.verifyRefreshToken(firstToken);
        const secondPayload = tokenUtils.verifyRefreshToken(secondToken);

        expect(firstPayload.userId).toBe("u3");
        expect(secondPayload.userId).toBe("u3");
        expect(warnSpy).toHaveBeenCalledTimes(1);

        warnSpy.mockRestore();
    });

    test("throws when both refresh and access secrets are missing for refresh token", () => {
        delete process.env.JWT_SECRET;
        delete process.env.JWT_REFRESH_SECRET;

        const tokenUtils = loadTokenUtils();

        expect(() => tokenUtils.generateRefreshToken({ _id: "u4", username: "dan" }))
            .toThrow("JWT_REFRESH_SECRET is not configured and JWT_SECRET fallback is unavailable");
    });
});
