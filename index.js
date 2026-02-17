require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const commentRoutes = require("./routes/comments");

const app = express();
const port = process.env.PORT || 3000;

// ----------------- API KEY -----------------
const API_KEY = process.env.API_KEY;

// ----------------- MIDDLEWARE -----------------
app.use(cors());
app.use(bodyParser.json());

// Protezione API key (esclude Swagger)
app.use((req, res, next) => {
  if (req.path.startsWith("/api-docs")) return next(); // Swagger libero
  const key = req.header("x-api-key");
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized: API key mancante o errata" });
  }
  next();
});

// ----------------- SWAGGER CONFIG -----------------
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Comment Classifier API",
      version: "1.0.0",
      description: "API per classificazione commenti PubPeer",
    },
    servers: [{ url: `http://localhost:${port}` }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
  },
  apis: ["./routes/*.js"],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ----------------- ROUTES -----------------
app.use("/api/comments", commentRoutes);

app.get("/", (req, res) => {
  res.send("Server Node.js con MongoDB e Swagger funzionante!");
});

// ----------------- CONNECT MONGODB -----------------
mongoose
  .connect(process.env.DB_URI)
  .then(() => {
    console.log("MongoDB connesso");
    app.listen(port, () => console.log(`Server running on port ${port}`));
  })
  .catch((err) => console.error("Errore connessione MongoDB:", err));
