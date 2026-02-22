// src/routes/adminRoutes.js
import express from "express";
import {
  getPendingRedemptions,
  markRedemptionClaimed,
  getRedemptionHistory,
  getAdminStats,
} from "../controller/adminController.js";

const router = express.Router();

// GET /api/admin/pending-redemptions
router.get("/pending-redemptions", getPendingRedemptions);

// POST /api/admin/claim
router.post("/claim", markRedemptionClaimed);

// NEW: GET /api/admin/redemption-history
router.get("/redemption-history", getRedemptionHistory);

// NEW: GET /api/admin/stats
router.get("/stats", getAdminStats);

export default router;  