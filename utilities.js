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
    const seconds = String(remainingSeconds - minutes * 60).padStart(2, "0")

    return {
        hours: padTime(hours),
        minutes: padTime(minutes),
        seconds: padTime(seconds)
    }
}

padTime = number => String(number).padStart(2, "0")