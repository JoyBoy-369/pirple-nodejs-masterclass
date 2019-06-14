/*
 * Library for storing and editing data
 */

//Dependencies
const fs = require('fs');
const util = require('util');
const path = require('path');
const helpers = require('./helpers');

const openAsync = util.promisify(fs.open);
const closeAsync = util.promisify(fs.close);
const writeFileAsync = util.promisify(fs.writeFile);
const readFileAsync = util.promisify(fs.readFile);
const truncateAsync = util.promisify(fs.truncate);
const unlinkAsync = util.promisify(fs.unlink);
const readdirAsync = util.promisify(fs.readdir);

function throwError(err) {
  return function() {
    throw err;
  };
}

const lib = {};

const BASE_DIR = path.join(__dirname, '/../.data/');

//write
lib.create = function(dir, file, data) {
  return openAsync(BASE_DIR + dir + '/' + file + '.json', 'wx')
    .catch(throwError('cant open file'))
    .then((fileDescriptor) => {
      const stringData = JSON.stringify(data);
      return writeFileAsync(fileDescriptor, stringData)
        .catch(throwError('cant write file'))
        .then(() => closeAsync)
        .catch(throwError('cant close file'));
    });
};

lib.read = function(dir, file) {
  return readFileAsync(BASE_DIR + dir + '/' + file + '.json', 'utf-8')
    .then((data) => {
      const parsedData = helpers.parseJsonToObject(data);
      return parsedData;
    })
    .catch(throwError('cant read'));
};

lib.update = function(dir, file, data) {
  return openAsync(BASE_DIR + dir + '/' + file + '.json', 'r+')
    .catch(throwError('cant open file'))
    .then((fileDescriptor) => {
      const stringData = JSON.stringify(data);
      return truncateAsync(fileDescriptor)
        .catch(throwError('cant truncate file'))
        .then(() => writeFileAsync(fileDescriptor, stringData))
        .catch(throwError('cant write file'))
        .then(() => closeAsync)
        .catch(throwError('cant close file'));
    });
};

lib.delete = function(dir, file) {
  return unlinkAsync(BASE_DIR + dir + '/' + file + '.json').catch(throwError('cant delete file'));
};

//list all items in a directory
lib.list = function(dir, callback) {
  readdirAsync(lib.BASE_DIR + dir + '/')
    .then((data) => {
      if (data && data.length) {
        const trimmedFileNames = [];
        data.forEach((fileName) => {
          trimmedFileNames.push(fileName.replace('.json', ''));
        });
      }
    })
    .catch((err) => callback(err, data));
};

module.exports = lib;
