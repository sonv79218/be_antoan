const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/**
 * AES-256-GCM Encryption Utilities
 * 
 * SECURITY NOTE: In production, use a Key Management System (KMS) like AWS KMS,
 * Azure Key Vault, or HashiCorp Vault. For this demo, we use a constant key,
 * but in production:
 * - Generate a unique key per book
 * - Encrypt the book key with a master RSA key
 * - Store encrypted keys in a secure database
 * - Use hardware security modules (HSM) for key storage
 */

// AES-256 requires a 32-byte (256-bit) key
// In production, this should come from environment variables or KMS
const AES_KEY = process.env.AES_ENCRYPTION_KEY || crypto.randomBytes(32);

// If no key is provided, generate a warning
if (!process.env.AES_ENCRYPTION_KEY) {
  console.warn(
    "⚠️  WARNING: Using randomly generated AES key. In production, use a secure key from KMS."
  );
}

/**
 * Encrypt a file using AES-256-GCM
 * 
 * @param {string} inputFilePath - Path to the plaintext file
 * @param {string} outputFilePath - Path where encrypted file will be saved
 * @returns {Promise<{iv: Buffer, authTag: Buffer}>} - IV and authentication tag for decryption
 * 
 * GCM (Galois/Counter Mode) provides:
 * - Confidentiality (encryption)
 * - Authenticity (authentication tag)
 * - Integrity (detects tampering)
 */
const encryptFile = async (inputFilePath, outputFilePath) => {
  // Validate input file exists
  if (!fs.existsSync(inputFilePath)) {
    throw new Error(`Input file does not exist: ${inputFilePath}`);
  }

  // Generate a random 12-byte IV (96 bits) for GCM mode
  // Each file gets a unique IV to ensure security
  const iv = crypto.randomBytes(12);

  // Create cipher with AES-256-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", AES_KEY, iv);

  // Create read stream for input file
  const inputStream = fs.createReadStream(inputFilePath);
  
  // Create write stream for encrypted output
  const outputStream = fs.createWriteStream(outputFilePath);

  return new Promise((resolve, reject) => {
    let errorOccurred = false;

    // Handle errors
    inputStream.on("error", (err) => {
      if (!errorOccurred) {
        errorOccurred = true;
        reject(new Error(`Failed to read input file: ${err.message}`));
      }
    });

    outputStream.on("error", (err) => {
      if (!errorOccurred) {
        errorOccurred = true;
        reject(new Error(`Failed to write encrypted file: ${err.message}`));
      }
    });

    // Pipe data through cipher to output
    inputStream
      .pipe(cipher)
      .pipe(outputStream)
      .on("finish", () => {
        // Get authentication tag (16 bytes) after encryption completes
        // This tag ensures the file hasn't been tampered with
        const authTag = cipher.getAuthTag();

        resolve({
          iv: iv, // Initialization Vector (needed for decryption)
          authTag: authTag, // Authentication tag (for integrity verification)
        });
      })
      .on("error", (err) => {
        if (!errorOccurred) {
          errorOccurred = true;
          reject(new Error(`Encryption failed: ${err.message}`));
        }
      });
  });
};

/**
 * Decrypt a file in memory and return as Buffer
 * 
 * @param {string} encryptedFilePath - Path to the encrypted file
 * @param {Buffer} iv - Initialization Vector used during encryption
 * @param {Buffer} authTag - Authentication tag from encryption
 * @returns {Promise<Buffer>} - Decrypted file content as Buffer
 * 
 * NOTE: File is decrypted in memory, not saved to disk for security
 */
const decryptFileToBuffer = async (encryptedFilePath, iv, authTag) => {
  // Validate encrypted file exists
  if (!fs.existsSync(encryptedFilePath)) {
    throw new Error(`Encrypted file does not exist: ${encryptedFilePath}`);
  }

  // Validate IV and authTag are provided
  if (!iv || !Buffer.isBuffer(iv)) {
    throw new Error("Invalid IV: must be a Buffer");
  }
  if (!authTag || !Buffer.isBuffer(authTag)) {
    throw new Error("Invalid authTag: must be a Buffer");
  }

  // Create decipher with AES-256-GCM
  const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);

  // Set authentication tag for integrity verification
  decipher.setAuthTag(authTag);

  // Read encrypted file into buffer
  const encryptedData = fs.readFileSync(encryptedFilePath);

  // Decrypt the data
  let decryptedData;
  try {
    decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
  } catch (error) {
    // If decryption fails (wrong key, tampered data, etc.)
    throw new Error(
      `Decryption failed: ${error.message}. File may be corrupted or key is incorrect.`
    );
  }

  return decryptedData;
};

/**
 * Decrypt a file and stream it directly (for large files)
 * 
 * @param {string} encryptedFilePath - Path to the encrypted file
 * @param {Buffer} iv - Initialization Vector
 * @param {Buffer} authTag - Authentication tag
 * @returns {Promise<ReadableStream>} - Decrypted file stream
 */
const decryptFileToStream = (encryptedFilePath, iv, authTag) => {
  // Validate encrypted file exists
  if (!fs.existsSync(encryptedFilePath)) {
    throw new Error(`Encrypted file does not exist: ${encryptedFilePath}`);
  }

  // Validate IV and authTag
  if (!iv || !Buffer.isBuffer(iv)) {
    throw new Error("Invalid IV: must be a Buffer");
  }
  if (!authTag || !Buffer.isBuffer(authTag)) {
    throw new Error("Invalid authTag: must be a Buffer");
  }

  // Create decipher
  const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);
  decipher.setAuthTag(authTag);

  // Create read stream for encrypted file
  const encryptedStream = fs.createReadStream(encryptedFilePath);

  // Pipe through decipher
  return encryptedStream.pipe(decipher);
};

/**
 * Convert IV and authTag buffers to base64 strings for storage in MongoDB
 * 
 * @param {Buffer} iv - Initialization Vector
 * @param {Buffer} authTag - Authentication tag
 * @returns {{iv: string, authTag: string}} - Base64 encoded strings
 */
const encodeEncryptionMetadata = (iv, authTag) => {
  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
};

/**
 * Convert base64 strings back to buffers for decryption
 * 
 * @param {string} ivBase64 - Base64 encoded IV
 * @param {string} authTagBase64 - Base64 encoded authTag
 * @returns {{iv: Buffer, authTag: Buffer}} - Buffers for decryption
 */
const decodeEncryptionMetadata = (ivBase64, authTagBase64) => {
  if (!ivBase64 || !authTagBase64) {
    throw new Error("Encryption metadata (IV or authTag) is missing");
  }

  return {
    iv: Buffer.from(ivBase64, "base64"),
    authTag: Buffer.from(authTagBase64, "base64"),
  };
};

module.exports = {
  encryptFile,
  decryptFileToBuffer,
  decryptFileToStream,
  encodeEncryptionMetadata,
  decodeEncryptionMetadata,
};

