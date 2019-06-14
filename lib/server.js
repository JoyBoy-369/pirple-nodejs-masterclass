/*
 * Server related tasks
 */

//dependencies
const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');
const path = require('path');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('../config');
const handlers = require('./handlers');
const helpers = require('./helpers');

//instantiate server module object
const server = {};

server.httpServer = http.createServer(function(req, res) {
  server.unifiedServer(req, res);
});

server.httpsServerOptions = {
  key: fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
};

server.httpsServer = https.createServer(server.httpsServerOptions, function(req, res) {
  server.unifiedServer(req, res);
});

server.unifiedServer = (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, '');
  const method = req.method.toLowerCase();
  const queryStringObject = parsedUrl.query;
  const headers = req.headers;

  //parsing payload
  const decoder = new StringDecoder('utf-8');
  let buffer = '';

  req.on('data', (data) => {
    buffer += decoder.write(data);
  });

  req.on('end', () => {
    buffer += decoder.end();

    const chosenHandler =
      typeof server.router[trimmedPath] !== 'undefined'
        ? server.router[trimmedPath]
        : handlers.notFound;

    const data = {
      trimmedPath,
      queryStringObject,
      method,
      headers,
      payload: helpers.parseJsonToObject(buffer)
    };

    chosenHandler(data, function(statusCode, payload) {
      statusCode = typeof statusCode === 'number' ? statusCode : 200;

      payload = typeof payload === 'object' ? payload : {};

      const payloadString = JSON.stringify(payload);

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(statusCode);
      res.end(payloadString);

      console.log('Returning', statusCode, payloadString);
    });
  });
};

server.router = {
  ping: handlers.ping,
  users: handlers.users,
  tokens: handlers.tokens,
  checks: handlers.checks
};

//init script
server.init = function() {
  //start http server
  server.httpServer.listen(config.httpPort, () => {
    console.log('Server started at port :', config.httpPort, ' in', config.envName);
  });

  //start https server
  server.httpsServer.listen(config.httpsPort, () => {
    console.log('Server started at port :', config.httpsPort, ' in', config.envName);
  });
};

//export server
module.exports = server;
