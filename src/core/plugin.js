/*
 * plugin.js - plugin upper class
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */

class Plugin {
	config = null;
	runtime = null;
	logger = null;
	directory = null;
	constructor(){
	}
	getId(){
		if(this.config==null){
			throw new Error('Not yet initialized!');
		}
		return this.config.id;
	}
	getConfig(){
		return this.config;
	}
	configure = function(path,config,runtime){
		console.log('configuring plugin '+config.id);
		this.directory = path;
		this.config = config;
		this.runtime = runtime;
		this.beforePlugExtensions();
		this.runtime.registerExtensionPoints(this);
		this.runtime.plugExtensions(this);
		this.onConfigurationLoaded();
	}
	beforePlugExtensions(){
		
	}
	onConfigurationLoaded(){
		
	}
	getLocalDirectory(){
		return this.directory;
	}
	getExtensionById = function(extensionId){
		for(var i=0;i<this.config.extends.length;i++){
			var extension = this.config.extends[i];
			if(extensionId==extension.id){
				return  extension;
			}
		}
		return null;
	}
	getExtensionsForPoint = function(extensionPointId){
		var extensions = [];
		for(var i=0;i<this.config.extends.length;i++){
			var extension = this.config.extends[i];
			if(extensionPointId==extension.extensionPoint){
				extensions.push(extension);
			}
		}
		return extensions;
	}
	plug(extender,extensionPointConfig){
		console.log(this.getId()+': plugin in extender to extension point '+extensionPointConfig.point);
	}
	setLogger(logger){
		this.logger = logger;
	}
	log(level,text){
		if(this.logger!=null){
			this.logger.log(level,text);
		}else{
			console.log(this.getId()+': '+level+' '+text);
		}
	}
	info(text){
		console.log(text);
		this.log('info',text);
	}
	debug(text){
		this.log('debug',text);
	}
	trace(text){
		this.log('trace',text);
	}
	error(text){
		console.log(text);
		this.log('info','an error was sent to the error log!');
		this.log('error',text);
	}
	start(then){
		this.info(this.config.id+' starting...');
		then();
	}
}

module.exports = Plugin;