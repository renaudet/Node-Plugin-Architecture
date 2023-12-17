IE  = window.ActiveXObject ? true : false;
MOZ = window.sidebar       ? true : false;

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

function initEditor(id){
	try{
		if(IE){  
			var edoc = window.frames[id].document;
		}
	    if(MOZ) {
	    	var edoc = document.getElementById(id).contentDocument;
	    }
	
	    if(!edoc){
	    	var edoc = document.getElementById(id).contentWindow.document;
	    }
	    if(edoc.designMode != 'on') edoc.designMode = 'on';
	    edoc.execCommand("enableObjectResizing", false, "true");
	    if(!edoc.body){
	    	setTimeout(function(){initEditor(id)},50);
	    }else{
	    	var iframe = document.getElementById(id);
		    if(iframe.editor){
		    	iframe.editor.onEditorInitialized();
		    }
		    iframe.focus();
	    }
	}catch(e){
		alert("L'éditeur n'a pas pu s'initialiser correctement ("+e+").\nVotre navigateur n'est peut-être pas compatible.");
	}
}
function editorById(id){
	var div = document.getElementById(id);
	return div.editor;
}
function RichTextEditor(id,width,height){
	var rte = new Object();
	rte.text = null;
	rte.id = id;
	rte.width = width;
	rte.height = height;
	rte.iframeWidth = 0;
	rte.iframeHeight = 0;
	rte.controlObject = null;
	rte.controls = null;
	rte.fieldId = id+'_field';
	rte.iframeSrc = '/js/richText/rte/rteBlank.html';
	rte.offsetX = 5;
	rte.inputChangedListeners = [];
	if(IE){
		rte.offsetY = 60;
	}else{
		rte.offsetY = 57;
	}
	rte.backgroundColor = '#eeeeee';
	
	rte.layout = function(){
		this.iframeWidth = this.width - this.offsetX;
		if(this.controlObject){
			this.iframeHeight = this.height - this.offsetY - 4;
		}else{
			this.iframeHeight = this.height - 8;
		}
		this.iframeHeight += 25;
	}
	rte.setIframeSrc = function(src){
		this.iframeSrc = src;
	}
	rte.init = function(parentDiv){
		if(parentDiv){
			var root = document.createElement('div');
			root.id = this.id+'_root';
			parentDiv.appendChild(root);
		}else{
			document.writeln('<div id="'+this.id+'_root"></div>');
			var root = document.getElementById(this.id+'_root');
		}
		root.editor = this;
		root.setAttribute('style','height: '+this.height+'px;width: '+this.width+'px;background-color: '+this.backgroundColor+';padding: 2px 0px 0px 2px;');
		
		this.afterControlInitialization();
	}
	rte.afterControlInitialization = function(){
		var root = document.getElementById(this.id+'_root');
		if(this.controlObject){
			this.controls = eval(this.controlObject+'(\''+this.id+'ctrls'+'\')');
			this.controls.initialize(this,root);
		}
		this.layout();
		var frameDiv = document.createElement('div');
		frameDiv.id = this.id+'_frame';
		//frameDiv.setAttribute('style','padding-top: 3px;');
		root.appendChild(frameDiv);
		
		var def = '';
		def += '<iframe id="'+this.id+'" name="'+this.id+'" tabindex="1" style="border-radius: 0.375rem;width: '+this.iframeWidth+'px;height: '+this.iframeHeight+'px;margin: 0; padding: 0;" src="'+this.iframeSrc+'" onload="initEditor(\''+this.id+'\');" scrolling="yes">';
		def += 'Ce navigateur ne supporte pas les IFrames. L\'éditeur RichText ne peut s\'initialiser !';
		def += '</iframe>';
		def += '<input type="hidden" name="'+this.fieldId+'" id="'+this.fieldId+'" value="">';
		
		frameDiv.innerHTML = def;
		document.getElementById(this.id).editor = this;
		
		this.onReadyState();
	}
	rte.onReadyState = function(){
	}
	rte.resize = function(width,height){
		this.width = width;
		this.height = height;
		this.layout();
		var root = document.getElementById(this.id+'_root');
		if(root){
			root.style.width = width+'px';
			root.style.height = height+'px';
			var iframe = document.getElementById(this.id);
			iframe.style.width = this.iframeWidth+'px';
			iframe.style.height = this.iframeHeight+'px';
		}
	}
	rte.edoc = function(){
		var edoc = null;
		if(IE){
			edoc = window.frames[this.id].document;
		}else{
			edoc = document.getElementById(this.id).contentDocument;
		}
		if(!edoc){
			edoc = document.getElementById(this.id).contentWindow.document;
		}
		return edoc;
	}
	rte.getText = function(){
		var doc = this.edoc();
		return doc.body.innerHTML;
	}
	
	rte.switchToField = function (){
		document.getElementById(this.fieldId).value = this.getText();
	}
	rte.setText = function(text){
		this.text = text;
		setTimeout(function(){ rte.refresh();},500);
	}
	rte.refresh = function(){
		var doc = this.edoc();
	    doc.body.innerHTML = this.text;
	    document.getElementById(this.id).focus();
	}
	rte.onEditorInitialized = function(){
		var doc = this.edoc();
		if(doc.addEventListener) {// if support addEventListener
	        doc.addEventListener("keyup", function(e){ rte.fireInputChangedEvent(e);}, true)
	    }
	}
	rte.registerInputChangedListener = function(listener){
		this.inputChangedListeners.push(listener);
	}
	rte.fireInputChangedEvent = function(e){
		for(var i=0;i<this.inputChangedListeners.length;i++){
			var listener = this.inputChangedListeners[i];
			try{
				listener.onInputChanged(e);
			}catch(e){}
		}
	}
	rte.clearText = function(){
		this.setText('');
	}
	rte.getId = function(){
		return this.id;
	}
	rte.disable = function(){
		var doc = this.edoc();
		if('contentEditable' in doc.body) {
			doc.body.contentEditable = false;
		}
		if('designMode' in doc) {
			doc.designMode = 'off';         
		}
	}
	rte.enable = function(){
		var doc = this.edoc();
		if('contentEditable' in doc.body) {
			doc.body.contentEditable = true;
		}
		if('designMode' in doc) {
			doc.designMode = 'on';         
		}
	}
	
	return rte;
}