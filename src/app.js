const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const config = require("./config/env");
const logger = require("./config/logger");
const routes = require("./routes/index");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.env === "production" ? "combined" : "dev", { stream: { write: (msg) => logger.info(msg.trim()) } }));

app.use("/api/v1", routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
