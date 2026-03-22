import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret";

export function verifyJwt(token: string): { id: string; phone: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; phone: string };
  } catch {
    return null;
  }
}
