/*
 * Library for storing and rotating logs
 */

//dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

//container for module
const lib = {};

const BASE_DIR = path.join(__dirname, '/../.logs/');

//append a string to a file. Create the file if it does not exist
lib.append = function(file, str, callback) {
  // Open the file for appending
  fs.open(BASE_DIR + file + '.log', 'a', function(err, fileDescriptor) {
    if (!err && fileDescriptor) {
      // Append to file and close it
      fs.appendFile(fileDescriptor, str + '\n', function(err) {
        if (!err) {
          fs.close(fileDescriptor, function(err) {
            if (!err) {
              callback(false);
            } else {
              callback('Error closing file that was being appended');
            }
          });
        } else {
          callback('Error appending to file');
        }
      });
    } else {
      callback('Could open file for appending');
    }
  });
};

//list all logs and optionally list compressed logs
lib.list = function(includeCompressedLogs, callback) {
  fs.readdir(BASE_DIR, function(err, data) {
    if (!err && data && data.length > 0) {
      var trimmedFileNames = [];
      data.forEach(function(fileName) {
        // Add the .log files
        if (fileName.indexOf('.log') > -1) {
          trimmedFileNames.push(fileName.replace('.log', ''));
        }

        // Add the .gz files
        if (fileName.indexOf('.gz.b64') > -1 && includeCompressedLogs) {
          trimmedFileNames.push(fileName.replace('.gz.b64', ''));
        }
      });
      callback(false, trimmedFileNames);
    } else {
      callback(err, data);
    }
  });
};

//compress .log into .gz.b64 within same directory
lib.compress = function(logId, newFileId, callback) {
  var sourceFile = logId + '.log';
  var destFile = newFileId + '.gz.b64';

  // Read the source file
  fs.readFile(BASE_DIR + sourceFile, 'utf8', function(err, inputString) {
    if (!err && inputString) {
      // Compress the data using gzip
      zlib.gzip(inputString, function(err, buffer) {
        if (!err && buffer) {
          // Send the data to the destination file
          fs.open(BASE_DIR + destFile, 'wx', function(err, fileDescriptor) {
            if (!err && fileDescriptor) {
              // Write to the destination file
              fs.writeFile(fileDescriptor, buffer.toString('base64'), function(err) {
                if (!err) {
                  // Close the destination file
                  fs.close(fileDescriptor, function(err) {
                    if (!err) {
                      callback(false);
                    } else {
                      callback(err);
                    }
                  });
                } else {
                  callback(err);
                }
              });
            } else {
              callback(err);
            }
          });
        } else {
          callback(err);
        }
      });
    } else {
      callback(err);
    }
  });
};

//decompress contenst of a .gz.b64 file into string variable
lib.decompress = function(fileId, callback) {
  const fileName = fileId + '.gz.b64';
  fs.readFile(BASE_DIR + fileName, 'utf-8', function(err, str) {
    if (!err && str) {
      //decompress data
      const inputBuffer = Buffer.from(str, 'base64');
      zlib.unzip(inputBuffer, function(err, outputBuffer) {
        if (!err && outputBuffer) {
          const str = outputBuffer.toString();
          callback(false, str);
        } else {
          callback(err);
        }
      });
    } else {
      callback(err);
    }
  });
};

//truncate log file
lib.truncate = function(logId, callback) {
  fs.truncate(BASE_DIR + logId + '.log', 0, function(err) {
    if (!err) {
      callback(false);
    } else {
      callback(err);
    }
  });
};

//export lib
module.exports = lib;
