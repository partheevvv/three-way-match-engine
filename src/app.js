import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Three-way Match Backend is running",
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
    });
});

export default app;