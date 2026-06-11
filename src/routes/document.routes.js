import express from "express";
import upload from "../middlewares/upload.middleware.js";
import { getDocumentById, uploadDocument } from "../controllers/document.controller.js";

const router = express.Router();

router.post("/upload", upload.single("file"), uploadDocument);

router.get("/:id", getDocumentById);

export default router;