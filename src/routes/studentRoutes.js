// src/routes/studentRoutes.js
import express from "express";
import { getStudentById } from "../controller/studentController.js";

const router = express.Router();

// GET /api/student/:studentId
router.get("/:studentId", getStudentById);

export default router;