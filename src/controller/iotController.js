// src/controller/iotController.js
import { supabase } from "../services/dbconfig.js";

const POINTS_PER_BOTTLE = 1;

// Define the rewards available in the system
const REWARDS = {
  school_supplies: {
    key: "school_supplies",
    name: "School Supplies",
    cost: 10,
  },
  snack_voucher: {
    key: "snack_voucher",
    name: "Snack Voucher",
    cost: 20,
  },
};

// In-memory queue for Smart Bin "open" commands
// Each item: { id, studentId }
const binCommandQueue = [];

/**
 * POST /api/iot/bottle-event
 * body: { studentId, bottles }
 */
export const recordBottleEvent = async (req, res) => {
  const { studentId, bottles } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: "studentId is required" });
  }

  const bottlesCount = Number(bottles) || 1;

  try {
    // 1) Get current student record
    const { data: student, error: fetchError } = await supabase
      .from("students")
      .select("id, student_id, points, total_bottles")
      .eq("student_id", studentId)
      .single();

    if (fetchError && fetchError.code === "PGRST116") {
      return res.status(404).json({ error: "Student not found" });
    }

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return res.status(500).json({ error: "Failed to fetch student data" });
    }

    const addedPoints = bottlesCount * POINTS_PER_BOTTLE;
    const newPoints = (student.points || 0) + addedPoints;
    const newTotalBottles = (student.total_bottles || 0) + bottlesCount;

    // 2) Update the student row
    const { error: updateError } = await supabase
      .from("students")
      .update({
        points: newPoints,
        total_bottles: newTotalBottles,
      })
      .eq("id", student.id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({ error: "Failed to update student" });
    }

    // 3) Log into bin_events
    try {
      await supabase.from("bin_events").insert([
        {
          student_id: studentId,
          bottles: bottlesCount,
          points_awarded: addedPoints,
        },
      ]);
    } catch (logErr) {
      console.warn("Failed to insert bin_events log:", logErr);
    }

    return res.json({
      message: "Bottle event recorded",
      points: newPoints,
      totalBottles: newTotalBottles,
      addedPoints,
    });
  } catch (err) {
    console.error("Unexpected bottle event error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/iot/redeem-status/:studentId
 * Returns which rewards are currently pending for the student.
 */
export const getRedeemStatus = async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) {
    return res.status(400).json({ error: "studentId is required" });
  }

  try {
    const { data, error } = await supabase
      .from("reward_redemptions")
      .select("reward_key")
      .eq("student_id", studentId)
      .eq("status", "pending");

    if (error) {
      console.error("Supabase redeem-status error:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch redemption status" });
    }

    const lockedRewardKeys = (data || []).map((row) => row.reward_key);
    return res.json({ lockedRewardKeys });
  } catch (err) {
    console.error("Unexpected redeem-status error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/iot/redeem
 * body: { studentId, rewardKey }
 */
export const redeemReward = async (req, res) => {
  const { studentId, rewardKey } = req.body;

  if (!studentId || !rewardKey) {
    return res
      .status(400)
      .json({ error: "studentId and rewardKey are required" });
  }

  const reward = REWARDS[rewardKey];
  if (!reward) {
    return res.status(400).json({ error: "Unknown reward key" });
  }

  try {
    // 1) Get student with current points
    const { data: student, error: fetchError } = await supabase
      .from("students")
      .select("id, student_id, points")
      .eq("student_id", studentId)
      .single();

    if (fetchError && fetchError.code === "PGRST116") {
      return res.status(404).json({ error: "Student not found" });
    }

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return res.status(500).json({ error: "Failed to fetch student data" });
    }

    const currentPoints = student.points || 0;
    if (currentPoints < reward.cost) {
      return res.status(400).json({
        error: "Not enough points to redeem this reward",
      });
    }

    // 2) Check if a pending redemption already exists for this reward
    const { data: existing, error: pendingError } = await supabase
      .from("reward_redemptions")
      .select("id, status")
      .eq("student_id", studentId)
      .eq("reward_key", rewardKey)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingError) {
      console.error("Supabase pending-check error:", pendingError);
      return res
        .status(500)
        .json({ error: "Failed to check existing redemptions" });
    }

    if (existing) {
      return res.status(409).json({
        error: "This reward is already pending pickup",
      });
    }

    const newPoints = currentPoints - reward.cost;

    // 3) Update student's points
    const { error: updateError } = await supabase
      .from("students")
      .update({ points: newPoints })
      .eq("id", student.id);

    if (updateError) {
      console.error("Supabase update points error:", updateError);
      return res
        .status(500)
        .json({ error: "Failed to update student points" });
    }

    // 4) Insert redemption record
    const { error: insertError } = await supabase
      .from("reward_redemptions")
      .insert([
        {
          student_id: studentId,
          reward_key: reward.key,
          reward_name: reward.name,
          cost_points: reward.cost,
          status: "pending",
        },
      ]);

    if (insertError) {
      console.error("Supabase insert redemption error:", insertError);
      return res
        .status(500)
        .json({ error: "Failed to create redemption record" });
    }

    return res.json({
      message:
        "Reward redeemed! Show this in the canteen to claim your item. Pending pickup.",
      points: newPoints,
      lockedRewardKey: reward.key,
    });
  } catch (err) {
    console.error("Unexpected redeem error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/iot/activity/:studentId?limit=5
 */
export const getRecentActivity = async (req, res) => {
  const { studentId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 5;

  if (!studentId) {
    return res.status(400).json({ error: "studentId is required" });
  }

  try {
    // 1) Get recent bottle events
    const { data: bottleEvents, error: bottleError } = await supabase
      .from("bin_events")
      .select("id, bottles, points_awarded, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (bottleError) {
      console.error("Supabase bin_events error:", bottleError);
      return res
        .status(500)
        .json({ error: "Failed to load bottle activity" });
    }

    // 2) Get recent reward redemptions
    const { data: redemptionEvents, error: redeemError } = await supabase
      .from("reward_redemptions")
      .select("id, reward_key, reward_name, cost_points, status, created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (redeemError) {
      console.error("Supabase reward_redemptions error:", redeemError);
      return res
        .status(500)
        .json({ error: "Failed to load reward activity" });
    }

    // 3) Normalise into a single list
    const bottleItems = (bottleEvents || []).map((b) => ({
      id: `bottle-${b.id}`,
      type: "bottle",
      description:
        b.bottles === 1
          ? "Recycled 1 plastic bottle"
          : `Recycled ${b.bottles} plastic bottles`,
      pointsChange: b.points_awarded || 0,
      createdAt: b.created_at,
    }));

    const rewardItems = (redemptionEvents || []).map((r) => ({
      id: `reward-${r.id}`,
      type: "redeem",
      description: `Redeemed ${r.reward_name}`,
      pointsChange: -(r.cost_points || 0),
      status: r.status,
      createdAt: r.created_at,
    }));

    // 4) Combine, sort by createdAt desc, and take top N
    const combined = [...bottleItems, ...rewardItems].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const activities = combined.slice(0, limit);

    return res.json({ activities });
  } catch (err) {
    console.error("Unexpected recent activity error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * Student clicks "Insert bottle" on the web app
 * POST /api/iot/open-request
 */
export const requestOpenBin = (req, res) => {
  const { studentId } = req.body || {};

  if (!studentId) {
    return res.status(400).json({ error: "studentId is required" });
  }

  const command = {
    id: Date.now().toString(),
    studentId,
  };

  binCommandQueue.push(command);

  console.log("Queued open-bin command:", command);

  return res.json({
    message: "Insert request queued. Waiting for Smart Bin...",
    commandId: command.id,
  });
};

/**
 * ESP32 polls this to get the next studentId to service
 * GET /api/iot/next-open-request
 */
export const getNextOpenRequest = (req, res) => {
  if (binCommandQueue.length === 0) {
    // No pending command
    return res.status(204).end(); // 204 = No Content
  }

  const command = binCommandQueue.shift();
  console.log("Smart Bin claimed command:", command);

  // For ESP32 we keep it super simple: plain text = studentId
  return res.status(200).type("text/plain").send(command.studentId);
};