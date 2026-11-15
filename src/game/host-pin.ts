export type HostPinCredential = {
  salt: string;
  hash: string;
};

export const MIN_HOST_PIN_LENGTH = 4;
export const MAX_HOST_PIN_LENGTH = 8;

export function isValidHostPin(pin: string): boolean {
  return new RegExp(`^\\d{${MIN_HOST_PIN_LENGTH},${MAX_HOST_PIN_LENGTH}}$`).test(pin);
}

export function isHostPinCredential(value: unknown): value is HostPinCredential {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const credential = value as Record<string, unknown>;
  return typeof credential.salt === 'string'
    && credential.salt.length >= 16
    && typeof credential.hash === 'string'
    && /^[a-f0-9]{64}$/.test(credential.hash);
}
