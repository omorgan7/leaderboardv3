'use strict'

const utilities = require('./utilities')

exports.startingMmr = 2000

const baseMmr = 25
const mmrCap = 20
const thresholdFactor = 50

const calibrationFactors = [1.6, 1.5, 1.4, 1.3, 1.2, 1.1]
const mmrChanges = {
    "0": 0,
    "1": 1,
    "2": 3,
    "3": 6,
    "4": 10,
    "5": 15,
    "6": 21,
}
const streakFactor = 1.05

function averageMmr(team) {
    return team.reduce((prev, current) => {
        return prev + current.mmr
    }, 0) / team.length
}

exports.averageMmr = averageMmr

exports.updateMmrSystem = function(players, winner) {

    // split each team into radiant and dire
    const radiant = players.filter(player => player.game_team == utilities.RADIANT)
    const dire = players.filter(player => player.game_team == utilities.DIRE)

    const radiantAvg = averageMmr(radiant)
    const direAvg = averageMmr(dire)

    // this math will be radiant-oriented
    const difference = Math.round(radiantAvg - direAvg)

    // clamp to a maximum of mmrCap - so that the most mmr you can win is 45 and the the least is 5.

    //
    const mmrIncrements = Math.floor(Math.abs(difference) / thresholdFactor)

    const baseChange = Math.min(mmrCap, mmrChanges[mmrIncrements])

    players.forEach((player) => {
        // flip the sign if the game was imbalanced in favour of one team
        let change = baseMmr + (player.game_team == utilities.RADIANT ? baseChange : -baseChange)

        // you should lose mmr if you lost the game.
        change = player.game_team == winner ? change : -change

        // move a _lot_ of mmr if you are calibrating
        if (player.calibration_games > 1) {
            change *= calibrationFactors[player.calibration_games - 1]
            player.calibration_games -= 1
        }
        else if (player.winStreak || player.lossStreak) {
            change *= streakFactor
        }

        // don't accumulate mmr if the player would go negative.
        if (change < 0 && (player.mmr + change) < 1) {
        }
        else {
            player.mmr += change
        }
        console.log(`Updating ${player.id32} with MMR: ${change}`)
    })
}