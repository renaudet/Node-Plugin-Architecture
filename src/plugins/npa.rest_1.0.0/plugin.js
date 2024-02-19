/*
 * plugin.js - REST client provider for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const axios = require('axios');

var plugin = new Plugin();
/*
 * restContext:
  {
	"host": string,
	"port": (optional)integer,
	"uri": string,
	"secured": boolean,
	"username": (optional)string,
	"password": (optional)string,
	"method": GET/PUT/POST/DELETE,
	"payload": (optional)json
  }
 */
plugin.performRestApiCall = function(restContext,onRestInvocationCompletedCallback){
	var port = typeof restContext.port!='undefined'?':'+restContext.port:'';
	var url = (restContext.secured?'https://':'http://')+restContext.host+port+restContext.uri;
	this.debug('url: '+url);
	this.debug('method: '+restContext.method);
	restContext.url = url;
	if(typeof restContext.username!='undefined'){
		restContext.securityContext = {"auth": {"username": restContext.username,"password": restContext.password}};
	}else{
		restContext.securityContext = {};
	}
	this.debug('securityContext: '+JSON.stringify(restContext.securityContext));
	if('GET'==restContext.method){
		this.performGetRestApiCall(restContext,onRestInvocationCompletedCallback);
	}else
	if('POST'==restContext.method){
		this.performPostRestApiCall(restContext,onRestInvocationCompletedCallback);
	}else
	if('PUT'==restContext.method){
		this.performPutRestApiCall(restContext,onRestInvocationCompletedCallback);
	}else
	if('DELETE'==restContext.method){
		this.performDeleteRestApiCall(restContext,onRestInvocationCompletedCallback);
	}	
}

plugin.performGetRestApiCall = function(restContext,onRestInvocationCompletedCallback){
	axios.get(restContext.url,restContext.securityContext)
	.then(function (response) {
		try{
			onRestInvocationCompletedCallback(null,response.data);
		}catch(e){
			console.log(e);
		}
	})
	.catch(function (error) {
		plugin.error('GET from url: '+restContext.url);
		plugin.error(JSON.stringify(error));
		onRestInvocationCompletedCallback('REST invocation failed for '+restContext.url,error);//error.response.data
	});
}

plugin.performPostRestApiCall = function(restContext,onRestInvocationCompletedCallback){
	axios.post(restContext.url,restContext.payload,restContext.securityContext)
	.then(function (response) {
		onRestInvocationCompletedCallback(null,response.data);
	})
	.catch(function (error) {
		plugin.error('POST from url: '+restContext.url);
		plugin.error(JSON.stringify(error));
		onRestInvocationCompletedCallback('REST invocation failed for '+restContext.url,error);//error.response.data
	});
}

plugin.performPutRestApiCall = function(restContext,onRestInvocationCompletedCallback){
	axios.put(restContext.url,restContext.payload,restContext.securityContext)
	.then(function (response) {
		onRestInvocationCompletedCallback(null,response.data);
	})
	.catch(function (error) {
		plugin.error('PUT from url: '+restContext.url);
		plugin.error(JSON.stringify(error));
		onRestInvocationCompletedCallback('REST invocation failed for '+restContext.url,error);//error.response.data
	});
}

plugin.performDeleteRestApiCall = function(restContext,onRestInvocationCompletedCallback){
	axios.delete(restContext.url,{},restContext.securityContext)
	.then(function (response) {
		onRestInvocationCompletedCallback(null,response.data);
	})
	.catch(function (error) {
		plugin.error('DELETE from url: '+restContext.url);
		plugin.error(JSON.stringify(error));
		onRestInvocationCompletedCallback('REST invocation failed for '+restContext.url,error);//error.response.data
	});
}

module.exports = plugin;