// Encryption utilities for password-protected file transfers
export class EncryptionManager {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();

  /**
   * Derives a cryptographic key from a password
   */
  static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      this.encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generates a random salt for key derivation
   */
  static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Generates a random IV (Initialization Vector)
   */
  static generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12));
  }

  /**
   * Encrypts data with a password
   */
  static async encrypt(
    data: ArrayBuffer,
    password: string,
    salt?: Uint8Array,
    iv?: Uint8Array
  ): Promise<{ encrypted: ArrayBuffer; salt: Uint8Array; iv: Uint8Array }> {
    const actualSalt = salt || this.generateSalt();
    const actualIV = iv || this.generateIV();
    
    const key = await this.deriveKey(password, actualSalt);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: actualIV.buffer as ArrayBuffer },
      key,
      data
    );

    return {
      encrypted,
      salt: actualSalt,
      iv: actualIV,
    };
  }

  /**
   * Decrypts data with a password
   */
  static async decrypt(
    encryptedData: ArrayBuffer,
    password: string,
    salt: Uint8Array,
    iv: Uint8Array
  ): Promise<ArrayBuffer> {
    const key = await this.deriveKey(password, salt);
    
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        encryptedData
      );
      return decrypted;
    } catch (error) {
      throw new Error('Invalid password or corrupted data');
    }
  }

  /**
   * Encrypts a string (useful for metadata)
   */
  static async encryptString(
    text: string,
    password: string
  ): Promise<{ encrypted: string; salt: string; iv: string }> {
    const data = this.encoder.encode(text);
    const result = await this.encrypt(data, password);

    return {
      encrypted: this.arrayBufferToBase64(result.encrypted),
      salt: this.arrayBufferToBase64(result.salt),
      iv: this.arrayBufferToBase64(result.iv),
    };
  }

  /**
   * Decrypts a string
   */
  static async decryptString(
    encryptedText: string,
    password: string,
    salt: string,
    iv: string
  ): Promise<string> {
    const encrypted = this.base64ToArrayBuffer(encryptedText);
    const saltBuffer = this.base64ToArrayBuffer(salt);
    const ivBuffer = this.base64ToArrayBuffer(iv);

    const decrypted = await this.decrypt(encrypted, password, new Uint8Array(saltBuffer), new Uint8Array(ivBuffer));
    return this.decoder.decode(decrypted);
  }

  /**
   * Verifies a password by attempting to decrypt a test string
   */
  static async verifyPassword(
    encryptedTest: string,
    password: string,
    salt: string,
    iv: string
  ): Promise<boolean> {
    try {
      await this.decryptString(encryptedTest, password, salt, iv);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Converts ArrayBuffer to Base64 string
   */
  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Converts Base64 string to ArrayBuffer
   */
  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Creates a password hash for verification (without encryption keys)
   */
  static async createPasswordVerifier(password: string): Promise<{
    testString: string;
    salt: string;
    iv: string;
  }> {
    const testString = 'PASSWORD_VERIFICATION_TOKEN';
    const result = await this.encryptString(testString, password);
    return {
      testString: result.encrypted,
      salt: result.salt,
      iv: result.iv,
    };
  }
}

