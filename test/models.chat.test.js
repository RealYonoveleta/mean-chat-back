const mongoose = require("mongoose");
const Chat = require("../src/models/Chat");

describe("Chat model", () => {
    test("fails validation when chat has less than 2 members", () => {
        const chat = new Chat({
            members: [new mongoose.Types.ObjectId()]
        });

        const err = chat.validateSync();

        expect(err).toBeDefined();
        expect(err.errors.members).toBeDefined();
        expect(err.errors.members.message).toContain("at least 2 members");
    });

    test("passes validation with 2 or more members", () => {
        const chat = new Chat({
            members: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
            isGroup: true,
            name: "Test Group"
        });

        const err = chat.validateSync();

        expect(err).toBeUndefined();
    });
});
