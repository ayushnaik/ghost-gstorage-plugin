<p align="center">
  <a href="" rel="noopener">
 <img width=200px height=200px src="https://i.imgur.com/FxL5qM0.jpg" alt="Plugin logo"></a>
</p>

<h3 align="center">ghost-gstorage-plugin</h3>

<div align="center">

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](/LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)]()

</div>

---

<p align="center"> 📦 A comprehensive Ghost Blog storage adapter plugin for Google Cloud Storage, supporting ALL media types including images, videos, audio files, and documents.
    <br>
</p>

## 📝 Table of Contents

- [📝 Table of Contents](#-table-of-contents)
- [🧐 About ](#-about-)
- [✨ New Features v2.0.0 ](#-new-features-v200-)
  - [🚀 Complete Media Support](#-complete-media-support)
  - [📁 Improved Organization](#-improved-organization)
  - [🔧 Better Configuration](#-better-configuration)
- [🏁 Getting Started ](#-getting-started-)
  - [Prerequisites](#prerequisites)
  - [Installing](#installing)
- [⚙️ Configuration ](#️-configuration-)
  - [Single Adapter Configuration (Recommended)](#single-adapter-configuration-recommended)
  - [Multiple Adapter Configuration](#multiple-adapter-configuration)
  - [Configuration Options](#configuration-options)
- [📁 File Organization ](#-file-organization-)
  - [File Type Detection](#file-type-detection)
  - [Storage Structure](#storage-structure)
- [🔧 Migration from v1.x ](#-migration-from-v1x-)
- [🔍 Verification](#-verification)
- [⛏️ Built Using ](#️-built-using-)
- [✍️ Authors ](#️-authors-)
- [🎉 Acknowledgements ](#-acknowledgements-)
- [🐛 Issues \& Support](#-issues--support)

## 🧐 About <a name = "about"></a>

The `ghost-gstorage-plugin` is a comprehensive storage adapter for Ghost CMS that allows you to store **ALL** your media files on Google Cloud Storage. This plugin provides a seamless way to manage and serve all types of media files directly from Google Cloud, ensuring high availability and scalability.

**Version 2.0.0** now supports:

- 🖼️ **Images** (jpg, png, gif, webp, etc.)
- 🎥 **Video files** (mp4, avi, mov, webm, etc.)
- 🎵 **Audio files** (mp3, wav, flac, aac, etc.)
- 📄 **Documents** (pdf, doc, txt, zip, etc.)

## ✨ New Features v2.0.0 <a name = "new-features"></a>

### 🚀 Complete Media Support

- **All file types**: No more limitations to just images
- **Smart file detection**: Automatically categorizes files by type
- **Organized storage**: Files are organized into folders by type and date

### 📁 Improved Organization

Files are automatically organized in your Google Cloud Storage bucket:

```
your-bucket/
├── images/
│   ├── 2024/01/image-123456789.jpg
│   └── 2024/02/photo-987654321.png
├── media/
│   ├── 2024/01/video-123456789.mp4
│   └── 2024/02/audio-987654321.mp3
└── files/
    ├── 2024/01/document-123456789.pdf
    └── 2024/02/archive-987654321.zip
```

### 🔧 Better Configuration

- Single adapter configuration for all file types
- Individual adapter configuration for fine-grained control
- Backward compatibility with v1.x configurations

## 🏁 Getting Started <a name = "getting_started"></a>

These instructions will help you set up the `ghost-gstorage-plugin` on your Ghost blog.

### Prerequisites

Before you begin, ensure you have met the following requirements:

- You have a Google Cloud account.
- You have created a Google Cloud Storage bucket.
- You have a service account key JSON file for authentication.
- Ghost CMS v4.0+ (required for file upload support)

### Installing

1. Navigate to your Ghost installation directory:

   ```bash
   cd /var/www/ghost
   ```

2. Install the plugin:

   ```bash
   npm install --save ghost-gstorage-plugin@latest
   ```

3. Create the storage module:

   ```bash
   export GHOST_ENVIRONMENT=production
   export CONTENT_PATH=$(jq -r '.paths.contentPath // "."' config.${GHOST_ENVIRONMENT}.json)
   mkdir -p ${CONTENT_PATH}/adapters/storage/gcloud
   cat > ${CONTENT_PATH}/adapters/storage/gcloud/index.js << EOL
   'use strict';
   module.exports = require('ghost-gstorage-plugin');
   EOL
   ```

## ⚙️ Configuration <a name = "configuration"></a>

### Single Adapter Configuration (Recommended)

For most users, this is the simplest approach. All file types use the same Google Cloud Storage configuration:

```json
{
  "storage": {
    "active": "gcloud",
    "gcloud": {
      "projectId": "your-project-id",
      "bucket": "your-bucket-name",
      "key": "path/to/your/service-account-key.json",
      "assetDomain": "https://your-custom-domain.com",
      "uploadFolderPath": "ghost-uploads",
      "insecure": false,
      "maxAge": 2678400
    }
  }
}
```

### Multiple Adapter Configuration

For advanced users who want different configurations for different file types:

```json
{
  "storage": {
    "images": {
      "adapter": "gcloud",
      "gcloud": {
        "projectId": "your-project-id",
        "bucket": "your-images-bucket",
        "key": "path/to/service-account-key.json",
        "uploadFolderPath": "images"
      }
    },
    "media": {
      "adapter": "gcloud", 
      "gcloud": {
        "projectId": "your-project-id",
        "bucket": "your-media-bucket",
        "key": "path/to/service-account-key.json",
        "uploadFolderPath": "media"
      }
    },
    "files": {
      "adapter": "gcloud",
      "gcloud": {
        "projectId": "your-project-id",
        "bucket": "your-files-bucket",
        "key": "path/to/service-account-key.json",
        "uploadFolderPath": "files"
      }
    }
  }
}
```

### Configuration Options

- **projectId**: Your Google Cloud project ID.
- **key**: Path to your service account key JSON file.
- **bucket**: Your Google Cloud Storage bucket name.
- **assetDomain**: Optional custom domain for your bucket.
- **uploadFolderPath**: The path within your bucket where files will be uploaded.
- **insecure**: Set to true if using a custom domain without HTTPS.
- **maxAge**: Cache control max-age in seconds (defaults to 31 days).

## 📁 File Organization <a name = "file-organization"></a>

The plugin automatically organizes files based on their type:

### File Type Detection

- **Images**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`, `.svg`, `.ico`
- **Media**: `.mp4`, `.avi`, `.mov`, `.wmv`, `.flv`, `.webm`, `.mkv`, `.mp3`, `.wav`, `.flac`, `.aac`, `.ogg`, `.m4a`
- **Files**: All other file types (`.pdf`, `.doc`, `.zip`, etc.)

### Storage Structure

```
bucket-name/
├── [uploadFolderPath]/
│   ├── images/
│   │   └── YYYY/MM/filename-timestamp.ext
│   ├── media/
│   │   └── YYYY/MM/filename-timestamp.ext
│   └── files/
│       └── YYYY/MM/filename-timestamp.ext
```

## 🔧 Migration from v1.x <a name = "migration"></a>

Version 2.0.0 is backward compatible with v1.x configurations. Your existing image uploads will continue to work without any changes.

To take advantage of the new features:

1. Update your Ghost installation to v4.0+ (if not already)
2. Install the latest version of the plugin
3. Update your configuration (optional - existing config will work)
4. Restart Ghost

## 🔍 Verification

After installation, verify your configuration:

```bash
ghost stop
ghost run
```

You should see logs indicating successful initialization. Test by uploading different file types in Ghost Admin.

## ⛏️ Built Using <a name = "built_using"></a>

- [@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage) - Google Cloud Storage Node.js Client
- [Ghost](https://ghost.org/) - The open-source headless Node.js CMS
- [mime-types](https://www.npmjs.com/package/mime-types) - MIME type detection

## ✍️ Authors <a name = "authors"></a>

- [Ayush Naik](https://github.com/ayushnaik) - Initial work & enhancements.

## 🎉 Acknowledgements <a name = "acknowledgement"></a>

- Thanks to the Ghost community for their support and contributions.
- Special thanks to users who requested full media support.

---

## 🐛 Issues & Support

If you encounter any issues or have questions:

1. Check the [Ghost documentation](https://ghost.org/docs/) for storage adapters
2. Create an issue on [GitHub](https://github.com/ayushnaik/ghost-gstorage-plugin/issues)
3. Make sure your Ghost version supports the file types you're trying to upload
