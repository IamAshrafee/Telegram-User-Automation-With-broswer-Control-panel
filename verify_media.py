
import requests
import os

# Configuration
BASE_URL = "http://localhost:8000"

def test_upload_valid_image():
    print("Testing Valid Image Upload...")
    # Create a dummy valid PNG
    with open("test_valid.png", "wb") as f:
        # Minimal PNG header
        f.write(b'\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0aIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\x0a\x2d\xb4\x00\x00\x00\x00IEND\xae\x42\x60\x82')
    
    files = {'files': ('test_valid.png', open('test_valid.png', 'rb'), 'image/png')}
    try:
        response = requests.post(f"{BASE_URL}/media/upload", files=files)
        if response.status_code == 200:
            print("✅ Valid upload success")
            # Delete it
            data = response.json()
            for item in data:
                print(f"   Uploaded ID: {item['id']}")
                requests.delete(f"{BASE_URL}/media/{item['id']}")
        else:
            print(f"❌ Valid upload failed: {response.text}")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    finally:
        if os.path.exists("test_valid.png"):
            os.remove("test_valid.png")

def test_upload_invalid_image():
    print("\nTesting Invalid Image Upload (Text file as JPG)...")
    # Create a text file
    with open("test_fake.jpg", "wb") as f:
        f.write(b"This is a text file not an image")
    
    files = {'files': ('test_fake.jpg', open('test_fake.jpg', 'rb'), 'image/jpeg')}
    try:
        response = requests.post(f"{BASE_URL}/media/upload", files=files)
        if response.status_code == 400:
            print(f"✅ Invalid upload correctly rejected: {response.text}")
        elif response.status_code == 200:
            print("❌ Invalid upload WAS ACCEPTED (Fail)")
            # Cleanup if it succeeded
            data = response.json()
            for item in data:
                requests.delete(f"{BASE_URL}/media/{item['id']}")
        else:
            print(f"❌ Unexpected status: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Connection error: {e}")
    finally:
        if os.path.exists("test_fake.jpg"):
            os.remove("test_fake.jpg")

if __name__ == "__main__":
    test_upload_valid_image()
    test_upload_invalid_image()
