/*
 * plugin.js - Node Plugin Architecture root plugin
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const DEFAULT_GLOBAL_STATE = 'starting';
const APPLICATION_STARTED_STATE = 'application.started';

var plugin = new Plugin();
plugin.applications = {};
plugin.services = {};
plugin.activeApplicationName = null;
plugin.stateListeners = {};
plugin.globalState = DEFAULT_GLOBAL_STATE;

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	if('npa.core.application'==extensionPointConfig.point){
		this.info('registering application '+extensionPointConfig.name+' from extension point '+extensionPointConfig.id);
		this.applications[extensionPointConfig.name] = extenderId;
	}
	if('npa.core.service'==extensionPointConfig.point){
		this.info('registering service '+extensionPointConfig.service+' from extension point '+extensionPointConfig.id);
		this.services[extensionPointConfig.service] = extenderId;
	}
}

plugin.getApplication = function(name){
	this.debug('->getApplication('+name+')');
	let appPluginId = this.applications[name];
	if(typeof appPluginId!='undefined'){
		this.trace('found application extension for "'+name+'" from plugin '+appPluginId);
		this.debug('<-getApplication()');
		return this.runtime.getPlugin(appPluginId);
	}else{
		this.trace('no application extension found for name "'+name+'"');
		this.debug('<-getApplication() - not found');
		return null;
	}
}

plugin.startApplication = function(name){
	this.debug('->startApplication('+name+')');
	let app = this.getApplication(name);
	if(app!=null){
		this.info('Starting application "'+name+'"');
		this.activeApplicationName = name;
		app.start();
		this.setState(APPLICATION_STARTED_STATE);
		this.debug('<-startApplication()');
	}else{
		this.error('Unable to start application "'+name+'": not found!');
		this.debug('<-startApplication() - not found');
	}
}

plugin.getService = function(name){
	this.debug('->getService('+name+')');
	let implPluginId = this.services[name];
	if(typeof implPluginId!='undefined'){
		this.trace('found service extension for "'+name+'" from plugin '+implPluginId);
		this.debug('<-getService()');
		return this.runtime.getPlugin(implPluginId);
	}else{
		this.trace('no service extension found for name "'+name+'"');
		this.debug('<-getService() - not found');
		return null;
	}
}

plugin.setGlobalState = function(state){
	this.debug('->setGlobalState('+state+')');
	this.globalState = state;
	if(typeof this.stateListeners[state]!='undefined'){
		this.trace('found '+this.stateListeners[state].length+' state listener(s)');
		for(var i=0;i<this.stateListeners[state].length;i++){
			let callback = this.stateListeners[state][i];
			this.trace('executing state listener callback #'+i);
			try{
				callback();
			}catch(t){
				this.error('exception while executing state callback #'+i+' for state '+state);
			}
		}
		delete this.stateListeners[state];
	}
	this.debug('<-setGlobalState()');
}

plugin.registerGlobalStateListener = function(state,onStateReachedCallback){
	this.debug('->registerGlobalStateListener('+state+',<callback>)');
	if(typeof this.stateListeners[state]=='undefined'){
		this.stateListeners[state] = [];
	}
	this.stateListeners[state].push(onStateReachedCallback);
	this.debug('<-registerGlobalStateListener()');
}

plugin.getGlobalState = function(){
	return this.globalState;
}

module.exports = plugin;