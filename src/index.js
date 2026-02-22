import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import iotRoutes from "./routes/iotRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= ROUTES =================
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/iot", iotRoutes);
app.use("/api/admin", adminRoutes);

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("Eco Coins API running");
});

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ================= START SERVER =================
app.listen(PORT, "0.0.0.0", () => {
  console.log("==================================");
  console.log(" Eco Coins API running");
  console.log(` Local:   http://localhost:${PORT}`);
  console.log(` Network: http://192.168.254.139:${PORT}`);
  console.log("==================================");
});