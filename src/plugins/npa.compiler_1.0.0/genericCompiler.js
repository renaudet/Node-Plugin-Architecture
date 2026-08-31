/*
 * genericCompiler.js - a generic rule-based compiler
 * Copyright 2024 Nicolas Renaudet - All rights reserved
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

const UNKNOWN_TYPE = 0;
const CHECK_RESULT_SUCCESS = 'success';
const CHECK_RESULT_FAILURE = 'failure';

class CompilationToken {
	type = UNKNOWN_TYPE;
	buffer = null;
	line = 0;
	char = 0;
	constructor(type,value,lineNumber,charInLine){
		this.type = type;
		this.buffer = value;
		this.line = lineNumber;
		this.char = charInLine
	}
	getValue(){
		return this.buffer;
	}
	toString(){
		return '['+this.line+','+this.char+'] type = '+this.type+' value = >'+this.getValue().replace(/\t/,'\\t').replace(/\r/,'\\r').replace(/\n/,'\\n')+'<';
	}
}

class TokenizerRuleHelper extends Logger{
	name = null;
	config = null;
	tokenizer = null;
	validated = false;
	buffer = '';
	canAcceptMore = true;
	priority = 0;
	constructor(configuration,tokenizer){
		super(configuration.logging);
		this.name = configuration.rule.name;
		this.config = configuration.rule;
		this.tokenizer = tokenizer;
		this.priority = configuration.rule.priority;
	}
	createToken(line,char){
		return new CompilationToken(this.name,this.buffer,line,char);
	}
	reset(){
		this.validated = false;
		this.buffer = '';
		this.canAcceptMore = true;
	}
	accept(char){
		if(!this.canAcceptMore){
			return false;
		}else{
			if('FIXED_CHAR'==this.config.type){
				if(this.config.value==char){
					this.buffer += char;
					this.canAcceptMore = false;
					this.validated = true;
					return true;
				}
				this.canAcceptMore = false;
				return false;
			}
			if('FIXED_VALUE'==this.config.type){
				if(this.buffer.length==0){
					for(var i=0;i<this.config.values.length;i++){
						let value = this.config.values[i];
						if(value.startsWith(char)){
							this.buffer += char;
							if(value==this.buffer){
								this.validated = true;
							}
							return true;
						}
					}
					this.canAcceptMore = false;
				}else{
					let tmpBuffer = this.buffer.slice(0);
					tmpBuffer += char;
					for(var i=0;i<this.config.values.length;i++){
						let value = this.config.values[i];
						if(value.startsWith(tmpBuffer)){
							this.buffer += char;
							if(value==this.buffer){
								this.validated = true;
							}
							return true;
						}
					}
					this.canAcceptMore = false;
					return false;
				}
			}
			if('SEQUENCE'==this.config.type){
				if(this.buffer.length==0){
					if(this.config.startsWith){
						if(this.config.startsWith.indexOf(char)>=0){
							this.buffer += char;
							return true;
						}else{
							this.canAcceptMore = false;
							return false;
						}
					}else{
						if(this.config.allowedChars){
							if(this.config.allowedChars.indexOf(char)>=0){
								this.buffer += char;
								if(this.config.validator){
									let toEval = this.config.validator.replace(/@/,this.buffer);
									this.trace(this.name+': validator rule found: '+toEval);
									try{
										this.validated = eval(toEval);
										this.trace('validator rule check: '+this.validated);
									}catch(evalException){
										this.validated = false;
										this.canAcceptMore = false;
									}
								}else{
									this.validated = true;
								}
								return true;
							}else{
								this.canAcceptMore = false;
								this.validated = false;
								return false;
							}
						}else{
							this.buffer += char;
							this.validated = true;
							return true;
						}
					}
				}else{
					if(this.config.endsWith){
						if(this.config.endsWith.indexOf(char)>=0){
							this.buffer += char;
							this.canAcceptMore = false;
							if(this.config.validator){
								let toEval = this.config.validator.replace(/@/,this.buffer);
								this.trace(this.name+': validator rule found: '+toEval);
								try{
									this.validated = eval(toEval);
									this.trace('validator rule check: '+this.validated);
								}catch(evalException){
									this.validated = false;
								}
							}else{
								this.validated = true;
							}
							return true;
						}
					}
					if(this.config.allowedChars){
						if(this.config.allowedChars.indexOf(char)>=0){
							this.buffer += char;
							if(this.config.validator){
								let toEval = this.config.validator.replace(/@/,this.buffer);
								this.trace(this.name+': validator rule found: '+toEval);
								try{
									this.validated = eval(toEval);
									this.trace('validator rule check: '+this.validated);
								}catch(evalException){
									this.validated = false;
									this.canAcceptMore = false;
								}
							}else{
								if(!this.config.endsWith){
									this.validated = true;
								}
							}
							return true;
						}else{
							this.canAcceptMore = false;
							if(this.config.validator){
								let toEval = this.config.validator.replace(/@/,this.buffer);
								this.trace(this.name+': validator rule found: '+toEval);
								try{
									this.validated = eval(toEval);
									this.trace('validator rule check: '+this.validated);
								}catch(evalException){
									this.validated = false;
									this.canAcceptMore = false;
								}
							}else{
								this.validated = true;
							}
							return false;
						}
					}else{
						this.buffer += char;
						this.validated = true;
						return true;
					}
				}
			}
			return false;
		}
	}
	dump(){
		this.trace('['+this.name+'] validated: '+this.validated+' canAcceptMore: '+this.canAcceptMore+' buffer: >'+this.buffer.replace(/\r/,'\\r').replace(/\n/,'\\n')+'<');
	}
}

class Tokenizer extends Logger{
	config = null;
	rules = [];
	status = {"returnCode": 0,"message": ""};
	constructor(configuration){
		super(configuration.logging);
		this.config = configuration;
		this.loadRules();
	}
	loadRules(){
		this.debug('->Tokenizer#loadRules()');
		this.trace('dumping tokenizer configuration:\n'+JSON.stringify(this.config,null,'\t'));
		for(var i=0;i<this.config.rules.length;i++){
			let ruleConfig = this.config.rules[i];
			this.trace('loading new TokenizerRuleHelper "'+ruleConfig.name+'"');
			let tokenizationRule = new TokenizerRuleHelper({"rule": ruleConfig,"logging": this.config.logging},this);
			this.rules.push(tokenizationRule);
		}
		this.debug('<-Tokenizer#loadRules() - loaded '+this.rules.length+' rule(s)');
	}
	tokenize(src){
		this.debug('->Tokenizer#tokenize()');
		this.resetRules();
		let tokens = [];
		if(src && src.length>0){
			let lineNumber = 1;
			let charPos = 0;
			let syntaxErrorDetected = false;
			for(var charIndex=0;charIndex<src.length && !syntaxErrorDetected;charIndex++){
				let eofReached = (charIndex==src.length-1);
				let currentChar = src.charAt(charIndex);
				charPos++;
				if('\n'==currentChar){
					lineNumber++;
					charPos = 0;
				}
				this.trace('------- processing char >'+currentChar.replace(/\n/,'\\n').replace(/\r/,'\\r')+'< ['+lineNumber+','+charPos+'] -------');
				let acceptedRuleCount = 0;
				for(var rn=0;rn<this.rules.length;rn++){
					let tokenizationRuleHelper = this.rules[rn];
					let accepted = tokenizationRuleHelper.accept(currentChar);
					this.trace('- '+tokenizationRuleHelper.name+' accepted = '+accepted);
					acceptedRuleCount += (accepted?1:0);
				}
				this.dumpRules();
				if(acceptedRuleCount==0 || eofReached){
					this.trace('rule acceptation break detected! eofReached='+eofReached);
					let tokenizationRuleHelperPtr = [];
					for(var rn=0;rn<this.rules.length;rn++){
						let tokenizationRuleHelper = this.rules[rn];
						if(tokenizationRuleHelper.validated){
							this.trace('- '+tokenizationRuleHelper.name+' validated');
							tokenizationRuleHelperPtr.push(tokenizationRuleHelper);
						}
					}
					if(tokenizationRuleHelperPtr.length>0){
						if(tokenizationRuleHelperPtr.length>1){
							for(var i=0;i<tokenizationRuleHelperPtr.length-1;i++){
								let leftPtr = tokenizationRuleHelperPtr[i];
								for(var j=i;j<tokenizationRuleHelperPtr.length;j++){
									let rightPtr = tokenizationRuleHelperPtr[j];
									if(leftPtr.priority<rightPtr.priority){
										let tmpPtr = leftPtr;
										tokenizationRuleHelperPtr[i] = tokenizationRuleHelperPtr[j];
										tokenizationRuleHelperPtr[j] = tmpPtr;
									}
								}
							}
						}
						this.trace('validated rule: '+tokenizationRuleHelperPtr[0].name);
						if(acceptedRuleCount==0){
							charPos--;
							if(charPos<0){
								charPos=0;
							}
							charIndex--;
							if('\n'==currentChar){
								lineNumber--;
							}
							tokens.push(tokenizationRuleHelperPtr[0].createToken(lineNumber,charPos));
							this.resetRules();
						}else{
							tokens.push(tokenizationRuleHelperPtr[0].createToken(lineNumber,charPos));
						}
					}else{
						syntaxErrorDetected = true;
						this.error('stopping tokenization due to syntax error detected. Line is '+lineNumber+' current char is >'+currentChar+'< at position '+charPos);
						this.status.returnCode = -1;
						this.status.message = 'syntax error detected line '+lineNumber+' at position '+charPos;
					}
				}
			}
		}
		this.debug('<-Tokenizer#tokenize() - found '+tokens.length+' tokens');
		return tokens;
	}
	resetRules(){
		for(var rn=0;rn<this.rules.length;rn++){
			let tokenizationRuleHelper = this.rules[rn];
			tokenizationRuleHelper.reset();
		}
		this.status = {"returnCode": 0,"message": ""};
	}
	dumpRules(){
		this.trace('--- dumping rule states begin ---');
		for(var rn=0;rn<this.rules.length;rn++){
			let tokenizationRuleHelper = this.rules[rn];
			tokenizationRuleHelper.dump();
		}
		this.trace('--- dumping rule states end ---');
	}
}

class GenericSyntaxRule {
	config = null;
	analyzer = null;
	constructor(configuration,analyzer){
		this.config = configuration;
		this.analyzer = analyzer;
	}
	info(txt){ this.analyzer.info(txt); }
	trace(txt){ this.analyzer.trace(txt); }
	debug(txt){ this.analyzer.debug(txt); }
	error(txt){ this.analyzer.error(txt); }
	warning(txt){ this.analyzer.warning(txt); }
	getType(){ return this.config.type; }
	getName(){ return 'default'; }
	assess(tokenList,beginIndex){
		this.debug('->GenericSyntaxRule#assess()');
		this.trace('beginIndex = '+beginIndex);
		this.debug('<-GenericSyntaxRule#assess()');
		return {"status": "failure","next": beginIndex};
	}
	dumpRule(){
		return '<unimplemented rule type "'+this.config.type+'">';
	}
}

class GenericTokenEvaluationRule extends GenericSyntaxRule{
	constructor(configuration,analyzer){ super(configuration,analyzer); }
	getName(){ return 'TOKEN'; }
	assess(tokenList,beginIndex){
		this.debug('->GenericTokenEvaluationRule#assess() name='+this.getName());
		this.trace('beginIndex = '+beginIndex);
		this.trace('config = '+JSON.stringify(this.config));
		let returnStatus = {"status": CHECK_RESULT_FAILURE,"next": beginIndex,"depth": 0};
		if(beginIndex<tokenList.length){
			let currentToken = tokenList[beginIndex];
			this.trace('current token: '+currentToken);
			if(this.config.name==currentToken.type){
				if(this.config.value){
					if(currentToken.getValue()==this.config.value){
						this.trace('expected value matches!');
						returnStatus.status=CHECK_RESULT_SUCCESS;
						returnStatus.next = beginIndex+1;
						returnStatus.depth = 1;
						returnStatus.executionUnit = new ExecutionUnit(this.analyzer.getLoggerConfig(),currentToken.type);
						returnStatus.executionUnit.token = currentToken;
						returnStatus.executionUnit.value = currentToken.getValue()
					}
				}else{
					returnStatus.status=CHECK_RESULT_SUCCESS;
					returnStatus.next = beginIndex+1;
					returnStatus.depth = 1;
					returnStatus.executionUnit = new ExecutionUnit(this.analyzer.getLoggerConfig(),currentToken.type);
					returnStatus.executionUnit.token = currentToken;
					returnStatus.executionUnit.value = currentToken.getValue();
				}
			}
			if(returnStatus.status==CHECK_RESULT_FAILURE){
				returnStatus.message = 'not a valid '+this.config.name+' at line '+currentToken.line+', col '+currentToken.char+' (found: "'+currentToken.getValue()+'")';
			}
		}else{
			this.debug('end of token list detected!');
			returnStatus.message = 'unexpected end of file (expected '+this.config.name+(this.config.value?' "'+this.config.value+'"':'')+')';
		}
		this.debug('<-GenericTokenEvaluationRule#assess() - status is '+returnStatus.status);
		return returnStatus;
	}
	dumpRule(){
		if(this.config.value){ return '"'+this.config.value+'"'; }
		return this.config.name;
	}
}

class GenericAndRule extends GenericSyntaxRule{
	constructor(configuration,analyzer){ super(configuration,analyzer); }
	getName(){ return 'AND'; }
	assess(tokenList,beginIndex){
		this.debug('->GenericAndRule#assess()');
		this.trace('tokenList.length = '+tokenList.length);
		this.trace('beginIndex = '+beginIndex);
		let returnStatus = {"status": CHECK_RESULT_SUCCESS,"next": beginIndex,"depth": 0};
		let evaluationResult = true;
		let innerRules = this.config.value['$and'];
		let currentTokenIndex = beginIndex;
		let innerRuleIndex = 0;
		let subEUs = [];
		let accumulatedDepth = 0;
		this.trace('found '+innerRules.length+' inner rules to assess');
		while(evaluationResult && innerRuleIndex<innerRules.length){
			let currentRuleConfig = innerRules[innerRuleIndex];
			this.trace(this.getName()+' - evaluating inner rule type <'+currentRuleConfig.type+'> (index = '+innerRuleIndex+')');
			let ruleAnalyzer = syntaxRuleFactory.getRule(currentRuleConfig,this.analyzer);
			let ruleAnalysisResult = ruleAnalyzer.assess(tokenList,currentTokenIndex);
			if(CHECK_RESULT_SUCCESS==ruleAnalysisResult.status){
				currentTokenIndex = ruleAnalysisResult.next;
				returnStatus.next = currentTokenIndex;
				accumulatedDepth += (ruleAnalysisResult.depth||0);
				subEUs.push(ruleAnalysisResult.executionUnit);
			}else{
				evaluationResult = false;
				returnStatus.status = CHECK_RESULT_FAILURE;
				returnStatus.message = ruleAnalysisResult.message;
				// depth = tokens already validated before this failure + depth of the failing sub-rule
				returnStatus.depth = accumulatedDepth + (ruleAnalysisResult.depth||0);
				currentTokenIndex = beginIndex;
				returnStatus.next = currentTokenIndex;
				this.debug('evaluation failure detected!');
			}
			innerRuleIndex++;
		}
		if(CHECK_RESULT_SUCCESS==returnStatus.status){
			returnStatus.depth = accumulatedDepth;
			let executionUnit = new ExecutionUnit(this.analyzer.getLoggerConfig(),this.getName());
			executionUnit.token = tokenList[beginIndex];
			executionUnit.next = subEUs;
			returnStatus.executionUnit = executionUnit;
		}
		this.debug('<-GenericAndRule#assess()');
		return returnStatus;
	}
	dumpRule(){
		let innerRules = this.config.value['$and'];
		let dumpStr = '( ';
		for(var i=0;i<innerRules.length;i++){
			let ruleConfig = innerRules[i];
			let ruleAnalyzer = syntaxRuleFactory.getRule(ruleConfig,this.analyzer);
			dumpStr += ruleAnalyzer.dumpRule();
			if(i<(innerRules.length-1)){ dumpStr += ' + '; }
		}
		dumpStr += ' )';
		return dumpStr;
	}
}

class GenericOrRule extends GenericSyntaxRule{
	constructor(configuration,analyzer){ super(configuration,analyzer); }
	getName(){ return 'OR'; }
	assess(tokenList,beginIndex){
		this.debug('->GenericOrRule#assess()');
		this.trace('beginIndex = '+beginIndex);
		let returnStatus = {"status": CHECK_RESULT_FAILURE,"next": beginIndex,"depth": 0};
		let evaluationResult = false;
		let innerRules = this.config.value['$or'];
		let innerRuleIndex = 0;
		let bestFailure = null;
		while(!evaluationResult && innerRuleIndex<innerRules.length){
			let currentRuleConfig = innerRules[innerRuleIndex];
			this.trace(this.getName()+' - evaluating inner rule type <'+currentRuleConfig.type+'>');
			let ruleAnalyzer = syntaxRuleFactory.getRule(currentRuleConfig,this.analyzer);
			let ruleAnalysisResult = ruleAnalyzer.assess(tokenList,beginIndex);
			if(CHECK_RESULT_SUCCESS==ruleAnalysisResult.status){
				returnStatus.status = CHECK_RESULT_SUCCESS;
				returnStatus.next = ruleAnalysisResult.next;
				returnStatus.depth = ruleAnalysisResult.depth||0;
				returnStatus.executionUnit = ruleAnalysisResult.executionUnit;
				returnStatus.executionUnit.token = tokenList[beginIndex];
				evaluationResult = true;
			}else{
				// keep track of the deepest failure (most tokens consumed before failing)
				let failureDepth = ruleAnalysisResult.depth||0;
				if(bestFailure===null || failureDepth>bestFailure.depth){
					bestFailure = {"message": ruleAnalysisResult.message,"depth": failureDepth};
				}
			}
			innerRuleIndex++;
		}
		if(CHECK_RESULT_FAILURE==returnStatus.status && bestFailure!==null){
			returnStatus.message = bestFailure.message;
			returnStatus.depth = bestFailure.depth;
		}
		this.debug('<-GenericOrRule#assess()');
		return returnStatus;
	}
	dumpRule(){
		let innerRules = this.config.value['$or'];
		let dumpStr = '( ';
		for(var i=0;i<innerRules.length;i++){
			let ruleConfig = innerRules[i];
			let ruleAnalyzer = syntaxRuleFactory.getRule(ruleConfig,this.analyzer);
			dumpStr += ruleAnalyzer.dumpRule();
			if(i<(innerRules.length-1)){ dumpStr += ' | '; }
		}
		dumpStr += ' )';
		return dumpStr;
	}
}

class GenericRuleReferenceRule extends GenericSyntaxRule{
	constructor(configuration,analyzer){ super(configuration,analyzer); }
	getName(){ return 'RULE'; }
	assess(tokenList,beginIndex){
		this.debug('->GenericRuleReferenceRule#assess()');
		this.trace('beginIndex = '+beginIndex);
		this.trace('rule reference name = '+this.config.name);
		let ruleAnalyzer = this.analyzer.rules[this.config.name];
		if(ruleAnalyzer){
			let analysisResult = ruleAnalyzer.validate(tokenList,beginIndex);
			this.debug('<-GenericRuleReferenceRule#assess()');
			return analysisResult;
		}else{
			let message = 'syntax rule "'+this.config.name+'" not found!';
			this.error(message);
			this.debug('<-GenericRuleReferenceRule#assess()');
			return {"status": CHECK_RESULT_FAILURE,"next": beginIndex,"depth": 0,"message": message};
		}
	}
	dumpRule(){ return this.config.name; }
}

const syntaxRuleFactory = {
	getRule(configuration,analyzer){
		if('logic'==configuration.type){
			if(configuration.value['$and']){ return new GenericAndRule(configuration,analyzer); }
			if(configuration.value['$or']){ return new GenericOrRule(configuration,analyzer); }
		}
		if('token'==configuration.type){ return new GenericTokenEvaluationRule(configuration,analyzer); }
		if('rule'==configuration.type){ return new GenericRuleReferenceRule(configuration,analyzer); }
		console.log('WARNING: unknown syntax rule type "'+configuration.type+'"! - using default GenericSyntaxRule instead...');
		return new GenericSyntaxRule(configuration,analyzer);
	}
};

class GenericSyntaxRuleValidator extends Logger{
	config = null;
	name = null;
	syntaxAnalyzer = null;
	constructor(configuration,syntaxAnalyzer){
		super(configuration.logging);
		this.config = configuration;
		this.name = configuration.rule.name;
		this.syntaxAnalyzer = syntaxAnalyzer;
	}
	validate(tokenSequence,beginIndex){
		this.debug('->GenericSyntaxRuleValidator#validate()');
		this.trace('rule name: '+this.name);
		this.trace('beginIndex = '+beginIndex);
		let rootSyntaxRuleConfig = this.config.rule.definition;
		let rootSyntaxRuleAnalyzer = syntaxRuleFactory.getRule(rootSyntaxRuleConfig,this.syntaxAnalyzer);
		let returnStatus = rootSyntaxRuleAnalyzer.assess(tokenSequence,beginIndex);
		if(CHECK_RESULT_SUCCESS==returnStatus.status){
			let euPtr = returnStatus.executionUnit;
			returnStatus.executionUnit = new ExecutionUnit(this.syntaxAnalyzer.getLoggerConfig(),this.name);
			returnStatus.executionUnit.next = euPtr;
			returnStatus.executionUnit.grammar = this.syntaxAnalyzer.config.grammar;
		}else{
			returnStatus.message = 'not a valid '+this.name+': '+returnStatus.message;
		}
		this.debug('<-GenericSyntaxRuleValidator#validate('+this.name+') - status is '+returnStatus.status);
		return returnStatus;
	}
	dumpRule(){
		let formattedRule = this.name + ' ::= ';
		let rootSyntaxRuleConfig = this.config.rule.definition;
		let rootSyntaxRuleAnalyzer = syntaxRuleFactory.getRule(rootSyntaxRuleConfig,this.syntaxAnalyzer);
		formattedRule += rootSyntaxRuleAnalyzer.dumpRule();
		this.info(formattedRule);
	}
}

class EOFRuleValidator extends GenericSyntaxRuleValidator {
	constructor(configuration,syntaxAnalyzer){ super(configuration,syntaxAnalyzer); }
	validate(tokenSequence,beginIndex){
		this.debug('->EOFRuleValidator#validate()');
		this.trace('rule name: '+this.name);
		this.trace('beginIndex = '+beginIndex);
		this.trace('end of file index = '+tokenSequence.length);
		let returnStatus = {"status": beginIndex<tokenSequence.length?CHECK_RESULT_FAILURE:CHECK_RESULT_SUCCESS,"next": beginIndex};
		if(returnStatus.status==CHECK_RESULT_SUCCESS){
			returnStatus.executionUnit = new ExecutionUnit(this.syntaxAnalyzer.getLoggerConfig(),'EOF');
		}else{
			returnStatus.message = 'extra tokens found';
		}
		this.debug('<-EOFRuleValidator#validate() - status is '+returnStatus.status);
		return returnStatus;
	}
	dumpRule(){ this.info('EOF ::= <end-of-file>'); }
}

class GenericSyntaxAnalyzer extends Logger{
	config = null;
	rules = {};
	constructor(configuration){
		super(configuration.logging);
		this.config = configuration;
		this.loadRules();
	}
	getLoggerConfig(){ return this.config.logging; }
	loadRules(){
		this.debug('->GenericSyntaxAnalyzer#loadRules()');
		this.rules['EOF'] = new EOFRuleValidator({"rule": {"name": "EOF"},"logging": this.config.logging},this);
		for(var i=0;i<this.config.rules.length;i++){
			let ruleDesc = this.config.rules[i];
			let existingRule = this.rules[ruleDesc.name];
			if(typeof existingRule=='undefined'){
				let rule = new GenericSyntaxRuleValidator({"rule": ruleDesc,"logging": this.config.logging},this);
				this.trace('registering rule '+rule.name);
				this.rules[rule.name] = rule;
			}else{
				this.warning('skipping duplicated rule named '+ruleDesc.name);
			}
		}
		this.debug('<-GenericSyntaxAnalyzer#loadRules() - '+this.config.rules.length+' rule(s) loaded');
	}
	validate(tokenList){
		this.debug('->GenericSyntaxAnalyzer#validate()');
		let validationContext = {"isValid": false,"comments": ""};
		let normalizedTokenList = [];
		for(var i=0;i<tokenList.length;i++){
			let token = tokenList[i];
			if('WHITE_SPACE'!=token.type){ normalizedTokenList.push(token); }
		}
		let rootRule = this.rules[this.config.grammar.rootRule];
		if(rootRule){
			let validationResult = rootRule.validate(normalizedTokenList,0);
			validationContext.isValid = (validationResult.status==CHECK_RESULT_SUCCESS);
			if(validationContext.isValid){
				validationContext.executionUnit = validationResult.executionUnit;
				validationContext.executionUnit.grammar = this.config.grammar;
			}else{
				validationContext.comments = validationResult.message||JSON.stringify(validationResult);
			}
		}else{
			validationContext.comments = 'unknown root validation rule "'+this.config.grammar.rootRule+'"';
		}
		this.debug('<-GenericSyntaxAnalyzer#validate() - '+validationContext.isValid);
		return validationContext;
	}
	dumpSyntaxRules(){
		this.debug('->GenericSyntaxAnalyzer#dumpSyntaxRules()');
		this.info('Grammar:');
		for(var ruleName in this.rules){
			let ruleValidator = this.rules[ruleName];
			ruleValidator.dumpRule();
		}
		this.debug('<-GenericSyntaxAnalyzer#dumpSyntaxRules()');
	}
}

class ExecutionUnit extends Logger{
	next = null;
	name = null;
	token = null;
	constructor(loggerConfig,name){
		super(loggerConfig);
		this.name = name;
	}
	initialize(){
		this.debug('->ExecutionUnit#initialize()');
		this.debug('<-ExecutionUnit#initialize()');
	}
	execute(executionEngine){
		this.debug('->ExecutionUnit#execute()');
		this.debug('<-ExecutionUnit#execute()');
		if(this.next){ this.next.execute(executionEngine); }
	}
	dumpToConsole(level=0){
		let indent = '';
		for(var i=0;i<level;i++){ indent += '  '; }
		if(Array.isArray(this.next)){
			for(var i=0;i<this.next.length;i++){
				this.next[i].dumpToConsole(level);
			}
		}else{
			if(this.value){
				console.log(indent+'\''+this.name+'\''+' value: '+this.value);
			}else{
				console.log(indent+'\''+this.name+'\'');
			}
			if(this.next && this.next!=null){ this.next.dumpToConsole(level+1); }
		}
	}
}

class GenericCompiler extends Logger{
	config = null;
	tokenizer = null;
	analyzer = null;
	lastError = null;
	constructor(configuration){
		super(configuration.logging);
		this.config = configuration;
		this.initializeEngine();
	}
	initializeEngine(){
		this.debug('->GenericCompiler#initializeEngine()');
		this.info('loading grammar "'+this.config.grammar.name+'" v'+this.config.grammar.version);
		this.tokenizer = new Tokenizer({"rules": this.config.engineConfig.tokenizationRules,"logging": this.config.logging});
		this.analyzer = new GenericSyntaxAnalyzer({"rules": this.config.engineConfig.compilationRules,"logging": this.config.logging,"grammar": this.config.grammar});
		this.dumpSyntaxRules();
		this.debug('<-GenericCompiler#initializeEngine()');
	}
	compile(inputSource){
		this.debug('->GenericCompiler#compile()');
		this.trace('inputSource length: '+inputSource.length);
		this.lastError = null;
		let tokens = this.tokenizer.tokenize(inputSource);
		this.debug('tokenizer returned '+tokens.length+' tokens');
		this.dumpCompilationToken(tokens);
		if(this.tokenizer.status.returnCode==0){
			let validationContext = this.analyzer.validate(tokens);
			if(validationContext.isValid){
				this.info('syntax analysis completed successfully!');
				this.debug('<-GenericCompiler#compile()');
				return validationContext.executionUnit;
			}else{
				this.lastError = validationContext.comments;
				this.error('syntax analysis completed with error!');
				this.error(validationContext.comments);
				this.debug('<-GenericCompiler#compile()');
				return null;
			}
		}else{
			this.lastError = this.tokenizer.status.message;
			this.error('pre-compilation error detected!');
			this.error(this.tokenizer.status.message);
			this.debug('<-GenericCompiler#compile()');
			return null;
		}
	}
	dumpCompilationToken(tokens){
		this.debug('->GenericCompiler#dumpCompilationToken()');
		this.trace('compilation tokens list:');
		for(var i=0;i<tokens.length;i++){
			let compilationToken = tokens[i];
			if('WHITE_SPACE'!=compilationToken.type){ this.trace(i+' - '+compilationToken); }
		}
		this.debug('<-GenericCompiler#dumpCompilationToken()');
	}
	dumpSyntaxRules(){
		this.analyzer.dumpSyntaxRules();
	}
}

module.exports = GenericCompiler;
