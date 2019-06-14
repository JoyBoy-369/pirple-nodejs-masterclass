/*
 *Request handlers
 */

//dependencies
const __data = require('./data');
const helpers = require('./helpers');
const config = require('../config');

const handlers = {};

handlers.ping = function(data, callback) {
  callback(200, { name: 'ping handler' });
};

handlers.users = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];

  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else callback(405);
};

handlers._users = {};

handlers._users.post = function(data, callback) {
  const firstName =
    typeof data.payload.firstName === 'string' && data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;
  const lastName =
    typeof data.payload.lastName === 'string' && data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;
  const phone =
    typeof data.payload.phone === 'string' && data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false;
  const password =
    typeof data.payload.password === 'string' && data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;
  const tosAgreement =
    typeof data.payload.tosAgreement === 'boolean' && data.payload.tosAgreement === true
      ? true
      : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    __data
      .read('users', phone)
      .then((data) => callback(400, { Error: 'A user already exists' }))
      .catch(() => {
        const hashedPassword = helpers.hash(password);

        if (hashedPassword) {
          const userObject = {
            firstName,
            lastName,
            phone,
            hashedPassword,
            tosAgreement: true
          };

          __data
            .create('users', phone, userObject)
            .then(() => callback(200))
            .catch(() => callback(500, { Error: 'Could not create new user' }));
        } else {
          callback(500, { Error: 'Could not hash password' });
        }
      });
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers._users.get = function(data, callback) {
  const phone =
    typeof data.queryStringObject.phone === 'string' &&
    data.queryStringObject.phone.trim().length === 10
      ? data.queryStringObject.phone.trim()
      : false;
  if (phone) {
    const token = typeof data.headers.token === 'string' ? data.headers.token : false;

    handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
      console.log(tokenIsValid, token);
      if (tokenIsValid) {
        __data
          .read('users', phone)
          .then((data) => {
            delete data.hashedPassword;
            callback(200, data);
          })
          .catch(() => callback(404));
      } else {
        callback(403, { Error: 'Missing token or invalid token' });
      }
    });
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers._users.put = function(data, callback) {
  const firstName =
    typeof data.payload.firstName === 'string' && data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;
  const lastName =
    typeof data.payload.lastName === 'string' && data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;
  const phone =
    typeof data.payload.phone === 'string' && data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false;
  const password =
    typeof data.payload.password === 'string' && data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  if (phone) {
    if (firstName || lastName || password) {
      const token = typeof data.headers.token === 'string' ? data.headers.token : false;

      handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
        if (tokenIsValid) {
          __data
            .read('users', phone)
            .then((userData) => {
              if (firstName) {
                userData.firstName = firstName;
              }
              if (lastName) {
                userData.lastName = lastName;
              }
              if (password) {
                userData.hashedPassword = helpers.hash(password);
              }

              __data
                .update('users', phone, userData)
                .then(() => {
                  callback(200);
                })
                .catch(() => callback(500, { Error: 'Could not update user' }));
            })
            .catch(() => callback(400, { Error: 'specified user file does not exist' }));
        } else {
          callback(403, { Error: 'Missing token or invalid token' });
        }
      });
    } else {
      callback(400, { Error: 'Missing fields to update' });
    }
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers._users.delete = function(data, callback) {
  const phone =
    typeof data.queryStringObject.phone === 'string' &&
    data.queryStringObject.phone.trim().length === 10
      ? data.queryStringObject.phone.trim()
      : false;
  if (phone) {
    const token = typeof data.headers.token === 'string' ? data.headers.token : false;
    handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
      if (tokenIsValid) {
        __data
          .read('users', phone)
          .then((userData) => {
            __data
              .delete('users', phone)
              .then(() => {
                const userChecks =
                  typeof userData.checks === 'object' && userData.checks instanceof Array
                    ? userData.checks
                    : [];
                const checksToDelete = userChecks.length;
                if (checksToDelete > 0) {
                  const checksDeleted = 0;
                  const deletionErros = false;

                  userChecks.forEach((checkId) => {
                    __data
                      .delete('checks', checkId)
                      .then(() => {
                        checksDeleted++;
                        if (checksDeleted == checksToDelete) {
                          if (!deletionErros) callback(200);
                          else
                            callback(500, {
                              Error: 'errors encountered while attempting to delete all user checks'
                            });
                        }
                      })
                      .catch(() => (deletionErros = true));
                  });
                } else {
                  callback(200);
                }
              })
              .catch((err) => {
                console.log(err);
                callback(500, { Error: 'Could not delete' });
              });
          })
          .catch(() => callback(400, { Error: 'Could not find the specified user' }));
      } else {
        callback(403, { Error: 'Missing token or invalid token' });
      }
    });
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers.tokens = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];

  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else callback(405);
};

handlers._tokens = {};

handlers._tokens.post = function(data, callback) {
  const phone =
    typeof data.payload.phone === 'string' && data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false;
  const password =
    typeof data.payload.password === 'string' && data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;
  if (phone && password) {
    __data
      .read('users', phone)
      .then((userData) => {
        const hashedPassword = helpers.hash(password);
        if (hashedPassword == userData.hashedPassword) {
          const tokenId = helpers.createRandomString(20);
          const expires = Date.now() + 1000 * 60 * 60;
          const tokenObject = {
            phone,
            id: tokenId,
            expires
          };
          __data
            .create('tokens', tokenId, tokenObject)
            .then(() => callback(200, tokenObject))
            .catch((err) => {
              console.log(err);
              callback(500, { Error: 'Could not create new token' });
            });
        } else {
          callback(400, { Error: 'Password did not match' });
        }
      })
      .catch((err) => {
        console.log(err);
        callback(400, { Error: 'Could not find specified user' });
      });
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers._tokens.get = function(data, callback) {
  const id =
    typeof data.queryStringObject.id === 'string' && data.queryStringObject.id.trim().length === 20
      ? data.queryStringObject.id.trim()
      : false;
  if (id) {
    __data
      .read('tokens', id)
      .then((data) => {
        callback(200, data);
      })
      .catch(() => callback(404));
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers._tokens.put = function(data, callback) {
  const id =
    typeof data.payload.id === 'string' && data.payload.id.trim().length === 20
      ? data.payload.id.trim()
      : false;
  const extend =
    typeof data.payload.extend === 'boolean' && data.payload.extend === true ? true : false;
  console.log(id, extend);
  if (id && extend) {
    __data
      .read('tokens', id)
      .then((tokenData) => {
        if (tokenData.expires > Date.now()) {
          tokenData.expires = Date.now + 1000 * 60 * 60;
          __data
            .update('tokens', id, tokenData)
            .then(() => {
              callback(200);
            })
            .catch(() => callback(500, { Error: 'Could not update token' }));
        } else {
          callback(400, { Error: 'token expired' });
        }
      })
      .catch((err) => {
        console.log(err);
        callback(400, { Error: 'Could not find specified token' });
      });
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers._tokens.delete = function(data, callback) {
  const id =
    typeof data.queryStringObject.id === 'string' && data.queryStringObject.id.trim().length === 20
      ? data.queryStringObject.id.trim()
      : false;
  if (id) {
    __data
      .read('tokens', id)
      .then(() => {
        __data
          .delete('tokens', id)
          .then(() => callback(200))
          .catch(() => callback(500, { Error: 'Could not delete' }));
      })
      .catch(() => callback(400, { Error: 'Could not find the specified token' }));
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers._tokens.verifyToken = function(id, phone, callback) {
  __data
    .read('tokens', id)
    .then((tokenData) => {
      console.log('hello', tokenData);
      if (tokenData.phone == phone && tokenData.id == id) {
        console.log(tokenData, phone, id);
        callback(true);
      } else {
        callback(false);
      }
    })
    .catch((err) => {
      console.log(err);
      callback(false);
    });
};

handlers.checks = function(data, callback) {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];

  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else callback(405);
};

handlers._checks = {};

handlers._checks.post = function(data, callback) {
  const protocol =
    typeof data.payload.protocol === 'string' &&
    ['http', 'https'].indexOf(data.payload.protocol) > -1
      ? data.payload.protocol
      : false;
  const url =
    typeof data.payload.url === 'string' && data.payload.url.trim().length > 0
      ? data.payload.url.trim()
      : false;
  const method =
    typeof data.payload.method === 'string' &&
    ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
      ? data.payload.method
      : false;
  const successCodes =
    typeof data.payload.successCodes === 'object' &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0
      ? data.payload.successCodes
      : false;
  const timeoutSeconds =
    typeof data.payload.timeoutSeconds === 'number' &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds > 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false;
  console.log(protocol, url, method, successCodes, timeoutSeconds);
  if (protocol && url && method && successCodes && timeoutSeconds) {
    const token = typeof data.headers.token === 'string' ? data.headers.token : false;

    __data
      .read('tokens', token)
      .then((data) => {
        if (data) {
          const phone = data.phone;
          return phone;
        } else throw '';
      })
      .then((userPhone) => {
        __data
          .read('users', userPhone)
          .then((userData) => {
            const userChecks =
              typeof userData.checks === 'object' && userData.checks instanceof Array
                ? userData.checks
                : [];
            if (userChecks.length < config.maxChecks) {
              const checkId = helpers.createRandomString(20);
              const checkObject = {
                id: checkId,
                userPhone,
                protocol,
                url,
                method,
                successCodes,
                timeoutSeconds
              };

              __data
                .create('checks', checkId, checkObject)
                .then(() => {
                  userData.checks = userChecks;
                  userData.checks.push(checkId);
                  __data
                    .update('users', userPhone, userData)
                    .then(() => {
                      callback(200, checkObject);
                    })
                    .catch((err) => {
                      console.log('what', err);
                      callback(500, { ERror: 'could not update user with new check' });
                    });
                })
                .catch(() => callback(400, { Error: 'Could not create check' }));
            } else {
              callback(400, {
                Error: 'User has already has maximum number of checks' + config.maxChecks
              });
            }
          })
          .catch((err) => {
            console.log('sd', err);
            callback(403);
          });
      })
      .catch((err) => {
        console.log('f', err);
        callback(403);
      });
  } else {
    callback(400, { Error: 'Missing required fields or inoput is invalid' });
  }
};

handlers._checks.get = function(data, callback) {
  const id =
    typeof data.queryStringObject.id === 'string' && data.queryStringObject.id.trim().length === 20
      ? data.queryStringObject.id.trim()
      : false;
  if (id) {
    __data
      .read('checks', id)
      .then((checkData) => {
        const token = typeof data.headers.token === 'string' ? data.headers.token : false;
        handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
          console.log(tokenIsValid, token);
          if (tokenIsValid) {
            callback(200, checkData);
          } else {
            callback(403);
          }
        });
      })
      .catch(() => callback(404));
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers._checks.put = function(data, callback) {
  const id =
    typeof data.payload.id === 'string' && data.payload.id.trim().length === 20
      ? data.payload.id.trim()
      : false;
  const protocol =
    typeof data.payload.protocol === 'string' &&
    ['http', 'https'].indexOf(data.payload.protocol) > -1
      ? data.payload.protocol
      : false;
  const url =
    typeof data.payload.url === 'string' && data.payload.url.trim().length > 0
      ? data.payload.url.trim()
      : false;
  const method =
    typeof data.payload.method === 'string' &&
    ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
      ? data.payload.method
      : false;
  const successCodes =
    typeof data.payload.successCodes === 'object' &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0
      ? data.payload.successCodes
      : false;
  const timeoutSeconds =
    typeof data.payload.timeoutSeconds === 'number' &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds > 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false;

  if (id) {
    if (protocol || url || method || timeoutSeconds || successCodes) {
      __data
        .read('checks', id)
        .then((checkData) => {
          const token = typeof data.headers.token === 'string' ? data.headers.token : false;
          handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
            console.log(tokenIsValid, token);
            if (tokenIsValid) {
              if (protocol) checkData.protocol = protocol;

              if (url) checkData.url = url;

              if (successCodes) checkData.successCodes = successCodes;

              if (timeoutSeconds) checkData.timeoutSeconds = timeoutSeconds;
              if (method) checkData.method = method;

              __data
                .update('checks', id, checkData)
                .then(() => callback(200))
                .catch(() => callback(500, { Error: 'Could not update the required fields' }));
            } else {
              callback(403);
            }
          });
        })
        .catch(() => callback(400, { Error: 'Check id did not exist' }));
    } else {
      callback(403, { Error: 'Missing requirede fields to update' });
    }
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers._checks.delete = function(data, callback) {
  const id =
    typeof data.queryStringObject.id === 'string' && data.queryStringObject.id.trim().length === 20
      ? data.queryStringObject.id.trim()
      : false;
  if (id) {
    __data
      .read('checks', id)
      .then((checkData) => {
        const token = typeof data.headers.token === 'string' ? data.headers.token : false;
        handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
          if (tokenIsValid) {
            __data
              .delete('checks', id)
              .then(() => {
                __data
                  .read('users', checkData.userPhone)
                  .then((userData) => {
                    const userChecks =
                      typeof userData.checks === 'object' && userData.checks instanceof Array
                        ? userData.checks
                        : [];

                    const checkPosition = userChecks.indexOf(id);
                    if (checkPosition > -1) {
                      userChecks.splice(checkPosition, 1);
                      __data
                        .update('users', checkData.userPhone, userData)
                        .then(() => callback(200))
                        .catch(() =>
                          callback(500, {
                            Error: 'Could not update'
                          })
                        );
                    } else {
                      callback(500, {
                        Error: 'Could not find check on the user objects'
                      });
                    }
                  })
                  .catch(() =>
                    callback(500, {
                      Error: 'Could not find the specified user'
                    })
                  );
              })
              .catch(() => callback(500, { Error: 'could not delete check' }));
          } else {
            callback(403, { Error: 'Missing token or invalid token' });
          }
        });
      })
      .catch((err) => {
        console.log(err);
        callback(400, { Error: 'Specified id does not exist' });
      });
  } else {
    callback(400, { Error: 'Missing required fields' });
  }
};

handlers.ping = function(data, callback) {
  callback(200);
};

handlers.notFound = function(data, callback) {
  callback(404);
};

module.exports = handlers;
