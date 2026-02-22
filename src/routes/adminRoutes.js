// src/routes/adminRoutes.js
import express from "express";
import {
  getPendingRedemptions,
  markRedemptionClaimed,
} from "../controller/adminController.js";

const router = express.Router();

// GET /api/admin/pending-redemptions
router.get("/pending-redemptions", getPendingRedemptions);

// POST /api/admin/claim
router.post("/claim", markRedemptionClaimed);

export default router;