const {
  MongoClient
} = require('mongodb');
const http = require('http');

// Command line options
const getUsage = require('command-line-usage');
const commandLineArgs = require('command-line-args');
const { cmdLineOptions, cmdLineSections } = require('./command_line');

// Parse the command line
const options = commandLineArgs(cmdLineOptions);
// Usage screen
const usage = getUsage(cmdLineSections);

// If user requested help information
if (options._all.help) {
  console.log(usage);
  process.exit(0);
}
