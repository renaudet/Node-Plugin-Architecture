/*
 * plugin.js - Generic compiler and execution engine service for NPA
 * Copyright 2025 Nicolas Renaudet - All rights reserved
 */

const Plugin = require('../../core/plugin.js');
const GenericCompiler = require('./genericCompiler.js');
const ExecutionEngine = require('./executionEngine.js');

var plugin = new Plugin();

/*
 * Build a logger adapter that routes all compiler/engine output
 * through the NPA logging service by wrapping the plugin's own
 * info/debug/trace/error/warning/canLog methods one-to-one.
 */
plugin._npaLoggerConfig = function(){
	let self = this;
	return {
		info:    function(txt){ self.info(txt); },
		debug:   function(txt){ self.debug(txt); },
		trace:   function(txt){ self.trace(txt); },
		error:   function(txt){ self.error(txt); },
		warning: function(txt){ self.warning(txt); },
		canLog:  function(level){ return self.canLog(level); }
	};
};

/*
 * Compile a source string using the given grammar configuration.
 *
 * @param {string}  source        - the source code to compile
 * @param {object}  grammarConfig - a full grammar configuration object
 *                                  (same format as compilerConfig_vX.Y.Z.json)
 * @returns {ExecutionUnit|null}  - the compiled execution unit tree, or null on error
 */
plugin.compile = function(source, grammarConfig){
	this.trace('->npa.compiler#compile()');
	let cfg = Object.assign({}, grammarConfig, { logging: this._npaLoggerConfig() });
	let compiler = new GenericCompiler(cfg);
	let eu = compiler.compile(source);
	if(!eu){
		this.error('npa.compiler#compile() - compilation failed for grammar "'+grammarConfig.grammar.name+'"');
		this.trace('<-npa.compiler#compile() - failure');
		return { eu: null, error: compiler.lastError || 'compilation failed' };
	}
	this.trace('<-npa.compiler#compile()');
	return { eu: eu, error: null };
};

/*
 * Execute a previously compiled ExecutionUnit.
 *
 * @param {ExecutionUnit} eu           - the compiled execution unit (result of compile())
 * @param {object}        builtins     - map of built-in functions to expose to the program.
 *                                       Each entry is either:
 *                                         { name: fn }                       for a sync built-in
 *                                         { name: { fn: fn, async: true } }  for an async built-in
 * @param {object}        enginePlugin - the language runtime plugin instance
 *                                       (must implement process(), callFunction(), halt())
 * @param {object}        [context]    - optional map of variable name → initial value to
 *                                       pre-store in the engine memory space before execution.
 *                                       These become top-level variables accessible by name
 *                                       in the script (e.g. { request: reqObj, response: {} }).
 * @returns {{ success: boolean, error: string|null, memorySpace: object }}
 */
plugin.execute = function(eu, builtins, enginePlugin, context){
	this.trace('->npa.compiler#execute()');
	let engine = new ExecutionEngine({ logging: this._npaLoggerConfig() });
	engine.registerPlugin(enginePlugin);
	if(builtins){
		for(var name in builtins){
			let entry = builtins[name];
			if(typeof entry === 'function'){
				engine.rfc(name, entry, false);
			}else{
				engine.rfc(name, entry.fn, entry.async === true);
			}
		}
	}
	if(context){
		for(var varName in context){
			engine.sto(varName, context[varName]);
		}
	}
	engine.process(eu);
	// Capture the memory space BEFORE reset() clears it.
	// For sync execution (_pendingCallbacks === 0), reset() was not called inside process()
	// so memorySpace still contains all variable values here.
	let snapshot = Object.assign({}, engine.memorySpace);
	if(engine._pendingCallbacks === 0){
		engine.reset();
	}
	let result;
	if(engine.haltFlagRaised){
		this.error('npa.compiler#execute() - execution halted: '+engine.haltMsg);
		result = { success: false, error: engine.haltMsg, memorySpace: snapshot };
	}else{
		result = { success: true, error: null, memorySpace: snapshot };
	}
	this.trace('<-npa.compiler#execute()');
	return result;
};

/*
 * Convenience method: compile + execute in a single call.
 *
 * @param {string}  source        - the source code to run
 * @param {object}  grammarConfig - a full grammar configuration object
 * @param {object}  builtins      - map of built-in functions (see execute())
 * @param {object}  enginePlugin  - the language runtime plugin instance
 * @param {object}  [context]     - optional initial variable context (see execute())
 * @returns {{ success: boolean, error: string|null, memorySpace: object }}
 */
plugin.run = function(source, grammarConfig, builtins, enginePlugin, context){
	this.trace('->npa.compiler#run()');
	let compileResult = this.compile(source, grammarConfig);
	if(!compileResult.eu){
		this.trace('<-npa.compiler#run() - compilation failed');
		return { success: false, error: compileResult.error, memorySpace: {} };
	}
	let result = this.execute(compileResult.eu, builtins, enginePlugin, context);
	this.trace('<-npa.compiler#run()');
	return result;
};

module.exports = plugin;
