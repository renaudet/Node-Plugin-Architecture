/*
 * couchdbSessionStore.js - Session store provider for NPA using CouchDB
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
const Store = require('express-session').Store;
const moment = require('moment');
const SESSION_DATASOURCE_REFERENCE = 'http.sessions';
const DEBUG_MODE = false;

class Queue {
	items = [];
	constructor(){
	}
	push(item){
		this.items.push(item);
		console.log('queue size is now '+this.items.length);
	}
	get(){
		if(this.items.length==0){
			return null;
		}else{
			let newQueue = [];
			let first = this.items[0];
			for(var i=1;i<this.items.length;i++){
				newQueue.push(this.items[i]);
			}
			this.items = newQueue;
			console.log('queue size is now '+this.items.length);
			return first;
		}
	}
	isEmpty(){
		return this.items.length==0;
	}
}

class CouchSessionStore extends Store{
	backend = null;
	sessions = {};
	online = false;
	locks = {};
	queues = {};
	constructor(couchService){
		super();
		this.backend = couchService;
		let factory = this;
		this.backend.checkDatabase(SESSION_DATASOURCE_REFERENCE,function(err,exists){
			if(err){
				console.log('unable to access the session database - working in offline mode');
			}else{
				if(!exists){
					console.log('session database not found - creating...');
					couchService.createDatabase(SESSION_DATASOURCE_REFERENCE,function(err,created){
						if(err){
							console.log('error creating the session database - working in offline mode');
							console.log(err);
						}else{
							console.log('session database created - working in online mode');
							factory.online = true;
						}
					});
				}else{
					console.log('session database found - working in online mode');
					factory.online = true;
				}
			}
		});
	}
	destroy(sid, callback){
		if(DEBUG_MODE) console.log('Factory#destroy('+sid+')');
		let factory = this;
		if(this.online){
			delete this.queues[sid];
			this.backend.deleteRecord(SESSION_DATASOURCE_REFERENCE,{"id": sid},function(err,data){
				delete factory.sessions[sid];
				if(err){
					if(typeof callback!='undefined'){
						callback(err);
					}
				}else{
					if(typeof callback!='undefined'){
						callback(null);
					}
				}
			});
		}else{
			delete this.sessions[sid];
			if(typeof callback!='undefined'){
				callback(null);
			}
		}
	}
	all(callback){
		if(DEBUG_MODE) console.log('Factory#all() online='+this.online);
		if(this.online){
			this.backend.query(SESSION_DATASOURCE_REFERENCE,{},function(err,records){
				if(err){
					callback(err,null);
				}else{
					var sessions = {};
					for(var i=0;i<records.length;i++){
						let sessionRecord = records[i];
						sessions[sessionRecord.id] = sessionRecord.data;
					}
					callback(null,sessions);
				}
			});
		}else{
			callback(null,this.sessions);
		}
	}
	get(sid, callback){
		if(DEBUG_MODE) console.log('Factory#get('+sid+')');
		/*if(typeof this.sessions[sid]!='undefined'){
			if(DEBUG_MODE) console.log('returning session from cache');
			callback(null, this.sessions[sid]);
		}else{
			if(this.online){
				let factory = this;
				this.lookupSessionRecord(sid,function(err,sessionRecord){
					if(err){
						callback(err,null);
					}else{
						if(sessionRecord){
							factory.sessions[sid] = sessionRecord.data;
							callback(null,sessionRecord.data);
						}else{
							callback(null, null);
						}
					}
				});
			}else{
				callback(null, null);
			}
		}*/
		if(this.online){
			//get the queue
			let queue = this.queues[sid];
			if(typeof queue=='undefined'){
				this.queues[sid] = new Queue();
				queue = this.queues[sid];
			}
			if(queue.isEmpty()){
				queue.push(callback);
				let factory = this;
				console.log('lookupSessionRecord('+sid+')');
				this.lookupSessionRecord(sid,function(err,sessionRecord){
					if(err || sessionRecord==null){
						let unQueue = function(){
							let callbackFctn = queue.get();
							if(callbackFctn!=null){
								if(err){
									callbackFctn(err,null);
								}else{
									callbackFctn(null, null);
								}
								unQueue();
							}
						}
						unQueue();
					}else{
						//factory.sessions[sid] = sessionRecord.data;
						let unQueue = function(){
							let callbackFctn = queue.get();
							if(callbackFctn!=null){
								callbackFctn(null,sessionRecord.data);
								unQueue();
							}
						}
						setTimeout(function(){ unQueue(); },20);
					}
				});
			}else{
				queue.push(callback);
			}
		}else{
			if(typeof this.sessions[sid]!='undefined'){
				callback(null, this.sessions[sid]);
			}else{
				callback(null, null);
			}
		}
	}
	lookupSessionRecord(sid,then){
		if(DEBUG_MODE) console.log('lookupSessionRecord('+sid+')');
		this.backend.findByPrimaryKey(SESSION_DATASOURCE_REFERENCE,{"id": sid},function(err,record){
			if(err){
				then(err,null);
			}else{
				if(typeof record!='undefined' && record!=null){
					then(null,record);
				}else{
					then(null,null);
				}
			}
		});
	}
	set(sid, session, callback){
		if(DEBUG_MODE) console.log('Factory#set('+sid+') online='+this.online);
		if(this.online){
			if(typeof this.locks[sid]=='undefined'){
				this.locks[sid] = true;
				let factory = this;
				this.lookupSessionRecord(sid,function(err,record){
					if(err){
						if(DEBUG_MODE) console.log('unable to access session ID#'+sid);
						if(DEBUG_MODE) console.log('error is '+JSON.stringify(err,null,'\t'));
						delete factory.locks[sid];
						callback(err);
					}else{
						if(record==null){
							if(DEBUG_MODE) console.log('session is new - creating');
							factory.backend.createRecord(SESSION_DATASOURCE_REFERENCE,{"id": sid,"data": session},function(err,record){
								if(err){
									if(DEBUG_MODE) console.log('unable to save session ID#'+sid);
									if(DEBUG_MODE) console.log('error is '+err);
									delete factory.locks[sid];
									callback(err);
								}else{
									factory.sessions[sid] = session;
									delete factory.locks[sid];
									callback(null);
								}
							});
						}else{
							if(DEBUG_MODE) console.log('session found - updating');
							record.data = session;
							record.created = moment();
							factory.backend.updateRecord(SESSION_DATASOURCE_REFERENCE,record,function(err2,updatedRecord){
								if(err2){
									if(DEBUG_MODE) console.log('unable to update session ID#'+sid);
									delete factory.locks[sid];
									callback(null);
								}else{
									factory.sessions[sid] = session;
									delete factory.locks[sid];
									callback(null);
								}
							});
						}
					}
				});
			}else{
				//lock set - skipping
				callback(null);
			}
		}else{
			this.sessions[sid] = session;
			callback(null);
		}
	}
	length(callback){
		if(DEBUG_MODE) console.log('Factory#length()');
		let count = 0;
		for(id in this.sessions){
			count++;
		}
		if(DEBUG_MODE) console.log('returning count='+count);
		callback(null,count);
	}
}
 
module.exports = CouchSessionStore;