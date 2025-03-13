"use strict";

const gc = require("@google-cloud/storage");
const Storage = gc.Storage || gc;
const BaseStore = require("ghost-storage-base");
const path = require("path");
const mime = require("mime-types");

let options = {};

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
    options = config;

    // Initialize Google Cloud Storage client.
    const gcs = new Storage({
      projectId: options.projectId,
      keyFilename: options.key,
    });
    this.bucket = gcs.bucket(options.bucket);

    // Parse assetDomain if provided as full URL.
    if (options.assetDomain && options.assetDomain.match(/^https?:\/\//i)) {
      try {
        const url = new URL(options.assetDomain);
        const segments = url.pathname.split("/").filter((segment) => segment);
        if (segments.length && segments[0] === options.bucket) {
          segments.shift();
        }
        this.basePath = segments.join("/");
        this.assetDomain = `${url.protocol}//${url.host}/${options.bucket}`;
      } catch (err) {
        this.assetDomain = options.assetDomain.replace(/\/+$/, "");
        this.basePath = options.basePath || "";
      }
    } else {
      this.assetDomain = options.insecure
        ? `http://${options.bucket}.storage.googleapis.com`
        : `https://${options.bucket}.storage.googleapis.com`;
      this.basePath = options.basePath || "";
    }

    if (options.uploadFolderPath) {
      this.basePath = options.uploadFolderPath;
    }

    if (this.basePath) {
      this.basePath = this.basePath.replace(/^\/+|\/+$/g, "");
    }

    this.insecure = !!options.insecure;
    this.maxAge = options.maxAge || 2678400;
  }

  /**
   * Builds the standard date-based folder structure ("YYYY/MM").
   *
   * @return {string} The date-based folder structure.
   */
  getTargetDir() {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = ("0" + (now.getMonth() + 1)).slice(-2);
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
    let originalName =
      file.name || (file.path && path.basename(file.path)) || "file";
    let ext = path.extname(originalName) || ".jpg";
    let baseName = path.basename(originalName, ext) || "file";
    const now = Date.now();
    const uniqueName = `${baseName}-${now}${ext}`;
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
    if (!options) {
      throw new Error("Google Cloud Storage is not configured.");
    }

    const dateFolder = this.getTargetDir();
    const targetDir = this.basePath
      ? [this.basePath, dateFolder].join("/")
      : dateFolder;
    const storageKey = this.getUniqueFileName(image, targetDir);

    const contentType =
      mime.lookup(image.path) || image.type || "application/octet-stream";

    const opts = {
      destination: storageKey,
      metadata: {
        cacheControl: `public, max-age=${this.maxAge}`,
        contentType: contentType,
      },
      public: true,
    };

    await this.bucket.upload(image.path, opts);

    let baseDomain = this.assetDomain.replace(/\/+$/, "");
    const publicUrl = `${baseDomain}/${storageKey}`;
    return publicUrl;
  }

  /**
   * Returns a middleware function that does nothing, as files are served via the public URL.
   *
   * @returns {Function} A middleware function.
   */
  serve() {
    return function (req, res, next) {
      next();
    };
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
    const data = await this.bucket.file(filePath).exists();
    return data[0];
  }

  /**
   * Reads the contents of a file from Google Cloud Storage.
   *
   * @param {string} filename - The name of the file to read.
   * @returns {Promise<Buffer>} A promise that resolves to the contents of the file.
   */
  read(filename) {
    const rs = this.bucket.file(filename).createReadStream();
    let contents = null;
    return new Promise((resolve, reject) => {
      rs.on("error", (err) => reject(err));
      rs.on("data", (data) => {
        contents = contents ? Buffer.concat([contents, data]) : data;
      });
      rs.on("end", () => resolve(contents));
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
