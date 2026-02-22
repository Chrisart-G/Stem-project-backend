// src/routes/authRoutes.js
import express from "express";
import {
  loginStudent,
  signupStudent,
  loginAdmin,
} from "../controller/authController.js";

const router = express.Router();

// Student auth
router.post("/login", loginStudent);
router.post("/signup", signupStudent);

// Admin auth
router.post("/admin/login", loginAdmin);

export default router;