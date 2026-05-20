// Config
require("dotenv").config();
require("dns").setDefaultResultOrder("ipv4first");

// Imports
const express = require("express");
const http = require("http");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const path = require("path");
const socketHandler = require("./src/socket");

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

// Allowed origin (set FRONTEND_URL in .env for production)
const allowedOrigin = process.env.FRONTEND_URL || "*";

// Socket.io config
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
  },
});

// Set up socket logic
socketHandler(io);

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Middleware
app.use(cors({ origin: allowedOrigin }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Routing
app.use("/auth", authLimiter, authRouter);
app.use("/chat", chatRouterFactory(io));

// Swagger (dev-only)
if (process.env.NODE_ENV !== "production") {
  try {
    const swaggerUI = require("swagger-ui-express");
    const YAML = require("yamljs");
    const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));
    app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(swaggerDocument));
  } catch (err) {
    console.warn("Swagger modules not installed; skipping /api-docs");
  }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sever is running on http://0.0.0.0:${PORT}`);
});
