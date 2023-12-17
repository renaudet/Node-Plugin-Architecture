function forumUploadImg(id){
	window.activeEditorId = id;
	var popupWindow = window.open("/js/richText//js/richText/rte/uploadPopup.html","uploadPopup","directories=no,location=no,menubar=no,resizable=no,scrollbars=no,status=no,toolbar=no,width=450,height=200");
}
var newDivId = 0;
function getSelectionAsHtml(win) {
    var html = "";
    if (typeof win.getSelection != "undefined") {
        var sel = win.getSelection();
        if (sel.rangeCount) {
            var container = document.createElement("div");
            for (var i = 0, len = sel.rangeCount; i < len; ++i) {
                container.appendChild(sel.getRangeAt(i).cloneContents());
            }
            html = container.innerHTML;
        }
    } 
    return html;
}
function forumSetContent(id,action, data){
    if(IE) {
        var ewin = window.frames[id];
        var edoc = ewin.document;
    } else {
        var ewin = document.getElementById(id).contentWindow;
        var edoc = document.getElementById(id).contentDocument;
    }
    if(!edoc){
    	var ewin = document.getElementById(id).contentWindow;
    	var edoc = document.getElementById(id).contentWindow.document;
    }
    switch (action){ 
    	case 'displayFontColors':
    		var pos = $('#'+id+'_FontColorsBtn').offset();
    		console.log(pos);
	    	var div = document.getElementById(id+'_fontColors');
	    	div.style.display='inline';
	    	div.style.top = (pos.top-50)+'px';
	    	div.style.left = (pos.left+20)+'px';
    	break;
    	case 'foreColor2' :
    		var div = document.getElementById(id+'_fontColors');
	    	div.style.display="none";
            edoc.execCommand('foreColor', false, data);
            ewin.focus();
        break;
		case 'displayBackColors':
			var pos = $('#'+id+'_BackColorsBtn').offset();
    		console.log(pos);
	    	var div = document.getElementById(id+'_backColors');
	    	div.style.display='inline';
	    	div.style.top = (pos.top-50)+'px';
	    	div.style.left = (pos.left+20)+'px';
		break;
		case 'backColor2' :
			var div = document.getElementById(id+'_backColors');
	    	div.style.display="none";
	    	if(IE){
            	edoc.execCommand('backColor', false, data);
            }else{
            	edoc.execCommand('hiliteColor', false, data);
            }
	        ewin.focus();
	    break;
	    case 'displaySmileys' :
	    	var btn = document.getElementById(id+'_SmileyBtn');
	    	var pos = $('#'+id+'_SmileyBtn').position();
	    	var div = document.getElementById(id+'_smiley');
	    	div.style.display="block";
	    	div.style.top = (pos.top+20)+'px';
	    	div.style.left = (pos.left+20)+'px';
	    break;
	    case 'insertSmiley' :
	    	var div = document.getElementById(id+'_smiley');
	    	div.style.display="none";
	    	if (document.all) {
	    		var span = document.createElement('span');
	    		span.innerHTML = '<img border="0" src="'+data+'">';
	    		edoc.body.appendChild(span);
	    	} else {
		    	edoc.execCommand('insertHTML', false, '<img border="0" src="'+data+'">');
	    	}
	        ewin.focus();
	    break;
	    case 'insertImage' :
	    	//forumUploadImg(id);
	    	showWarning('Not yet implemented!');
	    break;
        case 'insertImgLink' :
            var imageUrl = prompt('Entrer l\'URL de l\'image : ', 'http://');

            if (imageUrl != null && imageUrl != '') {
                edoc.execCommand('insertHTML', false, '<img border="0" class="richTextImage" src="'+imageUrl+'"/>');
                ewin.focus();
            }
        break;

        case 'insertLink' :
            var url = prompt('Entrer l\'URL : ', '');

            if (url != null && url.length>7 && (url.startsWith('http://') || url.startsWith('https://'))) {
                edoc.execCommand('createLink', false, url);
                ewin.focus();
            }
        break;

        case 'foreColor' :
            if (data == 'other') {  // Si on choisi une couleur personnalisée
                var foreColor = prompt('Entrer la couleur Hexadecimal du texte : ', '#');

                if (foreColor != null && foreColor != '' && foreColor != '#') {
                    edoc.execCommand(action, false, foreColor);
                }
            }else{
            	edoc.execCommand(action, false, data);
            }
            ewin.focus();
        break;

        case 'hiliteColor' :
            if (data == 'other') {  // Si on choisi une couleur personnalisée
                var foreColor = prompt('Entrer la couleur Hexadecimal du fond : ', '#');

                if (foreColor != null && foreColor != '' && foreColor != '#') {
                	if(IE){
                    	edoc.execCommand('backColor', false, foreColor);
                    }else{
                    	edoc.execCommand(action, false, foreColor);
                    }
                }
            }else{
	            if(IE){
	            	edoc.execCommand('backColor', false, data);
	            }else{
	            	edoc.execCommand(action, false, data);
	            }
            }
            ewin.focus();
        break;

        case 'insertPanel' :
        	if(IE && edoc.selection.createRange().text.length>0){
        		edoc.selection.createRange().pasteHTML('<div class="textPanel">'+edoc.selection.createRange().text+'</div>');
        	}else{
        		var selection = ewin.getSelection();
        		var str = selection.toString();
        		var html = getSelectionAsHtml(ewin);
        		if(str.length>0){
        			edoc.execCommand('insertHTML', false, '<div class="textPanel">'+html+'</div>');
        		}else{
        			if (document.all) {
        	    		var div = document.createElement('div');
        	    		div.setAttribute('class','sourcePanel');
        	    		div.innerHTML = 'Tapez ici le code source';
        	    		edoc.body.appendChild(div);
        	    	} else {
        	    		edoc.execCommand('insertHTML', false, '<div class="textPanel">Tapez ici le code source</div>');
        	    	}
        		}
        	}
            ewin.focus();
        break;

        case 'insertQuote' :
        	if(IE && edoc.selection.createRange().text.length>0){
        		edoc.selection.createRange().pasteHTML('<div class="quote">'+edoc.selection.createRange().text+'</div>');
        	}else{
        		var selection = ewin.getSelection();
        		var str = selection.toString();
        		var html = getSelectionAsHtml(ewin);
        		if(str.length>0){
        			edoc.execCommand('insertHTML', false, '<div class="quote">'+html+'</div>');
        		}else{
        			if (document.all) {
        	    		var div = document.createElement('div');
        	    		div.setAttribute('class','quote');
        	    		div.innerHTML = 'Collez ici le texte de votre citation';
        	    		edoc.body.appendChild(div);
        	    	} else {
        	    		edoc.execCommand('insertHTML', false, '<div class="quote">Collez ici le texte de votre citation</div>');
        	    	}
        		}
        	}
            ewin.focus();
        break;

        default :
            edoc.execCommand(action, false, data);
            ewin.focus();
    }
}

function ForumEditorControls(id,editor){
	var ec = new Object();
	ec.id = id;
	ec.editor = null;
	ec.smileys = new Array();
	ec.smileys[0] = new Array();
	ec.smileys[0][0] = '/js/richText/rte/img/face-smile-big.png';
	ec.smileys[0][1] = '/js/richText/rte/img/face-smile.png';
	ec.smileys[0][2] = '/js/richText/rte/img/face-plain.png';
	ec.smileys[0][3] = '/js/richText/rte/img/face-surprise.png';
	ec.smileys[1] = new Array();
	ec.smileys[1][0] = '/js/richText/rte/img/face-wink.png';
	ec.smileys[1][1] = '/js/richText/rte/img/face-sad.png';
	ec.smileys[1][2] = '/js/richText/rte/img/face-crying.png';
	ec.smileys[1][3] = '/js/richText/rte/img/face-glasses.png';
	ec.smileys[2] = new Array();
	ec.smileys[2][0] = '/js/richText/rte/img/face-angel.png';
	ec.smileys[2][1] = '/js/richText/rte/img/face-devilish.png';
	ec.smileys[2][2] = '/js/richText/rte/img/face-grin.png';
	ec.smileys[2][3] = '/js/richText/rte/img/face-kiss.png';
	
	ec.colors = new Array();
	ec.colors[0] = new Array();
	ec.colors[0][0] = '#FFFFFF';
	ec.colors[0][1] = '#FFFFCC';
	ec.colors[0][2] = '#FF9966';
	ec.colors[0][3] = '#CCCCFF';
	ec.colors[1] = new Array();
	ec.colors[1][0] = '#CC33CC';
	ec.colors[1][1] = '#FFFF66';
	ec.colors[1][2] = '#FF6666';
	ec.colors[1][3] = '#66FFFF';
	ec.colors[2] = new Array();
	ec.colors[2][0] = '#666666';
	ec.colors[2][1] = '#33FF33';
	ec.colors[2][2] = '#FF0000';
	ec.colors[2][3] = '#3366FF';
	ec.colors[3] = new Array();
	ec.colors[3][0] = '#000000';
	ec.colors[3][1] = '#006600';
	ec.colors[3][2] = '#660000';
	ec.colors[3][3] = '#000099';
	
	ec.initialize = function(editor,parentDiv){
		this.editor = editor;
		var root = document.createElement('div');
		root.id = this.id+'_root';
		parentDiv.appendChild(root);
		
		var def  = '<style>\n';
		def += '.rteGroup{\n';
	    def += '  float: left;\n';
	    def += '  padding: 1px;\n';
	    def += '  border-radius: 3px;\n';
	    //def += '  border: 1px outset #000000;\n';
	    def += '  margin-right: 3px;\n';
	    def += '  margin-bottom: 3px;\n';
	    def += '  background-color: #FFFFFF;\n';
	    //def += '  height: 23px;\n';
	    def += '}';
	    def += '.rteAction{\n';
	    def += '  cursor: pointer;\n';
	    def += '  border: 1px solid #FFFFFF;\n';
	    def += '  margin-bottom: 2px;\n';
	    def += '}';
	    def += '.rteAction:hover{\n';
	    def += '  border: 1px solid #6BBCFF;\n';
	    def += '}';
	    def += '</style>\n';
	    
	    def += '    <div style="float: left;padding-right: 3px;">';
		def += '      <select style="padding: 2px;font-size:0.78pc;height: 30px;width: 100px;background-color: #ffffff;" onchange="forumSetContent(\''+this.editor.id+'\',\'fontName\', this.value);this.selectedIndex=0" name="'+this.id+'_font" id="'+this.id+'_font">';
		def += '        <option value="none">[Police]</option>';
		def += '        <option value="arial">Arial</option>';
		def += '        <option value="courier">Courier</option>';
		def += '        <option value="times">Times</option>';
		def += '      </select>';
		def += '    </div>';
		def += '    <div style="float: left;padding-right: 3px;">';
		def += '      <select style="padding: 2px;font-size:0.78pc;height: 30px;width: 80px;background-color: #ffffff;" onchange="forumSetContent(\''+this.editor.id+'\',\'fontSize\', this.value);this.selectedIndex=0" name="'+this.id+'_size" id="'+this.id+'_size">';
		def += '        <option value="none">[Taille]</option>';
		def += '        <option value="1">6</option>';
		def += '        <option value="2">9</option>';
		def += '        <option value="3">12</option>';
		def += '        <option value="4">16</option>';
		def += '        <option value="5">18</option>';
		def += '        <option value="6">24</option>';
		def += '        <option value="7">36</option>';
		def += '      </select>';
		def += '    </div>';
		def += '    <div style="float: left;padding-right: 3px;">';
		def += '      <select style="padding: 2px;font-size:0.78pc;height: 30px;width: 150px;background-color: #ffffff;" onchange="forumSetContent(\''+this.editor.id+'\',\'formatBlock\', this.value);this.selectedIndex=0" name="'+this.id+'_style" id="'+this.id+'_style">';
		def += '        <option value="none">[Style]</option>';
		def += '        <option value="<p>">Paragraph &lt;p&gt;</option>';
		def += '        <option value="<h1>">Heading 1 &lt;h1&gt;</option>';
		def += '        <option value="<h2>">Heading 2 &lt;h2&gt;</option>';
		def += '        <option value="<h3>">Heading 3 &lt;h3&gt;</option>';
		def += '        <option value="<h4>">Heading 4 &lt;h4&gt;</option>';
		def += '        <option value="<pre>">Formatted &lt;pre&gt;</option>';
		def += '      </select>';
		def += '    </div>';
	    
		def += '  <div class="rteGroup">';
		def += '    <img title="Bold" class="rteAction" style="margin-left: 4px;margin-bottom: 3px;margin-top: 3px;" id="'+this.id+'_bold" src="/img/silk/text_bold.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'bold\');">';
		def += '    <img title="Italic" class="rteAction" id="'+this.id+'_italic" src="/img/silk/text_italic.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'italic\');">';
		def += '    <img title="Underline" class="rteAction" id="'+this.id+'_underlined" src="/img/silk/text_underline.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'underline\');">';
		def += '    <img title="Strike" class="rteAction" style="margin-right: 4px;" id="'+this.id+'_striked" src="/img/silk/text_strikethrough.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'strikeThrough\');">';
		def += '  </div>';
		def += '  <div class="rteGroup">';
		def += '    <img title="Font color" class="rteAction" style="margin-left: 4px;" id="'+this.editor.id+'_FontColorsBtn" src="/js/richText/rte/img/font_color.gif" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'displayFontColors\');">';
		def += '    <img title="Background color" class="rteAction" style="margin-right: 4px;" id="'+this.editor.id+'_BackColorsBtn" src="/js/richText/rte/img/backcolor.gif" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'displayBackColors\');">';
		def += '  </div>';
		def += '  <div class="rteGroup">';
		def += '    <img title="Left align" class="rteAction" style="margin-left: 4px;margin-bottom: 3px;margin-top: 3px;" id="'+this.id+'_alignLeft" src="/img/silk/text_align_left.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'justifyLeft\');">';
		def += '    <img title="Center" class="rteAction" id="'+this.id+'_center" src="/img/silk/text_align_center.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'justifyCenter\');">';
		def += '    <img title="Right align" class="rteAction" id="'+this.id+'_alignRight" src="/img/silk/text_align_right.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'justifyRight\');">';
		def += '    <img title="Justify" class="rteAction" id="'+this.id+'_justify" src="/img/silk/text_align_justify.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'justifyFull\');">';
		def += '    <img title="Indent" class="rteAction" id="'+this.id+'_indent" src="/img/silk/text_indent.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'indent\');">';
		def += '    <img title="Numbered list" class="rteAction" id="'+this.id+'_convertToList" src="/img/silk/text_list_numbers.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'insertOrderedList\');">';
		def += '    <img title="Bullet list" class="rteAction" style="margin-right: 4px;" id="'+this.id+'_convertToUnorderedList" src="/img/silk/text_list_bullets.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'insertUnorderedList\');">';
		def += '  </div>';
		def += '  <div class="rteGroup">';
		def += '    <img title="Insert horizontal line" class="rteAction" style="margin-left: 4px;margin-bottom: 3px;margin-top: 3px;" id="'+this.id+'_insertRule" src="/img/silk/text_horizontalrule.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'insertHorizontalRule\');">';
		def += '    <img title="Insert hyperlink" class="rteAction" id="'+this.id+'_insertLink" src="/img/silk/link.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'insertLink\');">';
		def += '    <img title="Insert image from URL" class="rteAction" id="'+this.id+'_insertImgLink" src="/img/silk/image_link.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'insertImgLink\');">';
		def += '    <img title="Insert quote" class="rteAction" id="'+this.id+'_insertQuote" src="/img/silk/comment.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'insertQuote\');">';
		def += '    <img title="Insert panel" class="rteAction" style="margin-right: 4px;" id="'+this.id+'_insertPanel" src="/img/silk/textfield.png" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'insertPanel\');">';
		def += '  </div>';
		def += '  <div style="clear: both;"></div>';
	    def += '  <div style="padding-bottom: 0px;">';
		def += '    <div style="clear: both;"></div>';
		def += '  </div>';
		
		root.innerHTML = def;
		this.createSmileyDiv();
		this.createFontColorsDiv();
		this.createBackColorsDiv();
	}
	
	ec.createSmileyDiv = function(){
		var root = document.getElementById(this.id+'_root');
		var smileyDiv = document.createElement('div');
		smileyDiv.id = this.editor.id+'_smiley';
		smileyDiv.setAttribute('style','position: absolute;top: 0px;left: 0px;display: none;width: 94px;height: 75px;background-color: #FFFFFF;border: 1px solid #A0A0A0;');
		
		var def = "";
		for(var l=0;l<this.smileys.length;l++){
			def+='<div style="padding: 3px;">'
			for(var c=0;c<4;c++){
				def+='<span style="padding: 3px;cursor: pointer;"><img src="'+this.smileys[l][c]+'" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'insertSmiley\',\''+this.smileys[l][c]+'\');"/></span>'
			}
			def+="</div>"
		}
		    
		smileyDiv.innerHTML = def;
		root.appendChild(smileyDiv);
	}
	
	ec.createFontColorsDiv = function(){
		var root = document.getElementById(this.id+'_root');
		var colorDiv = document.createElement('div');
		colorDiv.id = this.editor.id+'_fontColors';
		colorDiv.setAttribute('style','position: absolute;top: 0px;left: 0px;z-index: 3;display: none;width: 106px;height: 102px;background-color: #FFFFFF;border: 1px solid #A0A0A0;');
		
		var def = '<table border="0" cellspacing="2" cellpadding="0">';
		for(var l=0;l<this.colors.length;l++){
			def+='<tr>';
			for(var c=0;c<4;c++){
				def+='<td><div style="padding: 3px 8px 3px 8px;cursor: pointer;background-color: '+this.colors[l][c]+';border: 1px solid #000000;" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'foreColor2\',\''+this.colors[l][c]+'\');">&nbsp;&nbsp;</div></td>'
			}
			def+="</tr>"
		}
		def+='</table>';
		    
		colorDiv.innerHTML = def;
		root.appendChild(colorDiv);
	}
	
	ec.createBackColorsDiv = function(){
		var root = document.getElementById(this.id+'_root');
		var colorDiv = document.createElement('div');
		colorDiv.id = this.editor.id+'_backColors';
		colorDiv.setAttribute('style','position: absolute;top: 0px;left: 0px;z-index: 3;display: none;width: 106px;height: 102px;background-color: #FFFFFF;border: 1px solid #A0A0A0;');
		
		var def = '<table border="0" cellspacing="2" cellpadding="0">';
		for(var l=0;l<this.colors.length;l++){
			def+='<tr>';
			for(var c=0;c<4;c++){
				def+='<td><div style="padding: 3px 8px 3px 8px;cursor: pointer;background-color: '+this.colors[l][c]+';border: 1px solid #000000;" onclick="javascript:forumSetContent(\''+this.editor.id+'\',\'backColor2\',\''+this.colors[l][c]+'\');">&nbsp;&nbsp;</div></td>'
			}
			def+="</tr>"
		}
		def+='</table>';
		    
		colorDiv.innerHTML = def;
		root.appendChild(colorDiv);
	}
	
	return ec;
}