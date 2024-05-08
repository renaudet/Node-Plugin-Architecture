/*
 * plugin.js - Cryptographic service provider for NPA
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
 
const CIPHER_KEY = 'NPA is a right tool only for you';
const CIPHER_NAME = 'aes-256-cbc';//-----------------;
 
const Plugin = require('../../core/plugin.js');
const crypto = require('crypto');
const KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

var plugin = new Plugin();

plugin.encrypt = function(data,key=CIPHER_KEY){
	this.trace('-> encrypt()');
	this.debug('data is "'+data+'"');
	this.debug('key is "'+key+'"');
	var cipher = crypto.createCipheriv(CIPHER_NAME, key,Buffer.from('vectorvector1234'));  
	var encryptedData = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
	this.debug('encrypted data is >'+encryptedData+'<');
	this.trace('<- encrypt()');
	return encryptedData;
}

plugin.decrypt = function(encryptedData,key=CIPHER_KEY){
	this.trace('-> decrypt()');
	this.debug('encryptedData is "'+encryptedData+'"');
	this.debug('key is "'+key+'"');
	var decipher = crypto.createDecipheriv(CIPHER_NAME, key, Buffer.from('vectorvector1234'));
	var decryptedData = decipher.update(encryptedData, 'hex', 'utf8') + decipher.final('utf8');
	this.debug('decrypted data is >'+decryptedData+'<');
	this.trace('<- decrypt()');
	return decryptedData;
}

plugin.generateRandomKey = function(){
	this.trace('-> generateRandomKey()');
	let generatedKey = '';
	let maxIndex = KEY_CHARS.length;
	for(var i=0;i<32;i++){
		generatedKey += KEY_CHARS.charAt(Math.floor(Math.random()*maxIndex));
	}
	this.trace('<- generateRandomKey()');
	return generatedKey;
}

module.exports = plugin;