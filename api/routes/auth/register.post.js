import { Route } from "owebjs";
import jwt from "jsonwebtoken";
import User from "../../models/User.js";
import { createLogger } from "../../utils/logger.js";

const logger = createLogger("AUTH");

/**
 * POST /auth/register
 * Register a new user
 */
export default class extends Route {
  async handle(req, res) {
    try {
      const { username, email, password, level } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).send({
          success: false,
          message: "Username, email and password are required",
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        if (existingUser.email === email) {
          return res.status(400).send({
            success: false,
            message: "This email already exists",
          });
        }
        if (existingUser.username === username) {
          return res.status(400).send({
            success: false,
            message: "This username already exists",
          });
        }
      }

      // Create new user
      const user = new User({
        username,
        email,
        password,
        // Only allow setting level if provided and not 'admin' (admins must be created manually)
        level: level && level !== "admin" ? level : "user",
      });

      await user.save();

      logger.info("New user registered", { username, email });

      // Generate token
      const token = jwt.sign(
        { userId: user._id, level: user.level },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).send({
        success: true,
        message: "User registered successfully",
        data: {
          user,
          token,
        },
      });
    } catch (error) {
      logger.error("Registration error", error);

      if (error.name === "ValidationError") {
        return res.status(400).send({
          success: false,
          message: "Validation error",
          errors: Object.values(error.errors).map((e) => e.message),
        });
      }

      res.status(500).send({
        success: false,
        message: "Registration failed",
      });
    }
  }
}
