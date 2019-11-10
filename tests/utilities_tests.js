'use strict'

const utils = require("../utilities")
const assert = require("assert")

assert(utils.maskBottom32Bits(76561198022333112n) === 62067384)
assert(utils.maskBottom32Bits(76561198000470429n) === 40204701)
assert(utils.maskBottom32Bits(40204701n) === 40204701)

assert(utils.teamIntToString(2) === "radiant")
assert(utils.teamIntToString(3) === "dire")
assert(utils.teamIntToString(9999) === undefined)

assert(utils.teamStringToInt("radiant") === 2)
assert(utils.teamStringToInt("Radiant") === 2)
assert(utils.teamStringToInt("raDiAnT") === 2)
assert(isNaN(utils.teamStringToInt("raDiAnTTTTTT")))

assert(utils.teamStringToInt("dire") === 3)
assert(utils.teamStringToInt("Dire") === 3)
assert(utils.teamStringToInt("dIrE") === 3)
assert(isNaN(utils.teamStringToInt("direTTTTT")))

