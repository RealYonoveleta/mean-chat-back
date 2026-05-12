// Config
require("dotenv").config();
require("dns").setDefaultResultOrder("ipv4first");

// Imports
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const path = require("path");
const socketHandler = require("./src/socket");
const YAML = require("yamljs");

// Swagger
const swaggerUI = require("swagger-ui-express");

// Routes
const authRouter = require("./src/routes/auth");
const chatRouterFactory = require("./src/routes/chat");

// Create express app and server
const app = express();
const server = http.createServer(app);

// MongoDB init
mongoose
  .connect(process.env.MONGO_URI, { dbName: "mean-chat" })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Socket.io config
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Set up socket logic
socketHandler(io);

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Routing
app.use("/auth", authRouter);
app.use("/chat", chatRouterFactory(io));

// Swagger
const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerDocument));

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sever is running on http://0.0.0.0:${PORT}`);
});
