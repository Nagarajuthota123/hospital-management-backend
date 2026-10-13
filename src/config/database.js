const { Sequelize } = require("sequelize");
const config = require("./env");
const logger = require("./logger");

// Sequelize is only used as a connection pool for raw stored-procedure calls (no models, no sync).
const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  // A named instance (e.g. SQLEXPRESS01) is found via SQL Browser, so the port must be left out.
  port: config.db.instance ? undefined : config.db.port,
  dialect: "mssql",
  dialectOptions: {
    options: {
      instanceName: config.db.instance || undefined,
      // On-prem SQL Server: no trusted CA cert on this box. Set DB_ENCRYPT=true if the server forces encryption.
      encrypt: config.db.encrypt,
      trustServerCertificate: true,
    },
  },
  logging: config.db.logging ? (msg) => logger.debug(msg) : false,
  pool: { max: 10, min: 0, idle: 10000, acquire: 30000 },
});

async function connectDB() {
  await sequelize.authenticate();
  const where = config.db.instance ? `${config.db.host}\\${config.db.instance}` : `${config.db.host}:${config.db.port}`;
  logger.info(`Connected to SQL Server database "${config.db.name}" at ${where}`);
}

module.exports = { sequelize, connectDB };
