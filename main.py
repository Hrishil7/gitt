
import warnings
warnings.filterwarnings("ignore")
import tensorflow.compat.v1 as tf
import tf_keras as keras

# Enable TF 1.x compat
tf.disable_v2_behavior()

import time
import os
import sys
import numpy
import skimage.color
import PIL.Image
from io import BytesIO

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

# Import Mask R-CNN
from mrcnn.config import Config
from mrcnn import model as modellib, utils

# Configuration
class PredictionConfig(Config):
    NAME = "floorPlan_cfg"
    NUM_CLASSES = 1 + 3 # background + door + wall + window
    GPU_COUNT = 1
    IMAGES_PER_GPU = 1

# Globals
ROOT_DIR = os.path.abspath("./")
MODEL_DIR = os.path.join(ROOT_DIR, "logs")
WEIGHTS_FOLDER = os.path.join(ROOT_DIR, "weights")
WEIGHTS_FILE_NAME = "maskrcnn_15_epochs.h5"

_model = None
_graph = None
_sess = None
cfg = None

app = FastAPI(title="FloorPlanTo3D API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serving Static Files
app.mount("/static", StaticFiles(directory="static"), name="static")

def load_model():
    global _model, _graph, _sess, cfg
    
    print("Loading Mask R-CNN Model...")
    cfg = PredictionConfig()
    
    model_folder_path = os.path.join(ROOT_DIR, "mrcnn")
    weights_path = os.path.join(WEIGHTS_FOLDER, WEIGHTS_FILE_NAME)
    
    _model = modellib.MaskRCNN(mode='inference', model_dir=model_folder_path, config=cfg)
    _model.load_weights(weights_path, by_name=True)
    
    _graph = tf.get_default_graph()
    _sess = tf.compat.v1.keras.backend.get_session()
    print("Model Loaded Successfully!")

# Startup Event
@app.on_event("startup")
def startup_event():
    load_model()


# Helper Functions
def myImageLoader(imageInput):
    # Ensure image is RGB
    if hasattr(imageInput, 'convert'):
        imageInput = imageInput.convert('RGB')
    
    image = numpy.asarray(imageInput)
    
    # Handle case where input was not PIL but numpy and might be RGBA
    if image.ndim == 2:
        image = skimage.color.gray2rgb(image)
    elif image.shape[-1] == 4:
        image = image[..., :3]
        
    h, w = image.shape[:2]
    return image, w, h

def mold_image(images, config):
    return images.astype(numpy.float32) - config.MEAN_PIXEL

def expand_dims(images, axis):
    return numpy.expand_dims(images, axis)

def getClassNames(classIds):
    result = list()
    for id in classIds:
        if id == 1:
            result.append("wall")
        elif id == 2:
            result.append("window")
        elif id == 3:
            result.append("door")
    return result

def normalizePoints(points, classIds):
    h, w = 1024, 1024 # Dummy default, updated later
    averageDoor = 0
    doorCount = 0
    
    # Calculate average door size
    for i in range(len(points)):
        if classIds[i] == 3: # Door
            doorCount += 1
            y1, x1, y2, x2 = points[i]
            dist = numpy.linalg.norm(numpy.array([x1, y1]) - numpy.array([x2, y2]))
            averageDoor += dist
            
    if doorCount > 0:
        averageDoor = averageDoor / doorCount
    else:
        averageDoor = 1.0 # Default to avoid div by zero

    # Convert rois (y1, x1, y2, x2) to list of dictionaries
    # NOTE: The Unity client expects x1, y1, x2, y2.
    # Mask R-CNN returns y1, x1, y2, x2
    output = []
    for i in range(len(points)):
        y1, x1, y2, x2 = points[i]
        output.append({
            "x1": int(x1),
            "y1": int(y1),
            "x2": int(x2),
            "y2": int(y2)
        })
        
    return output, averageDoor

def turnSubArraysToJson(subArrays):
    return subArrays

@app.get("/")
def read_root():
    return FileResponse('static/index.html')

@app.post("/predict")
def predict(image: UploadFile = File(...)):
    global _model, _graph, _sess, cfg
    
    try:
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Invalid file type")
            
        contents = image.file.read()
        pil_image = PIL.Image.open(BytesIO(contents))
        
        # Preprocess
        img_array, w, h = myImageLoader(pil_image)
        scaled_image = mold_image(img_array, cfg)
        sample = expand_dims(scaled_image, 0)
        
        # Run Inference
        # IMPORTANT: Use the graph context AND session
        if _graph is None or _sess is None:
             raise HTTPException(status_code=500, detail="Model not initialized")
             
        with _graph.as_default():
            with _sess.as_default():
                results = _model.detect(sample, verbose=0)
                r = results[0]
            
        # Post-process results
        bbx = r['rois'].tolist()
        class_ids = r['class_ids']
        
        points_data, averageDoor = normalizePoints(bbx, class_ids)
        classes_data = getClassNames(class_ids)
        
        response_data = {
            "points": points_data,
            "classes": classes_data,
            "Width": int(w),
            "Height": int(h),
            "averageDoor": float(averageDoor)
        }
        
        return JSONResponse(content=response_data)

    except Exception as e:
        print(f"Error during prediction: {e}")
        # Print full traceback for debugging
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print('=========== Starting FastAPI Server on Port 5001 ==========')
    # Run uvicorn programmatically
    uvicorn.run(app, host="0.0.0.0", port=5002)
