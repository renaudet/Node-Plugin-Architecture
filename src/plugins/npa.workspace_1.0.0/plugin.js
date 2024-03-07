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
	}
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
	fs.mkdirSync(this.location+'/'+projectInfo.name,{"recursive": true});
	let confFileContent = JSON.stringify(projectInfo,null,'\t');
	this.createLocalFile(PROJECT_CONF_FILE_NAME,projectInfo.name,confFileContent);
}

plugin.createLocalFile = function(relativeFileName,project,content,options={}){
	let absolutePath = this.location+'/'+project+'/'+relativeFileName;
	var stream = fs.createWriteStream(absoluteFileName, {flags:'a'});
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
}

module.exports = plugin;