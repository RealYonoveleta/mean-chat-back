const User = require("../src/models/User");

describe("User model", () => {
    test("hashes password and validates it", async () => {
        const plainPassword = "my-secret-password";
        const passwordHash = await User.hashPassword(plainPassword);

        const user = new User({
            username: "alice",
            passwordHash,
            name: "Alice",
            surname: "Doe",
            email: "alice@example.com"
        });

        const ok = await user.isValidPassword(plainPassword);
        const bad = await user.isValidPassword("wrong-password");

        expect(passwordHash).not.toBe(plainPassword);
        expect(ok).toBe(true);
        expect(bad).toBe(false);
    });

    test("fails validation when required fields are missing", () => {
        const user = new User({
            username: "alice"
        });

        const err = user.validateSync();

        expect(err).toBeDefined();
        expect(err.errors.passwordHash).toBeDefined();
        expect(err.errors.name).toBeDefined();
        expect(err.errors.email).toBeDefined();
    });
});
