const packageJson = require('../package.json');

const cmdLineOptions = [
  {
    name: 'help',
    description: 'Display this usage guide.',
    alias: 'h',
    type: Boolean,
    group: 'all'
  },
  // {
  //   name: 'host',
  //   description: `server to connect to.`,
  //   type: String,
  //   typeLabel: '[arg]',
  // },
  // {
  //   name: 'eval',
  //   description: `evaluate javascript.`,
  //   type: String,
  //   typeLabel: '[arg]',
  // },
  // {
  //   name: 'version',
  //   description: `show version information.`,
  //   type: Boolean,
  // },
  // {
  //   name: 'verbose',
  //   description: `increase verbosity.`,
  //   type: Boolean,
  // },
  // {
  //   name: 'username',
  //   alias: 'u',
  //   description: `username for authentication.`,
  //   type: String,
  //   typeLabel: '[arg]',
  //   group: "auth"
  // },
  // {
  //   name: 'password',
  //   alias: 'p',
  //   description: `password for authentication.`,
  //   type: String,
  //   typeLabel: '[arg]',
  //   group: "auth"
  // },
  // {
  //   name: 'authenticationDatabase',
  //   description: `user source (defaults to dbname).`,
  //   type: String,
  //   typeLabel: '[arg]',
  //   group: "auth"
  // },
  // {
  //   name: 'authenticationMechanism',
  //   description: `authentication mechanism one off [DEFAULT, SCRAM-SHA-1, MONGODB-X509, GSSAPI, MONGODB-CR]`,
  //   type: String,
  //   typeLabel: '[arg]',
  //   group: "auth"
  // },
  // {
  //   name: 'gssapiServiceName',
  //   description: `Service name to use when authenticating using GSSAPI/Kerberos.`,
  //   type: String,
  //   typeLabel: '[arg] (=mongodb)',
  //   group: "auth"
  // },
  // // {
  // //   name: 'gssapiHostName',
  // //   description: `Remote host name to use for purpose of GSSAPI/Kerberos authentication.`,
  // //   type: String,
  // //   typeLabel: '[arg]',
  // //   group: "auth"
  // // },
  // {
  //   name: 'ssl',
  //   description: `use SSL for all connections.`,
  //   type: Boolean,
  //   group: "ssl"
  // },{
  //   name: 'sslCAFile',
  //   description: `Certificate Authority file for SSL.`,
  //   type: String,
  //   typeLabel: '[arg]',
  //   group: "ssl"
  // },{
  //   name: 'sslPEMKeyFile',
  //   description: `PEM certificate/key file for SSL.`,
  //   type: String,
  //   typeLabel: '[arg]',
  //   group: "ssl"
  // },{
  //   name: 'sslPEMKeyPassword',
  //   description: `password for key in PEM file for SSL.`,
  //   type: String,
  //   typeLabel: '[arg]',
  //   group: "ssl"
  // },{
  //   name: 'sslCRLFile',
  //   description: `Certificate Revocation List file for SSL.`,
  //   type: String,
  //   typeLabel: '[arg]',
  //   group: "ssl"
  // },{
  //   name: 'sslAllowInvalidHostnames',
  //   description: `allow connections to servers with non-matching hostnames.`,
  //   type: Boolean,
  //   group: "ssl"
  // },{
  //   name: 'sslAllowInvalidCertificates',
  //   description: `allow connections to servers with invalid certificates.`,
  //   type: Boolean,
  //   group: "ssl",
  // // },{
  // //   name: 'sslFIPSMode',
  // //   description: `activate FIPS 140-2 mode at startup.`,
  // //   type: Boolean,
  // //   group: "ssl"
  // },
]

const cmdLineSections = [
  {
    header: `Copernicus Monitor ${packageJson.version}`,
    content: 'Copernicus Monitor commmand line help.'
  },
  {
    header: 'Usage',
    content: [
      `$ monitor [bold]{[options]} [db address] [simulation (ending in .js)`,
      '$ monitor [bold]{--help}',
      '',
      '[bold]{db address can be:}',
      'foo                   foo database on local machine',
      '192.168.0.5/foo       foo database on 192.168.0.5 machine',
      '192.168.0.5:9999/foo  foo database on 192.168.0.5 machine on port 9999',
    ]
  },
  {
    header: 'Options',
    optionList: cmdLineOptions,
    group: ['all'],
  },
  // {
  //   header: 'Authentication Options',
  //   optionList: cmdLineOptions,
  //   group: ['auth'],
  // },
  // {
  //   header: 'SSL Options',
  //   optionList: cmdLineOptions,
  //   group: ['ssl'],
  // },
  {
    content: 'MongoDB home: [underline]{https://mongodb.com}'
  }
]

module.exports = {
  cmdLineOptions, cmdLineSections
}
