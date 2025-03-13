<p align="center">
  <a href="" rel="noopener">
 <img width=200px height=200px src="https://i.imgur.com/FxL5qM0.jpg" alt="Plugin logo"></a>
</p>

<h3 align="center">ghost-gstorage-plugin</h3>

<div align="center">

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](/LICENSE)

</div>

---

<p align="center"> 📦 A Ghost Blog storage adapter plugin for Google Cloud Storage, enabling seamless integration and management of media files.
    <br>
</p>

## 📝 Table of Contents

- [📝 Table of Contents](#-table-of-contents)
- [🧐 About](#-about-)
- [🏁 Getting Started](#-getting-started-)
  - [Prerequisites](#prerequisites)
  - [Installing](#installing)
- [⚙️ Configuration](#️-configuration-)
- [⛏️ Built Using](#️-built-using-)
- [✍️ Authors](#️-authors-)
- [🎉 Acknowledgements](#-acknowledgements-)

## 🧐 About <a name = "about"></a>

The `ghost-gstorage-plugin` is a storage adapter for Ghost CMS that allows you to store your media files on Google Cloud Storage. This plugin provides a seamless way to manage and serve your media files directly from Google Cloud, ensuring high availability and scalability.

## 🏁 Getting Started <a name = "getting_started"></a>

These instructions will help you set up the `ghost-gstorage-plugin` on your Ghost blog.

### Prerequisites

Before you begin, ensure you have met the following requirements:

- You have a Google Cloud account.
- You have created a Google Cloud Storage bucket.
- You have a service account key JSON file for authentication.

### Installing

1. Navigate to your Ghost installation directory:

   ```bash
   cd /var/www/ghost
   ```

2. Install the plugin:

   ```bash
   npm install --save ghost-gstorage-plugin
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

1. Create a bucket in your Google Cloud project. Note your project ID and create a service account key in JSON format.

2. Add the key to your Ghost root directory or any preferred location.

3. Update your `config.production.json` with the following configuration:

   ```json
   "storage": {
     "active": "gcloud",
     "gcloud": {
       "projectId": "simpledirect-blog",
       "bucket": "ghost-blog-data",
       "key": "/var/www/ghost/ghost-storage-key.json",
       "assetDomain": "https://storage.googleapis.com/ghost-blog-data",
       "uploadFolderPath": "simpledirect-blog/content/images",
       "insecure": true,
       "maxAge": "2678400"
     }
   }
   ```

   - **projectId**: Your Google Cloud project ID.
   - **key**: Path to your service account key JSON file. If it's in the Ghost root directory, just use the file name; otherwise, use an absolute path.
   - **bucket**: Your Google Cloud Storage bucket name.
   - **assetDomain**: Optional custom domain for your bucket. This is only required if you want to use a custom domain for your cloud storage bucket. Note that these instructions only allow for HTTP, not HTTPS, as the storage servers do not present a custom certificate for your domain.
   - **uploadFolderPath**: The path within your bucket where files will be uploaded.
   - **insecure**: Set to true if using a custom domain without HTTPS. This config is optional and defaults to false.
   - **maxAge**: Cache control max-age in seconds. This is optional and defaults to 31 days (in seconds). It is desirable if you will not be deleting and re-uploading the same file multiple times, and will reduce your bandwidth usage when paired with a CDN.

4. Verify your Ghost configuration:

   ```bash
   ghost stop
   ghost run
   ```

   You will see some logs or an error if the install was not successful. Fix any errors and rerun until successful.

5. Restart Ghost:

   ```bash
   ghost start
   ```

## ⛏️ Built Using <a name = "built_using"></a>

- [@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage) - Google Cloud Storage Node.js Client
- [Ghost](https://ghost.org/) - The open-source headless Node.js CMS

## ✍️ Authors <a name = "authors"></a>

- [Ayush Naik](https://github.com/ayushnaik) - Initial work

## 🎉 Acknowledgements <a name = "acknowledgement"></a>

- Thanks to the Ghost community for their support and contributions.
