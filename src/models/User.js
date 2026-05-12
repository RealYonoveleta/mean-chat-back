const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    surname: { type: String, default: '' },
    email: { type: String, required: true, unique: true }
});

userSchema.statics.hashPassword = async function (password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

userSchema.methods.isValidPassword = async function (password) {
    return await bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model("User", userSchema);
module.exports = User;