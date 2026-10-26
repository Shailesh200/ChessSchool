export const PASSWORD_HASH_ROUNDS: number;
export function hashPassword(password: string): Promise<string>;
