/*
 * scafGraphicUtils.js: a set of basic utility functions to easily handle drawings on HTML5 Canevas
 */

/*
 * Returns an element's absolute position relative to the screen
 */
function getPosition(elem) {
    var pos={'r':0,'l':0,'t':0,'b':0};
    var tmp=elem;
 
    do {
        pos.l += tmp.offsetLeft;
        tmp = tmp.offsetParent;
    } while( tmp !== null );
    pos.r = pos.l + elem.offsetWidth;
 
    tmp=elem;
    do {
        pos.t += tmp.offsetTop;
        tmp = tmp.offsetParent;
    } while( tmp !== null );
    pos.b = pos.t + elem.offsetHeight;
 
    return pos;
}
/*
 * Returns the cursor position relative to the Browser window
 */
function getCursorPosition(e) {
    var x;
    var y;
    if (e.pageX != undefined && e.pageY != undefined) {
        x = e.pageX;
        y = e.pageY;
    } else {
        x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
        y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }
    return [x, y];
}


/*
 * Object definition: a Graphical Point
 */
function Point(x,y){
	this.x = x;
	this.y = y;
}
Point.prototype.shift = function(deltax,deltay){
	this.x += deltax;
	this.y += deltay;
	return this;
}
Point.prototype.move = function(x,y){
	this.x = x;
	this.y = y;
	return this;
}
Point.prototype.distance = function(p){
	return Math.sqrt(Math.pow(p.x-this.x,2)+Math.pow(p.y-this.y,2));
}
Point.prototype.clone = function(){
	var duplicate = new Point(this.x,this.y);
	return duplicate;
}

/*
 * Object definition: a MouseEvent event structure
 */
function MouseEvent(location,type,source){
	this.location = location;
	this.type = type;
	this.target = null;
	this.redrawNeeded = false;
	this.source = source;
}
MouseEvent.prototype.MOUSE_DOWN = 0;
MouseEvent.prototype.MOUSE_UP = 1;
MouseEvent.prototype.MOUSE_ENTER = 2;
MouseEvent.prototype.MOUSE_LEAVE = 3;
MouseEvent.prototype.MOUSE_MOVE = 4;

MouseEvent.prototype.toString = function(){
	return 'MouseEvent type='+this.type+' ['+this.location.x+','+this.location.y+']';
}

/*
 * Object definition: a KeyboardEvent event structure
 */
function KeyboardEvent(keyCode,type){
	this.target = null;
	this.type = type;
	this.keyCode = keyCode;
	this.redrawNeeded = false;
}
KeyboardEvent.prototype.KEY_DOWN = 5;
KeyboardEvent.prototype.KEY_UP = 6;

KeyboardEvent.prototype.toString = function(){
	var kcToChar = "";
	return 'KeyboardEvent type='+this.type+' ['+this.keyCode+',"'+kcToChar+'"]';
}

function ImageLoader(){
	this.imgSrc = [];
	this.imgs = [];
	this.loadedCount = 0;
	this.keyCount = 0;
	this.ready = false;
} 
ImageLoader.prototype.addImage = function(key,src){
	this.imgSrc[key] = src;
	this.imgs[key] = new Image();
	this.keyCount++;
}
ImageLoader.prototype.load = function(){
	var loader = this;
	for(var i in this.imgs){
		var key = i;
		this.imgs[i].onload = function(){
			loader.loadedCount++;
			if(loader.loadedCount==loader.keyCount){
				loader.ready = true;
				loader.onReadyState();
			}
		}
		this.imgs[i].src = this.imgSrc[key];
	}
}
ImageLoader.prototype.getImage = function(key){
	return this.imgs[key];
}
ImageLoader.prototype.onReadyState = function(){
}
function ReactivArea(id,parentDivId,width,height){
	var uic = {};
  	uic.id = id;
	uic.parentDivId = parentDivId;
	uic.width = width;
	uic.height = height;
	uic.background = '#d3d3d3';
	uic.enabled = true;

	uic.init = function(){
		var div = document.getElementById(this.parentDivId);
		if(div){
			this.canvas = document.createElement('canvas');
			this.canvas.id = this.id+'_canvas';
			this.canvas.setAttribute('style','cursor: pointer;');
			this.canvas.setAttribute('tabindex','1');
			this.canvas.innerHTML = 'This browser does not support HTML 5';
			div.appendChild(this.canvas);
			this.location = getPosition(this.canvas);
			
			this.canvas.handler = this;
			this.canvas.width = this.width;
			this.canvas.height = this.height;
			
			if ('ontouchstart' in document.documentElement) {
				this.canvas.addEventListener('touchmove', this.mouseMove, false);
				this.canvas.addEventListener('touchstart', this.mouseDown, false);
				this.canvas.addEventListener('touchend', this.mouseUp, false);
			}else{
				this.canvas.addEventListener('mousemove', this.mouseMove, false);
				this.canvas.addEventListener('mousedown', this.mouseDown, false);
				this.canvas.addEventListener('mouseup', this.mouseUp, false);
			}
			
		    this.canvas.addEventListener('keydown', this.keyDown, false);
		    this.canvas.addEventListener('keyup', this.keyUp, false);
		    
		    this.repaint();
		}
	}
	uic.resize = function(width,height){
		this.width = width;
		this.height = height;
		this.canvas.width = this.width;
		this.canvas.height = this.height;
		this.onResized();
		this.repaint();
	}
	uic.onResized = function(){
	}
	uic.getPointerPos = function(e){
		var coord = getCursorPosition(e);
		var pos = new Point(coord[0]-this.location.l,coord[1]-this.location.t);
		return pos;
	}
	uic.makeGraphicEvent = function(e,type){
		var event = e || window.event;
		if(event.targetTouches){
			event = event.targetTouches[0];
		}
		var p = this.getPointerPos(event);
		return new MouseEvent(p,type,this);
	}
	uic.onMouseMove = function(mouseEvent){
	}
	uic.mouseMove = function(e){
		var mouseEvent = this.handler.makeGraphicEvent(e,MouseEvent.prototype.MOUSE_MOVE);
		if(this.handler.enabled){
			this.handler.onMouseMove(mouseEvent);
		}
	}
	uic.onMouseDown = function(mouseEvent){
	}
	uic.mouseDown = function(e){
		var mouseEvent = this.handler.makeGraphicEvent(e,MouseEvent.prototype.MOUSE_DOWN);
		if(this.handler.enabled){
			this.handler.onMouseDown(mouseEvent);
		}
	}
	uic.onMouseUp = function(mouseEvent){
	}
	uic.mouseUp = function(e){
		var mouseEvent = this.handler.makeGraphicEvent(e,MouseEvent.prototype.MOUSE_UP);
		if(this.handler.enabled){
			this.handler.onMouseUp(mouseEvent);
		}
	}
	uic.onKeyDown = function(keyEvent){
	}
	uic.keyDown = function(e){
		var event = e || window.event;
		var keyEvent = new KeyboardEvent(event.keyCode,KeyboardEvent.prototype.KEY_DOWN);
		if (event.keyCode==8 || event.keyCode==9 || event.keyCode==38 || event.keyCode==40) {
			e.preventDefault();
	        e.stopPropagation();
	    	return false;
	    }else{
	    	if(this.handler.enabled){
	    		this.handler.onKeyDown(keyEvent);
	    	}
	    }	
	}
	uic.onKeyUp = function(keyEvent){
	}
	uic.keyUp = function(e){
		var event = e || window.event;
		var keyEvent = new KeyboardEvent(event.keyCode,KeyboardEvent.prototype.KEY_UP);
		if(this.handler.enabled){
			this.handler.onKeyUp(keyEvent);
		}
	}
	uic.paint = function(gc){
	}
	uic.setEnabled = function(state){
		this.enabled = state;
		this.repaint();
	}
	uic.repaint = function(){
		if(this.canvas && this.canvas.getContext){
			var ctx = this.canvas.getContext('2d');
		    var width = this.canvas.width;
			var height = this.canvas.height;
				  
		    ctx.clearRect(0,0,width,height);
		    ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.shadowBlur = 0;
		    ctx.fillStyle = this.background;
		    ctx.fillRect(0, 0, width, height); 
		    
		    this.paint(ctx);
		}
	}
    uic.setWidth = function(width){
      this.width = width;
      this.canvas.width = width;
      this.repaint();
    }
    uic.setHeight = function(height){
      this.height = height;
      this.canvas.height = height;
      this.repaint();
    }
	return uic;
}