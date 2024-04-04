/*
 * plugin.js - CouchDB adapter for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const PROTOCOL = 'http://';

var plugin = new Plugin();
plugin.datasources = {};
plugin.baseUrlCache = {};

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	if('npa.couchdb.adapter.datasource'==extensionPointConfig.point){
		this.registerDatasource(extensionPointConfig);
	}
}

plugin.registerDatasource = function(datasourceDef){
	this.debug('registering new datasource "'+datasourceDef.reference+'"');
	this.debug(JSON.stringify(datasourceDef,null,'\t'));
	this.datasources[datasourceDef.reference] = datasourceDef;
}

plugin.unregisterDatasource = function(dsReference){
	this.debug('unregistering datasource "'+dsReference+'"');
	delete this.datasources[dsReference];
	if(typeof this.baseUrlCache[dsReference]!='undefined'){
		delete this.baseUrlCache[dsReference];
	}
}

plugin.getDatasource = function(ref){
	if(typeof this.datasources[ref]!='undefined'){
		return this.datasources[ref];
	}else{
		throw new Error('Unknown datasource reference "'+ref+'"');
	}
}

plugin.makeBaseUrl = function(ds){
	if(typeof this.baseUrlCache[ds.reference]!='undefined'){
		return this.baseUrlCache[ds.reference];
	}else{
		var url = PROTOCOL;
		if(typeof ds.environment!='undefined' && 
		   typeof ds.environment.username!='undefined' && 
		   typeof process.env[ds.environment.username]!='undefined' && 
		   typeof ds.environment.password!='undefined' && 
		   typeof process.env[ds.environment.password]!='undefined'){
			url += process.env[ds.environment.username]+':'+process.env[ds.environment.password]+'@';
		}else
		if(typeof ds.username!='undefined' && typeof ds.password!='undefined'){
			url += ds.username+':'+ds.password+'@';
		}
		if(typeof ds.environment!='undefined' && 
		   typeof ds.environment.hostname!='undefined' &&
		   typeof process.env[ds.environment.hostname]!='undefined'){
			url += process.env[ds.environment.hostname];
		}else{
			url += ds.hostname;
		}
		if(typeof ds.environment!='undefined' && 
		   typeof ds.environment.port!='undefined' &&
		   typeof process.env[ds.environment.port]!='undefined'){
			url += ':'+process.env[ds.environment.port];
		}else
		if(typeof ds.port!='undefined'){
			url += ':'+ds.port;
		}else{
			url += ':5984';
		}
		if(typeof ds.environment!='undefined' && 
		   typeof ds.environment.dbname!='undefined' && 
		   typeof process.env[ds.environment.dbname]!='undefined'){
			url += '/'+process.env[ds.environment.dbname];
		}else{
			url += '/'+ds.dbname;
		}
		this.baseUrlCache[ds.reference] = url;
		return url;
	}
}

/*
 * Check if Couch Database exists
 */
plugin.checkDatabase = function(reference,callback){
	this.debug('->checkDatabase()');
	this.trace('reference: '+reference);
	var datasource = this.getDatasource(reference);
	var url= this.makeBaseUrl(datasource);
	axios.get(url)
	.then(function (response) {
		var result = response.data;
		if(result && result.error){
			plugin.debug('result contains an error: '+result.error);
			plugin.debug('<-checkDatabase()');
			callback(null,false);
		}else{
			plugin.debug('<-checkDatabase()');
			callback(null,true);
		}
	})
	.catch(function (error) {
		plugin.debug('axios returned an error!');
		if(error.response && error.response.data){
			if('not_found'==error.response.data.error){
				plugin.debug('<-checkDatabase()');
				callback(null,false);
			}else{
				plugin.debug('error.response.data:');
				plugin.debug(JSON.stringify(error.response.data));
				plugin.debug('<-checkDatabase()');
				callback(error.response.data,false);
			}
		}else{
			plugin.debug('error:');
			plugin.debug(JSON.stringify(error));
			plugin.debug('<-checkDatabase()');
			callback(error,false);
		}
	});
}

/*
 * Create Couch database
 */
plugin.createDatabase = function(reference,callback){
	this.debug('->createDatabase()');
	this.trace('reference: '+reference);
	var datasource = this.getDatasource(reference);
	var url= this.makeBaseUrl(datasource);
	axios.put(url, {})
	.then(function (response) {
		var result = response.data;
		if(result && result.error){
			plugin.debug('<-createDatabase()');
			callback(result.error,false);
		}else{
			plugin.debug('<-createDatabase()');
			callback(null,true);
		}
	})
	.catch(function (error) {
		if(error.response && error.response.data){
			plugin.debug('<-createDatabase()');
			callback(error.response.data,false);
		}else{
			plugin.debug('<-createDatabase()');
			callback(error,false);
		}
	});
}


/*
 * Query Database for documents - uses CouchDB Query language
 * Returns and array of docs
 */
plugin.query = function(reference,query,callback){
	this.debug('->query()');
	this.trace('reference: '+reference);
	var datasource = this.getDatasource(reference);
	var url= this.makeBaseUrl(datasource)+'/_find';
	if(!query.limit){
		query.limit = datasource.maxPageSize;
	}
	if(!query.selector){
		query.selector = {};
	}
	this.trace('query: '+JSON.stringify(query));
	axios.post(url, query, {
        headers: {
            'Content-Type': 'application/json'
    }})
	.then(function (response) {
		plugin.debug('<-query()');
		callback(null,response.data.docs);
	})
	.catch(function (error) {
		console.log(error);
		if(error.response){
			plugin.error(JSON.stringify(error.response.data,null,'\t'));
			plugin.debug('<-query()');
			callback('Internal error: '+error.response.data.reason,null);
		}else{
			plugin.error(JSON.stringify(error,null,'\t'));
			plugin.debug('<-query()');
			callback('Internal error: CouchDB process not reachable',null);
		}
	});
}

/*
 * Read a database record given its uinique ID
 */
plugin.findByPrimaryKey = function(reference,data,callback){
	this.debug('->findByPrimaryKey()');
	this.trace('reference: '+reference);
	this.trace('data: '+JSON.stringify(data));
	var datasource = this.getDatasource(reference);
	var url= this.makeBaseUrl(datasource)+'/'+data.id;
	axios.get(url)
	.then(function (response) {
		if(response.data.error){
			console.log('then');
			console.log(response);
			plugin.error(JSON.stringify(response.data,null,'\t'));
			plugin.debug('<-findByPrimaryKey()');
			callback(response.data.error,null);
		}else{
			plugin.debug('<-findByPrimaryKey()');
			callback(null,response.data);
		}
	})
	.catch(function (error) {
		if(error && error.response && error.response.status==404){
			plugin.debug('<-findByPrimaryKey()');
			callback(null,null);
		}else{
			console.log('catch');
			console.log(error);
			plugin.error(JSON.stringify(error,null,'\t'));
			plugin.debug('<-findByPrimaryKey()');
			callback(error,null);
		}
	});
}

/*
 * create a record
 */
 plugin.createRecord = function(reference,data,callback){
	this.debug('->createRecord()');
	this.trace('reference: '+reference);
	this.trace('data: '+JSON.stringify(data));
	if(typeof data.id=='undefined'){
		data.id = uuidv4();
	}
	var datasource = this.getDatasource(reference);
	var url= this.makeBaseUrl(datasource)+'/'+data.id;
	axios.put(url,data)
	.then(function (response) {
		if(response.data.error){
			plugin.error(JSON.stringify(response.data,null,'\t'));
			plugin.debug('<-createRecord()');
			callback(response.data.error,null);
		}else{
			plugin.debug('<-createRecord()');
			data._rev = response.data.rev;
			callback(null,data);
		}
	})
	.catch(function (error) {
		plugin.error(JSON.stringify(error,null,'\t'));
		plugin.debug('<-createRecord()');
		callback(error,null);
	});
}

/*
 * update an existing record
 */
 plugin.updateRecord = function(reference,data,callback){
	this.debug('->updateRecord()');
	this.trace('reference: '+reference);
	this.trace('data: '+JSON.stringify(data));
	this.findByPrimaryKey(reference,data,function(err,record){
		if(err){
			plugin.error(JSON.stringify(err,null,'\t'));
			plugin.debug('<-updateRecord() findByPrimaryKey');
			callback(err,null);
		}else{
			var datasource = plugin.getDatasource(reference);
			var url= plugin.makeBaseUrl(datasource)+'/'+data.id+"?rev="+record._rev;
			axios.put(url,data)
			.then(function (response) {
				if(response.data.error){
					plugin.debug('<-updateRecord() response.data.error');
					plugin.error(JSON.stringify(response.data,null,'\t'));
					callback(response.data.error,null);
				}else{
					plugin.debug('<-updateRecord() success');
					data._rev = response.data.rev;
					callback(null,data);
				}
			})
			.catch(function (error) {
				plugin.error(JSON.stringify(error,null,'\t'));
				plugin.debug('<-updateRecord() catch');
				callback(error,null);
			});
		}
	});
}

/*
 * delete an existing record
 */
 plugin.deleteRecord = function(reference,data,callback){
	this.debug('->deleteRecord()');
	this.trace('reference: '+reference);
	this.trace('data: '+JSON.stringify(data));
	this.findByPrimaryKey(reference,data,function(err,record){
		if(err){
			plugin.error(JSON.stringify(err,null,'\t'));
			plugin.debug('<-deleteRecord()');
			callback(err,null);
		}else{
			if(record!=null){
				var datasource = plugin.getDatasource(reference);
				var url= plugin.makeBaseUrl(datasource)+'/'+data.id+"?rev="+record._rev;
				axios.delete(url)
				.then(function (response) {
					if(response.data.error){
						plugin.error(JSON.stringify(response.data,null,'\t'));
						plugin.debug('<-deleteRecord()');
						callback(response.data.error,null);
					}else{
						plugin.debug('<-deleteRecord()');
						callback(null,{"status": "deleted","record":record });
					}
				})
				.catch(function (error) {
					plugin.error(JSON.stringify(error,null,'\t'));
					plugin.debug('<-deleteRecord()');
					callback(error,null);
				});
			}else{
				callback(null,{"status": "not found","record":record });
			}
		}
	});
}

module.exports = plugin;