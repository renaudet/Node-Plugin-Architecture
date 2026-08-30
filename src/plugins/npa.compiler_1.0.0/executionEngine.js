/*
 * executionEngine.js - a generic executionEngine for processing compiled ExecutionUnits
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 *
 * NPA build — Logger delegates to the NPA logging service via a { log, canLog } adapter
 * injected at construction time by plugin.js.
 */

/*
 * Logger — thin delegating wrapper.
 * config must be { info, debug, trace, error, warning, canLog }
 * supplied by npa.compiler#_npaLoggerConfig() so all output goes through npa.logging.
 */
class Logger {
	constructor(config={}){
		let noop = function(){};
		this._info    = (config && config.info)    || noop;
		this._debug   = (config && config.debug)   || noop;
		this._trace   = (config && config.trace)   || noop;
		this._error   = (config && config.error)   || noop;
		this._warning = (config && config.warning) || noop;
		this._canLog  = (config && config.canLog)  || function(){ return false; };
	}
	canLog(level){ return this._canLog(level); }
	info(txt)   { this._info(txt); }
	trace(txt)  { this._trace(txt); }
	debug(txt)  { this._debug(txt); }
	error(txt)  { this._error(txt); }
	warning(txt){ this._warning(txt); }
}

class ExecutionEngine extends Logger{
	plugins = {};
	memorySpace = {};
	functionSpace = {};
	namespaceStack = [''];
	haltFlagRaised = false;
	haltMsg = '';
	selectedPlugin = null;
	callStack = [];
	_pendingCallbacks = 0;   // number of async built-in callbacks still in flight
	constructor(configuration){
		super(configuration.logging);
	}
	registerPlugin(plugin){
		this.plugins[plugin.grammar.name] = plugin;
	}
	reset(){
		this.debug('->ExecutionEngine#reset()');
		this.namespaceStack = [''];
		this.memorySpace = {};
		this.haltFlagRaised = false;
		this.haltMsg = '';
		this.selectedPlugin = null;
		this.callStack = [];
		this._pendingCallbacks = 0;
		this.debug('<-ExecutionEngine#reset()');
	}
	process(executionUnit){
		this.debug('->ExecutionEngine#process()');
		if(executionUnit && this.canLog('debug')){
			executionUnit.dumpToConsole();
		}
		this.selectedPlugin = this.plugins[executionUnit.grammar.name];
		if(this.selectedPlugin){
			this.trace('found helper plugin for grammar "'+executionUnit.grammar.name+'" with release number '+this.selectedPlugin.grammar.version);
			this.selectedPlugin.process(executionUnit,this);
			if(this.haltFlagRaised){
				this.error('execution aborted!');
				this.error('cause: '+this.haltMsg);
			}else if(this._pendingCallbacks===0){
				// No async callbacks in flight — safe to reset immediately
				this.reset();
			}
			// If _pendingCallbacks > 0, reset() will be called by _onCallbackDone()
			// once the last callback has fired.
		}else{
			this.error('unknown source type "'+executionUnit.grammar.name+'"');
		}
		this.debug('<-ExecutionEngine#process()');
	}
	pushStack(operationName){
		this.trace('pushing '+operationName+' in the call stack');
		this.callStack.push(operationName);
	}
	popStack(){
		if(!this.haltFlagRaised){
			this.trace('poping the call stack one level');
			this.callStack.pop();
		}
	}
	sto(identifier,value){
		if(!this.haltFlagRaised){
			this.debug('->ExecutionEngine#sto('+identifier+','+value+')');
			let namespace = this.namespaceStack[this.namespaceStack.length-1];
			let key = namespace+'.'+identifier;
			this.trace('global key is '+key);
			this.memorySpace[key] = value;
			this.debug('<-ExecutionEngine#sto()');
		}
	}
	memoryLookup(key,level){
		let value = null;
		if(!this.haltFlagRaised){
			this.debug('->ExecutionEngine#memoryLookup('+key+','+level+')');
			if(level>=0){
				if(level<this.namespaceStack.length){
					let namespace = this.namespaceStack[level];
					let memoryKey = namespace+'.'+key;
					this.trace('lookup key: '+memoryKey);
					value = this.memorySpace[memoryKey];
					if(typeof value!='undefined'){
						this.trace('found value: '+value);
					}else{
						value = this.memoryLookup(key,level-1);
					}
				}else{
					this.halt('stack overflow');
				}
			}else{
				this.halt('unknown identifier "'+key+'"!');
				this.dumpMemory();
			}
			this.debug('<-ExecutionEngine#memoryLookup()');
		}
		return value;
	}
	rcl(identifier){
		this.debug('->ExecutionEngine#rcl('+identifier+')');
		this.debug('<-ExecutionEngine#rcl()');
		return this.memoryLookup(identifier,this.namespaceStack.length-1);
	}
	rfc(identifier,functionPtr,isAsync=false){
		if(!this.haltFlagRaised){
			this.debug('->ExecutionEngine#rfc('+identifier+')');
			this.functionSpace['_builtIn.'+identifier] = { fn: functionPtr, async: isAsync };
			this.debug('<-ExecutionEngine#rfc()');
		}
	}
	dcl(identifier,executionUnit){
		if(!this.haltFlagRaised){
			this.debug('->ExecutionEngine#dcl('+identifier+')');
			this.functionSpace[identifier] = executionUnit;
			this.debug('<-ExecutionEngine#dcl()');
		}
	}
	push(namespace){
		if(!this.haltFlagRaised){
			this.debug('->ExecutionEngine#push('+namespace+')');
			this.namespaceStack.push(namespace);
			this.debug('<-ExecutionEngine#push()');
		}
	}
	pop(){
		if(!this.haltFlagRaised){
			this.debug('->ExecutionEngine#pop()');
			this.namespaceStack.pop();
			this.debug('<-ExecutionEngine#pop()');
		}
	}
	_onCallbackDone(){
		this._pendingCallbacks--;
		this.debug('ExecutionEngine: pending callbacks -> '+this._pendingCallbacks);
		if(this._pendingCallbacks===0 && !this.haltFlagRaised){
			this.reset();
		}
	}
	cal(identifier,args){
		let returnValue = true;
		if(!this.haltFlagRaised){
			this.debug('->ExecutionEngine#cal('+identifier+')');
			for(var i=0;i<args.length;i++){
				this.trace('argument: '+args[i]);
			}
			let builtInEntry = this.functionSpace['_builtIn.'+identifier];
			if(builtInEntry){
				if(builtInEntry.async){
					// Async built-in: last arg is the callback function name (string).
					// Build a native JS wrapper that will invoke engine.cal(callbackName, ...)
					// when the built-in eventually finishes its I/O.
					// Return immediately — the engine continues to the next instruction.
					let callbackName = args[args.length-1];
					let passArgs     = args.slice(0,-1);
					let self         = this;
					this._pendingCallbacks++;
					let nativeCallback = function(){
						let cbArgs = Array.prototype.slice.call(arguments);
						self.cal(callbackName,cbArgs);
						self._onCallbackDone();
					};
					this.trace('async built-in call to '+identifier+'() with callback "'+callbackName+'"');
					builtInEntry.fn(passArgs.concat([nativeCallback]));
					// returnValue stays true — no synchronous result
				}else{
					this.trace('delegating call to registered built-in function');
					this.pushStack(identifier+'()');
					returnValue = builtInEntry.fn(args);
					this.popStack();
				}
			}else{
				let euPtr = this.functionSpace[identifier];
				if(euPtr){
					if(this.canLog('debug')){
						euPtr.dumpToConsole();
					}
					this.push(identifier);
					if(this.selectedPlugin){
						this.pushStack(identifier+'()');
						returnValue = this.selectedPlugin.callFunction(euPtr,args,this);
						this.popStack();
					}else{
						this.halt('unknown source type "'+euPtr.grammar.name+'" for function '+identifier);
					}
					this.pop();
				}else{
					this.halt('call to undefined function "'+identifier+'"!');
				}
			}
			this.debug('<-ExecutionEngine#cal()');
		}
		return returnValue;
	}
	halt(msg){
		this.debug('->ExecutionEngine#halt()');
		this.haltFlagRaised = true;
		this.haltMsg = msg;
		if(this.selectedPlugin){
			this.selectedPlugin.halt();
		}
		this.printStackTrace();
		this.debug('<-ExecutionEngine#halt()');
	}
	dumpMemory(){
		this.info('Dumping the ExecutionEngine memory space:');
		for(var key in this.memorySpace){
			let value = this.memorySpace[key];
			this.info('- '+key+': '+value);
		}
	}
	printStackTrace(){
		this.info('Stack trace:');
		for(var i=this.callStack.length-1;i>=0;i--){
			this.info(this.callStack[i]);
		}
	}
}

module.exports = ExecutionEngine;
