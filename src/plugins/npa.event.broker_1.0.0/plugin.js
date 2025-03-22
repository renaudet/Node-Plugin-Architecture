/*
 * plugin.js - Event broker provider for NPA
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const moment = require('moment');
const EventEmitter = require('node:events');
const TIMESTAMP_FORMAT = 'YYYY/MM/DD - HH:mm:ss';

var plugin = new Plugin();
plugin.eventEmitter = new EventEmitter();
plugin.eventHandlers = {};

/*
 * event structure: {
	 "name": "abcd",
	 "source*": "abcd",
	 "data": {}
   }
 */
plugin.emit = function(event){
	this.debug('->emit()');
	if(event && event.name && event.data){
		this.trace('event: '+event.name);
		this.trace('source: '+(event.source?event.source:'anonymous'));
		event.emitted = moment().format(TIMESTAMP_FORMAT);
		this.eventEmitter.emit(event.name,event);
		this.debug('<-emit() - event emitted');
		return true;
	}else{
		this.trace('invalid event detected!');
		try{
			this.trace(JSON.stringify(event,null,'\t'));
		}catch(t){};
		this.debug('<-emit() - event discarded');
		return false;
	}
}

plugin.registerHandler = function(eventName,handlerId,handlerCallback){
	this.debug('->registerHandler()');
	this.trace('eventName: '+eventName);
	this.trace('handlerId: '+handlerId);
	if(typeof this.eventHandlers[handlerId]=='undefined'){	
		this.trace('new handler ID detected - creating new event map');
		this.eventHandlers[handlerId] = {};
	}
	var handlerWrapper = function(event){
		plugin.trace(handlerId+' event handler for "'+eventName+'" activated!');
		plugin.trace('event: '+event.name);
		plugin.trace('source: '+event.source);
		plugin.trace('timestamp: '+event.emitted);
		try{
			handlerCallback(event);
			plugin.trace('callback invoked successfully!');
		}catch(t){
			// automatically un-register
			plugin.debug('unregistering event handler for "'+eventName+'" due to exception');
			plugin.unregisterHandler(eventName, handlerId);
		}
	}
	this.eventHandlers[handlerId][eventName] = handlerWrapper;
	this.eventEmitter.on(eventName,handlerWrapper);
	this.debug('<-registerHandler()');
}

plugin.unregisterHandler = function(eventName,handlerId){
	this.debug('->unregisterHandler()');
	this.trace('eventName: '+eventName);
	this.trace('handlerId: '+handlerId);
	if(typeof this.eventHandlers[handlerId]!='undefined'){
		if(typeof this.eventHandlers[handlerId][eventName]!='undefined'){
			this.eventEmitter.removeListener(eventName, this.eventHandlers[handlerId][eventName]);
		}
	}
	this.debug('<-unregisterHandler()');
}

module.exports = plugin;