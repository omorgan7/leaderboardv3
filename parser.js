'use strict'

const spawn = require("child_process")
const fs = require("fs")
const path = require("path")

function fileFromStdOut(stdout) {

    // validate stdout
    const lines = stdout.split('\n')
    const matched = lines.map((line) => /^[\d]+\.json$/.exec(line)).filter((match) => match != null)[0][0]
    if (!matched) {
        console.log("Invalid output from stdout from parser:", stdout)
        return null
    }
    if (lines.length > 1) {
        console.log("Warning - additional output from parser: ", stdout)
    }

    return matched
}

exports.parseReplay = function(fileName, callback) {
    var file = fileName
    const javaParser = spawn.exec("java -jar mjollnir/target/mjollnir.one-jar.jar " + fileName, (err, stdout, stderr) => {
        
        if (err && err.code != 0) {
            callback(err)
            return
        }

        const tempName = fileFromStdOut(stdout)
        if (!tempName)
        {
            callback("Replay parse failed.", null)
            return
        }
        
        const fileName = "replays/" + tempName

        fs.rename(tempName, fileName, (err) => {
            if (err) return callback(err)

            fs.readFile(fileName, "utf8", (err, data) => {
                if (err) return callback(err)
        
                const matchData = JSON.parse(data)
                callback(null, matchData)
            })
        })    
    })
}