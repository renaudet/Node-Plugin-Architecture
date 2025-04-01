/*
 * plugin.js - plugin upper class
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
const fs = require('fs'); 

class Plugin {
	constructor(){
		this.config = null;
		this.runtime = null;
		this.logger = null;
		this.directory = null;
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
	configure(path,config,runtime){
		console.log('configuring plugin '+config.id);
		this.directory = path;
		this.config = config;
		this.runtime = runtime;
	}
	getConfigValue(relativJsonPath,type='string'){
		let config = this.config;
		try{
			const configValue = eval(`config.${relativJsonPath}`);
			if(typeof configValue!='undefined' && configValue!=null){
				if(typeof configValue=='string' && configValue.startsWith('$')){
					let tokens = configValue.split(',');
					let envVarName = tokens[0].replace(/\$/,'');
					let defaultValue = '';
					if(tokens.length==2){
						defaultValue = tokens[1];
					}
					let envValue = process.env[envVarName];
					if(typeof envValue!='undefined'){
						if('string'==type){
							return envValue;
						}else if('integer'==type){
							return parseInt(envValue);
						}else if('boolean'==type){
							return 'true'==envValue;
						}else{
							console.log('ERROR: plugin#getConfigValue() unsupported type "'+type+'" for configuration path '+relativJsonPath);
							return null;
						}
					}else{
						if('string'==type){
							return defaultValue;
						}else if('integer'==type){
							return parseInt(defaultValue);
						}else if('boolean'==type){
							return 'true'==defaultValue;
						}else{
							console.log('ERROR: plugin#getConfigValue() unsupported type "'+type+'" for configuration path '+relativJsonPath);
							return null;
						}
					}
				}else{
					return configValue;
				}
			}else{
				console.log('ERROR: plugin#getConfigValue() configuration mistake for plugin '+this.getId()+' - configuration value does not exists for path '+relativJsonPath);
				return null;
			}
		}catch(e){
			console.log('ERROR: plugin#getConfigValue() configuration mistake for plugin '+this.getId()+' - unable to read configuration value for path '+relativJsonPath);
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
	getResourceContent(relativePath){
		this.debug('->getResourceContent()');
		this.debug('relativePath: '+relativePath);
		let resourcePath = this.getLocalDirectory()+relativePath;
		this.debug('resourcePath: '+resourcePath);
		var buffer = fs.readFileSync(resourcePath,{});
		this.debug('<-getResourceContent()');
		return buffer.toString();
	}
	getExtensionById(extensionId){
		for(var i=0;i<this.config.extends.length;i++){
			var extension = this.config.extends[i];
			if(extensionId==extension.id){
				return  extension;
			}
		}
		return null;
	}
	getExtensionsForPoint(extensionPointId){
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
	canLog(level){
		return this.getLogger().canLog(level);
	}
	info(text){
		console.log(this.getId()+': '+text);
		this.log('info',text);
	}
	debug(text){
		this.log('debug',text);
	}
	trace(text){
		this.log('trace',text);
	}
	error(text){
		console.log(this.getId()+': '+text);
		this.log('info','an error was sent to the error log!');
		this.log('error',text);
	}
	start(){
		this.info(this.config.id+' starting...');
	}
	setState(state){
		this.debug('->setState('+state+')');
		let core = this.runtime.getPlugin('npa.core');
		core.setGlobalState(state);
		this.debug('<-setState()');
	}
	registerStateListener(state,callback){
		let core = this.runtime.getPlugin('npa.core');
		core.registerGlobalStateListener(state,callback);
	}
	sortOn(list,attributeName,descending=true){
		if(typeof attributeName=='undefined'){
			return list;
		}else{
			if(list.length>1){
				for(var i=0;i<list.length-1;i++){
					for(var j=i+1;j<list.length;j++){
						var listi = list[i];
						var listj = list[j];
						if(typeof listj[attributeName]!='undefined' && typeof listi[attributeName]!='undefined'){
							if(Number.isInteger(listj[attributeName])){
								if(listj[attributeName]<listi[attributeName]){
									var tmp = listi;
									list[i] = listj;
									list[j] = tmp;
								}
							}else{
								if(descending){
									if(listj[attributeName].localeCompare(listi[attributeName])<0){
										var tmp = listi;
										list[i] = listj;
										list[j] = tmp;
									}
								}else{
									if(listj[attributeName].localeCompare(listi[attributeName])>0){
										var tmp = listi;
										list[i] = listj;
										list[j] = tmp;
									}
								}
							}
						}
					}
				}
			}
			return list;
		}
	}
	checkInput(src,from){
		if(typeof src=='undefined' || src==null){
			if(typeof from!='undefined' && from!=null){
				return false;
			}else{
				return true;
			}
		}
		let checkResult = true;
		for(var attributeName in from){
			if(typeof src[attributeName]=='undefined'){
				checkResult = false;
			}else{
				if(typeof src[attributeName]!=typeof from[attributeName]){
					checkResult = false;
				}
			}
		}
		return checkResult;
	}
}

module.exports = Plugin;