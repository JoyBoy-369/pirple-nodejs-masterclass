/*
 * primary file for api
 */

//dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');

//declare app
const app = {};

//init function
app.init = function() {
  //start server
  server.init();
  //start worker
  workers.init();
};

//execute
app.init();

//export app
module.exports = app;
