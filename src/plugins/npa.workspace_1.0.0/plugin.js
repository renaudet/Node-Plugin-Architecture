/*
 * plugin.js - Filesystem support service provider for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const ENV_WORKSPACE_LOCATION = 'WORKSPACE_LOC';
const PROJECT_CONF_FILE_NAME = '.project';
const fs = require('fs'); 

var plugin = new Plugin();
plugin.location = './';

plugin.beforeExtensionPlugged = function(){
	if(typeof process.env[ENV_WORKSPACE_LOCATION]!='undefined'){
		this.location = process.env[ENV_WORKSPACE_LOCATION];
		this.debug('Workspace location is '+this.location);
	}
}

plugin.folderContent = function(relativePath,showHiddenFile=false){
	this.trace('->folderContent()');
	this.debug('relativePath: '+relativePath);
	var folderAbsolutePath = this.location+'/'+relativePath;
	var entries = fs.readdirSync(folderAbsolutePath,{withFileTypes: true});
	var folderEntries = [];
	for(var i=0;i<entries.length;i++){
		var dirEntry = entries[i];
		if(dirEntry.isFile()){
			var stat = fs.statSync(folderAbsolutePath+'/'+dirEntry.name);
			if(showHiddenFile || !dirEntry.name.startsWith('.')){
				folderEntries.push({"name": dirEntry.name,"type": "file","size": stat.size,"lastModified": stat.mtime,"created": stat.birthtime});
			}
		}else{
			folderEntries.push({"name": dirEntry.name,"type": "directory"});
		}
	}
	this.trace('<-folderContent()');
	return folderEntries;
}

/*
 * projectInfo structure:
   {
	 "name": <project-name>,
	 "type": <project-type>
   }
}
 */
plugin.createProject = function(projectInfo){
	this.trace('->createProject()');
	this.debug('projectInfo.name: '+projectInfo.name);
	fs.mkdirSync(this.location+'/'+projectInfo.name,{"recursive": true});
	let confFileContent = JSON.stringify(projectInfo,null,'\t');
	this.createLocalFile(PROJECT_CONF_FILE_NAME,projectInfo.name,confFileContent);
	this.trace('<-createProject()');
}

plugin.createFolder = function(project,relativPath){
	this.trace('->createFolder()');
	this.debug('project: '+project);
	this.debug('relativePath: '+relativPath);
	let absolutePath = this.location+'/'+project+'/'+relativPath;
	fs.mkdirSync(absolutePath,{"recursive": true});
	this.trace('<-createFolder()');
	return '/'+project+'/'+relativPath;
}

plugin.createLocalFile = function(relativeFileName,project,content,options={}){
	this.trace('->createLocalFile()');
	this.debug('relativeFileName: '+relativeFileName);
	this.debug('project: '+project);
	let absolutePath = this.location+'/'+project+'/'+relativeFileName;
	var stream = fs.createWriteStream(absolutePath, {flags:'w'});
	stream.on('error', function (err) {
		plugin.error('in createLocalFile()');
		plugin.error(JSON.stringify(err));
	});
	if(options && options.encoding){
		stream.write(content,options.encoding);
	}else{
		stream.write(content);
	}
	stream.end();
	this.trace('<-createLocalFile()');
}

plugin.deleteResource = function(path){
	this.trace('->deleteResource()');
	this.debug('path: '+path);
	let absolutePath = this.location+'/'+path;
	if(path && path.indexOf('/')>=0){
		let stat = fs.statSync(absolutePath,{"throwIfNoEntry ": false});
		if(typeof stat!='undefined'){
			if(stat.isDirectory()){
				fs.rmdirSync(absolutePath,{"force": true,"recursive ": true});
				this.trace('<-deleteResource() - success');
			}else{
				fs.rmSync(absolutePath,{"force": true,"recursive ": true});
				this.trace('<-deleteResource() - success');
			}
		}
	}else{
		this.trace('<-deleteResource() - bad path');
		throw new Error('Invalid path!');
	}
}

plugin.setFileContent = function(workspaceRelativeFileName,content,options={}){
	this.trace('->setFileContent()');
	this.debug('workspaceRelativeFileName: '+workspaceRelativeFileName);
	let absolutePath = this.location+'/'+workspaceRelativeFileName;
	if(options && options.recursive){
		let folder = absolutePath.substring(0,absolutePath.lastIndexOf('/'));
		fs.mkdirSync(folder,{"recursive": true});
	}
	var stream = fs.createWriteStream(absolutePath, {flags:'w'});
	stream.on('error', function (err) {
		plugin.error('in npa.workspace.Plugin#setFileContent()');
		plugin.error(JSON.stringify(err));
	});
	if(options && options.encoding){
		stream.write(content,options.encoding);
	}else{
		stream.write(content);
	}
	stream.end();
	this.trace('<-setFileContent()');
}

plugin.appendToFileContent = function(workspaceRelativeFileName,content,options={}){
	this.trace('->appendToFileContent()');
	this.debug('workspaceRelativeFileName: '+workspaceRelativeFileName);
	let absolutePath = this.location+'/'+workspaceRelativeFileName;
	var stream = fs.createWriteStream(absolutePath, {flags:'a'});
	stream.on('error', function (err) {
		plugin.error('in appendToFileContent()');
		plugin.error(JSON.stringify(err));
	});
	if(options && options.encoding){
		stream.write(content,options.encoding);
	}else{
		stream.write(content);
	}
	stream.end();
	this.trace('<-appendToFileContent()');
}

plugin.getProject = function(name){
	this.trace('->getProject()');
	this.debug('name: '+name);
	let path = this.location+'/'+name;
	if(fs.existsSync(path)){
		let configPath = path+'/'+PROJECT_CONF_FILE_NAME;
		let buffer = fs.readFileSync(configPath,{"encoding": "utf-8"});
		let json = buffer.toString();
		this.trace('<-getProject()');
		return JSON.parse(json);
	}else{
		this.trace('<-getProject()');
		return null;
	}
}

plugin.deleteProject = function(name,user){
	this.trace('->deleteProject()');
	this.debug('name: '+name);
	let project = this.getProject(name);
	if(project!=null){
		if(user.isAdmin || user.login==project.createdBy){
			let path = this.location+'/'+name;
			this.deleteResource(name+'/'+PROJECT_CONF_FILE_NAME);
			fs.rmdirSync(path,{"force": true,"recursive ": true});
			this.trace('<-deleteProject() - success');
		}else{
			this.trace('<-deleteProject() - not owner');
			throw new Error('Not owner');
		}
	}else{
		this.trace('<-deleteProject() - project does not exist');
	}
}

plugin.getProjects = function(filter){
	this.trace('->getProjects()');
	let projects = this.folderContent('');
	let result = [];
	for(var i=0;i<projects.length;i++){
		let projectEntry = projects[i];
		if('directory'==projectEntry.type){
			let projectConfig = this.getProject(projectEntry.name);
			let selected = projectConfig!=null;
			if(selected && filter && filter.name){
				if(!projectEntry.name.startsWith(filter.name)){
					selected = false;
				}
			}
			if(selected && filter && filter.type){
				if(!projectConfig.type==filter.type){
					selected = false;
				}
			}
			if(selected){
				result.push(projectConfig);
			}
		}
	}
	this.trace('<-getProjects()');
	return result;
}

plugin.getFileContent = function(filePath,options={}){
	this.trace('->getFileContent()');
	let absoluteFilePath = 	this.location+'/'+filePath;
	var buffer = fs.readFileSync(absoluteFilePath,options);
	this.trace('<-getFileContent()');
	return buffer.toString();
}

plugin.getFileInfo = function(filePath){
	this.trace('->getFileInfo()');
	let absoluteFilePath = 	this.location+'/'+filePath;
	var stat = fs.statSync(absoluteFilePath);
	this.trace('<-getFileInfo()');
	return stat;
}

plugin.absolutePath = function(resourcePath){
	return this.location+'/'+resourcePath;
}

plugin.renameFile = function(baseDir,oldName,newName){
	fs.renameSync(baseDir+'/'+oldName,baseDir+'/'+newName);
}

module.exports = plugin;