const {
  MongoClient
} = require('mongodb');
const http = require('http');
const request = require('request');
// Command line options
const getUsage = require('command-line-usage');
const commandLineArgs = require('command-line-args');
const os = require('os');
const net = require('net');
const { cmdLineOptions, cmdLineSections } = require('./command_line');

// State machine for the agent
const states = {
  init: ['unregistered', 'registered', 'init', 'quit'],
  registered: ['idle', 'unregistered', 'quit'],
  unregistered: ['registered', 'quit'],
  idle: ['idle', 'unregistered', 'quit', 'executing'],
  executing: ['executing', 'done', 'quit'],
  done: ['idle', 'quit'],
}

function changeState(prev, next) {
  if (states[prev].indexOf(next) == -1) {
    throw new Error(`illegal state transition from ${prev} to ${next}`);
  }

  return next;
}

// State machine initial state
let state = 'init';

// Parse the command line
const options = commandLineArgs(cmdLineOptions);
// Usage screen
const usage = getUsage(cmdLineSections);

// If user requested help information
if (options._all.help) {
  console.log(usage);
  process.exit(0);
}

// Check if we have a monitor address
if (!options._unknown || options._unknown.length == 0) {
  console.log(`a monitor host address must be provided in the format [host:port], ex: localhost:52000`);
  process.exit(1);
}

// Get the option and split it
const monitorHost = options._unknown[0].split(':')[0];
const monitorPort = Number.parseInt(options._unknown[0].split(':')[1]) || 52000;
// Generate the http post uri for the agent to report
const uri = `http://${monitorHost}:${monitorPort}/api/agent`;
// The register interval
const registerIntervalMS = 1000;

//We need a function which handles requests and send response
function handleRequest(request, response){
  console.log("------- recevied message")
  response.end('It Works!! Path Hit: ' + request.url);
}

//Create a server
const server = http.createServer(handleRequest);

//Lets start our server
server.listen(options._all.port, options._all.bind, async function() {
  console.log("Agent listening on: port %s", options._all.port);

  // Attempt to register the agent
  if (!await registerAgent()) {
    // If we failed to register the agent start attempts
    // to reconnect.
    register();
  }
});

function register() {
  setTimeout(async () => {
    const result = await registerAgent();
    if (!result) register();
  }, registerIntervalMS);
}

async function registerAgent() {
  try {
    console.log(`agent attempting to register with monitor at ${monitorHost}:${monitorPort}`);
    // Attempt to connect to the monitor
    const result = await post(uri, {
      cpus: os.cpus,
      net: {
        local: {
          address: options._all.bind || net.localAddress,
          port: net.localPort,
        },
        remote: {
          address: net.remoteAddress,
          port: net.remotePort,
        }
      } 
    });

    console.log(`agent registered successfully with monitor at ${monitorHost}:${monitorPort}`);
    return result;
  } catch(err) {
    console.log(`agent failed to register with monitor at ${monitorHost}:${monitorPort}`);
  }
}

async function post(uri, json) {
  return await requestPromise({
    uri: uri,
    method: 'POST',
    json: json
  });
}

function requestPromise(options) {
  return new Promise((resolve, reject) => {
    request(options, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });  
  })
}
