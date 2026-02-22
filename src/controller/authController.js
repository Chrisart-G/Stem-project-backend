// src/controller/authController.js
import { supabase } from "../services/dbconfig.js";

/**
 * POST /api/auth/signup
 * body: { studentId, name, gradeLevel, password }
 */
export const signupStudent = async (req, res) => {
  const { studentId, name, gradeLevel, password } = req.body;

  if (!studentId || !name || !password) {
    return res
      .status(400)
      .json({ error: "studentId, name, and password are required" });
  }

  try {
    // Check if student_id already exists
    const { data: existing, error: checkError } = await supabase
      .from("students")
      .select("student_id")
      .eq("student_id", studentId)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing student:", checkError);
      return res.status(500).json({ error: "Failed to check existing account" });
    }

    if (existing) {
      return res.status(409).json({ error: "Student ID is already registered" });
    }

    // Insert new student
    const { data, error } = await supabase
      .from("students")
      .insert([
        {
          student_id: studentId,
          name,
          grade_level: gradeLevel || null,
          password, // NOTE: plaintext for now; for real systems, hash this!
          points: 0,
          total_bottles: 0,
        },
      ])
      .select("id, student_id, name, grade_level, points, total_bottles")
      .single();

    if (error) {
      console.error("Supabase error during signup:", error);
      return res.status(500).json({ error: "Failed to create account" });
    }

    return res.status(201).json({
      message: "Account created successfully",
      student: {
        id: data.id,
        studentId: data.student_id,
        name: data.name,
        gradeLevel: data.grade_level,
        points: data.points ?? 0,
        totalBottles: data.total_bottles ?? 0,
      },
    });
  } catch (err) {
    console.error("Unexpected signup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/auth/login
 * body: { schoolId, password }
 * - schoolId = student_id in the students table
 * - password = must match the stored password
 */
export const loginStudent = async (req, res) => {
  const { schoolId, password } = req.body;

  if (!schoolId || !password) {
    return res
      .status(400)
      .json({ error: "schoolId and password are required" });
  }

  try {
    const { data, error } = await supabase
      .from("students")
      .select(
        "id, student_id, name, grade_level, points, total_bottles, password"
      )
      .eq("student_id", schoolId)
      .single();

    if (error && error.code === "PGRST116") {
      // no rows found
      return res.status(401).json({ error: "Student not found" });
    }

    if (error) {
      console.error("Supabase error during login:", error);
      return res.status(500).json({ error: "Login failed" });
    }

    // Simple password check (plaintext) – OK for school project
    if (!data.password || data.password !== password) {
      return res.status(401).json({ error: "Invalid password" });
    }

    return res.json({
      message: "Login successful",
      student: {
        id: data.id,
        studentId: data.student_id,
        name: data.name,
        gradeLevel: data.grade_level,
        points: data.points ?? 0,
        totalBottles: data.total_bottles ?? 0,
      },
      token: null,
    });
  } catch (err) {
    console.error("Unexpected login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/auth/admin/login
 * body: { username, password }
 */
export const loginAdmin = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username and password are required" });
  }

  try {
    const { data, error } = await supabase
      .from("admins")
      .select("id, username, full_name, password")
      .eq("username", username)
      .single();

    if (error && error.code === "PGRST116") {
      return res.status(401).json({ error: "Admin not found" });
    }

    if (error) {
      console.error("Supabase error during admin login:", error);
      return res.status(500).json({ error: "Login failed" });
    }

    if (!data.password || data.password !== password) {
      return res.status(401).json({ error: "Invalid password" });
    }

    return res.json({
      message: "Admin login successful",
      admin: {
        id: data.id,
        username: data.username,
        fullName: data.full_name,
      },
      token: null,
    });
  } catch (err) {
    console.error("Unexpected admin login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};