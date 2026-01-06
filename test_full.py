
import requests
import json
import os
import sys

BASE_URL = "http://127.0.0.1:5002"
IMAGE_PATH = "/Users/hrishilshah/.gemini/antigravity/brain/63c90519-c615-4409-bc3b-1c6a64c26718/uploaded_image_1767185895155.jpg"

def test_get_root():
    print(f"\n{'='*60}")
    print(f"TEST 1: GET {BASE_URL}/")
    print(f"{'='*60}")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("[\033[92mPASS\033[0m] GET / returned 200 OK")
            print(f"Content-Type: {response.headers.get('content-type')}")
        else:
            print(f"[\033[91mFAIL\033[0m] GET / returned {response.status_code}")
            return False
    except Exception as e:
        print(f"[\033[91mFAIL\033[0m] Error: {e}")
        return False
    return True

def test_static_assets():
    print(f"\n{'='*60}")
    print(f"TEST 2: Static Assets")
    print(f"{'='*60}")
    assets = ['/static/style.css', '/static/script.js']
    all_pass = True
    for asset in assets:
        try:
            response = requests.head(f"{BASE_URL}{asset}")
            if response.status_code == 200:
                print(f"[\033[92mPASS\033[0m] {asset} -> 200 OK")
            else:
                print(f"[\033[91mFAIL\033[0m] {asset} -> {response.status_code}")
                all_pass = False
        except Exception as e:
            print(f"[\033[91mFAIL\033[0m] {asset} -> Error: {e}")
            all_pass = False
    return all_pass

def test_post_predict():
    print(f"\n{'='*60}")
    print(f"TEST 3: POST {BASE_URL}/predict")
    print(f"{'='*60}")
    print(f"Image: {os.path.basename(IMAGE_PATH)}")
    
    if not os.path.exists(IMAGE_PATH):
        print(f"[\033[91mFAIL\033[0m] Image not found at {IMAGE_PATH}")
        return False, None
        
    try:
        with open(IMAGE_PATH, 'rb') as f:
            files = {'image': ('test_image.jpg', f, 'image/jpeg')}
            response = requests.post(f"{BASE_URL}/predict", files=files)
            
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            required_keys = ['points', 'classes', 'Width', 'Height', 'averageDoor']
            if all(k in data for k in required_keys):
                print("[\033[92mPASS\033[0m] POST /predict returned 200 OK with valid JSON structure")
                return True, data
            else:
                print(f"[\033[91mFAIL\033[0m] POST /predict returned 200 but missing keys. Got: {data.keys()}")
                return False, None
        else:
            print(f"[\033[91mFAIL\033[0m] POST /predict returned {response.status_code}")
            print(f"Response: {response.text}")
            return False, None
    except Exception as e:
        print(f"[\033[91mFAIL\033[0m] Error: {e}")
        return False, None

def display_full_results(data):
    print(f"\n{'='*60}")
    print("FULL ANALYSIS RESULTS")
    print(f"{'='*60}")
    
    print(f"\n\033[1mImage Dimensions:\033[0m {data['Width']} x {data['Height']} pixels")
    print(f"\033[1mAverage Door Size:\033[0m {data['averageDoor']:.2f} units")
    print(f"\033[1mTotal Features Detected:\033[0m {len(data['points'])}")
    
    # Count by class
    class_counts = {}
    for c in data['classes']:
        class_counts[c] = class_counts.get(c, 0) + 1
    
    print(f"\n\033[1mFeature Breakdown:\033[0m")
    for cls, count in class_counts.items():
        color = {'wall': '\033[91m', 'door': '\033[92m', 'window': '\033[94m'}.get(cls, '\033[0m')
        print(f"  {color}● {cls.capitalize()}: {count}\033[0m")
    
    print(f"\n\033[1mDetailed Feature List:\033[0m")
    print("-" * 60)
    for i, (point, cls) in enumerate(zip(data['points'], data['classes'])):
        color = {'wall': '\033[91m', 'door': '\033[92m', 'window': '\033[94m'}.get(cls, '\033[0m')
        width = point['x2'] - point['x1']
        height = point['y2'] - point['y1']
        print(f"  {i+1:2}. {color}{cls.upper():8}\033[0m  Position: ({point['x1']:4},{point['y1']:4}) to ({point['x2']:4},{point['y2']:4})  Size: {width}x{height}")
    
    print("-" * 60)
    
    # Also save full JSON to file
    output_path = "/Users/hrishilshah/Desktop/gitt/FloorPlanTo3D-API/analysis_result.json"
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"\n\033[93mFull JSON saved to: {output_path}\033[0m")

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  FLOORPLANTO3D API - FULL TEST SUITE")
    print("  Server: " + BASE_URL)
    print("="*60)
    
    success = True
    success &= test_get_root()
    success &= test_static_assets()
    predict_success, data = test_post_predict()
    success &= predict_success
    
    if data:
        display_full_results(data)
    
    print("\n" + "="*60)
    if success:
        print("\033[92m  ✓ ALL TESTS PASSED\033[0m")
    else:
        print("\033[91m  ✗ SOME TESTS FAILED\033[0m")
    print("="*60 + "\n")
    
    sys.exit(0 if success else 1)
