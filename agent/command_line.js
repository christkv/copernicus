const packageJson = require('../package.json');

const cmdLineOptions = [
  {
    name: 'help',
    description: 'Display this usage guide.',
    alias: 'h',
    type: Boolean,
    group: 'all'
  },
  {
    name: 'host',
    description: `host or ip address to bind to. (default: all interfaces)`,
    type: String,
    typeLabel: '[arg]',
    group: 'all'
  },
  {
    name: 'port',
    description: `tcp port to bind too (default: 51000)`,
    type: Number,
    defaultValue: 51000,
    typeLabel: '[arg]',
    group: 'all'
  },
]

const cmdLineSections = [
  {
    header: `Copernicus Agent ${packageJson.version}`,
    content: 'Copernicus Agent commmand line help.'
  },
  {
    header: 'Usage',
    content: [
      `$ agent [bold]{[options]} [monitor address]`,
      '$ agent [bold]{--help}',
      '',
      '[bold]{monitor address can be:}',
      'server                monitor on localhost and port 52000',
      '192.168.0.5:51000     monitor on 192.168.0.5 and port 51000',
    ]
  },
  {
    header: 'Options',
    optionList: cmdLineOptions,
    group: ['all'],
  },
  {
    content: 'MongoDB home: [underline]{https://mongodb.com}'
  }
]

module.exports = {
  cmdLineOptions, cmdLineSections
}
