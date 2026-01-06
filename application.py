import os
import PIL
import numpy


from numpy import average


from numpy import zeros
from numpy import asarray

import tensorflow.compat.v1 as tf
tf.disable_v2_behavior()

# Postpone mrcnn imports until tf behavior is set? 
# Actually disable_v2_behavior must be called before any tensor ops.
# It is safe to call it here.

from mrcnn.config import Config

from mrcnn.model import MaskRCNN

from skimage.draw import polygon2mask
from skimage.io import imread

from datetime import datetime



from io import BytesIO
from mrcnn.utils import extract_bboxes
from numpy import expand_dims
from matplotlib import pyplot
from matplotlib.patches import Rectangle
from tf_keras.backend import clear_session
import json
from flask import Flask, flash, request,jsonify, redirect, url_for
from werkzeug.utils import secure_filename

from skimage.io import imread
from mrcnn.model import mold_image

import sys

from PIL import Image




global _model
global _graph
global cfg
ROOT_DIR = os.path.abspath("./")
WEIGHTS_FOLDER = "./weights"

from flask_cors import CORS, cross_origin

sys.path.append(ROOT_DIR)

MODEL_NAME = "mask_rcnn_hq"
WEIGHTS_FILE_NAME = 'maskrcnn_15_epochs.h5'

application=Flask(__name__)
cors = CORS(application, resources={r"/*": {"origins": "*"}})



class PredictionConfig(Config):
	# define the name of the configuration
	NAME = "floorPlan_cfg"
	# number of classes (background + door + wall + window)
	NUM_CLASSES = 1 + 3
	# simplify GPU config
	GPU_COUNT = 1
	IMAGES_PER_GPU = 1
	


# Workaround for Flask 2.3+ removal of before_first_request
first_request_processed = False

def load_model():
    global cfg
    global _model
    model_folder_path = os.path.abspath("./") + "/mrcnn"
    weights_path= os.path.join(WEIGHTS_FOLDER, WEIGHTS_FILE_NAME)
    cfg=PredictionConfig()
    print(cfg.IMAGE_RESIZE_MODE)
    print('==============before loading model=========')
    _model = MaskRCNN(mode='inference', model_dir=model_folder_path,config=cfg)
    print('=================after loading model==============')
    _model.load_weights(weights_path, by_name=True)
    global _graph
    _graph = tf.get_default_graph()

@application.before_request
def before_request():
    global first_request_processed
    if not first_request_processed:
        first_request_processed = True
        load_model()



def myImageLoader(imageInput):
    # Ensure image is RGB
    if hasattr(imageInput, 'convert'):
        imageInput = imageInput.convert('RGB')
    
    image = numpy.asarray(imageInput)
    
    # Handle case where input was not PIL but numpy and might be RGBA
    if image.ndim == 2:
        import skimage.color
        image = skimage.color.gray2rgb(image)
    elif image.shape[-1] == 4:
        image = image[..., :3]
        
    h, w = image.shape[:2]
    return image, w, h

def getClassNames(classIds):
	result=list()
	for classid in classIds:
		data={}
		if classid==1:
			data['name']='wall'
		if classid==2:
			data['name']='window'
		if classid==3:
			data['name']='door'
		result.append(data)	

	return result				
def normalizePoints(bbx,classNames):
	normalizingX=1
	normalizingY=1
	result=list()
	doorCount=0
	index=-1
	doorDifference=0
	for bb in bbx:
		index=index+1
		if(classNames[index]==3):
			doorCount=doorCount+1
			if(abs(bb[3]-bb[1])>abs(bb[2]-bb[0])):
				doorDifference=doorDifference+abs(bb[3]-bb[1])
			else:
				doorDifference=doorDifference+abs(bb[2]-bb[0])


		result.append([bb[0]*normalizingY,bb[1]*normalizingX,bb[2]*normalizingY,bb[3]*normalizingX])
	return result,(doorDifference/doorCount)	
		

def turnSubArraysToJson(objectsArr):
	result=list()
	for obj in objectsArr:
		data={}
		data['x1']=obj[1]
		data['y1']=obj[0]
		data['x2']=obj[3]
		data['y2']=obj[2]
		result.append(data)
	return result



@application.route('/',methods=['POST', 'GET'])
def prediction():
	if request.method == 'GET':
		from flask import send_from_directory
		return send_from_directory('static', 'index.html')

	global cfg
	if 'image' not in request.files:
		return jsonify({"error": "No image part in the request"}), 400
		
	imagefile = PIL.Image.open(request.files['image'].stream)
	image,w,h=myImageLoader(imagefile)
	print(h,w)
	scaled_image = mold_image(image, cfg)
	sample = expand_dims(scaled_image, 0)

	global _model
	global _graph
	with _graph.as_default():
		r = _model.detect(sample, verbose=0)[0]
	
	#output_data = model_api(imagefile)
	
	data={}
	bbx=r['rois'].tolist()
	temp,averageDoor=normalizePoints(bbx,r['class_ids'])
	temp=turnSubArraysToJson(temp)
	data['points']=temp
	data['classes']=getClassNames(r['class_ids'])
	data['Width']=w
	data['Height']=h
	data['averageDoor']=averageDoor
	return jsonify(data)
		
    
if __name__ =='__main__':
	application.debug=False
	print('===========before running==========')
	application.run(port=5001, threaded=False)
	print('===========after running==========')
