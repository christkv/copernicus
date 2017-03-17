const {
  MongoClient
} = require('mongodb');
const http = require('http');

// Command line options
const getUsage = require('command-line-usage');
const commandLineArgs = require('command-line-args');
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
if (!options._unknown || options._unknown.length < 2) {
  console.log(`a db connection uri and simulation.js file must be provided`);
  process.exit(1);
}

// Unpack the variables
const uri = options._unknown[0];
const simulation = options._unknown[1];

// Wrap the server
(async () => {
  // Connect to MongoDB
  const client = await MongoClient.connect(uri);
  
  //We need a function which handles requests and send response
  function handleRequest(request, response){
    console.log("============== handleRequest")
    response.end('It Works!! Path Hit: ' + request.url);
  }

  //Create a server
  const server = http.createServer(handleRequest);

  //Lets start our server
  server.listen(options._all.port, options._all.bind, async function() {
    console.log("Monitor listening on: port %s", options._all.port);
  });
})();

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
