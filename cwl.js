/**
 * Created by porter on 11/15/15.
 */

var YAML = require('js-yaml');

var TYPE_FLOAT = /\bfloat\b/gi;
var TYPE_INT = /\binteger\b|\bint\b/gi;
var TYPE_STRING = /\bstring\b|\bstr\b|\btext\b/gi;
var TYPE_FILE = /\bFILE\b|\(file\)|\<file\>/g;

function input(arg) {
    var type = "boolean";
    var isOptional = true;
    var position = 1;

    if (arg.isOptional !== undefined)
        isOptional = arg.isOptional;

    if (arg.position !== undefined)
        position = arg.position;

    if (arg.type !== undefined) {
        type = arg.type;
    } else {
        if (TYPE_FLOAT.test(arg.descr))
            type = "float";
        else if (TYPE_INT.test(arg.descr))
            type = "int";
        else if (TYPE_STRING.test(arg.descr))
            type = "string";
        else if (TYPE_FILE.test(arg.descr))
            type = "File";
    }
    TYPE_INT.lastIndex = 0;
    TYPE_FLOAT.lastIndex = 0;
    TYPE_STRING.lastIndex = 0;
    var inp = {
        "id": "" + arg.arg.replace(/^[-]{1,2}/g, ''),
        "type": isOptional ? ["null", type] : type,
        "description": arg.descr
    };

    if(arg.inputB === undefined || arg.inputB ) {
        inp["inputBinding"]=  {
            "position": position
        };
        if(arg.prefix === undefined || arg.prefix ) {
            inp["inputBinding"]["prefix"] = arg.arg;
        }
    }
    return inp;
}

function CWL(parsed) {
    var cwl = {
        "cwlVersion": "cwl:draft-3.dev3",
        "class": "CommandLineTool",
        "requirements": [
            {"$import": "envvar-global.cwl" },
            {"$import": parsed.command + "-docker.cwl" },
            {"class": "InlineJavascriptRequirement" }
        ],
        "inputs": [
            {"id": "#stdoutfilename", "type": "string"}
        ],
        "outputs": [
            {
                "id": "#stdoutfile",
                "type": "File",
                "outputBinding": {
                    "glob": "$(inputs.stdoutfilename)"
                }
            }],
        "stdout": "$(inputs.stdoutfilename)",
        "baseCommand": [parsed.command].concat(parsed.c_args.filter(function (v) {
            return !(/(^[\-]{0,2}[Hh]$)|(^[\-]{0,2}[Hh]elp$)/g).test(v);
        })),
        "description": parsed.help.trim()
    };

    var i = 0;
    while (parsed.args && parsed.args.length > i) {
        var arg = parsed.args[i];
        cwl['inputs'].push(input(arg));
        i++;
    }

    return YAML.dump(cwl, 2);
}

module.exports = CWL;
