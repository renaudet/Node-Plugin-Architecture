/*
 * plugin.js - Cryptographic service provider for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const CIPHER_KEY = 'NPA is a right tool only for you';
const CIPHER_NAME = 'aes-256-cbc';//-----------------;
 
const Plugin = require('../../core/plugin.js');
const crypto = require('crypto');

var plugin = new Plugin();

plugin.encrypt = function(data){
	this.trace('-> encrypt()');
	this.debug('data is "'+data+'"');
	var cipher = crypto.createCipheriv(CIPHER_NAME, CIPHER_KEY,Buffer.from('vectorvector1234'));  
	var encryptedData = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
	this.debug('encrypted data is >'+encryptedData+'<');
	this.trace('<- encrypt()');
	return encryptedData;
}

plugin.decrypt = function(encryptedData){
	this.trace('-> decrypt()');
	this.debug('encryptedData is "'+encryptedData+'"');
	var decipher = crypto.createDecipheriv(CIPHER_NAME, CIPHER_KEY, Buffer.from('vectorvector1234'));
	var decryptedData = decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8');
	this.debug('decrypted data is >'+decryptedData+'<');
	this.trace('<- decrypt()');
	return decryptedData;
}

module.exports = plugin;