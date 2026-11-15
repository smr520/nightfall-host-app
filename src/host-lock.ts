import * as Crypto from 'expo-crypto';
import {
  isValidHostPin,
  MIN_HOST_PIN_LENGTH,
  MAX_HOST_PIN_LENGTH,
  type HostPinCredential,
} from './game/host-pin';

async function digest(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `nightfall-host:${salt}:${pin}`,
  );
}

export async function createHostPinCredential(pin: string): Promise<HostPinCredential> {
  if (!isValidHostPin(pin)) {
    throw new Error(`主持 PIN 必须是 ${MIN_HOST_PIN_LENGTH}–${MAX_HOST_PIN_LENGTH} 位数字`);
  }
  const salt = Crypto.randomUUID();
  return { salt, hash: await digest(salt, pin) };
}

export async function verifyHostPinCredential(
  credential: HostPinCredential,
  pin: string,
): Promise<boolean> {
  if (!isValidHostPin(pin)) return false;
  return (await digest(credential.salt, pin)) === credential.hash;
}
