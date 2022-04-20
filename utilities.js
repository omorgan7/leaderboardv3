const RADIANT = 2
const DIRE = 3

const fs = require('fs')

exports.RADIANT = RADIANT
exports.DIRE = DIRE

const heroes = JSON.parse(fs.readFileSync("dota_assets/heroes.json"))
const items = JSON.parse(fs.readFileSync("dota_assets/items.json"))

const keysByName = (dict) => {
    let out = {}
    for (const item of dict) {
        out[item.name] = item
    }

    return out
}

const keysById = (dict) => {
    let out = {}
    for (const item of dict) {
        out[item.id] = item
    }

    return out
}

const heroesIds = keysById(heroes)
const itemIds = keysById(items)
const heroesNames = keysByName(heroes)
const itemNames = keysByName(items)

exports.heroIdToName = (id) => {
    const hero = heroesIds[id]
    return hero == undefined ? null : hero.name
}
exports.heroIdToLocalisedName = (id) => {
    const hero = heroesIds[id]
    return hero == undefined ? null : hero.localized_name
}
exports.heroNameToLocalisedName = (name) => {
    const hero = heroesIds[name]
    return hero == undefined ? null : hero.localized_name
}

exports.itemIdToName = (id) => itemIds[id].name
exports.itemIdToLocalisedName = (id) => itemIds[id].localized_name
exports.itemNameToLocalisedName = (name) => itemNames[name].localized_name

exports.teamStringToInt = function(team) {
    const lower = team.toLowerCase()
    if (lower === "radiant") {
        return RADIANT
    }
    if (lower === "dire") {
        return DIRE
    }
    return NaN
}

exports.teamIntToString = function(team) {
    if (team === RADIANT) {
        return "radiant"
    }
    if (team == DIRE) {
        return "dire"
    }

    return undefined
}

exports.maskBottom32Bits = function(n) {
        // JS is stupid and can't mask out the bottom bits correctly.
        // convert to 64 bit int to avoid rounding errors
        const binary = BigInt(n).toString(2).padStart(64, '0')

        return parseInt(binary.slice(binary.length - 32, binary.length), 2)
}

// copied from stack overflow
exports.equals = function(x, y) {
    if (x === y) return true;
  
    if (!(x instanceof Object) || !(y instanceof Object)) return false;
  
    if (x.constructor !== y.constructor) return false;
  
    for (var p in x) {
        if (!x.hasOwnProperty(p)) continue;

        if (!y.hasOwnProperty(p)) return false;

        if (x[p] === y[p]) continue;

        if (typeof(x[p]) !== "object") return false;

        if (!exports.equals(x[p], y[p])) return false;
    }
  
    for (p in y) {
        if (y.hasOwnProperty(p) && !x.hasOwnProperty(p)) return false;
    }
    return true;
}

exports.calculateMatchLength = function(duration) {
    const time = Math.round(duration)
    const hours = Math.floor(time / 3600)
    const remainingSeconds = time - hours * 3600

    const minutes = Math.floor(remainingSeconds / 60)
    const seconds = remainingSeconds - minutes * 60

    return {
        hours,
        minutes: padTime(minutes),
        seconds: padTime(seconds)
    }
}

padTime = number => String(number).padStart(2, "0")