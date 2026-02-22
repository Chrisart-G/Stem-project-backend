// src/routes/iotRoutes.js
import express from "express";
import {
  recordBottleEvent,
  getRedeemStatus,
  redeemReward,
  getRecentActivity,
} from "../controller/iotController.js";

const router = express.Router();

// POST /api/iot/bottle-event
router.post("/bottle-event", recordBottleEvent);

// GET /api/iot/redeem-status/:studentId
router.get("/redeem-status/:studentId", getRedeemStatus);

// POST /api/iot/redeem
router.post("/redeem", redeemReward);
router.get("/activity/:studentId", getRecentActivity);
export default router;