/*
 * integrationRuntime.js - plugin integration technology for Node.js
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
const PLUGIN_MANIFEST_NAME = 'manifest.json';
var fs = require('fs');  
var PluginWrapper = require('./pluginWrapper');  
 
 class Integrator{
	config = null;
	map = {};
	plugins = null;
	extensionPoints = {};
	constructor(runtimeConfiguration){
		this.config = runtimeConfiguration;
		this.config.installLocation = process.cwd();
		this.discover();
	}
	discover(){
		for(var i=0;i<this.config.sites.length;i++){
			let site = this.config.sites[i];
			console.log('discovering installation site "'+site.id+'"...');
			let entries = fs.readdirSync(site.location,{withFileTypes: true});
			for(var j=0;j<entries.length;j++){
				var dirEntry = entries[j];
				if(dirEntry.isDirectory()){
					var path = site.location+'/'+dirEntry.name;
					this.loadPluginManifest(path);
				}
			}
		}
		this.createPluginMap();
	}
	loadPluginManifest(path){
		var manifestFilename = path.replace(/\.\//,'../')+'/'+PLUGIN_MANIFEST_NAME;
		try{
			var manifest = require(manifestFilename);
			if(typeof this.map[manifest.id]=='undefined'){
				this.map[manifest.id] = [];
			}
			var metadata = {};
			metadata.path = path;
			metadata.manifest = manifest;
			this.map[manifest.id].push(metadata);
		}catch(fnf){
			console.log('No manifest file found in '+path);
			//console.log(fnf);
		}
	}
	createPluginMap(){
		for(var pluginId in this.map){
			var pluginEntry = this.map[pluginId];
			var selectedVersion = null;
			if(pluginEntry.length>1){
				var highestVersion = {"manifest": {"version": "0.0.0"}};
				for(var i=0;i<pluginEntry.length;i++){
					var entry = pluginEntry[i];
					if(this.compareVersion(entry.manifest.version,highestVersion.manifest.version)>0){
						highestVersion = entry;
					}
				}
				selectedVersion = highestVersion;
			}else{
				selectedVersion = pluginEntry[0];
			}
			selectedVersion.weight = 0;
			selectedVersion.requires = {};
			this.map[pluginId] = selectedVersion;
		}
		for(var pluginId in this.map){
			var pluginEntry = this.map[pluginId];
			pluginEntry.resolved = true;
			for(var i=0;i<pluginEntry.manifest.requires.length && pluginEntry.resolved;i++){
				var requiredDep = pluginEntry.manifest.requires[i];
				if('plugin'==requiredDep.type){
					var mapEntry = this.map[requiredDep.id];
					if(typeof mapEntry=='undefined'){
						console.log('Unresolved dependency found for plugin '+pluginId+': '+requiredDep.id);
						pluginEntry.resolved = false;
					}else{
						if(this.matchDependency(requiredDep.version,mapEntry.manifest.version)){
							pluginEntry.requires[requiredDep.id] = mapEntry;
						}else{
							console.log('Unmatched dependency found for plugin '+pluginId+': '+requiredDep.id+' required version is '+requiredDep.version+' - found '+mapEntry.manifest.version);
							pluginEntry.resolved = false;
						}
					}
				}
			}
		}
		for(var pluginId in this.map){
			var pluginEntry = this.map[pluginId];
			if(pluginEntry.resolved){
				pluginEntry.weight = this.computeWeight(pluginEntry);
			}
		}
		this.plugins = [];
		for(var pluginId in this.map){
			var pluginEntry = this.map[pluginId];
			if(pluginEntry.resolved){
				this.plugins.push(pluginEntry);
			}
		}
		var maxWeight = 0;
		for(var i=0;i<this.plugins.length-1;i++){
			for(var j=i+1;j<this.plugins.length;j++){
				if(this.plugins[j].weight<this.plugins[i].weight){
					var tmp = this.plugins[i];
					this.plugins[i] = this.plugins[j];
					this.plugins[j] = tmp;
				}
			}
		}
		for(var i=0;i<this.plugins.length;i++){
			this.lazzyLoadPlugin(this.plugins[i]);
		}
	}
	lazzyLoadPlugin(mapEntry){
		console.log('lazzyLoadPlugin('+mapEntry.manifest.id+')');
		try{
			let wrapper = new PluginWrapper(mapEntry,this);
			this.lazzyRegisterExtensionPoints(wrapper);
			this.lazzyPlugExtensions(wrapper);
			this.map[wrapper.getId()] = wrapper;
		}catch(lpe){
			console.log('Plugin '+mapEntry.manifest.id+' failed loading!');
			console.log(lpe);
		}
	}
	computeWeight(mapEntry){
		var weight = 1;
		for(var i=0;i<mapEntry.manifest.requires.length;i++){
			var requiredDep = mapEntry.manifest.requires[i];
			if('plugin'==requiredDep.type){
				var entry = this.map[requiredDep.id];
				var entryWeight = this.computeWeight(entry);
				if(entry.resolved){
					weight += 10*entryWeight;
				}else{
					mapEntry.resolved = false;
				}
			}
		}
		return weight;
	}
	compareVersion(v1,v2){
		if(!v1 || v1==null){
			if(!v2 || v2==null){
				return 0;
			}else{
				return -1;
			}
		}else
		if(!v2 || v2==null){
			return 1;
		}
		var v1Numbers = v1.split('.');
		var v2Numbers = v2.split('.');
		while(v1Numbers.length<v2Numbers.length){
			v1Numbers.push('0');
		}
		while(v2Numbers.length<v1Numbers.length){
			v2Numbers.push('0');
		}
		for(var i=0;i<v1Numbers.length;i++){
			var v1 = eval(v1Numbers[i]);
			var v2 = eval(v2Numbers[i]);
			if(v1>v2){
				return 1;
			}
			if(v1<v2){
				return -1;
			}
		}
		return 0;
	}
	matchDependency(requiredVersion,availableVersion){
		if(requiredVersion.startsWith('=')){
			let required = requiredVersion.replace(/=/g,'');
			if(this.compareVersion(availableVersion,required)==0){
				return true;
			}
		}else
		if(requiredVersion.startsWith('^')){
			let required = requiredVersion.replace(/\^/g,'');
			if(this.compareVersion(availableVersion,required)>0){
				return true;
			}
		}else
		if(this.compareVersion(availableVersion,requiredVersion)>=0){
			return true;
		}
		return false;
	}
	lazzyRegisterExtensionPoints(pluginWrapper){
		var pluginConfig = pluginWrapper.getConfig();
		for(var i=0;i<pluginConfig.provides.length;i++){
			var extensionPoint = pluginConfig.provides[i];
			this.extensionPoints[extensionPoint.id] = pluginWrapper;
			console.log('lazzy registered extension point '+extensionPoint.id);
		}
	}
	lazzyPlugExtensions(pluginWrapper){
		var pluginConfig = pluginWrapper.getConfig();
		for(var i=0;i<pluginConfig.extends.length;i++){
			var extension = pluginConfig.extends[i];
			var targetPluginWrapper = this.extensionPoints[extension.point];
			if(typeof targetPluginWrapper!='undefined'){
				targetPluginWrapper.plug(pluginWrapper,extension);
			}else{
				console.log(pluginWrapper.getId()+': unknown extension point '+extension.point);
			}
		}
	}
	getPlugin(pluginId){
		return this.map[pluginId].getPlugin();
	}
	getPluginWrapper(pluginId){
		return this.map[pluginId];
	}
}

module.exports = Integrator;