/*
 * plugin.js - MAIL support provider for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const Plugin = require('../../core/plugin.js');
var mailer = require("nodemailer");

var plugin = new Plugin();
plugin.providers = {};

plugin.lazzyPlug = function(extenderId,extensionPointConfig){
	this.trace('adding mail provider from '+extenderId);
	this.trace(JSON.stringify(extensionPointConfig,null,'\t'));
	this.providers[extensionPointConfig.type] = extensionPointConfig;
	if(typeof extensionPointConfig.username!='undefined' && extensionPointConfig.username.startsWith('$')){
		let envVariableName = extensionPointConfig.username.replace(/$/,'');
		this.providers[extensionPointConfig.type].username = process.env[envVariableName];
	}
	if(typeof extensionPointConfig.password!='undefined' && extensionPointConfig.password.startsWith('$')){
		let envVariableName = extensionPointConfig.password.replace(/$/,'');
		this.providers[extensionPointConfig.type].password = process.env[envVariableName];
	}
	this.trace('configuration after environment varaible extension:');
	this.trace(JSON.stringify(this.providers[extensionPointConfig.type],null,'\t'));
}

plugin.sendMail = function(providerId,from,to,subject,content,isHtml,then){
	this.trace("->sendMail()");
	this.debug('from: '+from);
	this.debug('to: '+to);
	this.debug('subject: '+subject);
	//this.debug('content: \n'+content);
	this.debug('isHtml: '+isHtml);
	
	var provider = this.providers[providerId];
	if(typeof provider!='undefined'){
		this.trace('using mail provider: '+JSON.stringify(provider,null,'\t'));
		let smtpTransport = null;
		if(provider.username){
			smtpTransport = mailer.createTransport({
				host: provider.host,
				port: provider.port,
				secure: provider.secure,
				auth: {
					user: provider.username,
					pass: provider.password
				}
			});
		}else{
			smtpTransport = mailer.createTransport({
				host: provider.host,
				port: provider.port,
				secure: false,
				tls: {
					rejectUnauthorized: false
				}
			});
		}
		var mail = {"from": from,"to": to,"subject": subject};
		if(isHtml){
			mail.html = content;
		}else{
			mail.text = content;
		}
		// mail is expected the following attributes: from, to, subject and html/text
		this.info(' sending mail from: '+from+' to: '+to+' subject: '+subject);
		smtpTransport.sendMail(mail, function(error, mailServerResponse){
			if(error){
				plugin.debug('exception while sending mail - see the error log for details');
				plugin.error(JSON.stringify(error));
				plugin.trace("<-sendMail() - error sending mail");
				then(error,null);
			}else{
				plugin.trace("<-sendMail() - success");
				then(error,mailServerResponse);
			}
			smtpTransport.close();
		});
	}else{
		then('No mail provider found for #ID: '+providerId,null);
	}
}

module.exports = plugin;