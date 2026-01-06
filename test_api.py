
import requests
import os
import sys

BASE_URL = "http://127.0.0.1:5001"
IMAGE_PATH = "/Users/hrishilshah/.gemini/antigravity/brain/63c90519-c615-4409-bc3b-1c6a64c26718/uploaded_image_1767154964461.jpg"

def test_get_root():
    print(f"Testing GET {BASE_URL}/ ...")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print("[\033[92mPASS\033[0m] GET / returned 200 OK")
        else:
            print(f"[\033[91mFAIL\033[0m] GET / returned {response.status_code}")
            return False
    except Exception as e:
        print(f"[\033[91mFAIL\033[0m] Error: {e}")
        return False
    return True

def test_post_predict():
    print(f"Testing POST {BASE_URL}/predict with image...")
    if not os.path.exists(IMAGE_PATH):
        print(f"[\033[91mFAIL\033[0m] Image not found at {IMAGE_PATH}")
        return False
        
    try:
        with open(IMAGE_PATH, 'rb') as f:
            files = {'image': ('test_image.jpg', f, 'image/jpeg')}
            response = requests.post(f"{BASE_URL}/predict", files=files)
            
        if response.status_code == 200:
            data = response.json()
            required_keys = ['points', 'classes', 'Width', 'Height', 'averageDoor']
            if all(k in data for k in required_keys):
                 print("[\033[92mPASS\033[0m] POST /predict returned 200 OK with valid JSON structure")
                 print(f"       Detected {len(data['points'])} features.")
            else:
                 print(f"[\033[91mFAIL\033[0m] POST /predict returned 200 but missing keys. Got: {data.keys()}")
                 return False
        else:
            print(f"[\033[91mFAIL\033[0m] POST /predict returned {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"[\033[91mFAIL\033[0m] Error: {e}")
        return False
    return True

if __name__ == "__main__":
    success = True
    success &= test_get_root()
    print("-" * 30)
    success &= test_post_predict()
    
    if success:
        print("\n\033[92mALL TESTS PASSED\033[0m")
        sys.exit(0)
    else:
        print("\n\033[91mSOME TESTS FAILED\033[0m")
        sys.exit(1)
