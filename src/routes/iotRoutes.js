// src/routes/iotRoutes.js
import express from "express";
import {
  recordBottleEvent,
  getRedeemStatus,
  redeemReward,
  getRecentActivity,
  requestOpenBin,
  getNextOpenRequest,
} from "../controller/iotController.js";

const router = express.Router();

// POST /api/iot/bottle-event
router.post("/bottle-event", recordBottleEvent);

// GET /api/iot/redeem-status/:studentId
router.get("/redeem-status/:studentId", getRedeemStatus);

// POST /api/iot/redeem
router.post("/redeem", redeemReward);

// GET /api/iot/activity/:studentId
router.get("/activity/:studentId", getRecentActivity);

// Student dashboard -> queue an "open bin" request
router.post("/open-request", requestOpenBin);

// ESP32 polls this to see if there's a request
router.get("/next-open-request", getNextOpenRequest);

export default router;