'use strict';

const Signale = require('./src/signale');
const {EaL, EaLConfiguration} = require('./dist/eal');

module.exports = Object.assign(new Signale(), {
  Signale,
  EaL,
  EaLConfiguration
});
