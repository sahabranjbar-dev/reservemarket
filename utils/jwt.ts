import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET || "";

if (!jwtSecret) {
  throw new Error("JWT_SECRET is required");
}

export function verifyJwt(token: string): { id: string; phone: string } | null {
  try {
    return jwt.verify(token, jwtSecret) as unknown as {
      id: string;
      phone: string;
    };
  } catch {
    return null;
  }
}
