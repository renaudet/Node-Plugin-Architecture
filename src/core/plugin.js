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
	}
	getConfigValue(relativJsonPath){
		let config = this.config;
		try{
			const configValue = eval(`config.${relativJsonPath}`);
			if(typeof configValue!='undefined' && configValue!=null){
				if(typeof configValue=='string' && configValue.startsWith('$')){
					let envVarName = configValue.replace(/\$/,'');
					return process.env[envVarName];
				}else{
					return configValue;
				}
			}else{
				console.log('ERROR: configuration mistake for plugin '+this.getId()+' - configuration value does not exists for path '+relativJsonPath);
				return null;
			}
		}catch(e){
			console.log('ERROR: configuration mistake for plugin '+this.getId()+' - unable to read configuration value for path '+relativJsonPath);
			return null;
		}
	}
	beforeExtensionPlugged(){
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
	lazzyPlug(extenderId,extensionPointConfig){
		console.log(this.getId()+': lazzy plugin-in extender '+extenderId+'to extension point '+extensionPointConfig.point);
	}
	getService(name){
		let core = this.runtime.getPlugin('npa.core');
		return core.getService(name);
	}
	getLogger(){
		let logger = this.runtime.getPlugin('npa.logging');
		return logger.getLogger(this.getId());
	}
	log(level,text){
		this.getLogger().log(level,text);
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
	start(){
		this.info(this.config.id+' starting...');
	}
}

module.exports = Plugin;