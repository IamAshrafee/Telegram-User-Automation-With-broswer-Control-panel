# 🚀 Deployment Guide: Telegram User Automation

This guide maps out exactly how to host your application on your Linux VPS (`www.businessupdate.org`) using **PM2**.

## 📋 Prerequisites

Your VPS has **4 Cores / 8GB RAM**, which is plenty for this application.

### 1. Connect to VPS

Open your terminal and SSH into your server:

```bash
ssh root@62.72.42.124
# Enter password if asked
```

### 2. Update System & Install Tools

Run these commands one by one to set up Python, Git, and Nginx.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git nginx
```

### 3. Install Node.js & PM2

Since you want to use PM2, we need Node.js installed (if not already there).

```bash
# Install Node.js (v18 or v20)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2
```

---

## ⚙️ Project Setup

### 4. Upload or Clone Project

You can either git clone your repo or upload files via SFTP (FileZilla).
Assuming you upload to `/var/www/telegram-automation`:

```bash
# Create directory
mkdir -p /var/www/telegram-automation
cd /var/www/telegram-automation

# ... (Upload your project files here) ...
```

### 5. Setup Python Environment

We will use a virtual environment to keep dependencies clean.

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## 🚀 Running with PM2

### 6. Configure PM2

I have added a file called `ecosystem.config.js` to your project root.
Open it and ensure the `interpreter` points to your venv python for stability, or just use the system python if you prefer.

**Recommended**: Edit `ecosystem.config.js` on the server:

```javascript
module.exports = {
  apps: [
    {
      name: "telegram-backend",
      script: "backend/main.py",
      interpreter: "./venv/bin/python", // Points to your VENV python
      env: {
        PYTHONUNBUFFERED: "1",
        HOST: "0.0.0.0",
        PORT: 8000,
      },
    },
  ],
};
```

### 7. Start the Application

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save configuration so it auto-starts on reboot
pm2 save
pm2 startup
```

---

## 🕵️ Stealth Deployment Configuration

To host this "secretly" alongside your existing application, we will use a **disguised name** and a **hidden port**.

### 6. Configure PM2 (Stealth Mode)

The `ecosystem.config.js` has been updated with a boring name (`sys-worker-lib`) so it doesn't look like a Telegram bot in the process list.

### 7. Start the Application

```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## 🌐 Hidden Access (Nginx Bridge)

Instead of a new website, we will "hide" this panel inside your existing website's config under a secret subpath.

### 8. Add to Existing Nginx Config

Don't create a new file. Instead, **edit your existing** configuration:
`sudo nano /etc/nginx/sites-available/default` (or your main config for www.businessupdate.org).

Add this block **inside** your existing `server { ... }` block:

```nginx
# SECRET ACCESS PATH
# You will access your panel at: http://www.businessupdate.org/sys-admin-panel/
location /sys-admin-panel/ {
    proxy_pass http://127.0.0.1:9876/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;

    # Optional: Allow only your IP for extra "secrecy"
    # allow YOUR_PERSONAL_IP;
    # deny all;
}
```

### 9. Restart Nginx

```bash
sudo nginx -t && sudo systemctl restart nginx
```

## ✅ Access Instructions

Your "hidden" panel is now available at:
👉 **`http://www.businessupdate.org/sys-admin-panel/`**

---

## 🛠 Troubleshooting Commands

If you need to check the process without it looking suspicious:

```bash
pm2 status          # Look for 'sys-worker-lib'
pm2 logs sys-worker-lib
```

## ✅ Done!

Your application should now be live at **http://www.businessupdate.org/sys-admin-panel/**.

---

## 🛠 Troubleshooting

**View Logs:**

```bash
pm2 restart sys-worker-lib
```
