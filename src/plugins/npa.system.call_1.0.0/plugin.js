/*
 * plugin.js - System call support for NPA
 * Copyright 2023 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const moment = require('moment');
const spawn = require('node:child_process').spawn;
const REAPER_THREAD_DELAY = 1000;

var plugin = new Plugin();
plugin.process = {};
plugin.reaperThreadActive = false;

plugin.createProcessWrapper = function(command){
	this.debug('->createProcessWrapper');
	var processInstance = {};
	processInstance.startTime = moment().format("YYYY/MM/DD HH:mm:ss");
	processInstance.status = 'pending';
	processInstance.commandLine = command;
	processInstance.process = null;
	processInstance.output = [];
	processInstance.exitCode = -1;
	this.trace('ProcessInstance: '+JSON.stringify(processInstance,null,'\t'));
	this.debug('<-createProcessWrapper');
	return processInstance;
}

plugin.executeCommand = function(command,needsCleanEnvironment,onCommandExecutionLaunched,onChildProcessCompleted){
	this.debug('->executeCommand');
	this.trace('command: '+command);
	var processWrapper = this.createProcessWrapper(command);
	function updateJob(data,completed){
		if(processWrapper.process && !processWrapper.process.killed){
			if(completed){
				processWrapper.exitCode = data;
				processWrapper.endTime = moment().format("YYYY/MM/DD HH:mm:ss");
				processWrapper.status = 'completed';
				plugin.debug('standard output for '+processWrapper.commandLine);
				plugin.debug(JSON.stringify(processWrapper.output,null,'\t'));
				if(onChildProcessCompleted){
					onChildProcessCompleted();
				}
			}else{
				if('completed'==processWrapper.status){
					console.log(data);
				}else{
					processWrapper.status = 'running';
					var lines = data.toString().split('\n');
					for(var i=0;i<lines.length;i++){
						var line = lines[i];
						if(line.length>0){
							processWrapper.output.push(line.replace(/\r/g,''));
						}
					}
				}
			}
		}
	}
	function logJobStdout(data){
		updateJob(data,false);
	}
	function logJobStderr(data){
		updateJob(data,false);
	}
	function processJobExit(code,signal){
	  var exitCode = 0;
	  if(signal){
		  exitCode = -1;
	  }else{
		  exitCode = code;
	  }
	  updateJob(exitCode,true);
	}
	try{
		if(needsCleanEnvironment){
			processWrapper.process = spawn(command,[],{"env": {},"detached": true,"shell": true});
		}else{
			processWrapper.process = spawn(command,[],{"shell": true});
		}
		processWrapper.process.stdout.on('data',logJobStdout);
		processWrapper.process.stderr.on('data',logJobStderr);
		processWrapper.process.on('exit',processJobExit);
		this.process[processWrapper.process.pid] = processWrapper;
		if(!this.reaperThreadActive){
			this.startReaperThread();
		}
		this.debug('<-executeCommand');
		onCommandExecutionLaunched(null,processWrapper.process.pid);
	}catch(ex){
		this.error(JSON.stringify(ex));
		this.debug('<-executeCommand');
		onCommandExecutionLaunched(ex,null);
	}
}

plugin.startReaperThread = function(){
	this.reaperThreadActive = true;
	var activeProcessCount = 0;
	for(pid in this.process){
		var processInstance = this.process[pid];
		if('completed'!=processInstance.status){
			activeProcessCount++;
		}else{
			//remove from memory here
		}
	}
	if(activeProcessCount>0){
		setTimeout(function(){ plugin.startReaperThread(); },REAPER_THREAD_DELAY);
	}else{
		this.reaperThreadActive = false;
	}
}

module.exports = plugin;