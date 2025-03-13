"use strict";

const gc = require("@google-cloud/storage");
const Storage = gc.Storage || gc;
const BaseStore = require("ghost-storage-base");
const path = require("path");
const mime = require("mime-types");

/**
 * GStore class extends BaseStore to provide Google Cloud Storage functionality.
 */
class GStore extends BaseStore {
  /**
   * Constructs a GStore instance with the given configuration.
   * Initializes Google Cloud Storage client and sets up asset domain and base path.
   *
   * @param {Object} config - Configuration object for GStore.
   */
  constructor(config = {}) {
    super(config);
    this.options = config;

    // Initialize Google Cloud Storage client.
    const gcs = new Storage({
      projectId: this.options.projectId,
      keyFilename: this.options.key,
    });
    this.bucket = gcs.bucket(this.options.bucket);

    this._initializeAssetDomain();
    this.insecure = !!this.options.insecure;
    this.maxAge = this.options.maxAge || 2678400;
  }

  /**
   * Initializes the asset domain and base path based on the configuration.
   */
  _initializeAssetDomain() {
    const { assetDomain, bucket, insecure, basePath, uploadFolderPath } =
      this.options;

    if (assetDomain && assetDomain.match(/^https?:\/\//i)) {
      try {
        const url = new URL(assetDomain);
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments[0] === bucket) segments.shift();
        this.basePath = segments.join("/");
        this.assetDomain = `${url.protocol}//${url.host}/${bucket}`;
      } catch {
        this.assetDomain = assetDomain.replace(/\/+$/, "");
        this.basePath = basePath || "";
      }
    } else {
      this.assetDomain = insecure
        ? `http://${bucket}.storage.googleapis.com`
        : `https://${bucket}.storage.googleapis.com`;
      this.basePath = basePath || "";
    }

    if (uploadFolderPath) {
      this.basePath = uploadFolderPath;
    }

    if (this.basePath) {
      this.basePath = this.basePath.replace(/^\/+|\/+$/g, "");
    }
  }

  /**
   * Builds the standard date-based folder structure ("YYYY/MM").
   *
   * @return {string} The date-based folder structure.
   */
  getTargetDir() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}/${month}`;
  }

  /**
   * Creates a unique file name using the target directory, base file name, and timestamp.
   *
   * @param {Object} file - The file object (expects file.name or file.path).
   * @param {string} targetDir - The target directory (e.g. basePath + "YYYY/MM").
   * @return {string} The complete storage key (with forward slashes).
   */
  getUniqueFileName(file, targetDir) {
    const originalName =
      file.name || (file.path && path.basename(file.path)) || "file";
    const ext = path.extname(originalName) || ".jpg";
    const baseName = path.basename(originalName, ext) || "file";
    const uniqueName = `${baseName}-${Date.now()}${ext}`;
    return path.join(targetDir, uniqueName).replace(/\\/g, "/");
  }

  /**
   * Uploads the image to Google Cloud Storage and returns the public URL of the uploaded file.
   *
   * @param {Object} image - The image file object with image.path and optionally image.name / image.type.
   * @returns {string} The public URL of the uploaded file.
   * @throws Will throw an error if Google Cloud Storage is not configured.
   */
  async save(image) {
    if (!this.options) {
      throw new Error("Google Cloud Storage is not configured.");
    }

    const dateFolder = this.getTargetDir();
    const targetDir = this.basePath
      ? `${this.basePath}/${dateFolder}`
      : dateFolder;
    const storageKey = this.getUniqueFileName(image, targetDir);

    const contentType =
      mime.lookup(image.path) || image.type || "application/octet-stream";

    const opts = {
      destination: storageKey,
      metadata: {
        cacheControl: `public, max-age=${this.maxAge}`,
        contentType,
      },
      public: true,
    };

    await this.bucket.upload(image.path, opts);

    const baseDomain = this.assetDomain.replace(/\/+$/, "");
    return `${baseDomain}/${storageKey}`;
  }

  /**
   * Returns a middleware function that does nothing, as files are served via the public URL.
   *
   * @returns {Function} A middleware function.
   */
  serve() {
    return (req, res, next) => next();
  }

  /**
   * Checks if a file exists in the specified target directory.
   *
   * @param {string} filename - The name of the file to check.
   * @param {string} targetDir - The target directory where the file is expected to be.
   * @returns {Promise<boolean>} A promise that resolves to true if the file exists, otherwise false.
   */
  async exists(filename, targetDir) {
    const filePath = path.join(targetDir, filename);
    const [exists] = await this.bucket.file(filePath).exists();
    return exists;
  }

  /**
   * Reads the contents of a file from Google Cloud Storage.
   *
   * @param {string} filename - The name of the file to read.
   * @returns {Promise<Buffer>} A promise that resolves to the contents of the file.
   */
  read(filename) {
    const rs = this.bucket.file(filename).createReadStream();
    return new Promise((resolve, reject) => {
      const chunks = [];
      rs.on("error", reject);
      rs.on("data", (chunk) => chunks.push(chunk));
      rs.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Deletes a file from Google Cloud Storage.
   *
   * @param {string} filename - The name of the file to delete.
   * @returns {Promise} A promise that resolves when the file is deleted.
   */
  delete(filename) {
    return this.bucket.file(filename).delete();
  }
}

module.exports = GStore;
