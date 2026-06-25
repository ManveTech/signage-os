# Signage Player Configuration

This Android TV application has its connectivity URLs hardcoded for security and deployment integrity.

## URL Configuration Location

To update the Server URL or the PocketBase URL:

1. Open the configuration file:
   [AppConfig.kt](file:///home/manve/projects/signage-os/tv-signage-player/app/src/main/java/com/example/AppConfig.kt)
   
2. Locate the `AppConfig` object:
   ```kotlin
   package com.example

   object AppConfig {
       const val SERVER_URL = "https://dem1.manve.co"
       const val POCKETBASE_URL = "https://demo.manve.co"
   }
   ```

3. Update the `SERVER_URL` and `POCKETBASE_URL` strings with your new server addresses.

4. Recompile and install the application on your target devices.

*Note: All administrative settings tools and URL overrides have been removed from the user interface.*
