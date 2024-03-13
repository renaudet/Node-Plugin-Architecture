/*
 * pluginWrapper.js - plugin wrapper to delay effective plugin loading until first real usage (lazzy loading)
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
class PluginWrapper {
	pluginConfig = null;
	runtime = null;
	impl = null;
	extensionPlugs = [];
	constructor(mapEntry,runtime){
		this.pluginConfig = mapEntry;
		this.runtime = runtime;
	}
	getPlugin(){
		if(this.impl==null){
			console.log('effectively loading Plugin '+this.getId());
			try{
				let pathToModule = this.pluginConfig.path.replace(/\.\//,'../')+'/'+this.pluginConfig.manifest.plugin;
				this.impl = require(pathToModule);
				this.impl.configure(this.pluginConfig.path,this.pluginConfig.manifest,this.runtime);
				this.impl.beforeExtensionPlugged();
				for(var i=0;i<this.extensionPlugs.length;i++){
					let extensionPlug = this.extensionPlugs[i];
					this.impl.lazzyPlug(extensionPlug.wrapper.getId(),extensionPlug.config);
				}
				this.impl.onConfigurationLoaded();
			}catch(t){
				console.log(t);
			}
		}
		return this.impl;
	}
	getConfig(){
		return this.pluginConfig.manifest;
	}
	getLocalDirectory(){
		return this.pluginConfig.path;
	}
	getId(){
		return this.pluginConfig.manifest.id;
	}
	plug(extenderWrapper,extensionPointConfig){
		this.extensionPlugs.push({"wrapper": extenderWrapper,"config": extensionPointConfig});
	}
}

module.exports = PluginWrapper;