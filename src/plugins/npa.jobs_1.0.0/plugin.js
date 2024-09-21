/*
 * plugin.js - Job Management provider for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const RUNTIME_PROPERTIES_SERVICE_NAME = 'properties';
//const JOB_CHECK_LOOP_TIMEOUT = 30*1000;
//const JOB_EXPIRATION_TIMEOUT = 60*1000;
const STATUS_PENDING = 'pending';
const STATUS_ONGOING = 'ongoing';
const STATUS_COMPLETED = 'completed';
const STATUS_TERMINATED = 'terminated';
const STATUS_SETROLLBACKONLY = 'setRollbackOnly';

var plugin = new Plugin();
/*
job structure: {
    "id": uuidv4(),
    "owner": "abcd",
    "description": "abcd",
    "startTime": moment(),
    "endTime": moment(),
    "revalidationTime": moment(),
    "status": "pending/ongoing/completed/setRollbackOnly/terminated",
    "progress": percentage (0-100),
    ""
}
*/
plugin.jobTable = {};

plugin.onConfigurationLoaded = function(){
    this.debug('->onConfigurationLoaded()');
    let propService = this.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
    let timeout = propService.getProperty('npa.jobs.property.timeout');
    setTimeout(function(){ plugin.checkJobExpiration();},timeout);
    this.debug('<-onConfigurationLoaded()');
}

plugin.getJobs = function(){
    let jobs = [];
    for(var jobId in this.jobTable){
        jobs.push(this.jobTable[jobId]);
    }
    return jobs;
}

plugin.getJob = function(jobId){
    let job = this.jobTable[jobId];
    if(typeof job!='undefined' && (STATUS_PENDING==job.status || STATUS_ONGOING==job.status)){
        job.revalidationTime = moment();
        if(STATUS_PENDING==job.status){
            job.status = STATUS_ONGOING;
        }
    }
    return job;
}

plugin.createJob = function(owner,description){
    this.debug('->createJob()');
    this.debug('owner: '+owner);
    this.debug('description: '+description);
    let job = {"id": uuidv4(),"owner": owner,"description": description,"startTime": moment(),"status": STATUS_PENDING,"progress": 0};
    job.revalidationTime = job.startTime;
    this.debug(JSON.stringify(job,null,'\t'));
    this.jobTable[job.id] = job;
    this.debug('<-createJob()');
    return job;
}

plugin.updateJob = function(job){
    this.debug('->updateJob()');
    if(job && job.id){
        this.debug('jobId: '+job.id);
        let internalJob = this.getJob(job.id);
        if(typeof internalJob!='undefined'){
	        if(STATUS_ONGOING == internalJob.status){
	            if(job.progress){
	                internalJob.progress = job.progress;
	            }
	            if(STATUS_SETROLLBACKONLY==job.status){
	                internalJob.status = job.status;
	            }
	            if(STATUS_COMPLETED==job.status){
	                internalJob.progress = 100;
	                internalJob.status = job.status;
	                internalJob.endTime = moment();
	            }
	            if(STATUS_ONGOING == internalJob.status && internalJob.progress==100){
	                internalJob.status = STATUS_COMPLETED;
	                internalJob.endTime = moment();
	            }
	        }
	        this.debug('<-updateJob()');
	        return internalJob;
        }else{
			return {};
		}
    }else{
        this.debug('<-updateJob() - not found');
        return {};
    }
}

plugin.checkJobExpiration = function(){
    this.debug('->checkJobExpiration()');
    let jobsToDelete = [];
    let propService = this.getService(RUNTIME_PROPERTIES_SERVICE_NAME);
    let now = moment();
    for(var jobId in this.jobTable){
        let job = this.jobTable[jobId];
        let expirationTimeout = propService.getProperty('job.expiration.timeout');
        if('pending'==job.status || 'ongoing'==job.status || 'setRollbackOnly'==job.status){
            if('setRollbackOnly'==job.status){
                this.debug('job id #'+jobId+' marked as setRollbackOnly - terminating');
                job.status = STATUS_TERMINATED;
                job.endTime = now;
            }else{
                if(now.diff(job.revalidationTime)>=expirationTimeout){
                    this.debug('job id #'+jobId+' was not revalidated for 10 min. - marking as setRollbackOnly');
                    job.status = STATUS_SETROLLBACKONLY;
                }
            }
        }else{
            if(now.diff(job.endTime)>=expirationTimeout){
                this.debug('job id #'+jobId+' expired');
                jobsToDelete.push(jobId);
            }
        }
    }
    this.debug('found '+jobsToDelete.length+' expired jobs');
    for(var i=0;i<jobsToDelete.length;i++){
        let toDeleteJobId = jobsToDelete[i];
        this.debug('deleting expired job #'+toDeleteJobId);
        delete this.jobTable[toDeleteJobId];
    }
    this.debug('<-checkJobExpiration()');
    let timeout = propService.getProperty('npa.jobs.property.timeout');
    setTimeout(function(){ plugin.checkJobExpiration();},timeout);
}


module.exports = plugin;