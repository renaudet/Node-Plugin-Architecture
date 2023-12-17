/*
 * treeViewer.js - Light implementation for a Tree Viewer
 *
 */
var TREE_VIEWER_LIBRARY_VERSION = '1.0.0';

function TreeNode(id,label,data){
	this.id = id;
	this.label = label;
	this.tree = null;
	this.data = data;
	this.parent = null;
	this.isParent = true; // true by default for retro-compatibility
	this.children = [];
	this.openStatus = false;
	if(this.data && typeof this.data.node != 'undefined'){
		this.data.node = this;
	}
}

TreeNode.prototype.hasChildren = function(){
	return this.children.length>0;
}

TreeNode.prototype.setTree = function(tree){
	this.tree = tree;
	tree.register(this);
}

TreeNode.prototype.getPath = function(){
	if(this.hasChildren()){
		if(this.parent){
			var pathList = this.parent.getPath();
			pathList.push(this.id);
			return pathList;
		}else{
			var pathList = [];
			return pathList;
		}
	}else{
		return this.parent.getPath();
	}
}

TreeNode.prototype.isSelected = function(){
	if(this.tree){
		return (this.tree.getSelectedNode()==this);
	}
	return false;
}

TreeNode.prototype.triggerClick = function(){
	$('#'+this.id+' span').first().trigger('click');
}

TreeNode.prototype.select = function(){
	if(this.hasChildren()){
		if(this.openStatus){
			this.close();
			if(this.openStatus){
				if(this.tree && this.tree.listener){
					try{
						this.tree.listener.onNodeSelected(this);
					}catch(e){
						console.log(e);
					}
				}
			}
		}else{
			this.open();
			if(this.tree && this.tree.listener){
				try{
					this.tree.listener.onNodeSelected(this);
				}catch(e){
					console.log(e);
				}
			}
		}
	}else{
		if(this.tree){
			this.tree.setSelectedNode(this);
			if(this.tree.listener){
				try{
					this.tree.listener.onNodeSelected(this);
				}catch(e){
					console.log(e);
				}
			}
		}
	}
}

TreeNode.prototype.reveal = function(){
	if(this.parent){
		this.open();
	}
}

TreeNode.prototype.open = function(){
	this.openStatus = true;
	if(this.tree){
		this.tree.setSelectedNode(this);
	}
	$('#'+this.id+' .nested').first().addClass('active');
	if(this.isParent){
		$('#'+this.id+' span').first().addClass('caret-down');
	}
}

TreeNode.prototype.expandAll = function(){
	if(this.parent){
		this.open();
	}
	if(this.hasChildren()){
		for(var i=0;i<this.children.length;i++){
			var child = this.children[i];
			child.expandAll();
		}
	}
}

TreeNode.prototype.isOpen = function(){
	return this.openStatus;
}

TreeNode.prototype.close = function(){
	if(this.hasChildren()){
		if(this.isSelected()){
			this.openStatus = false;
			$('#'+this.id+' .nested').first().removeClass('active');
			$('#'+this.id+' span').first().removeClass('caret-down');
		}else{
			if(this.tree){
				this.tree.setSelectedNode(this);
			}
		}
	}else{
		this.openStatus = false;
	}
}

TreeNode.prototype.childCount = function(){
	return this.children.length;
}

TreeNode.prototype.addChild = function(childNode){
	this.children.push(childNode);
	childNode.parent = this;
	childNode.tree = this.tree;
}

TreeNode.prototype.removeChild = function(childNode){
	if(childNode){
		var newChildren = [];
		for(var i=0;i<this.children.length;i++){
			var child = this.children[i];
			if(child.id!=childNode.id){
				newChildren.push(child);
			}
		}
		this.children = newChildren;
	}
}

TreeNode.prototype.setLabel = function(label){
	this.label = label;
	$('#'+this.id+' span').first().html(label);
}

TreeNode.prototype.toHtml = function(){
	var html = '';
	if(this.parent){
		html += '<li id="';
		html += this.id;
		html += '">';
		if(this.hasChildren()){
			if(this.openStatus){
				html += '<span class="caret caret-down">';
			}else{
				html += '<span class="caret">';
			}
		}else{
			html += '<span class="leaf">';
		}
		html += this.label;
		html += '</span>';
		if(this.hasChildren()){
			if(this.openStatus){
				html += '<ul class=" tree nested active">';
			}else{
				html += '<ul class="tree nested">';
			}
			for(var i=0;i<this.children.length;i++){
				var child = this.children[i];
				html += child.toHtml();
			}
			html += '</ul>';
		}
		html += '</li>';
	}else{
		if(this.hasChildren()){
			for(var i=0;i<this.children.length;i++){
				var child = this.children[i];
				html += child.toHtml();
			}
		}
	}
	return html;
}

var treeViewerCache = {};

function getTreeViewer(id){
	return treeViewerCache[id];
}

function TreeViewer(id,rootDiv){
	this.parent = rootDiv;
	this.id = id;
	this.visitor = null;
	this.decorator = null;
	this.listener = null;
	this.nodeCache = {};
	this.rootNode = new TreeNode(this.id+'_root','',[]);
	this.rootNode.setTree(this);
	this.selectedNode = this.rootNode;
	treeViewerCache[id] = this;
}

TreeViewer.prototype.init = function(){
	//loadStylesheet('/css/treeViewer.css');
	this.root = document.createElement('ul');
	this.root.setAttribute('class', 'tree');
	this.root.setAttribute('id', this.id+'_root');
	this.parent.appendChild(this.root);
}

TreeViewer.prototype.clear = function(){
	this.rootNode.children = [];
	$('#'+this.id+'_root').empty();
	this.nodeCache = {};
	this.rootNode.setTree(this);
}

TreeViewer.prototype.reveal = function(path){
	for(var i=0;i<path.length;i++){
		var nodeId = path[i];
		var node = this.findNode(nodeId);
		if(node){
			node.reveal();
		}
	}
}

TreeViewer.prototype.register = function(node){
	this.nodeCache[node.id] = node;
}

TreeViewer.prototype.setSelectedNode = function(node){
	if(this.selectedNode){
		$('#'+this.selectedNode.id+' span').first().removeClass('selectedNode');
	}
	this.selectedNode = node;
	if(this.selectedNode){
		$('#'+this.selectedNode.id+' span').first().addClass('selectedNode');
	}
}

TreeViewer.prototype.getSelectedNode = function(node){
	return this.selectedNode;
}

TreeViewer.prototype.getPath = function(nodeId){
	var node = this.findNode(nodeId);
	if(node){
		return node.getPath();
	}else{
		return [];
	}
}

TreeViewer.prototype.setVisitor = function(modelVisitor){
	this.visitor = modelVisitor;
}

TreeViewer.prototype.setDecorator = function(modelDecorator){
	this.decorator = modelDecorator;
}

TreeViewer.prototype.setEventListener = function(eventListener){
	this.listener = eventListener;
}

TreeViewer.prototype.createTreeStructure = function(id,data){
	var label = id;
	if(this.visitor){
		label = this.visitor.getLabel(data);
		if(this.decorator){
			label = this.decorator.decorate(data,label);
		}
	}
	var node = new TreeNode(id,label,data);
	node.setTree(this);
	if(this.visitor){
		if(typeof this.visitor.isParent!='undefined' && !this.visitor.isParent(data)){
			node.isParent = false;
		}else{
			var children = this.visitor.getChildren(data);
			for(var i=0;i<children.length;i++){
				var childData = children[i];
				var childNode = this.createTreeStructure(id+'_'+i,childData);
				node.addChild(childNode);
			}
		}
	}
	return node;
}

TreeViewer.prototype.refreshNodeStructure = function(node){
	if(!node.hasChildren() && this.visitor){
		var children = this.visitor.getChildren(node.data);
		//console.log(children);
		for(var i=0;i<children.length;i++){
			var childData = children[i];
			var childNode = this.createTreeStructure(node.id+'_'+i,childData);
			node.addChild(childNode);
		}
		//console.log(node);
		if(this.decorator){
			var data = node.data;
			var label = this.visitor.getLabel(data);
			label = this.decorator.decorate(data,label);
			node.label = label;
		}
		this.refreshTree();
	}
}

TreeViewer.prototype.addRootData = function(childData){
	var childNodeId = this.id+'_node_'+this.rootNode.childCount();
	var childNode = this.createTreeStructure(childNodeId,childData);
	this.rootNode.addChild(childNode);
	return childNodeId;
}

TreeViewer.prototype.findNode = function(nodeId){
	return this.nodeCache[nodeId];
}

function caretEventListener(){
	var nodeId = $(this).parent().prop('id');
	var treeId = $('#'+nodeId+' .caret').data('treeId');
	var tree = treeViewerCache[treeId];
    var node = tree.findNode(nodeId);
	node.select();
}

function leafEventListener(){
	var nodeId = $(this).parent().prop('id');
	var treeId = $('#'+nodeId+' .leaf').data('treeId');
	var tree = treeViewerCache[treeId];
    var node = tree.findNode(nodeId);
	node.select();
}

TreeViewer.prototype.refreshTree = function(){
	$('#'+this.id+'_root').empty();
	$('#'+this.id+'_root').append(this.rootNode.toHtml());
	var tree = this;
	$('#'+this.id+'_root .caret').each(function(index){
		$(this).data('treeId',tree.id);
		$(this).click(caretEventListener);
	});
	$('#'+this.id+'_root .leaf').each(function(index){
		$(this).data('treeId',tree.id);
		$(this).click(leafEventListener);
	});
}

TreeViewer.prototype.expandAll = function(){
	this.rootNode.expandAll();
}