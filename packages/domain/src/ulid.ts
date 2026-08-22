const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

export const ULID_LENGTH = TIME_LENGTH + RANDOM_LENGTH;

const ULID_PATTERN = new RegExp(`^[${ENCODING}]{${ULID_LENGTH}}$`);

function encodeTime(milliseconds: number) {
  let remaining = milliseconds;
  let encoded = "";

  for (let index = 0; index < TIME_LENGTH; index += 1) {
    encoded = ENCODING.charAt(remaining % 32) + encoded;
    remaining = Math.floor(remaining / 32);
  }

  return encoded;
}

function encodeRandom() {
  const bytes = new Uint8Array(RANDOM_LENGTH);
  crypto.getRandomValues(bytes);

  let encoded = "";
  for (const byte of bytes) {
    encoded += ENCODING.charAt(byte % 32);
  }

  return encoded;
}

/**
 * ULID keeps creation order in the identifier itself, so a project list sorts
 * without a separate key. See specs/product/glossary.md.
 */
export function ulid(milliseconds = Date.now()) {
  return encodeTime(milliseconds) + encodeRandom();
}

export function isUlid(value: string) {
  return ULID_PATTERN.test(value);
}
