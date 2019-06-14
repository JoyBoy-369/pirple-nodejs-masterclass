/*
 * Helpers for various tasks
 */

//dependencies
const crypto = require('crypto');
const querystring = require('querystring');
const https = require('https');
const config = require('../config');

const helpers = {};

helpers.hash = function(str) {
  if (typeof str === 'string' && str.length > 0) {
    const hash = crypto
      .createHmac('sha256', config.hashSecret)
      .update(str)
      .digest('hex');
    return hash;
  } else {
    return false;
  }
};

helpers.parseJsonToObject = function(str) {
  try {
    const obj = JSON.parse(str);
    return obj;
  } catch (err) {
    return {};
  }
};

helpers.createRandomString = function(strLength) {
  strLength = typeof strLength === 'number' && strLength > 0 ? strLength : false;
  if (strLength) {
    const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let str = '';
    for (let i = 0; i < strLength; i++) {
      const randomCharacter = possibleCharacters.charAt(
        Math.floor(Math.random() * possibleCharacters.length)
      );
      str += randomCharacter;
    }
    return str;
  } else {
    return false;
  }
};

helpers.sendTwilioSms = function(phone, msg, callback) {
  phone = typeof phone === 'string' && phone.trim().length === 10 ? phone.trim() : false;
  msg =
    typeof msg === 'string' && msg.trim().length > 0 && msg.trim().length <= 100
      ? msg.trim()
      : false;
  if (phone && msg) {
    const payload = {
      From: config.twilio.fromPhone,
      To: config.twilio.toPhone,
      Body: msg
    };
    const stringPayload = querystring.stringify(payload);
    const requestDetails = {
      protocol: 'https:',
      hostname: 'api.twilio.com',
      method: 'POST',
      path: '/2010-04-01/Accounts/' + config.twilio.accountSid + '/Messages.json',
      auth: config.twilio.accountSid + ':' + config.twilio.authToken,
      headers: {
        'Content-Type': 'application/x-www-form-url-encoded',
        'Content-Length': Buffer.byteLength(stringPayload)
      }
    };

    const req = https.request(requestDetails, function(res) {
      const status = res.statusCode;
      if (status == 200 || status == 201) {
        callback(false);
      } else {
        callback('Stastus code returned' + status);
      }
    });

    req.on('error', function(e) {
      callback(e);
    });

    req.write(stringPayload);
    req.end();
  } else {
    callback('Given parameters missing');
  }
};

module.exports = helpers;
