'use strict'

const spawn = require("child_process")
const fs = require("fs")
const path = require("path")

function fileFromStdOut(stdout) {
    // the file name should be the first line in stdout.
    let fileName = stdout.split("\n")[0]

    // validate stdout
    const matched = /^[\d]+\.json$/.exec(fileName)
    if (matched == null) {
        console.log("Invalid output from stdout from parser:", stdout)
        return null
    }

    return fileName
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

        fs.rename(file, "replays_backup/" + path.basename(tempName), () => {})
        
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