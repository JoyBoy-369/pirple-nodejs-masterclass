/*
 * worker related tasks
 */

//dependencies
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const util = require('util');
const url = require('url');
const __data = require('./data');
const helpers = require('./helpers');
const __logs = require('./logs');

const debug = util.debuglog('workers');

//instatiate workers
const workers = {};

//look up all checks,get their data, send to validator
workers.gatherAllChecks = function() {
  // Get all the checks
  __data.list('checks', function(err, checks) {
    if (!err && checks && checks.length > 0) {
      checks.forEach(function(check) {
        // Read in the check data
        __data
          .read('checks', check)
          .then((originalCheckData) => {
            if (originalCheckData) {
              // Pass it to the check validator, and let that function continue the function or log the error(s) as needed
              workers.validateCheckData(originalCheckData);
            }
          })
          .catch((err) => debug("Error reading one of the check's data: ", err));
      });
    } else {
      debug('Error: Could not find any checks to process');
    }
  });
};

//sanity checking check data
workers.validateCheckData = function(originalCheckData) {
  originalCheckData =
    typeof originalCheckData === 'object' && originalCheckData ? originalCheckData : {};
  originalCheckData.id =
    typeof originalCheckData.id === 'string' && originalCheckData.id.length === 20
      ? originalCheckData.id
      : false;
  originalCheckData.userPhone =
    typeof originalCheckData.userPhone === 'string' && originalCheckData.userPhone.length === 10
      ? originalCheckData.userPhone
      : false;
  originalCheckData.protocol =
    typeof originalCheckData.protocol === 'string' &&
    ['http', 'https'].indexOf(originalCheckData.protocol) > -1
      ? originalCheckData.protocol
      : false;
  originalCheckData.url =
    typeof originalCheckData.url === 'string' && originalCheckData.url.length > 0
      ? originalCheckData.url
      : false;
  originalCheckData.method =
    typeof originalCheckData.method === 'string' &&
    ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1
      ? originalCheckData.method
      : false;
  originalCheckData.successCodes =
    typeof originalCheckData.successCodes === 'object' &&
    originalCheckData.successCodes instanceof Array &&
    originalCheckData.successCodes.length > 0
      ? originalCheckData.successCodes
      : false;
  originalCheckData.timeoutSeconds =
    typeof originalCheckData.timeoutSeconds === 'number' &&
    originalCheckData.timeoutSeconds % 1 === 0 &&
    originalCheckData.timeoutSeconds > 1 &&
    originalCheckData.timeoutSeconds <= 5
      ? originalCheckData.timeoutSeconds
      : false;

  //set the keys if not set (workers not seen this check before)
  originalCheckData.state =
    typeof originalCheckData.state === 'string' &&
    ['up', 'down'].indexOf(originalCheckData.state) > -1
      ? originalCheckData.state
      : 'down';

  originalCheckData.lastChecked =
    typeof originalCheckData.lastChecked === 'number' && originalCheckData.lastChecked > 0
      ? originalCheckData.lastChecked
      : false;

  //if all the checks passed pass the data along to the next step in the process
  if (
    originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol &&
    originalCheckData.url &&
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds
  ) {
    workers.performCheck(originalCheckData);
  } else {
    debug('Error: One of the checks is not properly formatted. Skipping it!');
  }
};

//Perform check , send orignal check data and outcome of check data to next step
workers.performCheck = function(originalCheckData) {
  //prepare initial check outcome

  const checkOutcome = {
    error: false,
    responseCode: false
  };

  //mark outcome not sent
  let outcomeSent = false;

  //parse hostname and url out of original check data
  const parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true);
  const hostname = parsedUrl.hostname;
  const path = parsedUrl.path; //we want the query string too

  //construct request
  const requestDetails = {
    protocol: originalCheckData.protocol + ':',
    hostname,
    method: originalCheckData.method.toUpperCase(),
    path,
    timeout: originalCheckData.timeoutSeconds * 1000
  };

  //instantiate request object
  const __moduleToUse = originalCheckData.protocol === 'http' ? http : https;
  const req = __moduleToUse.request(requestDetails, function(res) {
    //grab status
    const status = res.statusCode;

    //update checkoutcome and pass data along
    checkOutcome.responseCode = status;
    if (!outcomeSent) {
      debug('ok');
      workers.processOutCome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  //bind err event if not thrown
  req.on('error', function(e) {
    //Update the check data and pass the data along
    checkOutcome.err = {
      err: true,
      value: e
    };
    if (!outcomeSent) {
      workers.processOutCome(originalCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  //bind timeout event
  req.on('timeout', function(e) {
    //Update the check data and pass the data along
    checkOutcome.err = {
      err: true,
      value: 'timeout'
    };
    if (!outcomeSent) {
      workers.processOutCome(originalCheckData, outcomeSent);
      outcomeSent = true;
    }
  });

  //end request
  req.end();
};

//process check outcome and check data and trigger alert to user if needed
//special logic for a check never been tested bfore
workers.processOutCome = function(originalCheckData, checkOutcome) {
  //decide if check is up or down
  const state =
    !checkOutcome.err &&
    checkOutcome.responseCode &&
    originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1
      ? 'up'
      : 'down';

  //decide if alert is warranted
  const alertWarranted =
    originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

  //log outcome
  const timeOfCheck = Date.now();
  workers.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

  //update check data
  const newCheckData = originalCheckData;
  newCheckData.state = state;
  newCheckData.lastChecked = Date.now();

  //save update
  __data
    .update('checks', newCheckData.id, newCheckData)
    .then(() => {
      //send new check data to next step
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckData);
      } else {
        debug('Check outcome has not change');
      }
    })
    .catch(() => debug('Error: updating check data'));
};

//alert user to the change in check status
workers.alertUserToStatusChange = function(newCheckData) {
  var msg =
    'Alert: Your check for ' +
    newCheckData.method.toUpperCase() +
    ' ' +
    newCheckData.protocol +
    '://' +
    newCheckData.url +
    ' is currently ' +
    newCheckData.state;
  helpers.sendTwilioSms(newCheckData.userPhone, msg, function(err) {
    if (!err) {
      debug('Success: User was alerted to a status change in their check, via sms: ', msg);
    } else {
      debug('Error: Could not send sms alert to user who had a state change in their check', err);
    }
  });
};

workers.log = function(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) {
  //form log data
  const logData = {
    check: originalCheckData,
    outcome: checkOutcome,
    state,
    alert: alertWarranted,
    time: timeOfCheck
  };
  //convert data to string
  const logString = JSON.stringify(logData);
  //determine name of the log
  const logFileName = originalCheckData.id;
  //append log string to file
  __logs.append(logFileName, logString, function(err) {
    if (!err) {
      debug('Logging to file succeeded');
    } else {
      debug('Logging to file failed');
    }
  });
};

//timer to execute the worker process once per minute
workers.loop = function() {
  setInterval(function() {
    workers.gatherAllChecks();
  }, 1000 * 60);
};

//rotate log files
workers.rotateLogs = function() {
  //list all compressed files
  __logs.list(false, function(err, logs) {
    if (!err && logs && logs.length) {
      logs.forEach(function(log) {
        //compress data to a different file
        const logId = log.replace('.log', '');
        const newFileId = logId + '-' + Date.now();
        __logs.compress(logId, newFileId, function(err) {
          if (!err) {
            //truncate the log
            __logs.truncate(logId, function(err) {
              if (!err) {
                debug('Success truncating logFile');
              } else {
                debug('Error truncating log file');
              }
            });
          } else {
            debug('Error compressing one of the log files', err);
          }
        });
      });
    } else {
      debug('Error: cannot find any logs to rotate');
    }
  });
};

//timer to execute log rotation process once per day
workers.logRotationLoop = function() {
  setInterval(function() {
    workers.rotateLogs();
  }, 1000 * 60 * 60 * 24);
};

//init script
workers.init = function() {
  //send in yellow
  console.log('\x1b[33m%s\x1b[0m', 'Background workers are running');

  //execute all checks immediately
  workers.gatherAllChecks();
  //call loop so checks will execute later on
  workers.loop();

  //compress all logs immediately
  workers.rotateLogs();

  //compression loop so logs will be compressed later on
  workers.logRotationLoop();
};

//export workers
module.exports = workers;
