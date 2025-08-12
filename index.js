"use strict";

const gc = require("@google-cloud/storage");
const Storage = gc.Storage || gc.Storage || gc;
const BaseStore = require("ghost-storage-base");
const path = require("path");
const mime = require("mime-types");

/**
 * GStore extends BaseStore to provide Google Cloud Storage functionality for Ghost.
 */
class GStore extends BaseStore {
  /**
   * Create a new GStore instance.
   * Initializes Google Cloud Storage client and sets up asset domain and base path.
   *
   * @param {Object} config - Configuration object for GStore.
   * @param {string} config.projectId - Google Cloud project ID.
   * @param {string} config.keyFilename - Path to the service account key file.
   * @param {string} config.key - Alternative to keyFilename, path to the service account key file.
   * @param {string} config.bucket - Name of the GCS bucket.
   * @param {string} [config.assetDomain] - Optional custom asset domain.
   * @param {boolean} [config.insecure] - Use http instead of https for asset domain.
   * @param {number} [config.maxAge] - Cache max-age in seconds.
   * @param {string} [config.basePath] - Optional base path for uploads.
   * @param {string} [config.uploadFolderPath] - Optional override for upload folder path.
   */
  constructor(config = {}) {
    super(config);
    this.options = config;

    const gcs = new Storage({
      projectId: this.options.projectId,
      keyFilename: this.options.key || this.options.keyFilename,
    });
    this.bucket = gcs.bucket(this.options.bucket);

    this.insecure = !!this.options.insecure;
    this.maxAge =
      typeof this.options.maxAge === "number" ? this.options.maxAge : 2678400;
    this._initializeAssetDomain();
  }

  /**
   * Initializes the asset domain and base path based on the configuration.
   * Sets this.assetDomain and this.basePath.
   */
  _initializeAssetDomain() {
    const { assetDomain, bucket, insecure, basePath, uploadFolderPath } =
      this.options;

    if (assetDomain && /^https?:\/\//i.test(assetDomain)) {
      try {
        const url = new URL(assetDomain);
        const segments = url.pathname.split("/").filter(Boolean);
        if (segments.length && segments[0] === bucket) segments.shift();
        this.basePath = segments.join("/");
        this.assetDomain = `${url.protocol}//${url.host}/${bucket}`;
      } catch (e) {
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
   * @returns {string} The date-based folder structure.
   */
  getTargetDir() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}/${month}`;
  }

  /**
   * Determines the file type category based on the file extension and MIME type.
   * Used to organize files into appropriate folders.
   *
   * @param {Object} file - The file object.
   * @param {string} [file.name] - The file name.
   * @param {string} [file.path] - The file path.
   * @param {string} [file.type] - The MIME type.
   * @returns {string} The file type category ('images', 'media', or 'files').
   */
  getFileTypeCategory(file) {
    const fileName =
      (file && file.name) ||
      (file && file.path && path.basename(file.path)) ||
      "file";
    const ext = path.extname(fileName).toLowerCase();
    let mimeType = "";
    if (file && file.path) {
      mimeType = mime.lookup(file.path) || file.type || "";
    } else if (file && file.name) {
      mimeType = mime.lookup(file.name) || file.type || "";
    } else {
      mimeType = file && file.type ? file.type : "";
    }

    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
      ".ico",
    ];
    const imageMimeTypes = ["image/"];

    const mediaExtensions = [
      ".mp4",
      ".avi",
      ".mov",
      ".wmv",
      ".flv",
      ".webm",
      ".mkv",
      ".mp3",
      ".wav",
      ".flac",
      ".aac",
      ".ogg",
      ".m4a",
    ];
    const mediaMimeTypes = ["video/", "audio/"];

    if (
      imageExtensions.includes(ext) ||
      imageMimeTypes.some(
        (type) =>
          mimeType && typeof mimeType === "string" && mimeType.startsWith(type)
      )
    ) {
      return "images";
    }

    if (
      mediaExtensions.includes(ext) ||
      mediaMimeTypes.some(
        (type) =>
          mimeType && typeof mimeType === "string" && mimeType.startsWith(type)
      )
    ) {
      return "media";
    }

    return "files";
  }

  /**
   * Creates a unique file name using the target directory, base file name, and timestamp.
   *
   * @param {Object} file - The file object (expects file.name or file.path).
   * @param {string} targetDir - The target directory (e.g. basePath + "YYYY/MM").
   * @returns {string} The complete storage key (with forward slashes).
   */
  getUniqueFileName(file, targetDir) {
    const originalName =
      (file && file.name) ||
      (file && file.path && path.basename(file.path)) ||
      "file";
    const ext = path.extname(originalName) || "";
    const baseName = path.basename(originalName, ext) || "file";
    const safeBaseName = baseName.replace(/[\/\\]/g, "_");
    const uniqueName = `${safeBaseName}-${Date.now()}${ext}`;
    return path.posix.join(targetDir, uniqueName);
  }

  /**
   * Uploads a file to Google Cloud Storage and returns the public URL of the uploaded file.
   *
   * @param {Object} file - The file object with file.path and optionally file.name / file.type.
   * @param {string} file.path - The local path to the file.
   * @param {string} [file.name] - The original file name.
   * @param {string} [file.type] - The MIME type.
   * @returns {Promise<string>} The public URL of the uploaded file.
   * @throws {Error} If Google Cloud Storage is not configured or file is invalid.
   */
  async save(file) {
    if (!this.options) {
      throw new Error("Google Cloud Storage is not configured.");
    }
    if (!file || !file.path) {
      throw new Error("File object with a valid path is required.");
    }

    const fileType = this.getFileTypeCategory(file);

    const dateFolder = this.getTargetDir();

    let targetDir;
    if (this.basePath) {
      targetDir = `${this.basePath}/${fileType}/${dateFolder}`;
    } else {
      targetDir = `${fileType}/${dateFolder}`;
    }
    targetDir = targetDir.replace(/\\/g, "/");

    const storageKey = this.getUniqueFileName(file, targetDir);
    const contentType =
      mime.lookup(file.path) || file.type || "application/octet-stream";

    const opts = {
      destination: storageKey,
      metadata: {
        cacheControl: `public, max-age=${this.maxAge}`,
        contentType,
      },
      public: true,
    };

    await this.bucket.upload(file.path, opts);

    const baseDomain = this.assetDomain.replace(/\/+$/, "");
    return `${baseDomain}/${storageKey}`
      .replace(/\/{2,}/g, "/")
      .replace(":/", "://");
  }

  /**
   * Converts a public URL back to the storage file path.
   * Required by Ghost for media operations like thumbnail generation.
   *
   * @param {string} url - The public URL of the file.
   * @returns {string} The storage file path.
   */
  urlToPath(url) {
    if (!url || typeof url !== "string") {
      return "";
    }

    try {
      let filePath = "";

      if (url.startsWith(this.assetDomain)) {
        filePath = url.substring(this.assetDomain.length);
      } else {
        const bucketPattern = new RegExp(
          `^https?://[^/]*googleapis\\.com/${this.options.bucket}/`
        );
        if (bucketPattern.test(url)) {
          filePath = url.replace(bucketPattern, "");
        } else {
          const urlObj = new URL(url);
          filePath = urlObj.pathname;

          if (filePath.startsWith(`/${this.options.bucket}/`)) {
            filePath = filePath.substring(`/${this.options.bucket}/`.length);
          }
        }
      }

      filePath = filePath.replace(/^\/+/, "").replace(/\/+/g, "/");

      return filePath;
    } catch (error) {
      const parts = url.split("/");
      return parts[parts.length - 1] || "";
    }
  }

  /**
   * Returns a middleware function that does nothing, as files are served via the public URL.
   *
   * @returns {Function} A middleware function for Ghost.
   */
  serve() {
    return (req, res, next) => next();
  }

  /**
   * Checks if a file exists in the specified target directory.
   *
   * @param {string} filename - The name of the file to check.
   * @param {string} targetDir - The target directory where the file is expected to be.
   * @returns {Promise<boolean>} Resolves to true if the file exists, otherwise false.
   */
  async exists(filename, targetDir) {
    const filePath = path.posix.join(targetDir, filename);
    try {
      const [exists] = await this.bucket.file(filePath).exists();
      return !!exists;
    } catch (e) {
      return false;
    }
  }

  /**
   * Reads the contents of a file from Google Cloud Storage.
   *
   * @param {string} filename - The name of the file to read.
   * @returns {Promise<Buffer>} Resolves to the contents of the file as a Buffer.
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
   * @returns {Promise} Resolves when the file is deleted.
   */
  async delete(filename) {
    try {
      await this.bucket.file(filename).delete();
    } catch (err) {
      if (err && err.code === 404) {
        return;
      }
      throw err;
    }
  }
}

module.exports = GStore;
