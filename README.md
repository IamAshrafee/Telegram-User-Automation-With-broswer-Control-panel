# Telegram User Automation System

A professional Telegram marketing automation system that uses a real Telegram user account (not a bot) to automate message sending to multiple groups. Built with Python (FastAPI + Telethon) backend and vanilla JavaScript frontend.

## Features

- 🔐 **Telegram Authentication** - Login with phone number + OTP
- 👥 **Group Management** - Sync and categorize groups by content permissions
- 🖼️ **Media Library** - Upload and manage marketing images
- ✉️ **Message Composer** - Send messages with text, links, and images
- ⏰ **Scheduler** - Schedule messages for future delivery
- 🛡️ **Safety Mechanisms** - Random delays and daily limits to protect your account

## Prerequisites

- Python 3.8 or higher
- Telegram account
- Telegram API credentials (get from [my.telegram.org](https://my.telegram.org))

## Installation

### 1. Clone or navigate to the project directory

```bash
cd <project-directory>
```

### 2. Create a virtual environment

```bash
python -m venv venv
```

### 3. Activate the virtual environment

**Windows:**

```bash
venv\Scripts\activate
```

**macOS/Linux:**

```bash
source venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure environment variables

1. Copy `.env.example` to `.env`:

   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and add your Telegram API credentials:

   ```
   TELEGRAM_API_ID=your_api_id_here
   TELEGRAM_API_HASH=your_api_hash_here
   ```

   **How to get API credentials:**
   - Go to [my.telegram.org](https://my.telegram.org)
   - Log in with your phone number
   - Go to "API development tools"
   - Create a new application
   - Copy the `api_id` and `api_hash`

## Running the Application

### Start the backend server

```bash
cd backend
python main.py
```

The server will start on `http://localhost:8000`

### Quick Start (Windows)

Simply run the `run.bat` script in the root directory:

```bash
run.bat
```

This will automatically create the virtual environment, install dependencies, and start the application.

### Access the web dashboard

Open your browser and navigate to:

```
http://localhost:8000
```

## First-Time Setup

1. **Authenticate with Telegram**
   - Enter your phone number (with country code, e.g., +1234567890)
   - Click "Send Code"
   - Check your Telegram app for the OTP code
   - Enter the code and click "Verify Code"

2. **Sync Your Groups**
   - Go to the "Groups" section
   - Click "🔄 Sync from Telegram"
   - Your groups will be fetched and displayed

3. **Configure Group Permissions**
   - For each group, set the appropriate permission type:
     - **All Content**: Text, links, images, and files allowed
     - **Text Only**: Only text messages
     - **Text + Link**: Text and links allowed
     - **Text + Image**: Text and images allowed
     - **Text + Link + Image**: Text, links, and images allowed

4. **Upload Marketing Media**
   - Go to "Media Library"
   - Upload your marketing images
   - Images will be available for use in messages

## Usage

### Sending Messages

1. Go to "Send Message" section
2. Enter your message text
3. (Optional) Add a link
4. (Optional) Select an image from your media library
5. Select target groups
6. Click "Send Now"

The system will:

- Validate content against each group's permissions
- Skip groups that don't allow the content type
- Apply random delays (10-30 seconds) between messages
- Respect daily message limits

### Scheduling Messages

1. Go to "Scheduler" section
2. Compose your message
3. Select target groups
4. Choose date and time
5. Click "Schedule Message"

The message will be sent automatically at the scheduled time.

## Safety Features

### Automatic Delays

- Random delay between 10-30 seconds between each message
- Prevents Telegram from detecting automated behavior

### Daily Limits

- Default: 100 messages per day
- Configurable in `.env` file
- Protects your account from restrictions

### Content Validation

- Messages are only sent to groups that allow the content type
- Prevents violations of group rules

## Best Practices

1. **Start Small**
   - Begin with a few groups
   - Monitor for any issues
   - Gradually increase volume

2. **Vary Your Messages**
   - Don't send identical messages repeatedly
   - Rotate message wording
   - Use different images

3. **Respect Group Rules**
   - Set correct permission types for each group
   - Don't spam
   - Follow group posting guidelines

4. **Monitor Your Account**
   - Watch for Telegram warnings
   - If you receive a warning, reduce activity
   - Take breaks between campaigns

## Project Structure

```
aphelion-equinox/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── database.py          # Database setup
│   ├── models/              # Database models
│   ├── schemas/             # Pydantic schemas
│   ├── routers/             # API endpoints
│   ├── services/            # Business logic
│   └── utils/               # Utilities
├── frontend/
│   ├── index.html           # Main page
│   ├── css/
│   │   └── styles.css       # Styles
│   └── js/
│       ├── app.js           # Main app
│       ├── auth.js          # Authentication
│       ├── groups.js        # Group management
│       ├── media.js         # Media library
│       ├── messages.js      # Message sending
│       └── scheduler.js     # Scheduling
├── storage/
│   └── media/               # Uploaded images
├── telegram_sessions/       # Session files (auto-created)
├── requirements.txt         # Python dependencies
└── .env                     # Configuration (create from .env.example)
```

## API Documentation

Once the server is running, visit:

```
http://localhost:8000/docs
```

This provides interactive API documentation powered by FastAPI.

## Troubleshooting

### "Not authenticated with Telegram"

- Make sure you've completed the authentication flow
- Check if your session is still valid in the database
- Try logging out and logging in again

### "Failed to sync groups"

- Ensure your Telegram session is active
- Check your internet connection
- Verify API credentials in `.env`

### "Upload failed"

- Check file type (only images allowed)
- Ensure file size is reasonable
- Verify `storage/media` directory exists

### Messages not sending

- Check group permissions
- Verify you haven't hit daily limit
- Ensure groups are marked as active
- Check backend console for errors

## Security Notes

- **Never share your `.env` file** - It contains sensitive credentials
- **Session files are sensitive** - They provide access to your Telegram account
- **Use strong passwords** - If you enable 2FA on Telegram
- **Monitor activity** - Regularly check for unauthorized access

## Scaling

To scale the system:

1. **Multiple Accounts**
   - Modify the code to support multiple Telegram sessions
   - Distribute load across accounts

2. **Database Migration**
   - Switch from SQLite to PostgreSQL
   - Update `DATABASE_URL` in `.env`

3. **Cloud Deployment**
   - Deploy to a VPS or cloud platform
   - Use cloud storage for media files
   - Set up proper domain and SSL

## License

This project is for educational and personal use. Use responsibly and in accordance with Telegram's Terms of Service.

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review the API documentation
3. Check backend console logs for errors
4. Ensure all dependencies are installed correctly

## Disclaimer

This tool automates Telegram user actions. While it includes safety mechanisms, use it responsibly. The developers are not responsible for any account restrictions or bans resulting from misuse.
