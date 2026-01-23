from sqlalchemy import create_engine, text
import os

# Database connection
DB_URL = "sqlite:///./telegram_automation.db"
engine = create_engine(DB_URL)

def fix_admin_email():
    with engine.connect() as conn:
        print("Checking for invalid admin email...")
        
        # Check if user exists
        result = conn.execute(text("SELECT id, email FROM users WHERE email = 'admin@localhost'"))
        user = result.fetchone()
        
        if user:
            print(f"Found user with invalid email: {user[1]} (ID: {user[0]})")
            
            # Update email
            conn.execute(text("UPDATE users SET email = 'admin@example.com' WHERE id = :id"), {"id": user[0]})
            conn.commit()
            print("Successfully updated email to 'admin@example.com'")
        else:
            print("No user found with email 'admin@localhost'. Checking for 'admin@example.com'...")
            result = conn.execute(text("SELECT id, email FROM users WHERE email = 'admin@example.com'"))
            if result.fetchone():
                print("Admin user already has valid email: admin@example.com")
            else:
                print("Admin user not found.")

if __name__ == "__main__":
    fix_admin_email()
