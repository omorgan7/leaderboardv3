'use strict'

const mmr = require('../mmr')
const utilities = require('../utilities')
const assert = require('assert')

{
    const oldTeam = []
    for (let i = 0; i < 5; ++i)
    {
        oldTeam.push({
            mmr: 2000,
            game_team: utilities.RADIANT,
            matchCount: 9999,
            winStreak: false,
            lossStreak: false
        })
    }
    for (let i = 0; i < 5; ++i)
    {
        oldTeam.push({
            mmr: 2115,
            game_team: utilities.DIRE,
            matchCount: 9999,
            winStreak: false,
            lossStreak: false
        })
    }


    const winner = utilities.RADIANT

    const updatedTeam = []
    for (let i = 0; i < 5; ++i)
    {
        updatedTeam.push({
            mmr: 2028,
            game_team: utilities.RADIANT,
            matchCount: 9999,
            winStreak: false,
            lossStreak: false
        })
    }
    for (let i = 0; i < 5; ++i)
    {
        updatedTeam.push({
            mmr: 2093,
            game_team: utilities.DIRE,
            matchCount: 9999,
            winStreak: false,
            lossStreak: false
        })
    }

    mmr.updateMmrSystem(oldTeam, winner)

    assert(utilities.equals(oldTeam, updatedTeam))
}

{
    const oldTeam = []
    for (let i = 0; i < 5; ++i)
    {
        oldTeam.push({
            mmr: 2000 + i * 10,
            game_team: utilities.RADIANT,
            matchCount: 9999,
            winStreak: false,
            lossStreak: false
        })
    }
    for (let i = 0; i < 5; ++i)
    {
        oldTeam.push({
            mmr: 2000 - i * 10,
            game_team: utilities.DIRE,
            matchCount: 9999,
            winStreak: false,
            lossStreak: false
        })
    }
    
    const winner = utilities.DIRE

    const updatedTeam = []
    for (let i = 0; i < 5; ++i)
    {
        updatedTeam.push({
            mmr: 1975 + i * 10,
            game_team: utilities.RADIANT,
            matchCount: 9999,
            winStreak: false,
            lossStreak: false
        })
    }
    for (let i = 0; i < 5; ++i)
    {
        updatedTeam.push({
            mmr: 2025 - i * 10,
            game_team: utilities.DIRE,
            matchCount: 9999,
            winStreak: false,
            lossStreak: false
        })
    }

    mmr.updateMmrSystem(oldTeam, winner)

    assert(utilities.equals(oldTeam, updatedTeam))
}