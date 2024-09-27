/*
 * plugin.js - REST client provider for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const axios = require('axios');
const https = require('https');

var plugin = new Plugin();
plugin.agent = new https.Agent({
 rejectUnauthorized: false
});

/*
 * restContext:
  {
	"host": string,
	"port": (optional)integer,
	"uri": string,
	"secured": boolean,
	"acceptCertificate": boolean
	"username": (optional)string,
	"password": (optional)string,
	"method": GET/PUT/POST/DELETE,
	"payload": (optional)json,
	"options": {
		headers: {
          "Content-Type": "multipart/form-data"
       }
	}
  }
 */
plugin.performRestApiCall = function(restContext,onRestInvocationCompletedCallback){
	var port = typeof restContext.port!='undefined'?':'+restContext.port:'';
	var url = (restContext.secured?'https://':'http://')+restContext.host+port+restContext.uri;
	this.debug('url: '+url);
	this.debug('method: '+restContext.method);
	restContext.url = url;
	if(typeof restContext.options=='undefined'){
		restContext.options = {};
	}
	if(restContext.secured && restContext.acceptCertificate){
		restContext.options.httpsAgent = this.agent;
	}
	if(typeof restContext.username!='undefined' && restContext.username.length>0){
		restContext.options.auth = {"username": restContext.username,"password": restContext.password};
	}
	this.debug('securityContext: '+JSON.stringify(restContext.options.auth));
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
	axios.get(restContext.url,restContext.options)
	.then(function (response) {
		try{
			onRestInvocationCompletedCallback(null,response);
		}catch(e){
			console.log(e);
		}
	})
	.catch(function (error) {
		plugin.error('GET from url: '+restContext.url);
		plugin.error(JSON.stringify(error,null,'\t'));
		onRestInvocationCompletedCallback('REST invocation failed for '+restContext.url,error);//error.response.data
	});
}

plugin.performPostRestApiCall = function(restContext,onRestInvocationCompletedCallback){
	this.debug('payload: '+JSON.stringify(restContext.payload,null,'\t'));
	axios.post(restContext.url,restContext.payload,restContext.options)
	.then(function (response) {
		onRestInvocationCompletedCallback(null,response);
	})
	.catch(function (error) {
		plugin.error('POST from url: '+restContext.url);
		plugin.error(JSON.stringify(error,null,'\t'));
		onRestInvocationCompletedCallback('REST invocation failed for '+restContext.url,error);//error.response.data
	});
}

plugin.performPutRestApiCall = function(restContext,onRestInvocationCompletedCallback){
	this.debug('payload: '+JSON.stringify(restContext.payload,null,'\t'));
	axios.put(restContext.url,restContext.payload,restContext.options)
	.then(function (response) {
		onRestInvocationCompletedCallback(null,response);
	})
	.catch(function (error) {
		plugin.error('PUT from url: '+restContext.url);
		plugin.error(JSON.stringify(error));
		onRestInvocationCompletedCallback('REST invocation failed for '+restContext.url,error);//error.response.data
	});
}

plugin.performDeleteRestApiCall = function(restContext,onRestInvocationCompletedCallback){
	axios.delete(restContext.url,{},restContext.options)
	.then(function (response) {
		onRestInvocationCompletedCallback(null,response);
	})
	.catch(function (error) {
		plugin.error('DELETE from url: '+restContext.url);
		plugin.error(JSON.stringify(error));
		onRestInvocationCompletedCallback('REST invocation failed for '+restContext.url,error);//error.response.data
	});
}

module.exports = plugin;