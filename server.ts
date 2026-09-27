import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import crypto from "crypto";

dotenv.config();

let razorpayInstance: Razorpay | null = null;

function getRazorpay() {
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_mock",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "mock_secret",
    });
  }
  return razorpayInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  const otpStore: Record<string, string> = {};

  app.post("/api/send-otp", (req, res) => {
    const { phone } = req.body;
    const otp = "1234"; // Mock OTP
    otpStore[phone] = otp;
    res.json({ msg: "OTP sent", otp });
  });

  app.post("/api/verify-otp", (req, res) => {
    const { phone, otp } = req.body;
    if (otpStore[phone] === otp) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  });

  // Razorpay Routes
  app.post("/api/create-razorpay-order", async (req, res) => {
    const { amount, currency, receipt } = req.body;
    try {
      const rzp = getRazorpay();
      const order = await rzp.orders.create({
        amount: Math.round(amount * 100), // amount in smallest currency unit (paise)
        currency: currency || "INR",
        receipt: receipt || `receipt_${Date.now()}`,
      });
      res.json(order);
    } catch (error) {
      console.error("Razorpay Order Error:", error);
      res.status(500).json({ error: "Failed to create Razorpay order" });
    }
  });

  app.post("/api/verify-razorpay-payment", (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    const secret = process.env.RAZORPAY_KEY_SECRET || "mock_secret";
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    if (generated_signature === razorpay_signature) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
