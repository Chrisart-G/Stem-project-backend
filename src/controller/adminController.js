// src/controller/adminController.js
import { supabase } from "../services/dbconfig.js";

/**
 * GET /api/admin/pending-redemptions
 * Returns list of pending reward redemptions with student info.
 */
export const getPendingRedemptions = async (req, res) => {
  try {
    // 1) All pending redemptions
    const { data: redemptions, error: redError } = await supabase
      .from("reward_redemptions")
      .select(
        "id, student_id, reward_key, reward_name, cost_points, status, created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (redError) {
      console.error("Supabase redemptions error:", redError);
      return res
        .status(500)
        .json({ error: "Failed to load pending redemptions" });
    }

    if (!redemptions || redemptions.length === 0) {
      return res.json({ items: [] });
    }

    const studentIds = [...new Set(redemptions.map((r) => r.student_id))];

    // 2) Fetch student info for those IDs
    const { data: students, error: stuError } = await supabase
      .from("students")
      .select("student_id, name, grade_level, points")
      .in("student_id", studentIds);

    if (stuError) {
      console.error("Supabase students error:", stuError);
      return res
        .status(500)
        .json({ error: "Failed to load student information" });
    }

    const studentMap = {};
    (students || []).forEach((s) => {
      studentMap[s.student_id] = s;
    });

    const items = redemptions.map((r) => {
      const s = studentMap[r.student_id] || {};
      return {
        redemptionId: r.id,
        studentId: r.student_id,
        studentName: s.name || "Unknown student",
        gradeLevel: s.grade_level || "",
        studentPoints: s.points ?? 0,
        rewardKey: r.reward_key,
        rewardName: r.reward_name,
        costPoints: r.cost_points,
        status: r.status, // 'pending'
        createdAt: r.created_at,
      };
    });

    return res.json({ items });
  } catch (err) {
    console.error("Unexpected pending-redemptions error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/admin/claim
 * body: { redemptionId }
 * Marks a pending redemption as claimed.
 */
export const markRedemptionClaimed = async (req, res) => {
  const { redemptionId } = req.body;

  if (!redemptionId) {
    return res.status(400).json({ error: "redemptionId is required" });
  }

  try {
    const { data, error } = await supabase
      .from("reward_redemptions")
      .update({
        status: "claimed",
        claimed_at: new Date().toISOString(),
      })
      .eq("id", redemptionId)
      .eq("status", "pending")
      .select("id, student_id, reward_name, status, claimed_at")
      .single();

    if (error && error.code === "PGRST116") {
      return res.status(404).json({ error: "Pending redemption not found" });
    }

    if (error) {
      console.error("Supabase claim update error:", error);
      return res.status(500).json({ error: "Failed to update redemption" });
    }

    return res.json({
      message: "Redemption marked as claimed",
      redemption: data,
    });
  } catch (err) {
    console.error("Unexpected claim error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};