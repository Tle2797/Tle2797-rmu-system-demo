// backend/src/utils/jwt.ts
export {
  authenticateRequest,
  getBearerToken,
  signToken,
  verifyToken,
  type JwtUser as JwtPayload,
} from "./auth";
