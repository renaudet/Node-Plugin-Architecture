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

plugin.plug = function(extender,extensionPointConfig){
	if('npa.couchdb.adapter.datasource'==extensionPointConfig.point){
		this.datasources[extensionPointConfig.reference] = extensionPointConfig;
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
		if(typeof ds.environment!='undefined' && typeof ds.environment.username!='undefined' && typeof ds.environment.password!='undefined'){
			url += process.env[ds.environment.username]+':'+process.env[ds.environment.password]+'@';
		}else
		if(typeof ds.username!='undefined' && typeof ds.password!='undefined'){
			url += ds.username+':'+ds.password+'@';
		}
		if(typeof ds.environment!='undefined' && typeof ds.environment.hostname!='undefined'){
			url += process.env[ds.environment.hostname];
		}else{
			url += ds.hostname;
		}
		if(typeof ds.environment!='undefined' && typeof ds.environment.port!='undefined'){
			url += ':'+process.env[ds.environment.port];
		}else
		if(typeof ds.port!='undefined'){
			url += ':'+ds.port;
		}else{
			url += ':5984';
		}
		if(typeof ds.environment!='undefined' && typeof ds.environment.dbname!='undefined'){
			url += '/'+process.env[ds.environment.dbname];
		}else{
			url += '/'+ds.dbname;
		}
		this.baseUrlCache[ds.reference] = url;
		return url;
	}
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
			plugin.error(JSON.stringify(response.data,null,'\t'));
			plugin.debug('<-findByPrimaryKey()');
			callback(response.data.error,null);
		}else{
			plugin.debug('<-findByPrimaryKey()');
			callback(null,response.data);
		}
	})
	.catch(function (error) {
		plugin.error(JSON.stringify(error,null,'\t'));
		plugin.debug('<-findByPrimaryKey()');
		callback(error,null);
	});
}

/*
 * create a record
 */
 plugin.createRecord = function(reference,data,callback){
	this.debug('->createRecord()');
	this.trace('reference: '+reference);
	this.trace('data: '+JSON.stringify(data));
	data.id = uuidv4();
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
			plugin.debug('<-updateRecord()');
			callback(err,null);
		}else{
			var datasource = this.getDatasource(reference);
			var url= this.makeBaseUrl(datasource)+'/'+data.id+"?rev="+record._rev;
			axios.put(url,data)
			.then(function (response) {
				if(response.data.error){
					plugin.error(JSON.stringify(response.data,null,'\t'));
					plugin.debug('<-updateRecord()');
					callback(response.data.error,null);
				}else{
					plugin.debug('<-updateRecord()');
					data._rev = response.data.rev;
					callback(null,data);
				}
			})
			.catch(function (error) {
				plugin.error(JSON.stringify(error,null,'\t'));
				plugin.debug('<-updateRecord()');
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
			var datasource = this.getDatasource(reference);
			var url= this.makeBaseUrl(datasource)+'/'+data.id+"?rev="+record._rev;
			axios.delete(url)
			.then(function (response) {
				if(response.data.error){
					plugin.error(JSON.stringify(response.data,null,'\t'));
					plugin.debug('<-deleteRecord()');
					callback(response.data.error,null);
				}else{
					plugin.debug('<-deleteRecord()');
					callback(null,{ "status": "deleted" });
				}
			})
			.catch(function (error) {
				plugin.error(JSON.stringify(error,null,'\t'));
				plugin.debug('<-deleteRecord()');
				callback(error,null);
			});
		}
	});
}

module.exports = plugin;