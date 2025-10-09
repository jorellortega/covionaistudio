import jwt from "jsonwebtoken";

export function makeKlingBearer(accessKey: string, secretKey: string): string {
  // nbf: now - 5s (to avoid 1003 "not yet valid"), exp: 30m
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { /* payload empty per docs; issuer below carries AK */ },
    secretKey,
    {
      algorithm: "HS256",
      issuer: accessKey,
      notBefore: -5,            // 5s skew
      expiresIn: 60 * 30,       // 30 minutes
      header: { alg: "HS256" }, // explicit for clarity
    }
  );
  return `Bearer ${token}`;
}
