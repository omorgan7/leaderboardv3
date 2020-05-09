'use strict'

const fs = require('fs')

const secret = JSON.parse(fs.readFileSync("secrets.json", "utf8"))

exports.steamKey = secret.steam_api_key

exports.cookieSecret = secret.cookie_secret

exports.loginHash = secret.login_hash

