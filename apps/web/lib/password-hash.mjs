import bcrypt from "bcryptjs";

/** Cost factor used by account signup (`registerUser` / `registerWithToken`). */
export const PASSWORD_HASH_ROUNDS = 10;

/** Hash a password the same way real signup does. */
export async function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
}
