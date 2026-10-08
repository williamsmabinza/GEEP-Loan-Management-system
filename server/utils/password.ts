import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}
