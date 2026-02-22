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

/**
 * NEW: GET /api/admin/redemption-history
 * Query params:
 *   status = 'all' | 'pending' | 'claimed' (default 'all')
 *   limit  = number of rows (default 50)
 */
export const getRedemptionHistory = async (req, res) => {
  try {
    const { status = "all", limit = 50 } = req.query;
    const limitNum = Number(limit) || 50;

    let query = supabase
      .from("reward_redemptions")
      .select(
        "id, student_id, reward_key, reward_name, cost_points, status, created_at, claimed_at"
      )
      .order("created_at", { ascending: false })
      .limit(limitNum);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: redemptions, error: redError } = await query;

    if (redError) {
      console.error("Supabase redemption-history error:", redError);
      return res
        .status(500)
        .json({ error: "Failed to load redemption history" });
    }

    if (!redemptions || redemptions.length === 0) {
      return res.json({ items: [] });
    }

    const studentIds = [...new Set(redemptions.map((r) => r.student_id))];

    const { data: students, error: stuError } = await supabase
      .from("students")
      .select("student_id, name, grade_level")
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
        rewardKey: r.reward_key,
        rewardName: r.reward_name,
        costPoints: r.cost_points,
        status: r.status,
        createdAt: r.created_at,
        claimedAt: r.claimed_at,
      };
    });

    return res.json({ items });
  } catch (err) {
    console.error("Unexpected redemption-history error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * NEW: GET /api/admin/stats
 * Query params:
 *   start: ISO date/time string
 *   end:   ISO date/time string
 *
 * Returns:
 * {
 *   start, end,
 *   totalBottles,
 *   totalPointsEarned,
 *   totalRedemptions,
 *   totalPointsRedeemed,
 *   byDay: [{ date, bottles, pointsEarned, redemptions, pointsRedeemed }]
 * }
 */
export const getAdminStats = async (req, res) => {
  try {
    let { start, end } = req.query;

    const now = new Date();

    if (!end) {
      end = now.toISOString();
    }
    if (!start) {
      // default: last 7 days
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      start = sevenDaysAgo.toISOString();
    }

    const startISO = new Date(start).toISOString();
    const endISO = new Date(end).toISOString();

    // 1) Bin events (bottles & points earned)
    const { data: binEvents, error: binError } = await supabase
      .from("bin_events")
      .select("bottles, points_awarded, created_at")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    if (binError) {
      console.error("Supabase bin_events stats error:", binError);
      return res.status(500).json({ error: "Failed to load bin stats" });
    }

    // 2) Reward redemptions (points spent)
    const { data: redemptions, error: redError } = await supabase
      .from("reward_redemptions")
      .select("cost_points, created_at")
      .gte("created_at", startISO)
      .lte("created_at", endISO);

    if (redError) {
      console.error("Supabase redemptions stats error:", redError);
      return res
        .status(500)
        .json({ error: "Failed to load redemption stats" });
    }

    let totalBottles = 0;
    let totalPointsEarned = 0;
    let totalRedemptions = 0;
    let totalPointsRedeemed = 0;

    const byDayMap = {};

    const ensureDay = (dateStr) => {
      if (!byDayMap[dateStr]) {
        byDayMap[dateStr] = {
          date: dateStr,
          bottles: 0,
          pointsEarned: 0,
          redemptions: 0,
          pointsRedeemed: 0,
        };
      }
      return byDayMap[dateStr];
    };

    // Process bin_events
    (binEvents || []).forEach((ev) => {
      const bottles = ev.bottles || 0;
      const pts = ev.points_awarded || 0;
      totalBottles += bottles;
      totalPointsEarned += pts;

      const day = (ev.created_at || "").slice(0, 10);
      const d = ensureDay(day);
      d.bottles += bottles;
      d.pointsEarned += pts;
    });

    // Process reward_redemptions
    (redemptions || []).forEach((r) => {
      const pts = r.cost_points || 0;
      totalRedemptions += 1;
      totalPointsRedeemed += pts;

      const day = (r.created_at || "").slice(0, 10);
      const d = ensureDay(day);
      d.redemptions += 1;
      d.pointsRedeemed += pts;
    });

    const byDay = Object.values(byDayMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return res.json({
      start: startISO,
      end: endISO,
      totalBottles,
      totalPointsEarned,
      totalRedemptions,
      totalPointsRedeemed,
      byDay,
    });
  } catch (err) {
    console.error("Unexpected stats error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};