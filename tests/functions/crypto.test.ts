import { describe, it, expect } from 'vitest'
import {
  createHash,
  createHash256,
  createEncryptedPassword,
  encrypt,
  decrypt,
  base64EncodeString,
  base64DecodeString,
  base64DecodeKeys,
  newRandomId,
  createTokenId,
  getHuemulAutoInc,
} from '../../src/functions/huemul-functions'

// AES-256 requires exactly 32 bytes
const AES_KEY = 'abcdefghijklmnopqrstuvwxyz123456'

describe('createHash (MD5)', () => {
  it('returns a 32-character hex string', () => {
    expect(createHash('hello')).toHaveLength(32)
  })
  it('is deterministic', () => {
    expect(createHash('test')).toBe(createHash('test'))
  })
  it('produces different hashes for different inputs', () => {
    expect(createHash('a')).not.toBe(createHash('b'))
  })
  it('returns known MD5 hash for empty string', () => {
    expect(createHash('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })
})

describe('createHash256 (SHA-256)', () => {
  it('returns a 64-character hex string', () => {
    expect(createHash256('hello')).toHaveLength(64)
  })
  it('is deterministic', () => {
    expect(createHash256('test')).toBe(createHash256('test'))
  })
  it('produces different hashes than MD5', () => {
    expect(createHash256('hello')).not.toBe(createHash('hello'))
  })
  it('returns known SHA-256 hash for empty string', () => {
    expect(createHash256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('createEncryptedPassword (SHA-512)', () => {
  it('returns a 128-character hex string', () => {
    expect(createEncryptedPassword('password')).toHaveLength(128)
  })
  it('is deterministic', () => {
    expect(createEncryptedPassword('secret')).toBe(createEncryptedPassword('secret'))
  })
  it('produces different results from SHA-256', () => {
    expect(createEncryptedPassword('test')).not.toBe(createHash256('test'))
  })
})

describe('encrypt / decrypt (AES-256-CBC)', () => {
  it('encrypts to a non-empty hex string different from the original', () => {
    const encrypted = encrypt('hello', AES_KEY)
    expect(encrypted).toBeTruthy()
    expect(encrypted).not.toBe('hello')
  })
  it('round-trips correctly (encrypt then decrypt)', () => {
    const original = 'Hello, Huemul!'
    const encrypted = encrypt(original, AES_KEY)
    const decrypted = decrypt(encrypted, AES_KEY)
    expect(decrypted).toBe(original)
  })
  it('same plaintext + same key produce same ciphertext (deterministic IV)', () => {
    expect(encrypt('test', AES_KEY)).toBe(encrypt('test', AES_KEY))
  })
  it('different plaintexts produce different ciphertexts', () => {
    expect(encrypt('aaa', AES_KEY)).not.toBe(encrypt('bbb', AES_KEY))
  })
})

describe('base64EncodeString / base64DecodeString', () => {
  it('encodes a string to base64', () => {
    expect(base64EncodeString('hello')).toBe('aGVsbG8=')
  })
  it('round-trips correctly', () => {
    const original = 'user:password123'
    expect(base64DecodeString(base64EncodeString(original))).toBe(original)
  })
  it('decodes a known base64 value', () => {
    expect(base64DecodeString('aGVsbG8=')).toBe('hello')
  })
})

describe('base64DecodeKeys', () => {
  it('splits decoded string by colon', () => {
    const encoded = base64EncodeString('user:secret')
    expect(base64DecodeKeys(encoded)).toEqual(['user', 'secret'])
  })
  it('returns single-element array when no colon is present', () => {
    const encoded = base64EncodeString('onlyvalue')
    expect(base64DecodeKeys(encoded)).toEqual(['onlyvalue'])
  })
  it('handles multiple colons', () => {
    const encoded = base64EncodeString('a:b:c')
    expect(base64DecodeKeys(encoded)).toEqual(['a', 'b', 'c'])
  })
})

describe('newRandomId', () => {
  it('returns a string matching UUID v4 format', () => {
    const uuid = newRandomId()
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('generates unique IDs on successive calls', () => {
    expect(newRandomId()).not.toBe(newRandomId())
  })
})

describe('createTokenId', () => {
  it('returns a non-empty string', () => {
    expect(createTokenId('jwt.token.here', 'user123')).toBeTruthy()
  })
  it('is deterministic for the same inputs', () => {
    expect(createTokenId('token', 'user')).toBe(createTokenId('token', 'user'))
  })
  it('produces different values for different inputs', () => {
    expect(createTokenId('token', 'user1')).not.toBe(createTokenId('token', 'user2'))
  })
})

describe('getHuemulAutoInc', () => {
  it('increments on successive calls', () => {
    const first = getHuemulAutoInc()
    const second = getHuemulAutoInc()
    expect(second).toBe(first + 1)
  })
  it('wraps around to 0 after reaching 9999', () => {
    // Drive the counter to 9999 then observe the wrap
    let current = getHuemulAutoInc()
    while (current < 9999) {
      current = getHuemulAutoInc()
    }
    expect(getHuemulAutoInc()).toBe(0)
  })
})
