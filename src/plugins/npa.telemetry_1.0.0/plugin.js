/*
 * plugin.js - Telemetry service plugin for NPA
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const moment = require('moment');
const DATE_TIME_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const USED_HEAP_DIMENSION = 'used.heap';
const TELEMETRY_COLLECT_TIMEOUT = 30;

var plugin = new Plugin();
/*
Telemetry dimension structure: {
    "id": "<contribution ID>",
    "point": "npa.runtime.property.provider",
    "name": "<dimension name>",
    "displayLabel": "<dimension display label>",
    "description": "<dimension description>",
    "type": "<dimension type, one of int/number>",
    "unit": "<dimension unit. e.g. request/min",
    "maxPoints": "<max data points for this dimension>"
}
*/
plugin.dimensions = {};

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
    this.trace('->lazzyPlug('+extenderId+','+extensionPointConfig.point+')');
    if('npa.telemetry.dimension.provider'==extensionPointConfig.point){
        this.debug('contribution: '+JSON.stringify(extensionPointConfig));
        let dimension = Object.assign({},extensionPointConfig);
        delete dimension.id;
        delete dimension.point;
        dimension.data = [];
        this.dimensions[dimension.name] = dimension;
    }
    this.trace('<-lazzyPlug()');
}

plugin.onConfigurationLoaded = function(){
	setTimeout(function(){ plugin.collectTelemetry(); },TELEMETRY_COLLECT_TIMEOUT*1000);
}

plugin.getDimensionList = function(){
	this.trace('->getDimensionList()');
	let list = [];
	for(var name in this.dimensions){
		let dimension = this.dimensions[name];
		let record = {"name": name,"displayLabel":dimension.displayLabel,"description": dimension.description,"type": dimension.type,"unit": dimension.unit};
		list.push(record);
	}
	this.trace('<-getDimensionList()');
	return list;
}

plugin.storeDataPoint = function(dimension,data){
	this.trace('->storeDataPoint()');
	if(dimension.data.length<dimension.maxPoints){
		dimension.data.push(data);
	}else{
		for(var i=0;i<dimension.maxPoints-1;i++){
			dimension.data[i] = dimension.data[i+1];
		}
		dimension.data[dimension.maxPoints-1] = data;
	}
	this.trace('<-storeDataPoint()');
}

plugin.push = function(dimensionName,telemetryData){
    this.trace('->push('+dimensionName+')');
    let dimension = this.dimensions[dimensionName];
    if(typeof dimension!='undefined'){
        this.storeDataPoint(dimension,telemetryData);
        this.trace('<-push()');
    }else{
        this.trace('<-push() - no valid dimension found');
    }
}

plugin.getDataPoints = function(dimensionName){
	this.trace('->getDataPoints('+dimensionName+')');
    let dimension = this.dimensions[dimensionName];
    if(typeof dimension!='undefined'){
		this.debug(JSON.stringify(dimension));
        this.trace('<-getDataPoints()');
        return dimension;
    }else{
        this.trace('<-getDataPoints() - no valid dimension found');
        return null;
    }
}

plugin.collectTelemetry = function(){
	this.trace('->collectTelemetry()');
	let usedHeapMb = Math.floor(process.memoryUsage().heapUsed/(1024*1024));
	let telemetryData = {"timestamp": moment().format('YYYY/MM/DD HH:mm:ss'),"count": usedHeapMb};
	this.push(USED_HEAP_DIMENSION,telemetryData);
	this.trace('<-collectTelemetry()');
	setTimeout(function(){ plugin.collectTelemetry(); },TELEMETRY_COLLECT_TIMEOUT*1000);
}

module.exports = plugin;