const RADIANT = 2
const DIRE = 3

exports.RADIANT = RADIANT
exports.DIRE = DIRE

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