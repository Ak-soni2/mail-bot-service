// server.js

require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const SENDER_EMAIL = process.env.SENDER_EMAIL;
const SENDER_PASS = process.env.SENDER_PASS;

if (!SENDER_EMAIL || !SENDER_PASS) {
  console.warn("⚠️  SENDER_EMAIL or SENDER_PASS not set in .env");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: SENDER_EMAIL,
    pass: SENDER_PASS,
  },
});

// Utility: wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post("/send", upload.single("attachment"), async (req, res) => {
  const { subject = "", message = "", recipients = "" } = req.body;

  const recipientList = recipients
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  if (!recipientList.length) {
    return res.status(400).json({ success: false, error: "No recipients provided." });
  }

  const results = [];

  for (let recipient of recipientList) {
    const mailOptions = {
      from: SENDER_EMAIL,
      to: recipient,
      subject: subject || "(No Subject)",
      text: message || "(No Message)",
      ...(req.file && {
        attachments: [
          {
            filename: req.file.originalname,
            path: req.file.path,
          },
        ],
      }),
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Email sent to ${recipient}: ${info.response}`);
      results.push({ recipient, success: true, info: info.response });
    } catch (err) {
      console.error(`❌ Failed to send to ${recipient}:`, err.message);
      results.push({ recipient, success: false, error: err.message });
    }

    // Wait 500ms before next email (to avoid spam flag)
    await sleep(1000);
  }

  res.json({
    success: true,
    message: `Processed ${results.length} emails.`,
    results,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
