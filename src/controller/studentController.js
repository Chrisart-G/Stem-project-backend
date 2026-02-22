// src/controllers/studentController.js
import { supabase } from "../services/dbconfig.js";

/**
 * GET /api/student/:studentId
 */
export const getStudentById = async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) {
    return res.status(400).json({ error: "studentId is required" });
  }

  try {
    const { data, error } = await supabase
      .from("students")
      .select("id, student_id, name, grade_level, points, total_bottles")
      .eq("student_id", studentId)
      .single();

    if (error && error.code === "PGRST116") {
      return res.status(404).json({ error: "Student not found" });
    }

    if (error) {
      console.error("Supabase error fetching student:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch student data" });
    }

    return res.json({
      id: data.id,
      studentId: data.student_id,
      name: data.name,
      gradeLevel: data.grade_level,
      points: data.points ?? 0,
      totalBottles: data.total_bottles ?? 0,
    });
  } catch (err) {
    console.error("Unexpected error fetching student:", err);
    return res.status(500).json({ error: "Server error" });
  }
};