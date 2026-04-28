# Emyris OMS - Critical Error Backlog

## Issue: Critical Save Error (Data Loss & Connection Failure)
**Date:** 2026-04-28
**Status:** Resolved (Fixes in progress)

### 1. Root Cause Analysis
The error was caused by a synchronization failure between the frontend UI (`admin.html`) and the administrative logic (`admin-script.js`).

#### A. TypeError in `saveSettings`
- **Location:** `admin-script.js` (around line 1184)
- **Problem:** The script attempted to access `.value` of several IDs (e.g., `set-tollfree`, `set-email1`, `set-bank-acc`) that had been removed or renamed in the `admin.html` file during a previous UI redesign.
- **Impact:** This caused a `TypeError: Cannot read properties of null (reading 'value')`.

#### B. Misleading Error Handling
- **Location:** `admin-script.js` (lines 1239-1242)
- **Problem:** The `catch` block for the settings save operation caught the TypeError and displayed a generic "CRITICAL ERROR: Could not connect to server" alert.
- **Impact:** The user was misled into thinking there was a network/server issue when it was actually a frontend logic crash.

#### C. Payload Size Limits
- **Location:** `server.js` (line 175)
- **Problem:** `express.json()` used the default limit (100kb). The settings payload included Base64 strings for the Logo and Signature, which frequently exceeded this limit.
- **Impact:** The server would return a `413 Payload Too Large` error, or in extreme cases, crash due to memory pressure on ephemeral environments like Render.

#### D. File Deletion (Ephemeral Storage)
- **Problem:** The user reported "all files getting deleted". 
- **Cause:** Since the app is hosted on Render (`emyris-oms.onrender.com`), the filesystem is ephemeral. If the server crashes (due to the 413 error or memory pressure) and restarts, the `uploads/` directory is wiped. Additionally, the frontend crash caused a page refresh, clearing the UI state.

### 2. Implemented Fixes

#### Server-Side
- [x] **Increased JSON Limit:** Updated `server.js` to allow `50mb` payloads to accommodate high-resolution branding assets.
- [x] **Extended URL Encoding:** Increased limits for urlencoded data as well.

#### Client-Side
- [ ] **Safe Value Access:** Implementing `safeGetVal` helper to prevent the script from crashing if a UI element is missing.
- [ ] **UI Restoration:** Restoring the missing "Company Settings" fields in `admin.html` to ensure the admin can actually edit all parameters.
- [ ] **Accurate Error Messaging:** Updating the `catch` block to log the actual error and provide more helpful feedback to the user.

### 3. Prevention Strategy
- Always use `safeGetVal` or check for element existence before accessing `.value` in global settings functions.
- Periodically verify that the `Company` schema in `server.js` matches the input fields in `admin.html`.
- Use Cloudinary for media storage (already partially implemented) to avoid data loss on ephemeral server restarts.
